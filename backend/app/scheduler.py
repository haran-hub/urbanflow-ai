from __future__ import annotations

"""
Background scheduler: generates new snapshots every N minutes
and trims old data (keep last 24h).
"""
import logging
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, delete

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import (
    ParkingZone, ParkingSnapshot,
    EVStation, EVSnapshot,
    TransitRoute, TransitSnapshot,
    LocalService, ServiceSnapshot,
    AirStation, AirSnapshot,
    BikeStation, BikeSnapshot,
    FoodTruck, FoodTruckSnapshot,
    NoiseZone, NoiseSnapshot,
    EmailSubscriber,
)
from app.data_engine import (
    generate_parking_occupancy, generate_ev_wait,
    generate_transit_crowd, generate_service_wait,
    generate_air_quality, generate_bike_availability,
    generate_food_truck, generate_noise_vibe,
)
from app.websocket_manager import manager

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()

OCM_URL = "https://api.openchargemap.io/v3/poi/"
SF_511_URL = "https://api.511.org/transit/VehicleMonitoring"

CITY_CENTERS = {
    "San Francisco": (37.7749, -122.4194),
    "New York":      (40.7128, -74.0060),
    "Austin":        (30.2672, -97.7431),
}

CITY_TIMEZONES = {
    "San Francisco": "America/Los_Angeles",
    "New York": "America/New_York",
    "Austin": "America/Chicago",
}


def _local_now(city: str, utc_now: datetime) -> datetime:
    tz = ZoneInfo(CITY_TIMEZONES.get(city, "UTC"))
    return utc_now.replace(tzinfo=timezone.utc).astimezone(tz)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def _fetch_ocm_city(lat: float, lng: float) -> list[dict]:
    params: dict = {
        "latitude": lat, "longitude": lng,
        "distance": 20, "distanceunit": "km",
        "maxresults": 50,
        "compact": "true", "verbose": "false",
    }
    if settings.ocm_api_key:
        params["key"] = settings.ocm_api_key
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(OCM_URL, params=params)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.warning(f"OCM real-time fetch failed: {e}")
        return []


async def _update_ev_realtime(db, now: datetime) -> list[EVStation]:
    """Fetch live OCM status per city and update EV snapshots."""
    stations = (await db.execute(select(EVStation))).scalars().all()
    if not stations:
        return stations

    # Group stations by city
    city_stations: dict[str, list[EVStation]] = {}
    for s in stations:
        city_stations.setdefault(s.city, []).append(s)

    for city, city_list in city_stations.items():
        center = CITY_CENTERS.get(city)
        if not center:
            # Fallback to simulation for unknown cities
            for station in city_list:
                available, wait = generate_ev_wait({"total_ports": station.total_ports}, _local_now(city, now))
                db.add(EVSnapshot(
                    station_id=station.id, timestamp=now,
                    available_ports=available, avg_wait_minutes=wait,
                ))
            continue

        pois = await _fetch_ocm_city(center[0], center[1])

        # Build a lookup: OCM POI lat/lng → status_id
        ocm_points = []
        for poi in pois:
            addr = poi.get("AddressInfo", {})
            poi_lat = addr.get("Latitude", 0.0)
            poi_lng = addr.get("Longitude", 0.0)
            status_id = (poi.get("StatusType") or {}).get("ID", 50)
            connections = poi.get("Connections") or []
            total_ports = max(len(connections), 1)
            ocm_points.append((poi_lat, poi_lng, status_id, total_ports))

        for station in city_list:
            # Find nearest OCM POI within 0.3 km
            best_status_id = None
            best_dist = float("inf")
            for poi_lat, poi_lng, status_id, _ in ocm_points:
                dist = _haversine_km(station.lat, station.lng, poi_lat, poi_lng)
                if dist < best_dist:
                    best_dist = dist
                    best_status_id = status_id

            if best_dist <= 0.3 and best_status_id is not None:
                if best_status_id == 100:          # Available
                    available = station.total_ports
                    wait = 0
                elif best_status_id in (150, 200):  # Unavailable / removed
                    available = 0
                    wait = 60
                else:                               # Operational (50) — use simulation
                    available, wait = generate_ev_wait({"total_ports": station.total_ports}, _local_now(station.city, now))
            else:
                # No nearby OCM match — simulate
                available, wait = generate_ev_wait({"total_ports": station.total_ports}, _local_now(station.city, now))

            db.add(EVSnapshot(
                station_id=station.id, timestamp=now,
                available_ports=available, avg_wait_minutes=wait,
            ))

    return stations


