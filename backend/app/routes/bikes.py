from __future__ import annotations

import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import BikeStation, BikeSnapshot
from app.ai_predictor import recommend_best_option

router = APIRouter(prefix="/api/bikes", tags=["Bikes & Scooters"])


def _distance_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _station_status(station: BikeStation, snap: BikeSnapshot | None) -> dict:
    return {
        "id": station.id,
        "name": station.name,
        "city": station.city,
        "lat": station.lat,
        "lng": station.lng,
        "address": station.address,
        "total_docks": station.total_docks,
        "network": station.network,
        "station_type": station.station_type,
        "available_bikes": snap.available_bikes if snap else 0,
        "available_ebikes": snap.available_ebikes if snap else 0,
        "available_docks": snap.available_docks if snap else station.total_docks,
        "is_renting": snap.is_renting if snap else True,
        "last_updated": snap.timestamp.isoformat() if snap else None,
    }


@router.get("/stations")
async def list_stations(
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    stations = (await db.execute(select(BikeStation).where(BikeStation.city == city))).scalars().all()

    results = []
    for station in stations:
        snap = (
            await db.execute(
                select(BikeSnapshot)
                .where(BikeSnapshot.station_id == station.id)
                .order_by(desc(BikeSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        results.append(_station_status(station, snap))

    results.sort(key=lambda x: -(x["available_bikes"] + x["available_ebikes"]))
    return {"stations": results, "count": len(results)}


@router.get("/stations/{station_id}/status")
async def station_status(station_id: str, db: AsyncSession = Depends(get_db)):
    station = await db.get(BikeStation, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Bike station not found")

    snaps = (
        await db.execute(
            select(BikeSnapshot)
            .where(BikeSnapshot.station_id == station_id)
            .order_by(desc(BikeSnapshot.timestamp))
            .limit(48)
        )
    ).scalars().all()

    current = snaps[0] if snaps else None
    history = [
        {
            "timestamp": s.timestamp.isoformat(),
            "available_bikes": s.available_bikes,
            "available_ebikes": s.available_ebikes,
            "available_docks": s.available_docks,
            "is_renting": s.is_renting,
        }
        for s in reversed(snaps)
    ]
    return {**_station_status(station, current), "history": history}


@router.get("/recommend")
async def recommend_bike(
    lat: float = Query(...),
    lng: float = Query(...),
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    stations = (await db.execute(select(BikeStation).where(BikeStation.city == city))).scalars().all()

    options = []
    for station in stations:
        snap = (
            await db.execute(
                select(BikeSnapshot)
                .where(BikeSnapshot.station_id == station.id)
                .order_by(desc(BikeSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        dist = _distance_km(lat, lng, station.lat, station.lng)
        total_available = (snap.available_bikes if snap else 0) + (snap.available_ebikes if snap else 0)
        options.append({
            "id": station.id,
            "name": station.name,
            "network": station.network,
            "distance_km": round(dist, 2),
            "available_bikes": snap.available_bikes if snap else 0,
            "available_ebikes": snap.available_ebikes if snap else 0,
            "available_docks": snap.available_docks if snap else station.total_docks,
            "is_renting": snap.is_renting if snap else True,
            "total_available": total_available,
        })

    options.sort(key=lambda x: (x["distance_km"], -x["total_available"]))

    user_request = {"lat": lat, "lng": lng, "city": city}
    recommendation = await recommend_best_option("bike", options[:8], user_request)

    return {"recommendation": recommendation, "options": options[:10]}
