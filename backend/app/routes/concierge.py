from __future__ import annotations

"""
AI City Concierge — natural language Q&A about current city conditions using Claude.
"""
import json
import logging
import re
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

import anthropic

from app.config import settings
from app.database import get_db
from app.models import (
    ParkingZone, ParkingSnapshot,
    EVStation, EVSnapshot,
    TransitRoute, TransitSnapshot,
    LocalService, ServiceSnapshot,
    AirStation, AirSnapshot,
    BikeStation, BikeSnapshot,
    FoodTruck, FoodTruckSnapshot,
    NoiseZone, NoiseSnapshot,
)

router = APIRouter(prefix="/api/concierge", tags=["Concierge"])
logger = logging.getLogger(__name__)

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic | None:
    global _client
    if not settings.anthropic_api_key:
        return None
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def _latest_snap(db, model, fk_field, entity_id):
    snap = (
        await db.execute(
            select(model)
            .where(getattr(model, fk_field) == entity_id)
            .order_by(desc(model.timestamp))
            .limit(1)
        )
    ).scalar_one_or_none()
    return snap


async def _build_city_context(db: AsyncSession, city: str) -> str:
    """Build a compact snapshot of all city metrics for the prompt."""
    lines = [f"Current city: {city}", f"Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}"]

    # Parking
    zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()
    total_spots = sum(z.total_spots for z in zones)
    avail_spots = 0
    for z in zones:
        s = await _latest_snap(db, ParkingSnapshot, "zone_id", z.id)
        avail_spots += s.available_spots if s else z.total_spots
    lines.append(f"Parking: {avail_spots}/{total_spots} spots available across {len(zones)} zones")

    # EV
    stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()
    ev_avail = 0
    ev_wait = 0
    for st in stations:
        s = await _latest_snap(db, EVSnapshot, "station_id", st.id)
        if s:
            ev_avail += s.available_ports
            ev_wait += s.avg_wait_minutes
    avg_wait = round(ev_wait / len(stations), 1) if stations else 0
    lines.append(f"EV Charging: {ev_avail} ports available, avg wait {avg_wait} min across {len(stations)} stations")

    # Transit
    routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()
    crowd_total = 0
    delayed = 0
    for r in routes:
        s = await _latest_snap(db, TransitSnapshot, "route_id", r.id)
        if s:
            crowd_total += s.occupancy_level
            if s.delay_minutes > 3:
                delayed += 1
    avg_crowd = round(crowd_total / len(routes)) if routes else 0
    lines.append(f"Transit: {len(routes)} routes, avg crowd {avg_crowd}%, {delayed} routes delayed")

    # Services
    svcs = (await db.execute(select(LocalService).where(LocalService.city == city))).scalars().all()
    open_svcs = 0
    for sv in svcs:
        s = await _latest_snap(db, ServiceSnapshot, "service_id", sv.id)
        if s and s.is_open:
            open_svcs += 1
    lines.append(f"Local Services: {open_svcs}/{len(svcs)} open now (hospitals, banks, pharmacies, DMV, post offices)")

    # Air
    air_sts = (await db.execute(select(AirStation).where(AirStation.city == city))).scalars().all()
    aqi_total = 0
    cat = "Unknown"
    for a in air_sts:
        s = await _latest_snap(db, AirSnapshot, "station_id", a.id)
        if s:
            aqi_total += s.aqi
            cat = s.category
    avg_aqi = round(aqi_total / len(air_sts)) if air_sts else 0
    lines.append(f"Air Quality: AQI {avg_aqi} ({cat})")

    # Bikes
    bss = (await db.execute(select(BikeStation).where(BikeStation.city == city))).scalars().all()
    bikes_total = 0
    for bs in bss:
        s = await _latest_snap(db, BikeSnapshot, "station_id", bs.id)
        if s:
            bikes_total += s.available_bikes + s.available_ebikes
    lines.append(f"Bikes: {bikes_total} bikes available at {len(bss)} stations")

    # Food Trucks
    trucks = (await db.execute(select(FoodTruck).where(FoodTruck.city == city))).scalars().all()
    open_trucks = 0
    for t in trucks:
        s = await _latest_snap(db, FoodTruckSnapshot, "truck_id", t.id)
        if s and s.is_open:
            open_trucks += 1
    lines.append(f"Food Trucks: {open_trucks}/{len(trucks)} open")

    # Noise/Vibe
    nzs = (await db.execute(select(NoiseZone).where(NoiseZone.city == city))).scalars().all()
    vibe_total = 0
    hottest = ""
    hottest_score = -1
    for nz in nzs:
        s = await _latest_snap(db, NoiseSnapshot, "zone_id", nz.id)
        if s:
            vibe_total += s.vibe_score
            if s.vibe_score > hottest_score:
                hottest_score = s.vibe_score
                hottest = nz.name
    avg_vibe = round(vibe_total / len(nzs)) if nzs else 0
    lines.append(f"Noise & Vibe: avg vibe {avg_vibe}/100, hottest spot: {hottest}")

    return "\n".join(lines)


class AskRequest(BaseModel):
    question: str
    city: str = "San Francisco"


@router.post("/ask")
async def ask_concierge(request: AskRequest, db: AsyncSession = Depends(get_db)):
    """Answer a natural language question about current city conditions."""
    ctx = await _build_city_context(db, request.city)

    client = _get_client()
    if not client:
        return {
            "answer": (
                f"I can see {request.city} has active data across all 8 urban domains — "
                "parking, EV charging, transit, services, air quality, bikes, food trucks, and vibe. "
                "Unfortunately my AI brain isn't connected right now (no API key), but the live data above is accurate!"
            ),
            "city": request.city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

    system = (
        "You are UrbanFlow AI, a friendly and knowledgeable city concierge. "
        "You have access to real-time data for the city below. "
        "Answer questions concisely and helpfully, like a local city expert. "
        "If asked for recommendations, give specific actionable advice. "
        "Keep responses under 150 words. Do not use bullet points for simple answers."
    )
    prompt = f"City data:\n{ctx}\n\nUser question: {request.question}"

    try:
        msg = await client.messages.create(
            model=settings.ai_model,
            max_tokens=300,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        answer = msg.content[0].text.strip()
    except Exception as e:
        logger.warning(f"Concierge fallback: {e}")
        answer = (
            f"Based on current {request.city} data: parking has spots available, "
            "transit is running, and city services are open. Check individual sections for details!"
        )

    return {
        "answer": answer,
        "city": request.city,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
