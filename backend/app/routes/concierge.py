from __future__ import annotations

"""
AI City Concierge — interactive multi-turn Q&A about current city conditions.
Provides entity-level context (names, addresses, real numbers) so Claude can
give specific, varied answers, not generic ones.
"""
import logging
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends
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


async def _snap(db, model, fk_col, entity_id):
    """Fetch the single latest snapshot for one entity."""
    return (
        await db.execute(
            select(model)
            .where(getattr(model, fk_col) == entity_id)
            .order_by(desc(model.timestamp))
            .limit(1)
        )
    ).scalar_one_or_none()


async def _build_rich_context(db: AsyncSession, city: str) -> str:
    """
    Build entity-level city data: actual names, addresses, real numbers.
    Claude uses this to give specific, varied answers.
    """
    parts: list[str] = [
        f"=== LIVE {city.upper()} DATA — {datetime.utcnow().strftime('%A %H:%M UTC')} ===",
        "",
    ]

    # ── Parking ────────────────────────────────────────────────────────────────
    zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()
    rows = []
    for z in zones:
        s = await _snap(db, ParkingSnapshot, "zone_id", z.id)
        avail = s.available_spots if s else z.total_spots
        occ = round((s.occupancy_pct or 0) * 100) if s else 0
        rate = f"${z.hourly_rate}/hr" if z.hourly_rate > 0 else "Free"
        rows.append((avail, f"  • {z.name} [{z.zone_type}] — {avail}/{z.total_spots} spots ({occ}% full) {rate} — {z.address}"))
    rows.sort(reverse=True)
    parts.append("PARKING (most available first):")
    parts += [r for _, r in rows[:8]]
    parts.append("")

    # ── EV Charging ────────────────────────────────────────────────────────────
    stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()
    rows = []
    for st in stations:
        s = await _snap(db, EVSnapshot, "station_id", st.id)
        avail = s.available_ports if s else st.total_ports
        wait = s.avg_wait_minutes if s else 0
        wait_str = f"{wait}min wait" if wait > 0 else "no queue"
        rows.append((avail, f"  • {st.name} ({st.network}) — {avail}/{st.total_ports} ports, {wait_str} — {st.address}"))
    rows.sort(reverse=True)
    parts.append("EV CHARGING (most available first):")
    parts += [r for _, r in rows[:6]]
    parts.append("")

    # ── Transit ────────────────────────────────────────────────────────────────
    routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()
    rows = []
    for r in routes:
        s = await _snap(db, TransitSnapshot, "route_id", r.id)
        crowd = s.occupancy_level if s else 0
        delay = s.delay_minutes if s else 0
        nxt = s.next_arrival_mins if s else r.frequency_mins
        label = "Empty" if crowd < 30 else "Comfortable" if crowd < 60 else "Busy" if crowd < 80 else "Packed"
        delay_str = f" ⚠ {delay}min late" if delay > 3 else " on-time"
        rows.append((crowd, f"  • {r.name} [{r.route_type}] — {label} ({crowd}%){delay_str}, next in {nxt}min"))
    rows.sort()
    parts.append("TRANSIT (least crowded first):")
    parts += [r for _, r in rows[:8]]
    parts.append("")

    # ── Local Services ─────────────────────────────────────────────────────────
    svcs = (await db.execute(select(LocalService).where(LocalService.city == city))).scalars().all()
    open_lines: list[tuple] = []
    closed_names: list[str] = []
    for sv in svcs:
        s = await _snap(db, ServiceSnapshot, "service_id", sv.id)
        if s and s.is_open:
            wait_str = f"{s.estimated_wait_minutes}min wait" if s.estimated_wait_minutes > 0 else "no wait"
            open_lines.append((s.estimated_wait_minutes, f"    • {sv.name} [{sv.category}] — {wait_str} — {sv.address}"))
        else:
            closed_names.append(sv.name)
    open_lines.sort()
    parts.append("LOCAL SERVICES:")
    if open_lines:
        parts.append("  Open now:")
        parts += [r for _, r in open_lines[:8]]
    if closed_names:
        parts.append(f"  Closed: {', '.join(closed_names[:6])}")
    parts.append("")

    # ── Air Quality ────────────────────────────────────────────────────────────
    air_sts = (await db.execute(select(AirStation).where(AirStation.city == city))).scalars().all()
    parts.append("AIR QUALITY:")
    for a in air_sts[:4]:
        s = await _snap(db, AirSnapshot, "station_id", a.id)
        if s:
            pollen_labels = ["None", "Low", "Medium", "High", "Very High"]
            pollen = pollen_labels[min(s.pollen_level, 4)]
            parts.append(
                f"  • {a.name}: AQI {s.aqi} ({s.category}) — "
                f"PM2.5:{s.pm25:.1f} O3:{s.o3:.1f} UV:{s.uv_index:.0f} Pollen:{pollen}"
            )
    parts.append("")

    # ── Bikes ──────────────────────────────────────────────────────────────────
    bss = (await db.execute(select(BikeStation).where(BikeStation.city == city))).scalars().all()
    rows = []
    for bs in bss:
        s = await _snap(db, BikeSnapshot, "station_id", bs.id)
        if s:
            total = s.available_bikes + s.available_ebikes
            rows.append((total, f"  • {bs.name} — {s.available_bikes} bikes + {s.available_ebikes} e-bikes, {s.available_docks} empty docks — {bs.address}"))
    rows.sort(reverse=True)
    parts.append("BIKE SHARE (most available first):")
    parts += [r for _, r in rows[:6]]
    parts.append("")

    # ── Food Trucks ────────────────────────────────────────────────────────────
    trucks = (await db.execute(select(FoodTruck).where(FoodTruck.city == city))).scalars().all()
    open_trucks: list[tuple] = []
    closed_trucks: list[str] = []
    for t in trucks:
        s = await _snap(db, FoodTruckSnapshot, "truck_id", t.id)
        if s and s.is_open:
            wait_str = f"{s.wait_minutes}min wait" if s.wait_minutes > 0 else "no wait"
            open_trucks.append((s.wait_minutes, f"    • {t.name} [{t.cuisine}] — {wait_str}, {s.crowd_level}% crowd — {t.address}"))
        else:
            closed_trucks.append(t.name)
    open_trucks.sort()
    parts.append("FOOD TRUCKS:")
    if open_trucks:
        parts.append("  Open now:")
        parts += [r for _, r in open_trucks[:8]]
    else:
        parts.append("  None open right now")
    if closed_trucks:
        parts.append(f"  Closed: {', '.join(closed_trucks[:5])}")
    parts.append("")

    # ── Noise & Vibe ───────────────────────────────────────────────────────────
    nzs = (await db.execute(select(NoiseZone).where(NoiseZone.city == city))).scalars().all()
    rows = []
    for nz in nzs:
        s = await _snap(db, NoiseSnapshot, "zone_id", nz.id)
        if s:
            rows.append((s.vibe_score, f"  • {nz.name} [{nz.zone_type}] — {s.vibe_label}, vibe {s.vibe_score}/100, {s.noise_db:.0f}dB, {s.crowd_density}% crowd — {nz.address}"))
    rows.sort(reverse=True)
    parts.append("NEIGHBORHOOD VIBE (liveliest first):")
    parts += [r for _, r in rows[:6]]

    return "\n".join(parts)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AskRequest(BaseModel):
    question: str
    city: str = "San Francisco"
    history: list[ChatMessage] = []


