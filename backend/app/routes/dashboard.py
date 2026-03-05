from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import (
    ParkingZone, ParkingSnapshot,
    EVStation, EVSnapshot,
    TransitRoute, TransitSnapshot,
    LocalService, ServiceSnapshot,
    AirStation, AirSnapshot,
    BikeStation, BikeSnapshot,
    FoodTruck, FoodTruckSnapshot,
    NoiseZone, NoiseSnapshot,
)
from app.ai_predictor import generate_urban_plan, find_best_time

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


async def _latest_snap(db, model, fk_field, entity_id):
    snap = (
        await db.execute(
            select(model)
            .where(getattr(model, fk_field) == entity_id)
            .order_by(desc(model.timestamp))
            .limit(1)
        )
    ).scalar_one_or_none()
    return snap


@router.get("/overview")
async def overview(
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    # Parking summary
    zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()
    parking_available = 0
    parking_total = 0
    for zone in zones:
        snap = await _latest_snap(db, ParkingSnapshot, "zone_id", zone.id)
        parking_total += zone.total_spots
        parking_available += snap.available_spots if snap else zone.total_spots

    # EV summary
    stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()
    ev_available = 0
    ev_total = 0
    ev_avg_wait = 0
    for station in stations:
        snap = await _latest_snap(db, EVSnapshot, "station_id", station.id)
        ev_total += station.total_ports
        ev_available += snap.available_ports if snap else station.total_ports
        if snap:
            ev_avg_wait += snap.avg_wait_minutes
    ev_avg_wait = round(ev_avg_wait / len(stations), 1) if stations else 0

    # Transit summary
    routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()
    transit_avg_crowd = 0
    transit_delayed = 0
    for route in routes:
        snap = await _latest_snap(db, TransitSnapshot, "route_id", route.id)
        if snap:
            transit_avg_crowd += snap.occupancy_level
            if snap.delay_minutes > 3:
                transit_delayed += 1
    transit_avg_crowd = round(transit_avg_crowd / len(routes)) if routes else 0

    # Services summary
    services = (await db.execute(select(LocalService).where(LocalService.city == city))).scalars().all()
    services_open = 0
    services_avg_wait = 0
    for service in services:
        snap = await _latest_snap(db, ServiceSnapshot, "service_id", service.id)
        if snap and snap.is_open:
            services_open += 1
            services_avg_wait += snap.estimated_wait_minutes
    services_avg_wait = round(services_avg_wait / services_open) if services_open else 0

    # Air Quality summary
    air_stations = (await db.execute(select(AirStation).where(AirStation.city == city))).scalars().all()
    air_aqi_total = 0
    air_count = 0
    air_category = "Good"
    for air_station in air_stations:
        snap = await _latest_snap(db, AirSnapshot, "station_id", air_station.id)
        if snap:
            air_aqi_total += snap.aqi
            air_count += 1
            air_category = snap.category
    air_avg_aqi = round(air_aqi_total / air_count) if air_count else 0

    # Bikes summary
    bike_stations = (await db.execute(select(BikeStation).where(BikeStation.city == city))).scalars().all()
    bikes_available = 0
    for bike_station in bike_stations:
        snap = await _latest_snap(db, BikeSnapshot, "station_id", bike_station.id)
        if snap:
            bikes_available += snap.available_bikes + snap.available_ebikes

    # Food Trucks summary
    food_trucks = (await db.execute(select(FoodTruck).where(FoodTruck.city == city))).scalars().all()
    trucks_open = 0
    for truck in food_trucks:
        snap = await _latest_snap(db, FoodTruckSnapshot, "truck_id", truck.id)
        if snap and snap.is_open:
            trucks_open += 1

    # Noise & Vibe summary
    noise_zones = (await db.execute(select(NoiseZone).where(NoiseZone.city == city))).scalars().all()
    noise_vibe_total = 0
    noise_count = 0
    hottest_zone = ""
    hottest_score = -1
    for noise_zone in noise_zones:
        snap = await _latest_snap(db, NoiseSnapshot, "zone_id", noise_zone.id)
        if snap:
            noise_vibe_total += snap.vibe_score
            noise_count += 1
            if snap.vibe_score > hottest_score:
                hottest_score = snap.vibe_score
                hottest_zone = noise_zone.name
    avg_vibe = round(noise_vibe_total / noise_count) if noise_count else 0

    now = datetime.utcnow()
    _CITY_TIMEZONES = {
        "San Francisco": "America/Los_Angeles",
        "New York": "America/New_York",
        "Austin": "America/Chicago",
    }
    local_now = now.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(_CITY_TIMEZONES.get(city, "UTC")))
    hour = local_now.hour
    if 7 <= hour < 9 or 17 <= hour < 19:
        rush_status = "Peak Rush Hour"
    elif 9 <= hour < 17:
        rush_status = "Normal Hours"
    else:
        rush_status = "Off-Peak"

    return {
        "city": city,
        "timestamp": now.isoformat() + "Z",
        "rush_status": rush_status,
        "parking": {
            "total_spots": parking_total,
            "available_spots": parking_available,
            "occupancy_pct": round((1 - parking_available / parking_total) * 100, 1) if parking_total else 0,
            "zones_count": len(zones),
        },
        "ev_charging": {
            "total_ports": ev_total,
            "available_ports": ev_available,
            "avg_wait_minutes": ev_avg_wait,
            "stations_count": len(stations),
        },
        "transit": {
            "routes_count": len(routes),
            "avg_crowd_level": transit_avg_crowd,
            "delayed_routes": transit_delayed,
            "crowd_label": "Packed" if transit_avg_crowd > 80 else "Busy" if transit_avg_crowd > 60 else "Comfortable",
        },
        "services": {
            "total": len(services),
            "open_now": services_open,
            "avg_wait_minutes": services_avg_wait,
        },
        "air_quality": {
            "avg_aqi": air_avg_aqi,
            "category": air_category,
            "stations_count": len(air_stations),
        },
        "bikes": {
            "total_available": bikes_available,
            "stations_count": len(bike_stations),
        },
        "food_trucks": {
            "open_count": trucks_open,
            "total": len(food_trucks),
        },
        "noise_vibe": {
            "avg_vibe": avg_vibe,
            "hottest_zone": hottest_zone,
            "zones_count": len(noise_zones),
        },
    }


