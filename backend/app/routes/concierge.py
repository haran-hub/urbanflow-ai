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
from sqlalchemy import select, desc, func

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


async def _latest_snaps_bulk(db, snap_model, fk_field, entity_ids: list[str]) -> dict:
    """Fetch the latest snapshot for each entity_id in one query using a subquery."""
    if not entity_ids:
        return {}
    # Subquery: max timestamp per entity
    sub = (
        select(
            getattr(snap_model, fk_field),
            func.max(snap_model.timestamp).label("max_ts"),
        )
        .where(getattr(snap_model, fk_field).in_(entity_ids))
        .group_by(getattr(snap_model, fk_field))
        .subquery()
    )
    rows = (
        await db.execute(
            select(snap_model).join(
                sub,
                (getattr(snap_model, fk_field) == sub.c[fk_field])
                & (snap_model.timestamp == sub.c.max_ts),
            )
        )
    ).scalars().all()
    return {getattr(r, fk_field): r for r in rows}


async def _build_rich_context(db: AsyncSession, city: str) -> str:
    """
    Build entity-level city data for Claude: actual names, addresses, real numbers.
    Uses bulk queries (not N+1) so it stays fast.
    """
    lines = [
        f"=== LIVE {city.upper()} DATA — {datetime.utcnow().strftime('%A %H:%M UTC')} ===",
        "",
    ]

    # ── Parking ────────────────────────────────────────────────────────────────
    zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()
    snaps = await _latest_snaps_bulk(db, ParkingSnapshot, "zone_id", [z.id for z in zones])
    rows = []
    for z in zones:
        s = snaps.get(z.id)
        avail = s.available_spots if s else z.total_spots
        occ = round((s.occupancy_pct or 0) * 100) if s else 0
        rate = f"${z.hourly_rate}/hr" if z.hourly_rate > 0 else "Free"
        rows.append((avail, f"• {z.name} [{z.zone_type}] {avail}/{z.total_spots} spots ({occ}% full) {rate} — {z.address}"))
    rows.sort(key=lambda x: x[0], reverse=True)
    lines.append("PARKING (most available first):")
    lines += [r for _, r in rows[:8]]
    lines.append("")

    # ── EV Charging ────────────────────────────────────────────────────────────
    stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()
    snaps = await _latest_snaps_bulk(db, EVSnapshot, "station_id", [s.id for s in stations])
    rows = []
    for st in stations:
        s = snaps.get(st.id)
        avail = s.available_ports if s else st.total_ports
        wait = s.avg_wait_minutes if s else 0
        wait_str = f"{wait}min wait" if wait > 0 else "no queue"
        rows.append((avail, f"• {st.name} ({st.network}) {avail}/{st.total_ports} ports — {wait_str} — {st.address}"))
    rows.sort(key=lambda x: x[0], reverse=True)
    lines.append("EV CHARGING (most available first):")
    lines += [r for _, r in rows[:6]]
    lines.append("")

    # ── Transit ────────────────────────────────────────────────────────────────
    routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()
    snaps = await _latest_snaps_bulk(db, TransitSnapshot, "route_id", [r.id for r in routes])
    rows = []
    for r in routes:
        s = snaps.get(r.id)
        crowd = s.occupancy_level if s else 0
        delay = s.delay_minutes if s else 0
        nxt = s.next_arrival_mins if s else r.frequency_mins
        label = "Empty" if crowd < 30 else "Comfortable" if crowd < 60 else "Busy" if crowd < 80 else "Packed"
        delay_str = f" ⚠{delay}min delay" if delay > 3 else " on-time"
        rows.append((crowd, f"• {r.name} [{r.route_type}] {label} ({crowd}%){delay_str} — next in {nxt}min"))
    rows.sort(key=lambda x: x[0])  # least crowded first
    lines.append("TRANSIT (least crowded first):")
    lines += [r for _, r in rows[:8]]
    lines.append("")

    # ── Local Services ─────────────────────────────────────────────────────────
    svcs = (await db.execute(select(LocalService).where(LocalService.city == city))).scalars().all()
    snaps = await _latest_snaps_bulk(db, ServiceSnapshot, "service_id", [sv.id for sv in svcs])
    open_lines, closed_names = [], []
    for sv in svcs:
        s = snaps.get(sv.id)
        if s and s.is_open:
            wait = s.estimated_wait_minutes
            wait_str = f"{wait}min wait" if wait > 0 else "no wait"
            open_lines.append((wait, f"• {sv.name} [{sv.category}] {wait_str} — {sv.address}"))
        else:
            closed_names.append(sv.name)
    open_lines.sort()
    lines.append("LOCAL SERVICES:")
    if open_lines:
        lines.append("  Open now:")
        lines += [f"    {r}" for _, r in open_lines[:8]]
    if closed_names:
        lines.append(f"  Closed ({len(closed_names)}): {', '.join(closed_names[:6])}")
    lines.append("")

    # ── Air Quality ────────────────────────────────────────────────────────────
    air_sts = (await db.execute(select(AirStation).where(AirStation.city == city))).scalars().all()
    snaps = await _latest_snaps_bulk(db, AirSnapshot, "station_id", [a.id for a in air_sts])
    lines.append("AIR QUALITY:")
    for a in air_sts[:4]:
        s = snaps.get(a.id)
        if s:
            pollen_label = ["None", "Low", "Medium", "High", "Very High"][min(s.pollen_level, 4)]
            lines.append(
                f"• {a.name}: AQI {s.aqi} ({s.category}) — PM2.5:{s.pm25:.1f} O3:{s.o3:.1f} "
                f"UV:{s.uv_index:.0f} Pollen:{pollen_label}"
            )
    lines.append("")

    # ── Bikes ──────────────────────────────────────────────────────────────────
    bss = (await db.execute(select(BikeStation).where(BikeStation.city == city))).scalars().all()
    snaps = await _latest_snaps_bulk(db, BikeSnapshot, "station_id", [bs.id for bs in bss])
    rows = []
    for bs in bss:
        s = snaps.get(bs.id)
        if s:
            total = s.available_bikes + s.available_ebikes
            rows.append((total, f"• {bs.name}: {s.available_bikes} bikes + {s.available_ebikes} e-bikes, {s.available_docks} empty docks — {bs.address}"))
    rows.sort(key=lambda x: x[0], reverse=True)
    lines.append("BIKE SHARE (most available first):")
    lines += [r for _, r in rows[:6]]
    lines.append("")

    # ── Food Trucks ────────────────────────────────────────────────────────────
    trucks = (await db.execute(select(FoodTruck).where(FoodTruck.city == city))).scalars().all()
    snaps = await _latest_snaps_bulk(db, FoodTruckSnapshot, "truck_id", [t.id for t in trucks])
    open_trucks, closed_trucks = [], []
    for t in trucks:
        s = snaps.get(t.id)
        if s and s.is_open:
            wait = s.wait_minutes
            wait_str = f"{wait}min wait" if wait > 0 else "no wait"
            open_trucks.append((wait, f"• {t.name} [{t.cuisine}] {wait_str}, {s.crowd_level}% crowd — {t.address}"))
        else:
            closed_trucks.append(t.name)
    open_trucks.sort()
    lines.append("FOOD TRUCKS:")
    if open_trucks:
        lines.append("  Open now:")
        lines += [f"    {r}" for _, r in open_trucks[:8]]
    else:
        lines.append("  None open right now")
    if closed_trucks:
        lines.append(f"  Closed: {', '.join(closed_trucks[:5])}")
    lines.append("")

    # ── Noise & Vibe ───────────────────────────────────────────────────────────
    nzs = (await db.execute(select(NoiseZone).where(NoiseZone.city == city))).scalars().all()
    snaps = await _latest_snaps_bulk(db, NoiseSnapshot, "zone_id", [nz.id for nz in nzs])
    rows = []
    for nz in nzs:
        s = snaps.get(nz.id)
        if s:
            rows.append((s.vibe_score, f"• {nz.name} [{nz.zone_type}] {s.vibe_label} — vibe {s.vibe_score}/100, {s.noise_db:.0f}dB, {s.crowd_density}% crowd — {nz.address}"))
    rows.sort(key=lambda x: x[0], reverse=True)
    lines.append("NEIGHBORHOOD VIBE (liveliest first):")
    lines += [r for _, r in rows[:6]]

    return "\n".join(lines)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AskRequest(BaseModel):
    question: str
    city: str = "San Francisco"
    history: list[ChatMessage] = []


