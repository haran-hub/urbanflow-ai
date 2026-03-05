from __future__ import annotations

import math
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import LocalService, ServiceSnapshot
from app.ai_predictor import predict_availability, recommend_best_option

router = APIRouter(prefix="/api/services", tags=["Local Services"])


def _distance_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _service_status(service: LocalService, snap: ServiceSnapshot | None) -> dict:
    return {
        "id": service.id,
        "name": service.name,
        "city": service.city,
        "lat": service.lat,
        "lng": service.lng,
        "address": service.address,
        "category": service.category,
        "typical_hours": service.typical_hours,
        "is_open": snap.is_open if snap else True,
        "estimated_wait_minutes": snap.estimated_wait_minutes if snap else 0,
        "queue_length": snap.queue_length if snap else 0,
        "wait_label": _wait_label(snap.estimated_wait_minutes if snap else 0),
        "last_updated": snap.timestamp.isoformat() + "Z" if snap else None,
    }


def _wait_label(minutes: int) -> str:
    if minutes == 0:
        return "No wait"
    if minutes < 15:
        return "Short wait"
    if minutes < 45:
        return "Moderate wait"
    return "Long wait"


@router.get("/")
async def list_services(
    city: str = Query(default="San Francisco"),
    category: Optional[str] = Query(default=None),
    lat: Optional[float] = Query(default=None),
    lng: Optional[float] = Query(default=None),
    radius_km: float = Query(default=5.0),
    db: AsyncSession = Depends(get_db),
):
    query = select(LocalService).where(LocalService.city == city)
    if category:
        query = query.where(LocalService.category == category)

    services = (await db.execute(query)).scalars().all()

    results = []
    for service in services:
        snap = (
            await db.execute(
                select(ServiceSnapshot)
                .where(ServiceSnapshot.service_id == service.id)
                .order_by(desc(ServiceSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        data = _service_status(service, snap)

        if lat is not None and lng is not None:
            dist = _distance_km(lat, lng, service.lat, service.lng)
            if dist > radius_km:
                continue
            data["distance_km"] = round(dist, 2)

        results.append(data)

    results.sort(key=lambda x: x["estimated_wait_minutes"])
    return {"services": results, "count": len(results)}


@router.get("/{service_id}/status")
async def service_status(service_id: str, db: AsyncSession = Depends(get_db)):
    service = await db.get(LocalService, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    snaps = (
        await db.execute(
            select(ServiceSnapshot)
            .where(ServiceSnapshot.service_id == service_id)
            .order_by(desc(ServiceSnapshot.timestamp))
            .limit(48)
        )
    ).scalars().all()

    current = snaps[0] if snaps else None
    history = [
        {
            "timestamp": s.timestamp.isoformat() + "Z",
            "estimated_wait_minutes": s.estimated_wait_minutes,
            "queue_length": s.queue_length,
            "is_open": s.is_open,
        }
        for s in reversed(snaps)
    ]
    return {**_service_status(service, current), "history": history}


@router.get("/{service_id}/predict")
async def predict_service(
    service_id: str,
    arrive_at: str = Query(..., description="ISO datetime"),
    db: AsyncSession = Depends(get_db),
):
    service = await db.get(LocalService, service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    try:
        target = datetime.fromisoformat(arrive_at)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format.")

    snaps = (
        await db.execute(
            select(ServiceSnapshot)
            .where(ServiceSnapshot.service_id == service_id)
            .order_by(desc(ServiceSnapshot.timestamp))
            .limit(24)
        )
    ).scalars().all()

    snap_dicts = [{"timestamp": s.timestamp.isoformat() + "Z", "estimated_wait_minutes": s.estimated_wait_minutes, "queue_length": s.queue_length} for s in snaps]
    entity = {"id": service.id, "name": service.name, "category": service.category}

    prediction = await predict_availability("service", entity, target, snap_dicts)
    wait = int(prediction["predicted_value"])
    return {
        "service_id": service_id,
        "service_name": service.name,
        "arrive_at": arrive_at,
        "predicted_wait_minutes": wait,
        "wait_label": _wait_label(wait),
        "confidence": prediction["confidence"],
        "explanation": prediction["explanation"],
    }


@router.get("/recommend")
async def recommend_service(
    category: str = Query(...),
    lat: float = Query(...),
    lng: float = Query(...),
    max_wait_minutes: int = Query(default=30),
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    services = (
        await db.execute(
            select(LocalService).where(LocalService.city == city, LocalService.category == category)
        )
    ).scalars().all()

    options = []
    for service in services:
        snap = (
            await db.execute(
                select(ServiceSnapshot)
                .where(ServiceSnapshot.service_id == service.id)
                .order_by(desc(ServiceSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        dist = _distance_km(lat, lng, service.lat, service.lng)
        options.append({
            "id": service.id,
            "name": service.name,
            "distance_km": round(dist, 2),
            "is_open": snap.is_open if snap else True,
            "estimated_wait_minutes": snap.estimated_wait_minutes if snap else 0,
            "queue_length": snap.queue_length if snap else 0,
            "wait_label": _wait_label(snap.estimated_wait_minutes if snap else 0),
        })

    options.sort(key=lambda x: (x["estimated_wait_minutes"], x["distance_km"]))

    user_request = {
        "category": category, "lat": lat, "lng": lng,
        "max_wait_minutes": max_wait_minutes,
    }
    recommendation = await recommend_best_option("service", options[:8], user_request)
    return {"recommendation": recommendation, "options": options[:10]}
