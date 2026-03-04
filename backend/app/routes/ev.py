from __future__ import annotations

import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import EVStation, EVSnapshot
from app.ai_predictor import predict_availability, recommend_best_option

router = APIRouter(prefix="/api/ev", tags=["EV Charging"])


def _distance_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _station_status(station: EVStation, snap: EVSnapshot | None) -> dict:
    return {
        "id": station.id,
        "name": station.name,
        "city": station.city,
        "lat": station.lat,
        "lng": station.lng,
        "address": station.address,
        "network": station.network,
        "total_ports": station.total_ports,
        "port_types": station.port_types,
        "available_ports": snap.available_ports if snap else station.total_ports,
        "avg_wait_minutes": snap.avg_wait_minutes if snap else 0,
        "status": "Available" if (snap and snap.available_ports > 0) else ("Queue" if snap and snap.avg_wait_minutes > 0 else "Available"),
        "last_updated": snap.timestamp.isoformat() if snap else None,
    }


@router.get("/stations")
async def list_stations(
    city: str = Query(default="San Francisco"),
    lat: Optional[float] = Query(default=None),
    lng: Optional[float] = Query(default=None),
    radius_km: float = Query(default=5.0),
    db: AsyncSession = Depends(get_db),
):
    stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()

    results = []
    for station in stations:
        snap = (
            await db.execute(
                select(EVSnapshot)
                .where(EVSnapshot.station_id == station.id)
                .order_by(desc(EVSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        data = _station_status(station, snap)

        if lat is not None and lng is not None:
            dist = _distance_km(lat, lng, station.lat, station.lng)
            if dist > radius_km:
                continue
            data["distance_km"] = round(dist, 2)

        results.append(data)

    results.sort(key=lambda x: (-x["available_ports"], x.get("distance_km", 999)))
    return {"stations": results, "count": len(results)}


@router.get("/stations/{station_id}/status")
async def station_status(station_id: str, db: AsyncSession = Depends(get_db)):
    station = await db.get(EVStation, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    snaps = (
        await db.execute(
            select(EVSnapshot)
            .where(EVSnapshot.station_id == station_id)
            .order_by(desc(EVSnapshot.timestamp))
            .limit(48)
        )
    ).scalars().all()

    current = snaps[0] if snaps else None
    history = [
        {"timestamp": s.timestamp.isoformat(), "available_ports": s.available_ports, "avg_wait_minutes": s.avg_wait_minutes}
        for s in reversed(snaps)
    ]
    return {**_station_status(station, current), "history": history}


@router.get("/stations/{station_id}/predict")
async def predict_station(
    station_id: str,
    arrive_at: str = Query(..., description="ISO datetime"),
    db: AsyncSession = Depends(get_db),
):
    station = await db.get(EVStation, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    try:
        target = datetime.fromisoformat(arrive_at)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format.")

    snaps = (
        await db.execute(
            select(EVSnapshot)
            .where(EVSnapshot.station_id == station_id)
            .order_by(desc(EVSnapshot.timestamp))
            .limit(24)
        )
    ).scalars().all()

    snap_dicts = [{"timestamp": s.timestamp.isoformat(), "available_ports": s.available_ports, "avg_wait_minutes": s.avg_wait_minutes} for s in snaps]
    entity = {"id": station.id, "name": station.name, "total_ports": station.total_ports, "network": station.network}

    prediction = await predict_availability("ev", entity, target, snap_dicts)
    return {
        "station_id": station_id,
        "station_name": station.name,
        "arrive_at": arrive_at,
        "predicted_wait_minutes": int(prediction["predicted_value"]),
        "confidence": prediction["confidence"],
        "explanation": prediction["explanation"],
    }


@router.get("/recommend")
async def recommend_ev(
    lat: float = Query(...),
    lng: float = Query(...),
    battery_pct: float = Query(default=20.0, description="Current battery percentage"),
    charge_needed_kwh: float = Query(default=40.0),
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()

    options = []
    for station in stations:
        snap = (
            await db.execute(
                select(EVSnapshot)
                .where(EVSnapshot.station_id == station.id)
                .order_by(desc(EVSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        dist = _distance_km(lat, lng, station.lat, station.lng)
        options.append({
            "id": station.id,
            "name": station.name,
            "distance_km": round(dist, 2),
            "available_ports": snap.available_ports if snap else station.total_ports,
            "avg_wait_minutes": snap.avg_wait_minutes if snap else 0,
            "port_types": station.port_types,
            "network": station.network,
        })

    options.sort(key=lambda x: (x["avg_wait_minutes"], x["distance_km"]))

    user_request = {
        "lat": lat, "lng": lng,
        "battery_pct": battery_pct,
        "charge_needed_kwh": charge_needed_kwh,
    }
    recommendation = await recommend_best_option("ev", options[:8], user_request)
    return {"recommendation": recommendation, "options": options[:10]}