async def _update_transit_realtime(db, now: datetime) -> list[TransitRoute]:
    """Update transit snapshots using 511.org for SF if key set, else simulate."""
    routes = (await db.execute(select(TransitRoute))).scalars().all()

    sf_delays: dict[str, int] = {}

    if settings.api_511_key:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(SF_511_URL, params={
                    "api_key": settings.api_511_key,
                    "agency": "SF",
                    "format": "json",
                })
                resp.raise_for_status()
                data = resp.json()
            activities = (
                data.get("Siri", {})
                    .get("ServiceDelivery", {})
                    .get("VehicleMonitoringDelivery", {})
                    .get("VehicleActivity", [])
            )
            for activity in activities:
                journey = activity.get("MonitoredVehicleJourney", {})
                line = journey.get("LineRef", "")
                delay_raw = journey.get("Delay", "PT0S")
                # Parse ISO 8601 duration PT{n}S or PT{n}M
                delay_mins = 0
                if isinstance(delay_raw, str):
                    import re
                    m = re.search(r"PT(\d+)M", delay_raw)
                    if m:
                        delay_mins = int(m.group(1))
                    else:
                        s = re.search(r"PT(\d+)S", delay_raw)
                        if s:
                            delay_mins = int(s.group(1)) // 60
                if line:
                    sf_delays[line] = max(sf_delays.get(line, 0), delay_mins)
        except Exception as e:
            logger.warning(f"511 real-time fetch failed: {e}")

    for route in routes:
        crowd, delay, next_arr = generate_transit_crowd(
            {"frequency_mins": route.frequency_mins, "route_type": route.route_type}, _local_now(route.city, now)
        )
        # Override delay for SF routes if 511 data available
        if route.city == "San Francisco" and sf_delays:
            for line_ref, real_delay in sf_delays.items():
                if line_ref.lower() in route.name.lower():
                    delay = real_delay
                    break
        db.add(TransitSnapshot(
            route_id=route.id, timestamp=now,
            occupancy_level=crowd, delay_minutes=delay,
            next_arrival_mins=next_arr,
        ))

    return routes


async def update_city_snapshots(city: str, db) -> None:
    """
    Regenerate snapshots for a single city using simulation (no external API calls).
    Called on-demand when a user request comes in for that city.
    """
    now = datetime.utcnow()
    local = _local_now(city, now)

    zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()
    for zone in zones:
        occ, available = generate_parking_occupancy(
            {"total_spots": zone.total_spots, "zone_type": zone.zone_type}, local
        )
        db.add(ParkingSnapshot(zone_id=zone.id, timestamp=now, available_spots=available, occupancy_pct=occ))

    stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()
    for st in stations:
        available, wait = generate_ev_wait({"total_ports": st.total_ports}, local)
        db.add(EVSnapshot(station_id=st.id, timestamp=now, available_ports=available, avg_wait_minutes=wait))

    routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()
    for r in routes:
        crowd, delay, next_arr = generate_transit_crowd(
            {"frequency_mins": r.frequency_mins, "route_type": r.route_type}, local
        )
        db.add(TransitSnapshot(route_id=r.id, timestamp=now, occupancy_level=crowd, delay_minutes=delay, next_arrival_mins=next_arr))

    services = (await db.execute(select(LocalService).where(LocalService.city == city))).scalars().all()
    for sv in services:
        wait, queue, is_open = generate_service_wait(
            {"category": sv.category, "typical_hours": sv.typical_hours}, local
        )
        db.add(ServiceSnapshot(service_id=sv.id, timestamp=now, estimated_wait_minutes=wait, queue_length=queue, is_open=is_open))

    air_stations = (await db.execute(select(AirStation).where(AirStation.city == city))).scalars().all()
    for ast in air_stations:
        aqi, pm25, pm10, o3, pollen, uv, cat = generate_air_quality({}, local)
        db.add(AirSnapshot(station_id=ast.id, timestamp=now, aqi=aqi, pm25=pm25, pm10=pm10, o3=o3, pollen_level=pollen, uv_index=uv, category=cat))

    bike_stations = (await db.execute(select(BikeStation).where(BikeStation.city == city))).scalars().all()
    for bs in bike_stations:
        bikes, ebikes, docks, renting = generate_bike_availability({"total_docks": bs.total_docks}, local)
        db.add(BikeSnapshot(station_id=bs.id, timestamp=now, available_bikes=bikes, available_ebikes=ebikes, available_docks=docks, is_renting=renting))

    trucks = (await db.execute(select(FoodTruck).where(FoodTruck.city == city))).scalars().all()
    for t in trucks:
        is_open, wait_min, crowd = generate_food_truck({"typical_hours": t.typical_hours}, local)
        db.add(FoodTruckSnapshot(truck_id=t.id, timestamp=now, is_open=is_open, wait_minutes=wait_min, crowd_level=crowd))

    noise_zones = (await db.execute(select(NoiseZone).where(NoiseZone.city == city))).scalars().all()
    for nz in noise_zones:
        noise_db_val, vibe, crowd, label = generate_noise_vibe({"zone_type": nz.zone_type}, local)
        db.add(NoiseSnapshot(zone_id=nz.id, timestamp=now, noise_db=noise_db_val, vibe_score=vibe, crowd_density=crowd, vibe_label=label))

    await db.commit()


