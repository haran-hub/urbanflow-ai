from __future__ import annotations

import math
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import TransitRoute, TransitSnapshot
from app.ai_predictor import predict_availability, recommend_best_option

router = APIRouter(prefix="/api/transit", tags=["Public Transit"])


def _crowd_label(level: int) -> str:
    if level < 30:
        return "Empty"
    if level < 60:
        return "Comfortable"
    if level < 80:
        return "Busy"
    return "Packed"


def _route_status(route: TransitRoute, snap: TransitSnapshot | None) -> dict:
    level = snap.occupancy_level if snap else 0
    return {
        "id": route.id,
        "name": route.name,
        "city": route.city,
        "route_type": route.route_type,
        "stops": route.stops,
        "frequency_mins": route.frequency_mins,
        "occupancy_level": level,
        "crowd_label": _crowd_label(level),
        "delay_minutes": snap.delay_minutes if snap else 0,
        "next_arrival_mins": snap.next_arrival_mins if snap else route.frequency_mins,
        "last_updated": snap.timestamp.isoformat() if snap else None,
    }


@router.get("/routes")
async def list_routes(
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()

    results = []
    for route in routes:
        snap = (
            await db.execute(
                select(TransitSnapshot)
                .where(TransitSnapshot.route_id == route.id)
                .order_by(desc(TransitSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()
        results.append(_route_status(route, snap))

    results.sort(key=lambda x: x["occupancy_level"])
    return {"routes": results, "count": len(results)}


@router.get("/routes/{route_id}/status")
async def route_status(route_id: str, db: AsyncSession = Depends(get_db)):
    route = await db.get(TransitRoute, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    snaps = (
        await db.execute(
            select(TransitSnapshot)
            .where(TransitSnapshot.route_id == route_id)
            .order_by(desc(TransitSnapshot.timestamp))
            .limit(48)
        )
    ).scalars().all()

    current = snaps[0] if snaps else None
    history = [
        {
            "timestamp": s.timestamp.isoformat(),
            "occupancy_level": s.occupancy_level,
            "crowd_label": _crowd_label(s.occupancy_level),
            "delay_minutes": s.delay_minutes,
        }
        for s in reversed(snaps)
    ]
    return {**_route_status(route, current), "history": history}


@router.get("/routes/{route_id}/predict")
async def predict_route(
    route_id: str,
    depart_at: str = Query(..., description="ISO datetime"),
    db: AsyncSession = Depends(get_db),
):
    route = await db.get(TransitRoute, route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")

    try:
        target = datetime.fromisoformat(depart_at)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format.")

    snaps = (
        await db.execute(
            select(TransitSnapshot)
            .where(TransitSnapshot.route_id == route_id)
            .order_by(desc(TransitSnapshot.timestamp))
            .limit(24)
        )
    ).scalars().all()

    snap_dicts = [{"timestamp": s.timestamp.isoformat(), "occupancy_level": s.occupancy_level, "delay_minutes": s.delay_minutes} for s in snaps]
    entity = {"id": route.id, "name": route.name, "route_type": route.route_type, "frequency_mins": route.frequency_mins}

    prediction = await predict_availability("transit", entity, target, snap_dicts)
    level = int(prediction["predicted_value"])
    return {
        "route_id": route_id,
        "route_name": route.name,
        "depart_at": depart_at,
        "predicted_occupancy_level": level,
        "crowd_label": _crowd_label(level),
        "confidence": prediction["confidence"],
        "explanation": prediction["explanation"],
    }


@router.get("/recommend")
async def recommend_transit(
    from_lat: float = Query(...),
    from_lng: float = Query(...),
    to_lat: float = Query(...),
    to_lng: float = Query(...),
    depart_at: str = Query(..., description="ISO datetime"),
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()

    options = []
    for route in routes:
        snap = (
            await db.execute(
                select(TransitSnapshot)
                .where(TransitSnapshot.route_id == route.id)
                .order_by(desc(TransitSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        options.append({
            "id": route.id,
            "name": route.name,
            "route_type": route.route_type,
            "occupancy_level": snap.occupancy_level if snap else 0,
            "crowd_label": _crowd_label(snap.occupancy_level if snap else 0),
            "delay_minutes": snap.delay_minutes if snap else 0,
            "next_arrival_mins": snap.next_arrival_mins if snap else route.frequency_mins,
            "stops_count": len(route.stops),
        })

    options.sort(key=lambda x: (x["occupancy_level"], x["delay_minutes"]))

    user_request = {
        "from_lat": from_lat, "from_lng": from_lng,
        "to_lat": to_lat, "to_lng": to_lng,
        "depart_at": depart_at,
    }
    recommendation = await recommend_best_option("transit", options[:8], user_request)
    return {"recommendation": recommendation, "options": options[:10]}
