from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EmailSubscriber

router = APIRouter(prefix="/api/subscribe", tags=["subscribe"])


class SubscribeRequest(BaseModel):
    email: str
    city: str = "San Francisco"


@router.post("")
async def subscribe(payload: SubscribeRequest, db: AsyncSession = Depends(get_db)):
    existing = (
        await db.execute(
            select(EmailSubscriber).where(EmailSubscriber.email == payload.email)
        )
    ).scalar_one_or_none()

    if existing:
        existing.city = payload.city
        await db.commit()
        return {"success": True, "message": f"Updated to {payload.city} briefings"}

    sub = EmailSubscriber(email=payload.email, city=payload.city)
    db.add(sub)
    await db.commit()
    return {"success": True, "message": f"Subscribed to {payload.city} morning briefings"}


@router.get("/unsubscribe", response_class=HTMLResponse)
async def unsubscribe(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    sub = (
        await db.execute(
            select(EmailSubscriber).where(EmailSubscriber.unsubscribe_token == token)
        )
    ).scalar_one_or_none()

    if sub:
        await db.execute(
            delete(EmailSubscriber).where(EmailSubscriber.unsubscribe_token == token)
        )
        await db.commit()
        return HTMLResponse("""
<html><body style="font-family:sans-serif;text-align:center;padding:60px">
<h2>Unsubscribed successfully ✓</h2>
<p>You will no longer receive UrbanFlow AI morning briefings.</p>
</body></html>""")

    return HTMLResponse("""
<html><body style="font-family:sans-serif;text-align:center;padding:60px">
<h2>Link not found</h2>
<p>This unsubscribe link may have already been used or expired.</p>
</body></html>""")