async def _update_snapshots():
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=24)

    async with AsyncSessionLocal() as db:
        # ── Parking (simulation — no free real-time API) ────────────────────────
        zones = (await db.execute(select(ParkingZone))).scalars().all()
        for zone in zones:
            occ, available = generate_parking_occupancy(
                {"total_spots": zone.total_spots, "zone_type": zone.zone_type}, _local_now(zone.city, now)
            )
            db.add(ParkingSnapshot(
                zone_id=zone.id, timestamp=now,
                available_spots=available, occupancy_pct=occ,
            ))

        # ── EV (real OCM status where available, else simulate) ─────────────────
        stations = await _update_ev_realtime(db, now)

        # ── Transit (real 511.org for SF if key set, else simulate) ────────────
        routes = await _update_transit_realtime(db, now)

        # ── Services (simulation — no free real-time API) ───────────────────────
        services = (await db.execute(select(LocalService))).scalars().all()
        for service in services:
            wait, queue, is_open = generate_service_wait(
                {"category": service.category, "typical_hours": service.typical_hours}, _local_now(service.city, now)
            )
            db.add(ServiceSnapshot(
                service_id=service.id, timestamp=now,
                estimated_wait_minutes=wait,
                queue_length=queue, is_open=is_open,
            ))

        # ── Air Quality (simulation) ────────────────────────────────────────────
        air_stations = (await db.execute(select(AirStation))).scalars().all()
        for air_station in air_stations:
            aqi, pm25, pm10, o3, pollen_level, uv_index, category = generate_air_quality(
                {}, _local_now(air_station.city, now)
            )
            db.add(AirSnapshot(
                station_id=air_station.id, timestamp=now,
                aqi=aqi, pm25=pm25, pm10=pm10, o3=o3,
                pollen_level=pollen_level, uv_index=uv_index, category=category,
            ))

        # ── Bike Share (simulation) ─────────────────────────────────────────────
        bike_stations = (await db.execute(select(BikeStation))).scalars().all()
        for bike_station in bike_stations:
            available_bikes, available_ebikes, available_docks, is_renting = generate_bike_availability(
                {"total_docks": bike_station.total_docks}, _local_now(bike_station.city, now)
            )
            db.add(BikeSnapshot(
                station_id=bike_station.id, timestamp=now,
                available_bikes=available_bikes,
                available_ebikes=available_ebikes,
                available_docks=available_docks,
                is_renting=is_renting,
            ))

        # ── Food Trucks (simulation) ────────────────────────────────────────────
        food_trucks = (await db.execute(select(FoodTruck))).scalars().all()
        for truck in food_trucks:
            is_open, wait_minutes, crowd_level = generate_food_truck(
                {"typical_hours": truck.typical_hours}, _local_now(truck.city, now)
            )
            db.add(FoodTruckSnapshot(
                truck_id=truck.id, timestamp=now,
                is_open=is_open, wait_minutes=wait_minutes, crowd_level=crowd_level,
            ))

        # ── Noise & Vibe (simulation) ───────────────────────────────────────────
        noise_zones = (await db.execute(select(NoiseZone))).scalars().all()
        for noise_zone in noise_zones:
            noise_db, vibe_score, crowd_density, vibe_label = generate_noise_vibe(
                {"zone_type": noise_zone.zone_type}, _local_now(noise_zone.city, now)
            )
            db.add(NoiseSnapshot(
                zone_id=noise_zone.id, timestamp=now,
                noise_db=noise_db, vibe_score=vibe_score,
                crowd_density=crowd_density, vibe_label=vibe_label,
            ))

        await db.commit()

        # ── Trim old snapshots ─────────────────────────────────────────────────
        for model in (
            ParkingSnapshot, EVSnapshot, TransitSnapshot, ServiceSnapshot,
            AirSnapshot, BikeSnapshot, FoodTruckSnapshot, NoiseSnapshot,
        ):
            await db.execute(delete(model).where(model.timestamp < cutoff))
        await db.commit()

    # Broadcast city-wide update
    cities = {z.city for z in zones}
    for city in cities:
        await manager.broadcast_to_city(city, {
            "type": "snapshot_update",
            "city": city,
            "timestamp": now.isoformat(),
        })

    logger.info(f"Snapshots updated at {now.isoformat()}")


