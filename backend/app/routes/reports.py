from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CommunityReport

router = APIRouter(prefix="/api/reports", tags=["reports"])


class ReportCreate(BaseModel):
    city: str
    lat: float
    lng: float
    type: str = Field(pattern="^(parking|ev|transit|general)$")
    description: str = Field(max_length=280)


@router.get("")
async def get_reports(city: str, db: AsyncSession = Depends(get_db)):
    cutoff = datetime.utcnow() - timedelta(hours=24)
    rows = (
        await db.execute(
            select(CommunityReport)
            .where(CommunityReport.city == city)
            .where(CommunityReport.created_at >= cutoff)
            .order_by(CommunityReport.upvotes.desc())
        )
    ).scalars().all()
    return {
        "reports": [
            {
                "id": r.id,
                "city": r.city,
                "lat": r.lat,
                "lng": r.lng,
                "type": r.type,
                "description": r.description,
                "upvotes": r.upvotes,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "city": city,
    }


@router.post("")
async def create_report(payload: ReportCreate, db: AsyncSession = Depends(get_db)):
    report = CommunityReport(
        city=payload.city,
        lat=payload.lat,
        lng=payload.lng,
        type=payload.type,
        description=payload.description,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return {"id": report.id, "success": True}


@router.post("/{report_id}/upvote")
async def upvote_report(report_id: int, db: AsyncSession = Depends(get_db)):
    report = (
        await db.execute(select(CommunityReport).where(CommunityReport.id == report_id))
    ).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.upvotes += 1
    await db.commit()
    return {"id": report.id, "upvotes": report.upvotes}