@router.post("/ask")
async def ask_concierge(request: AskRequest, db: AsyncSession = Depends(get_db)):
    """Multi-turn city Q&A with entity-level live data injected into every request."""

    # Build rich context — wrap so errors here don't kill the whole endpoint
    try:
        ctx = await _build_rich_context(db, request.city)
    except Exception as e:
        logger.error(f"Context build failed for {request.city}: {e}", exc_info=True)
        ctx = f"City: {request.city} (live data temporarily unavailable)"

    client = _get_client()
    if not client:
        return {
            "answer": (
                f"My AI connection isn't available right now (no API key configured). "
                f"But here's what I can see for {request.city}: " + ctx[:300]
            ),
            "city": request.city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

    system = (
        f"You are UrbanFlow AI, a sharp, friendly city concierge for {request.city}. "
        "You have access to REAL-TIME city data injected below — use it to give SPECIFIC answers. "
        "Always name actual places, quote real numbers, and reference the data directly. "
        "Examples:\n"
        "  Q: 'Where should I park?' → Name the top 2-3 parking zones with spot counts and rates.\n"
        "  Q: 'Is air quality safe for a run?' → Quote the AQI number and category, say yes/no clearly.\n"
        "  Q: 'What food trucks are open?' → List actual truck names and cuisines.\n"
        "  Q: 'Which transit is least crowded?' → Name the specific route and its crowd %.\n"
        "Never say 'I don't have access to real-time data' — you DO have it. "
        "Be conversational and direct. Under 120 words unless asked for details.\n\n"
        f"--- LIVE DATA ---\n{ctx}\n--- END DATA ---"
    )

    # Build multi-turn message list (last 10 exchanges for context)
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
        logger.error(f"Claude API error in concierge: {e}", exc_info=True)
        # Smart fallback: answer from the data we already have
        answer = _data_driven_fallback(request.question, ctx)

    return {
        "answer": answer,
        "city": request.city,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


def _data_driven_fallback(question: str, ctx: str) -> str:
    """When Claude is unavailable, extract relevant lines from the context."""
    q = question.lower()
    lines = ctx.splitlines()

    if any(w in q for w in ["park", "spot", "car", "garage"]):
        section = _extract_section(lines, "PARKING")
        return f"Current parking data:\n{section}" if section else "Check the Parking page for live availability."

    if any(w in q for w in ["ev", "charge", "electric", "plug", "charger"]):
        section = _extract_section(lines, "EV CHARGING")
        return f"Current EV data:\n{section}" if section else "Check the EV Charging page for port availability."

    if any(w in q for w in ["transit", "bus", "subway", "train", "route", "crowd"]):
        section = _extract_section(lines, "TRANSIT")
        return f"Current transit data:\n{section}" if section else "Check the Transit page for crowd levels."

    if any(w in q for w in ["air", "aqi", "pollution", "run", "outdoor", "breathe", "pollen"]):
        section = _extract_section(lines, "AIR QUALITY")
        return f"Current air quality:\n{section}" if section else "Check the Air Quality page."

    if any(w in q for w in ["food", "truck", "eat", "restaurant", "hungry", "lunch", "dinner"]):
        section = _extract_section(lines, "FOOD TRUCKS")
        return f"Current food truck status:\n{section}" if section else "Check the Food Trucks page."

    if any(w in q for w in ["bike", "scooter", "cycle", "dock"]):
        section = _extract_section(lines, "BIKE SHARE")
        return f"Current bike availability:\n{section}" if section else "Check the Bikes page."

    if any(w in q for w in ["vibe", "noise", "nightlife", "bar", "downtown", "scene", "energy"]):
        section = _extract_section(lines, "NEIGHBORHOOD VIBE")
        return f"Current neighborhood vibe:\n{section}" if section else "Check the Noise & Vibe page."

    return "I'm having trouble with my AI connection right now. Check the individual category pages for live data!"


def _extract_section(lines: list[str], heading: str) -> str:
    """Extract up to 5 lines after a section heading."""
    for i, line in enumerate(lines):
        if heading in line:
            relevant = [l for l in lines[i + 1: i + 7] if l.strip()]
            return "\n".join(relevant[:5])
    return ""