async def _send_daily_briefings():
    """Daily 7am job: fetch AI briefing for each city and email subscribers via Resend."""
    if not settings.resend_api_key:
        return

    try:
        import resend
        resend.api_key = settings.resend_api_key
    except ImportError:
        logger.warning("resend package not installed — skipping daily briefings")
        return

    cities = ["San Francisco", "New York", "Austin"]
    for city in cities:
        # Fetch briefing by calling the local API
        briefing_text = ""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    "http://localhost:8000/api/briefing/today",
                    params={"city": city},
                )
                resp.raise_for_status()
                data = resp.json()
                briefing_text = data.get("briefing", "")
        except Exception as e:
            logger.warning(f"Briefing fetch failed for {city}: {e}")
            briefing_text = f"Morning update for {city} — visit urbanflow-ai.com for live city intelligence."

        async with AsyncSessionLocal() as db:
            subscribers = (
                await db.execute(
                    select(EmailSubscriber).where(EmailSubscriber.city == city)
                )
            ).scalars().all()

        for sub in subscribers:
            unsubscribe_url = (
                f"https://urbanflow-ai.onrender.com/api/subscribe/unsubscribe"
                f"?token={sub.unsubscribe_token}"
            )
            html_body = f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
<h2 style="color:#3b82f6">UrbanFlow AI — {city} Morning Brief</h2>
<div style="background:#f8fafc;border-radius:12px;padding:20px;white-space:pre-wrap;color:#1e293b">{briefing_text}</div>
<hr style="margin:24px 0;border-color:#e2e8f0">
<p style="color:#94a3b8;font-size:12px">
  <a href="{unsubscribe_url}" style="color:#94a3b8">Unsubscribe</a> · UrbanFlow AI
</p>
</div>"""
            try:
                resend.Emails.send({
                    "from": "UrbanFlow AI <brief@urbanflow-ai.com>",
                    "to": sub.email,
                    "subject": f"Your {city} Morning Brief",
                    "html": html_body,
                })
            except Exception as e:
                logger.warning(f"Email send failed to {sub.email}: {e}")

    logger.info("Daily briefings sent")


def start_scheduler():
    scheduler.add_job(
        _update_snapshots,
        "interval",
        minutes=settings.snapshot_interval_minutes,
        id="snapshot_update",
        replace_existing=True,
        next_run_time=datetime.utcnow(),  # run immediately on startup
    )
    scheduler.add_job(
        _send_daily_briefings,
        "cron",
        hour=7,
        minute=0,
        id="daily_briefings",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started (interval: {settings.snapshot_interval_minutes} min)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
