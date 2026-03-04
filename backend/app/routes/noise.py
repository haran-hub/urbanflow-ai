from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models import NoiseZone, NoiseSnapshot

router = APIRouter(prefix="/api/noise", tags=["Noise & Vibe"])


def _zone_status(zone: NoiseZone, snap: NoiseSnapshot | None) -> dict:
    return {
        "id": zone.id,
        "name": zone.name,
        "city": zone.city,
        "lat": zone.lat,
        "lng": zone.lng,
        "address": zone.address,
        "zone_type": zone.zone_type,
        "noise_db": snap.noise_db if snap else 45.0,
        "vibe_score": snap.vibe_score if snap else 50,
        "crowd_density": snap.crowd_density if snap else 0,
        "vibe_label": snap.vibe_label if snap else "Quiet",
        "last_updated": snap.timestamp.isoformat() if snap else None,
    }


@router.get("/zones")
async def list_zones(
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    zones = (await db.execute(select(NoiseZone).where(NoiseZone.city == city))).scalars().all()

    results = []
    for zone in zones:
        snap = (
            await db.execute(
                select(NoiseSnapshot)
                .where(NoiseSnapshot.zone_id == zone.id)
                .order_by(desc(NoiseSnapshot.timestamp))
                .limit(1)
            )
        ).scalar_one_or_none()

        results.append(_zone_status(zone, snap))

    # Sort by vibe_score descending
    results.sort(key=lambda x: x["vibe_score"], reverse=True)
    return {"zones": results, "count": len(results)}


@router.get("/zones/{zone_id}/status")
async def zone_status(zone_id: str, db: AsyncSession = Depends(get_db)):
    zone = await db.get(NoiseZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Noise zone not found")

    snaps = (
        await db.execute(
            select(NoiseSnapshot)
            .where(NoiseSnapshot.zone_id == zone_id)
            .order_by(desc(NoiseSnapshot.timestamp))
            .limit(48)
        )
    ).scalars().all()

    current = snaps[0] if snaps else None
    history = [
        {
            "timestamp": s.timestamp.isoformat(),
            "noise_db": s.noise_db,
            "vibe_score": s.vibe_score,
            "crowd_density": s.crowd_density,
            "vibe_label": s.vibe_label,
        }
        for s in reversed(snaps)
    ]
    return {**_zone_status(zone, current), "history": history}
