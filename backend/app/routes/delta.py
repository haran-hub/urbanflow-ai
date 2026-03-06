"""GET /api/delta/today?city=
What changed in the last 24 hours — snapshot delta for key metrics.
"""
import time
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    ParkingZone, ParkingSnapshot,
    EVStation, EVSnapshot,
    TransitRoute, TransitSnapshot,
    AirStation, AirSnapshot,
    NoiseZone, NoiseSnapshot,
)

router = APIRouter(prefix="/api/delta", tags=["delta"])

# In-memory daily baseline: {city: {"date": str, "snapshot": dict}}
_daily_baselines: dict[str, dict] = {}


async def _current_snapshot(city: str, db: AsyncSession) -> dict:
    """Pull current aggregate values for all key metrics."""

    async def avg(model, snap_model, join_col, value_col, city_col="city"):
        rows = await db.execute(
            select(func.avg(getattr(snap_model, value_col)))
            .join(model, join_col)
            .where(getattr(model, city_col) == city)
        )
        return float(rows.scalar() or 0)

    p_occ = await avg(ParkingZone, ParkingSnapshot,
                      ParkingSnapshot.zone_id == ParkingZone.id, "occupancy_pct")
    ev_wait = await avg(EVStation, EVSnapshot,
                        EVSnapshot.station_id == EVStation.id, "avg_wait_minutes")
    ev_ports = await avg(EVStation, EVSnapshot,
                         EVSnapshot.station_id == EVStation.id, "available_ports")
    t_crowd = await avg(TransitRoute, TransitSnapshot,
                        TransitSnapshot.route_id == TransitRoute.id, "occupancy_level")
    aqi = await avg(AirStation, AirSnapshot,
                    AirSnapshot.station_id == AirStation.id, "aqi")
    vibe = await avg(NoiseZone, NoiseSnapshot,
                     NoiseSnapshot.zone_id == NoiseZone.id, "vibe_score")

    return {
        "parking_occ_pct": round(p_occ * 100, 1),
        "ev_wait_min":      round(ev_wait, 1),
        "ev_ports":         round(ev_ports, 1),
        "transit_crowd":    round(t_crowd, 1),
        "aqi":              round(aqi, 1),
        "vibe_score":       round(vibe, 1),
    }


METRIC_META = [
    {"key": "parking_occ_pct", "label": "Parking Occupancy",  "unit": "%",   "icon": "🅿",  "lower_better": True},
    {"key": "ev_wait_min",     "label": "EV Wait Time",       "unit": " min","icon": "⚡",  "lower_better": True},
    {"key": "ev_ports",        "label": "EV Ports Available", "unit": "",    "icon": "⚡",  "lower_better": False},
    {"key": "transit_crowd",   "label": "Transit Crowd",      "unit": "%",   "icon": "🚇",  "lower_better": True},
    {"key": "aqi",             "label": "Air Quality (AQI)",  "unit": "",    "icon": "🌬",  "lower_better": True},
    {"key": "vibe_score",      "label": "Vibe Score",         "unit": "/100","icon": "🎵",  "lower_better": False},
]


@router.get("/today")
async def get_delta(city: str = "San Francisco", db: AsyncSession = Depends(get_db)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    current = await _current_snapshot(city, db)

    # First call of the day — store as baseline (or if new city)
    if city not in _daily_baselines or _daily_baselines[city]["date"] != today:
        _daily_baselines[city] = {"date": today, "snapshot": current}
        return {
            "city": city,
            "has_data": False,
            "message": "Baseline captured. Check back in a few minutes to see what changed.",
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": [],
        }

    baseline = _daily_baselines[city]["snapshot"]
    metrics = []

    for meta in METRIC_META:
        k = meta["key"]
        prev = baseline.get(k, 0)
        curr = current.get(k, 0)
        if prev == 0:
            change_pct = 0.0
        else:
            change_pct = round(((curr - prev) / abs(prev)) * 100, 1)

        if abs(change_pct) < 1:
            direction = "flat"
        elif change_pct > 0:
            direction = "up"
        else:
            direction = "down"

        # Good/bad depends on lower_better flag
        lb = meta["lower_better"]
        if direction == "flat":
            sentiment = "neutral"
        elif (direction == "up" and lb) or (direction == "down" and not lb):
            sentiment = "bad"
        else:
            sentiment = "good"

        metrics.append({
            "key": k,
            "label": meta["label"],
            "unit": meta["unit"],
            "icon": meta["icon"],
            "current": curr,
            "previous": prev,
            "change_pct": change_pct,
            "direction": direction,
            "sentiment": sentiment,
        })

    improved = sum(1 for m in metrics if m["sentiment"] == "good")
    worsened = sum(1 for m in metrics if m["sentiment"] == "bad")

    if improved > worsened:
        summary = f"{city} is doing better than earlier today across {improved} metrics."
    elif worsened > improved:
        summary = f"{city} has worsened on {worsened} metrics compared to earlier today."
    else:
        summary = f"{city} conditions are roughly the same as earlier today."

    return {
        "city": city,
        "has_data": True,
        "summary": summary,
        "improved": improved,
        "worsened": worsened,
        "timestamp": datetime.utcnow().isoformat(),
        "metrics": metrics,
    }