@router.post("/ask")
async def ask_concierge(request: AskRequest, db: AsyncSession = Depends(get_db)):
    """Multi-turn city Q&A backed by live entity-level data."""

    try:
        ctx = await _build_rich_context(db, request.city)
    except Exception as e:
        logger.error(f"Context build failed for {request.city}: {e}", exc_info=True)
        ctx = f"City: {request.city} (live data temporarily unavailable)"

    client = _get_client()
    if not client:
        return {
            "answer": (
                f"AI connection not configured (no API key). "
                f"Live data is available — check the individual city pages!"
            ),
            "city": request.city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

    system = (
        f"You are UrbanFlow AI, a sharp, friendly city concierge for {request.city}. "
        "You have REAL-TIME city data below. Always answer with SPECIFIC details from it: "
        "actual names, real numbers, actual addresses. Never be vague. Examples:\n"
        "  'Where to park?' → name the top 2-3 zones with spot counts and rates.\n"
        "  'Air safe for a run?' → quote the AQI number and say yes/no clearly.\n"
        "  'Food trucks open?' → list actual truck names and cuisines.\n"
        "  'Least crowded transit?' → name the route and its exact crowd %.\n"
        "Be conversational and direct. Under 120 words unless asked for more.\n\n"
        f"--- LIVE DATA ---\n{ctx}\n--- END ---"
    )

    messages: list[dict] = [
        {"role": m.role, "content": m.content}
        for m in request.history[-10:]
    ]
    messages.append({"role": "user", "content": request.question})

    try:
        msg = await client.messages.create(
            model=settings.ai_model,
            max_tokens=400,
            system=system,
            messages=messages,
        )
        answer = msg.content[0].text.strip()
    except Exception as e:
        logger.error(f"Claude API error: {e}", exc_info=True)
        answer = _data_fallback(request.question, ctx)

    return {
        "answer": answer,
        "city": request.city,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


def _data_fallback(question: str, ctx: str) -> str:
    """Return relevant data lines when Claude is unavailable."""
    q = question.lower()
    lines = ctx.splitlines()

    section_map = {
        ("park", "spot", "garage", "lot", "car"): "PARKING",
        ("ev", "charg", "electric", "plug", "port"): "EV CHARGING",
        ("transit", "bus", "train", "subway", "route", "crowd"): "TRANSIT",
        ("hospital", "bank", "pharmacy", "dmv", "service", "wait"): "LOCAL SERVICES",
        ("air", "aqi", "pollution", "run", "outdoor", "breath", "pollen", "uv"): "AIR QUALITY",
        ("bike", "ebike", "scooter", "dock", "cycle"): "BIKE SHARE",
        ("food", "truck", "eat", "taco", "lunch", "dinner", "cuisine"): "FOOD TRUCKS",
        ("vibe", "noise", "night", "bar", "downtown", "scene", "energy", "crowd"): "NEIGHBORHOOD VIBE",
    }

    for keywords, heading in section_map.items():
        if any(k in q for k in keywords):
            section = _extract(lines, heading)
            return f"{heading}:\n{section}" if section else f"Check the {heading.title()} page for live data."

    return "Check the individual category pages for live city data!"


def _extract(lines: list[str], heading: str) -> str:
    for i, line in enumerate(lines):
        if heading in line:
            relevant = [l for l in lines[i + 1: i + 10] if l.strip()]
            return "\n".join(relevant[:6])
    return ""