class UrbanPlanRequest(BaseModel):
    lat: float
    lng: float
    city: str = "San Francisco"
    needs: list[str]  # e.g. ["parking", "ev", "transit"]
    depart_at: str    # ISO datetime


@router.post("/ai-plan")
async def ai_plan(request: UrbanPlanRequest, db: AsyncSession = Depends(get_db)):
    all_options: dict = {}

    if "parking" in request.needs:
        zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == request.city))).scalars().all()
        parking_opts = []
        for zone in zones[:5]:
            snap = await _latest_snap(db, ParkingSnapshot, "zone_id", zone.id)
            parking_opts.append({
                "id": zone.id, "name": zone.name, "zone_type": zone.zone_type,
                "available_spots": snap.available_spots if snap else zone.total_spots,
                "hourly_rate": zone.hourly_rate,
            })
        all_options["parking"] = parking_opts

    if "ev" in request.needs:
        stations = (await db.execute(select(EVStation).where(EVStation.city == request.city))).scalars().all()
        ev_opts = []
        for station in stations[:5]:
            snap = await _latest_snap(db, EVSnapshot, "station_id", station.id)
            ev_opts.append({
                "id": station.id, "name": station.name,
                "available_ports": snap.available_ports if snap else station.total_ports,
                "avg_wait_minutes": snap.avg_wait_minutes if snap else 0,
            })
        all_options["ev"] = ev_opts

    if "transit" in request.needs:
        routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == request.city))).scalars().all()
        transit_opts = []
        for route in routes[:5]:
            snap = await _latest_snap(db, TransitSnapshot, "route_id", route.id)
            transit_opts.append({
                "id": route.id, "name": route.name, "route_type": route.route_type,
                "occupancy_level": snap.occupancy_level if snap else 0,
                "next_arrival_mins": snap.next_arrival_mins if snap else route.frequency_mins,
            })
        all_options["transit"] = transit_opts

    if "services" in request.needs:
        svcs = (await db.execute(select(LocalService).where(LocalService.city == request.city))).scalars().all()
        svc_opts = []
        for svc in svcs[:5]:
            snap = await _latest_snap(db, ServiceSnapshot, "service_id", svc.id)
            svc_opts.append({
                "id": svc.id, "name": svc.name, "category": svc.category,
                "estimated_wait_minutes": snap.estimated_wait_minutes if snap else 0,
                "is_open": snap.is_open if snap else True,
            })
        all_options["services"] = svc_opts

    location = {"lat": request.lat, "lng": request.lng, "city": request.city}
    plan = await generate_urban_plan(location, request.needs, request.depart_at, all_options)
    return {"plan": plan, "generated_at": datetime.utcnow().isoformat() + "Z"}


