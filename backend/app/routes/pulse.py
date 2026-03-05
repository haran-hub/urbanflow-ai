from __future__ import annotations

"""
Urban Pulse Score — composite 0-100 livability index computed from all 8 domains.
Higher = better conditions in the city right now.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, Query
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

router = APIRouter(prefix="/api/pulse", tags=["Pulse"])


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


def _clamp(v: float, lo: float = 0, hi: float = 100) -> float:
    return max(lo, min(hi, v))


@router.get("/score")
async def pulse_score(
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a composite Urban Pulse Score (0–100) and per-domain breakdown.
    Weights:
      Parking    15%  — low occupancy = good
      EV         15%  — available ports + low wait = good
      Transit    15%  — low crowd + no delays = good
      Services   10%  — open + low wait = good
      Air        20%  — low AQI = good
      Bikes      10%  — bikes available = good
      Food       5%   — trucks open = good
      Vibe       10%  — high vibe = good
    """
    scores: dict[str, float] = {}
    details: dict[str, dict] = {}

    # ── Parking (15%) ──────────────────────────────────────────
    zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()
    if zones:
        total = sum(z.total_spots for z in zones)
        avail = 0
        for z in zones:
            s = await _latest_snap(db, ParkingSnapshot, "zone_id", z.id)
            avail += s.available_spots if s else z.total_spots
        occ_pct = 1 - (avail / total) if total else 0
        parking_score = _clamp((1 - occ_pct) * 100)
        scores["parking"] = parking_score
        details["parking"] = {"available": avail, "total": total, "score": round(parking_score)}
    else:
        scores["parking"] = 50
        details["parking"] = {"available": 0, "total": 0, "score": 50}

    # ── EV (15%) ───────────────────────────────────────────────
    stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()
    if stations:
        ev_avail = 0
        ev_total = 0
        ev_wait_total = 0
        for st in stations:
            s = await _latest_snap(db, EVSnapshot, "station_id", st.id)
            ev_total += st.total_ports
            ev_avail += s.available_ports if s else st.total_ports
            if s:
                ev_wait_total += s.avg_wait_minutes
        avail_score = (ev_avail / ev_total * 100) if ev_total else 50
        avg_wait = ev_wait_total / len(stations)
        wait_score = _clamp(100 - avg_wait * 2)  # 30 min wait → 40 score
        ev_score = avail_score * 0.7 + wait_score * 0.3
        scores["ev"] = ev_score
        details["ev"] = {"available_ports": ev_avail, "avg_wait_min": round(avg_wait, 1), "score": round(ev_score)}
    else:
        scores["ev"] = 50
        details["ev"] = {"available_ports": 0, "avg_wait_min": 0, "score": 50}

    # ── Transit (15%) ─────────────────────────────────────────
    routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()
    if routes:
        crowd_total = 0
        delayed = 0
        for r in routes:
            s = await _latest_snap(db, TransitSnapshot, "route_id", r.id)
            if s:
                crowd_total += s.occupancy_level
                if s.delay_minutes > 3:
                    delayed += 1
        avg_crowd = crowd_total / len(routes)
        crowd_score = _clamp(100 - avg_crowd)
        delay_penalty = (delayed / len(routes)) * 30
        transit_score = _clamp(crowd_score - delay_penalty)
        scores["transit"] = transit_score
        details["transit"] = {"avg_crowd": round(avg_crowd), "delayed_routes": delayed, "score": round(transit_score)}
    else:
        scores["transit"] = 50
        details["transit"] = {"avg_crowd": 0, "delayed_routes": 0, "score": 50}

    # ── Services (10%) ────────────────────────────────────────
    svcs = (await db.execute(select(LocalService).where(LocalService.city == city))).scalars().all()
    if svcs:
        open_count = 0
        wait_total = 0
        for sv in svcs:
            s = await _latest_snap(db, ServiceSnapshot, "service_id", sv.id)
            if s and s.is_open:
                open_count += 1
                wait_total += s.estimated_wait_minutes
        open_ratio = open_count / len(svcs)
        avg_wait = wait_total / open_count if open_count else 0
        wait_score = _clamp(100 - avg_wait * 1.5)
        svc_score = open_ratio * 60 + wait_score * 0.4
        scores["services"] = _clamp(svc_score)
        details["services"] = {"open": open_count, "total": len(svcs), "avg_wait_min": round(avg_wait), "score": round(svc_score)}
    else:
        scores["services"] = 50
        details["services"] = {"open": 0, "total": 0, "avg_wait_min": 0, "score": 50}

    # ── Air Quality (20%) ─────────────────────────────────────
    air_stations = (await db.execute(select(AirStation).where(AirStation.city == city))).scalars().all()
    if air_stations:
        aqi_total = 0
        aqi_count = 0
        category = "Good"
        for ast in air_stations:
            s = await _latest_snap(db, AirSnapshot, "station_id", ast.id)
            if s:
                aqi_total += s.aqi
                aqi_count += 1
                category = s.category
        avg_aqi = aqi_total / aqi_count if aqi_count else 0
        # AQI: 0-50=Good(100), 51-100=Moderate(70), 101-150=USG(40), 150+=Poor(10)
        if avg_aqi <= 50:
            air_score = 100
        elif avg_aqi <= 100:
            air_score = 100 - (avg_aqi - 50)
        elif avg_aqi <= 150:
            air_score = 50 - (avg_aqi - 100) * 0.8
        else:
            air_score = max(0, 10 - (avg_aqi - 150) * 0.1)
        scores["air"] = _clamp(air_score)
        details["air"] = {"avg_aqi": round(avg_aqi), "category": category, "score": round(air_score)}
    else:
        scores["air"] = 70
        details["air"] = {"avg_aqi": 0, "category": "Unknown", "score": 70}

    # ── Bikes (10%) ───────────────────────────────────────────
    bike_stations = (await db.execute(select(BikeStation).where(BikeStation.city == city))).scalars().all()
    if bike_stations:
        bikes_avail = 0
        total_docks = 0
        for bs in bike_stations:
            s = await _latest_snap(db, BikeSnapshot, "station_id", bs.id)
            total_docks += bs.total_docks
            if s:
                bikes_avail += s.available_bikes + s.available_ebikes
        bike_score = _clamp((bikes_avail / total_docks * 100) * 1.5) if total_docks else 50
        scores["bikes"] = bike_score
        details["bikes"] = {"available": bikes_avail, "score": round(bike_score)}
    else:
        scores["bikes"] = 50
        details["bikes"] = {"available": 0, "score": 50}

    # ── Food Trucks (5%) ──────────────────────────────────────
    trucks = (await db.execute(select(FoodTruck).where(FoodTruck.city == city))).scalars().all()
    if trucks:
        open_trucks = 0
        for t in trucks:
            s = await _latest_snap(db, FoodTruckSnapshot, "truck_id", t.id)
            if s and s.is_open:
                open_trucks += 1
        food_score = _clamp(open_trucks / len(trucks) * 100)
        scores["food_trucks"] = food_score
        details["food_trucks"] = {"open": open_trucks, "total": len(trucks), "score": round(food_score)}
    else:
        scores["food_trucks"] = 50
        details["food_trucks"] = {"open": 0, "total": 0, "score": 50}

    # ── Vibe (10%) ────────────────────────────────────────────
    noise_zones = (await db.execute(select(NoiseZone).where(NoiseZone.city == city))).scalars().all()
    if noise_zones:
        vibe_total = 0
        vibe_count = 0
        for nz in noise_zones:
            s = await _latest_snap(db, NoiseSnapshot, "zone_id", nz.id)
            if s:
                vibe_total += s.vibe_score
                vibe_count += 1
        avg_vibe = vibe_total / vibe_count if vibe_count else 50
        scores["vibe"] = _clamp(avg_vibe)
        details["vibe"] = {"avg_vibe": round(avg_vibe), "score": round(avg_vibe)}
    else:
        scores["vibe"] = 50
        details["vibe"] = {"avg_vibe": 50, "score": 50}

    # ── Composite Score ───────────────────────────────────────
    WEIGHTS = {
        "parking":    0.15,
        "ev":         0.15,
        "transit":    0.15,
        "services":   0.10,
        "air":        0.20,
        "bikes":      0.10,
        "food_trucks": 0.05,
        "vibe":       0.10,
    }
    composite = sum(scores[k] * WEIGHTS[k] for k in WEIGHTS)
    composite = round(_clamp(composite))

    # Label
    if composite >= 80:
        label = "Excellent"
        color = "#22c55e"
    elif composite >= 65:
        label = "Good"
        color = "#3b82f6"
    elif composite >= 50:
        label = "Fair"
        color = "#f59e0b"
    else:
        label = "Stressed"
        color = "#ef4444"

    return {
        "city": city,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "pulse_score": composite,
        "label": label,
        "color": color,
        "breakdown": details,
        "weights": WEIGHTS,
    }
