from __future__ import annotations

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import FoodTruck, FoodTruckSnapshot
from app.ai_predictor import predict_availability

router = APIRouter(prefix="/api/foodtrucks", tags=["Food Trucks"])


def _wait_label(minutes: int) -> str:
    if minutes == 0:
        return "No wait"
    if minutes < 10:
        return "Short wait"
    if minutes < 25:
        return "Moderate wait"
    return "Long wait"


def _truck_status(truck: FoodTruck, snap: FoodTruckSnapshot | None) -> dict:
    wait = snap.wait_minutes if snap else 0
    return {
        "id": truck.id,
        "name": truck.name,
        "city": truck.city,
        "lat": truck.lat,
        "lng": truck.lng,
        "address": truck.address,
        "cuisine": truck.cuisine,
        "typical_hours": truck.typical_hours,
        "is_open": snap.is_open if snap else False,
        "wait_minutes": wait,
        "crowd_level": snap.crowd_level if snap else 0,
        "wait_label": _wait_label(wait),
        "last_updated": snap.timestamp.isoformat() if snap else None,
    }


@router.get("/")
async def list_food_trucks(
    city: str = Query(default="San Francisco"),
    cuisine: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    query = select(FoodTruck).where(FoodTruck.city == city)
    if cuisine:
        query = query.where(FoodTruck.cuisine.ilike(f"%{cuisine}%"))

    trucks = (await db.execute(query)).scalars().all()

    results = []
    for truck in trucks:
        snap = (
            await db.execute(
                select(FoodTruckSnapshot)
                .where(FoodTruckSnapshot.truck_id == truck.id)
                .order_by(desc(FoodTruckSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        results.append(_truck_status(truck, snap))

    # Open trucks first, then by wait time
    results.sort(key=lambda x: (not x["is_open"], x["wait_minutes"]))
    return {"trucks": results, "count": len(results)}


@router.get("/{truck_id}/status")
async def truck_status(truck_id: str, db: AsyncSession = Depends(get_db)):
    truck = await db.get(FoodTruck, truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail="Food truck not found")

    snaps = (
        await db.execute(
            select(FoodTruckSnapshot)
            .where(FoodTruckSnapshot.truck_id == truck_id)
            .order_by(desc(FoodTruckSnapshot.timestamp))
            .limit(48)
        )
    ).scalars().all()

    current = snaps[0] if snaps else None
    history = [
        {
            "timestamp": s.timestamp.isoformat(),
            "is_open": s.is_open,
            "wait_minutes": s.wait_minutes,
            "crowd_level": s.crowd_level,
        }
        for s in reversed(snaps)
    ]
    return {**_truck_status(truck, current), "history": history}


@router.get("/{truck_id}/predict")
async def predict_truck(
    truck_id: str,
    arrive_at: str = Query(..., description="ISO datetime, e.g. 2026-03-03T12:00:00"),
    db: AsyncSession = Depends(get_db),
):
    truck = await db.get(FoodTruck, truck_id)
    if not truck:
        raise HTTPException(status_code=404, detail="Food truck not found")

    try:
        target = datetime.fromisoformat(arrive_at)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO 8601.")

    snaps = (
        await db.execute(
            select(FoodTruckSnapshot)
            .where(FoodTruckSnapshot.truck_id == truck_id)
            .order_by(desc(FoodTruckSnapshot.timestamp))
            .limit(24)
        )
    ).scalars().all()

    snap_dicts = [
        {
            "timestamp": s.timestamp.isoformat(),
            "is_open": s.is_open,
            "wait_minutes": s.wait_minutes,
            "crowd_level": s.crowd_level,
        }
        for s in snaps
    ]
    entity = {
        "id": truck.id,
        "name": truck.name,
        "cuisine": truck.cuisine,
        "typical_hours": truck.typical_hours,
    }

    prediction = await predict_availability("food_truck", entity, target, snap_dicts)
    wait = int(prediction["predicted_value"])

    return {
        "truck_id": truck_id,
        "truck_name": truck.name,
        "arrive_at": arrive_at,
        "predicted_wait_minutes": wait,
        "wait_label": _wait_label(wait),
        "confidence": prediction["confidence"],
        "explanation": prediction["explanation"],
    }