@router.get("/compare")
async def compare_cities(db: AsyncSession = Depends(get_db)):
    """Side-by-side comparison of all 3 cities across key metrics."""
    CITIES = ["San Francisco", "New York", "Austin"]
    result = {}

    for city in CITIES:
        # Parking
        zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()
        total_spots = sum(z.total_spots for z in zones)
        avail_spots = 0
        for z in zones:
            s = await _latest_snap(db, ParkingSnapshot, "zone_id", z.id)
            avail_spots += s.available_spots if s else z.total_spots
        park_occ = round((1 - avail_spots / total_spots) * 100, 1) if total_spots else 0

        # EV
        stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()
        ev_avail = 0
        ev_wait = 0
        for st in stations:
            s = await _latest_snap(db, EVSnapshot, "station_id", st.id)
            if s:
                ev_avail += s.available_ports
                ev_wait += s.avg_wait_minutes
        ev_avg_wait = round(ev_wait / len(stations), 1) if stations else 0

        # Transit
        routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()
        crowd_total = 0
        delayed = 0
        for r in routes:
            s = await _latest_snap(db, TransitSnapshot, "route_id", r.id)
            if s:
                crowd_total += s.occupancy_level
                if s.delay_minutes > 3:
                    delayed += 1
        avg_crowd = round(crowd_total / len(routes)) if routes else 0

        # Air
        air_sts = (await db.execute(select(AirStation).where(AirStation.city == city))).scalars().all()
        aqi_total = 0
        air_cat = "N/A"
        for a in air_sts:
            s = await _latest_snap(db, AirSnapshot, "station_id", a.id)
            if s:
                aqi_total += s.aqi
                air_cat = s.category
        avg_aqi = round(aqi_total / len(air_sts)) if air_sts else 0

        # Bikes
        bss = (await db.execute(select(BikeStation).where(BikeStation.city == city))).scalars().all()
        bikes_avail = 0
        for bs in bss:
            s = await _latest_snap(db, BikeSnapshot, "station_id", bs.id)
            if s:
                bikes_avail += s.available_bikes + s.available_ebikes

        # Vibe
        nzs = (await db.execute(select(NoiseZone).where(NoiseZone.city == city))).scalars().all()
        vibe_total = 0
        vibe_count = 0
        for nz in nzs:
            s = await _latest_snap(db, NoiseSnapshot, "zone_id", nz.id)
            if s:
                vibe_total += s.vibe_score
                vibe_count += 1
        avg_vibe = round(vibe_total / vibe_count) if vibe_count else 0

        result[city] = {
            "parking_occupancy_pct": park_occ,
            "parking_available": avail_spots,
            "ev_available_ports": ev_avail,
            "ev_avg_wait_min": ev_avg_wait,
            "transit_crowd_pct": avg_crowd,
            "transit_delayed": delayed,
            "air_aqi": avg_aqi,
            "air_category": air_cat,
            "bikes_available": bikes_avail,
            "vibe_score": avg_vibe,
        }

    # Determine winners per metric (lower is better for occupancy/wait/crowd/aqi; higher is better for avail/vibe)
    metrics_lower_better = ["parking_occupancy_pct", "ev_avg_wait_min", "transit_crowd_pct", "transit_delayed", "air_aqi"]
    metrics_higher_better = ["ev_available_ports", "parking_available", "bikes_available", "vibe_score"]
    winners: dict[str, str] = {}
    for m in metrics_lower_better:
        best_city = min(CITIES, key=lambda c: result[c][m])
        winners[m] = best_city
    for m in metrics_higher_better:
        best_city = max(CITIES, key=lambda c: result[c][m])
        winners[m] = best_city

    return {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "cities": result,
        "winners": winners,
    }


@router.get("/best-time")
async def best_time(
    entity_type: str = Query(..., description="parking / ev / transit / service"),
    entity_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    entity_map = {
        "parking": (ParkingZone, {}),
        "ev": (EVStation, {}),
        "transit": (TransitRoute, {}),
        "service": (LocalService, {}),
    }
    if entity_type not in entity_map:
        return JSONResponse(status_code=400, content={"detail": "Invalid entity_type"})

    model_class, _ = entity_map[entity_type]
    entity = await db.get(model_class, entity_id)
    if not entity:
        return JSONResponse(status_code=404, content={"detail": "Entity not found"})

    entity_dict = {c.name: getattr(entity, c.name) for c in entity.__table__.columns}
    result = await find_best_time(entity_type, entity_dict)
    return {"entity_type": entity_type, "entity_id": entity_id, **result}
