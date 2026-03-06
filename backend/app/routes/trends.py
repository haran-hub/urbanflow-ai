"""GET /api/trends/mini?city=
Lightweight sparkline data — last 12 city-wide average snapshots over a 2h window.
"""
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    AirSnapshot, AirStation,
    EVSnapshot, EVStation,
    ParkingSnapshot, ParkingZone,
    TransitSnapshot, TransitRoute,
)

router = APIRouter(prefix="/api/trends", tags=["trends"])


def _bucket_avg(rows: list, n: int = 12) -> list[float]:
    """Group (datetime, float) pairs into 10-min buckets, return last n averages."""
    if not rows:
        return []
    buckets: dict = defaultdict(list)
    for ts, val in rows:
        key = ts.replace(second=0, microsecond=0)
        key = key.replace(minute=(key.minute // 10) * 10)
        buckets[key].append(float(val))
    sorted_avgs = [round(sum(v) / len(v), 1) for _, v in sorted(buckets.items())]
    return sorted_avgs[-n:]


@router.get("/mini")
async def mini_trends(city: str = "San Francisco", db: AsyncSession = Depends(get_db)):
    cutoff = datetime.utcnow() - timedelta(hours=2)

    p = (await db.execute(
        select(ParkingSnapshot.timestamp, ParkingSnapshot.occupancy_pct)
        .join(ParkingZone, ParkingSnapshot.zone_id == ParkingZone.id)
        .where(ParkingZone.city == city)
        .where(ParkingSnapshot.timestamp >= cutoff)
        .order_by(ParkingSnapshot.timestamp)
    )).all()

    e = (await db.execute(
        select(EVSnapshot.timestamp, EVSnapshot.avg_wait_minutes)
        .join(EVStation, EVSnapshot.station_id == EVStation.id)
        .where(EVStation.city == city)
        .where(EVSnapshot.timestamp >= cutoff)
        .order_by(EVSnapshot.timestamp)
    )).all()

    t = (await db.execute(
        select(TransitSnapshot.timestamp, TransitSnapshot.occupancy_level)
        .join(TransitRoute, TransitSnapshot.route_id == TransitRoute.id)
        .where(TransitRoute.city == city)
        .where(TransitSnapshot.timestamp >= cutoff)
        .order_by(TransitSnapshot.timestamp)
    )).all()

    a = (await db.execute(
        select(AirSnapshot.timestamp, AirSnapshot.aqi)
        .join(AirStation, AirSnapshot.station_id == AirStation.id)
        .where(AirStation.city == city)
        .where(AirSnapshot.timestamp >= cutoff)
        .order_by(AirSnapshot.timestamp)
    )).all()

    return {
        "city": city,
        "parking_occ": _bucket_avg([(r[0], r[1] * 100) for r in p]),
        "ev_wait":      _bucket_avg(list(e)),
        "transit_crowd": _bucket_avg(list(t)),
        "aqi":          _bucket_avg(list(a)),
        "timestamp":    datetime.utcnow().isoformat() + "Z",
    }
