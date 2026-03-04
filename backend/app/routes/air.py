from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import AirStation, AirSnapshot
from app.ai_predictor import predict_availability

router = APIRouter(prefix="/api/air", tags=["Air Quality"])

POLLEN_LABELS = ["None", "Low", "Moderate", "High", "Very High"]


def _station_status(station: AirStation, snap: AirSnapshot | None) -> dict:
    return {
        "id": station.id,
        "name": station.name,
        "city": station.city,
        "lat": station.lat,
        "lng": station.lng,
        "address": station.address,
        "aqi": snap.aqi if snap else 0,
        "pm25": snap.pm25 if snap else 0.0,
        "pm10": snap.pm10 if snap else 0.0,
        "o3": snap.o3 if snap else 0.0,
        "pollen_level": snap.pollen_level if snap else 0,
        "pollen_label": POLLEN_LABELS[snap.pollen_level] if snap else "None",
        "uv_index": snap.uv_index if snap else 0.0,
        "category": snap.category if snap else "Good",
        "last_updated": snap.timestamp.isoformat() if snap else None,
    }


def _health_advisory(category: str) -> str:
    advisories = {
        "Good": "Air quality is satisfactory. No health concerns.",
        "Moderate": "Acceptable air quality. Unusually sensitive people should limit outdoor activity.",
        "Unhealthy for Sensitive Groups": "Sensitive groups should reduce prolonged outdoor exertion.",
        "Unhealthy": "Everyone may experience health effects. Limit outdoor activity.",
        "Very Unhealthy": "Health alert — everyone should avoid outdoor activity.",
        "Hazardous": "Health emergency. Everyone should stay indoors.",
    }
    return advisories.get(category, "Monitor air quality conditions.")


@router.get("/stations")
async def list_stations(
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    stations = (await db.execute(select(AirStation).where(AirStation.city == city))).scalars().all()

    results = []
    for station in stations:
        snap = (
            await db.execute(
                select(AirSnapshot)
                .where(AirSnapshot.station_id == station.id)
                .order_by(desc(AirSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        data = _station_status(station, snap)
        data["health_advisory"] = _health_advisory(data["category"])
        results.append(data)

    results.sort(key=lambda x: x["aqi"])
    return {"stations": results, "count": len(results)}


@router.get("/stations/{station_id}/status")
async def station_status(station_id: str, db: AsyncSession = Depends(get_db)):
    station = await db.get(AirStation, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Air station not found")

    snaps = (
        await db.execute(
            select(AirSnapshot)
            .where(AirSnapshot.station_id == station_id)
            .order_by(desc(AirSnapshot.timestamp))
            .limit(48)
        )
    ).scalars().all()

    current = snaps[0] if snaps else None
    history = [
        {
            "timestamp": s.timestamp.isoformat(),
            "aqi": s.aqi,
            "pm25": s.pm25,
            "pm10": s.pm10,
            "o3": s.o3,
            "pollen_level": s.pollen_level,
            "uv_index": s.uv_index,
            "category": s.category,
        }
        for s in reversed(snaps)
    ]
    result = _station_status(station, current)
    result["health_advisory"] = _health_advisory(result["category"])
    return {**result, "history": history}


@router.get("/stations/{station_id}/predict")
async def predict_station(
    station_id: str,
    arrive_at: str = Query(..., description="ISO datetime, e.g. 2026-03-03T08:30:00"),
    db: AsyncSession = Depends(get_db),
):
    station = await db.get(AirStation, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Air station not found")

    try:
        target = datetime.fromisoformat(arrive_at)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime format. Use ISO 8601.")

    snaps = (
        await db.execute(
            select(AirSnapshot)
            .where(AirSnapshot.station_id == station_id)
            .order_by(desc(AirSnapshot.timestamp))
            .limit(24)
        )
    ).scalars().all()

    snap_dicts = [
        {"timestamp": s.timestamp.isoformat(), "aqi": s.aqi, "pm25": s.pm25, "category": s.category}
        for s in snaps
    ]
    entity = {"id": station.id, "name": station.name, "city": station.city}

    prediction = await predict_availability("air_quality", entity, target, snap_dicts)
    predicted_aqi = int(prediction["predicted_value"])
    if predicted_aqi <= 50:
        predicted_category = "Good"
    elif predicted_aqi <= 100:
        predicted_category = "Moderate"
    elif predicted_aqi <= 150:
        predicted_category = "Unhealthy for Sensitive Groups"
    elif predicted_aqi <= 200:
        predicted_category = "Unhealthy"
    elif predicted_aqi <= 300:
        predicted_category = "Very Unhealthy"
    else:
        predicted_category = "Hazardous"

    return {
        "station_id": station_id,
        "station_name": station.name,
        "arrive_at": arrive_at,
        "predicted_aqi": predicted_aqi,
        "predicted_category": predicted_category,
        "health_advisory": _health_advisory(predicted_category),
        "confidence": prediction["confidence"],
        "explanation": prediction["explanation"],
    }
