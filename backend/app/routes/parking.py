from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import ParkingZone, ParkingSnapshot
from app.ai_predictor import predict_availability, recommend_best_option

router = APIRouter(prefix="/api/parking", tags=["Parking"])


def _distance_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _zone_status(zone: ParkingZone, snap: ParkingSnapshot | None) -> dict:
    return {
        "id": zone.id,
        "name": zone.name,
        "city": zone.city,
        "lat": zone.lat,
        "lng": zone.lng,
        "address": zone.address,
        "zone_type": zone.zone_type,
        "hourly_rate": zone.hourly_rate,
        "total_spots": zone.total_spots,
        "available_spots": snap.available_spots if snap else zone.total_spots,
        "occupancy_pct": round(snap.occupancy_pct * 100, 1) if snap else 0.0,
        "last_updated": snap.timestamp.isoformat() + "Z" if snap else None,
    }


@router.get("/zones")
async def list_zones(
    city: str = Query(default="San Francisco"),
    lat: Optional[float] = Query(default=None),
    lng: Optional[float] = Query(default=None),
    radius_km: float = Query(default=5.0),
    db: AsyncSession = Depends(get_db),
):
    zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()

    results = []
    for zone in zones:
        snap = (
            await db.execute(
                select(ParkingSnapshot)
                .where(ParkingSnapshot.zone_id == zone.id)
                .order_by(desc(ParkingSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        data = _zone_status(zone, snap)

        if lat is not None and lng is not None:
            dist = _distance_km(lat, lng, zone.lat, zone.lng)
            if dist > radius_km:
                continue
            data["distance_km"] = round(dist, 2)

        results.append(data)

    results.sort(key=lambda x: x.get("occupancy_pct", 100))
    return {"zones": results, "count": len(results)}


@router.get("/zones/{zone_id}/status")
async def zone_status(zone_id: str, db: AsyncSession = Depends(get_db)):
    zone = await db.get(ParkingZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    snaps = (
        await db.execute(
            select(ParkingSnapshot)
            .where(ParkingSnapshot.zone_id == zone_id)
            .order_by(desc(ParkingSnapshot.timestamp))
            .limit(48)
        )
    ).scalars().all()

    current = snaps[0] if snaps else None
    history = [
        {"timestamp": s.timestamp.isoformat() + "Z", "available_spots": s.available_spots, "occupancy_pct": round(s.occupancy_pct * 100, 1)}
        for s in reversed(snaps)
    ]
    return {**_zone_status(zone, current), "history": history}


@router.get("/zones/{zone_id}/predict")
async def predict_zone(
    zone_id: str,
    arrive_at: str = Query(..., description="ISO datetime, e.g. 2026-03-03T08:30:00"),
    db: AsyncSession = Depends(get_db),
):
    zone = await db.get(ParkingZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    try:
        target = datetime.fromisoformat(arrive_at)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO 8601.")

    snaps = (
        await db.execute(
            select(ParkingSnapshot)
            .where(ParkingSnapshot.zone_id == zone_id)
            .order_by(desc(ParkingSnapshot.timestamp))
            .limit(24)
        )
    ).scalars().all()

    snap_dicts = [{"timestamp": s.timestamp.isoformat() + "Z", "occupancy_pct": s.occupancy_pct} for s in snaps]
    entity = {"id": zone.id, "name": zone.name, "zone_type": zone.zone_type, "total_spots": zone.total_spots}

    prediction = await predict_availability("parking", entity, target, snap_dicts)
    predicted_pct = prediction["predicted_value"]
    predicted_available = max(0, round((1 - predicted_pct) * zone.total_spots))

    return {
        "zone_id": zone_id,
        "zone_name": zone.name,
        "arrive_at": arrive_at,
        "predicted_occupancy_pct": round(predicted_pct * 100, 1),
        "predicted_available_spots": predicted_available,
        "confidence": prediction["confidence"],
        "explanation": prediction["explanation"],
    }


@router.get("/recommend")
async def recommend_parking(
    lat: float = Query(...),
    lng: float = Query(...),
    arrive_by: str = Query(..., description="ISO datetime"),
    duration_hrs: float = Query(default=1.0),
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()

    options = []
    for zone in zones:
        snap = (
            await db.execute(
                select(ParkingSnapshot)
                .where(ParkingSnapshot.zone_id == zone.id)
                .order_by(desc(ParkingSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        dist = _distance_km(lat, lng, zone.lat, zone.lng)
        options.append({
            "id": zone.id,
            "name": zone.name,
            "zone_type": zone.zone_type,
            "distance_km": round(dist, 2),
            "available_spots": snap.available_spots if snap else zone.total_spots,
            "occupancy_pct": round((snap.occupancy_pct if snap else 0) * 100, 1),
            "hourly_rate": zone.hourly_rate,
            "estimated_cost": round(zone.hourly_rate * duration_hrs, 2),
        })

    options.sort(key=lambda x: (x["occupancy_pct"], x["distance_km"]))

    user_request = {"lat": lat, "lng": lng, "arrive_by": arrive_by, "duration_hrs": duration_hrs}
    recommendation = await recommend_best_option("parking", options[:8], user_request)

    return {"recommendation": recommendation, "options": options[:10]}
