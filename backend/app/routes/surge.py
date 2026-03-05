from __future__ import annotations

"""
Surge Predictor — AI-powered early warnings before parking/transit gets congested.
Analyzes trends and alerts users to upcoming surges.
"""
import json
import logging
import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

import anthropic

from app.config import settings
from app.database import get_db
from app.models import (
    ParkingZone, ParkingSnapshot,
    EVStation, EVSnapshot,
    TransitRoute, TransitSnapshot,
)

router = APIRouter(prefix="/api/surge", tags=["Surge"])
logger = logging.getLogger(__name__)

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic | None:
    global _client
    if not settings.anthropic_api_key:
        return None
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def _recent_snaps(db, model, fk_field, entity_id, limit: int = 6):
    snaps = (
        await db.execute(
            select(model)
            .where(getattr(model, fk_field) == entity_id)
            .order_by(desc(model.timestamp))
            .limit(limit)
        )
    ).scalars().all()
    return list(reversed(snaps))


def _parse_json(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    return json.loads(cleaned)


def _rule_based_surge(city: str, parking_data: list, ev_data: list, transit_data: list) -> list:
    """Fallback surge detection using simple trend rules."""
    alerts = []
    now = datetime.utcnow()

    # Parking surge: if avg occupancy > 75% and trending up
    if parking_data:
        avg_occ = sum(d["occupancy_pct"] for d in parking_data) / len(parking_data)
        trend = parking_data[-1]["occupancy_pct"] - parking_data[0]["occupancy_pct"] if len(parking_data) > 1 else 0
        if avg_occ > 0.75:
            severity = "high" if avg_occ > 0.90 else "medium"
            alerts.append({
                "domain": "parking",
                "severity": severity,
                "message": f"Parking is {round(avg_occ * 100)}% full across tracked zones",
                "tip": "Consider arriving 20 min early or using a garage instead of street parking",
                "predicted_peak_in_mins": 15 if trend > 0 else 30,
            })

    # Transit surge: if avg crowd > 70%
    if transit_data:
        avg_crowd = sum(d["occupancy_level"] for d in transit_data) / len(transit_data)
        delayed = sum(1 for d in transit_data if d["delay_minutes"] > 3)
        if avg_crowd > 70 or delayed > len(transit_data) * 0.3:
            alerts.append({
                "domain": "transit",
                "severity": "medium" if avg_crowd < 85 else "high",
                "message": f"Transit at {round(avg_crowd)}% capacity, {delayed} routes delayed",
                "tip": "Consider biking or waiting 30 min for crowds to ease",
                "predicted_peak_in_mins": 20,
            })

    # EV surge: if avg wait > 15 min
    if ev_data:
        avg_wait = sum(d["avg_wait_minutes"] for d in ev_data) / len(ev_data)
        if avg_wait > 15:
            alerts.append({
                "domain": "ev",
                "severity": "medium" if avg_wait < 30 else "high",
                "message": f"EV charging queue averaging {round(avg_wait)} min wait",
                "tip": "Charge overnight or try a different network during off-peak hours",
                "predicted_peak_in_mins": 25,
            })

    if not alerts:
        alerts.append({
            "domain": "all",
            "severity": "low",
            "message": "City conditions look smooth — no surges detected",
            "tip": "Great time to travel! All systems operating normally.",
            "predicted_peak_in_mins": 60,
        })

    return alerts


@router.get("/alerts")
async def surge_alerts(
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    """Returns AI-powered surge alerts for the city."""
    # Gather current metrics
    zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()
    parking_data = []
    for z in zones[:10]:
        snaps = await _recent_snaps(db, ParkingSnapshot, "zone_id", z.id, 3)
        if snaps:
            latest = snaps[-1]
            occ = 1 - (latest.available_spots / z.total_spots) if z.total_spots else 0
            parking_data.append({"zone": z.name, "occupancy_pct": occ, "available": latest.available_spots})

    stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()
    ev_data = []
    for st in stations[:8]:
        snaps = await _recent_snaps(db, EVSnapshot, "station_id", st.id, 3)
        if snaps:
            latest = snaps[-1]
            ev_data.append({"station": st.name, "available_ports": latest.available_ports, "avg_wait_minutes": latest.avg_wait_minutes})

    routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()
    transit_data = []
    for r in routes[:10]:
        snaps = await _recent_snaps(db, TransitSnapshot, "route_id", r.id, 3)
        if snaps:
            latest = snaps[-1]
            transit_data.append({"route": r.name, "occupancy_level": latest.occupancy_level, "delay_minutes": latest.delay_minutes})

    client = _get_client()
    if not client or (not parking_data and not ev_data and not transit_data):
        alerts = _rule_based_surge(city, parking_data, ev_data, transit_data)
        return {
            "city": city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "alerts": alerts,
            "ai_generated": False,
        }

    system = (
        "You are an urban surge prediction AI. Analyze current city metrics and identify emerging surges. "
        "Return ONLY valid JSON: {\"alerts\": [{\"domain\": str, \"severity\": \"low|medium|high\", "
        "\"message\": str, \"tip\": str, \"predicted_peak_in_mins\": int}]}. "
        "Max 3 alerts. If conditions are good, return one low-severity alert saying so."
    )
    prompt = (
        f"City: {city}\n"
        f"Parking (top zones): {json.dumps(parking_data[:5])}\n"
        f"EV Charging: {json.dumps(ev_data[:5])}\n"
        f"Transit: {json.dumps(transit_data[:5])}\n\n"
        "Identify any emerging surges or congestion patterns. "
        "Predict when peak will hit and give actionable tips. Return JSON only."
    )

    try:
        msg = await client.messages.create(
            model=settings.ai_model,
            max_tokens=400,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        result = _parse_json(msg.content[0].text)
        alerts = result.get("alerts", [])
    except Exception as e:
        logger.warning(f"Surge AI fallback: {e}")
        alerts = _rule_based_surge(city, parking_data, ev_data, transit_data)
        return {
            "city": city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "alerts": alerts,
            "ai_generated": False,
        }

    return {
        "city": city,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "alerts": alerts,
        "ai_generated": True,
    }
