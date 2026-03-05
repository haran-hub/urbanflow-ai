from __future__ import annotations

"""
AI City Concierge — interactive multi-turn Q&A about current city conditions.
Context includes specific entity names, real numbers, and conversation history.
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


async def _build_rich_context(db: AsyncSession, city: str, question: str) -> str:
    """
    Build a rich, entity-level snapshot so Claude can give specific, varied answers.
    The context includes real names, addresses, and current numbers.
    """
    q = question.lower()
    lines = [
        f"=== LIVE DATA FOR {city.upper()} ===",
        f"Time: {datetime.utcnow().strftime('%A %H:%M UTC')}",
        "",
    ]

    # ── Parking ────────────────────────────────────────────────────────────────
    zones = (await db.execute(select(ParkingZone).where(ParkingZone.city == city))).scalars().all()
    if zones:
        zone_data = []
        for z in zones:
            s = await _latest_snap(db, ParkingSnapshot, "zone_id", z.id)
            avail = s.available_spots if s else z.total_spots
            occ = round((s.occupancy_pct or 0) * 100) if s else 0
            zone_data.append((z.name, z.address, z.zone_type, avail, z.total_spots, occ, z.hourly_rate))
        # Sort: most available first
        zone_data.sort(key=lambda x: x[3], reverse=True)
        lines.append("PARKING ZONES (sorted by availability):")
        for name, addr, ztype, avail, total, occ, rate in zone_data[:8]:
            rate_str = f"${rate}/hr" if rate > 0 else "Free"
            lines.append(f"  • {name} ({ztype}) — {avail}/{total} spots free ({occ}% full) · {rate_str} · {addr}")
        lines.append("")

    # ── EV Charging ────────────────────────────────────────────────────────────
    stations = (await db.execute(select(EVStation).where(EVStation.city == city))).scalars().all()
    if stations:
        ev_data = []
        for st in stations:
            s = await _latest_snap(db, EVSnapshot, "station_id", st.id)
            avail = s.available_ports if s else st.total_ports
            wait = s.avg_wait_minutes if s else 0
            status = s.status if s else "Unknown" if not s else "Unknown"
            # Get status from snapshot model
            ev_data.append((st.name, st.address, st.network, avail, st.total_ports, wait))
        ev_data.sort(key=lambda x: x[3], reverse=True)
        lines.append("EV CHARGING STATIONS (sorted by availability):")
        for name, addr, network, avail, total, wait in ev_data[:6]:
            wait_str = f"{wait} min wait" if wait > 0 else "No wait"
            lines.append(f"  • {name} ({network}) — {avail}/{total} ports free · {wait_str} · {addr}")
        lines.append("")

    # ── Transit ────────────────────────────────────────────────────────────────
    routes = (await db.execute(select(TransitRoute).where(TransitRoute.city == city))).scalars().all()
    if routes:
        transit_data = []
        for r in routes:
            s = await _latest_snap(db, TransitSnapshot, "route_id", r.id)
            crowd = s.occupancy_level if s else 0
            delay = s.delay_minutes if s else 0
            next_arr = s.next_arrival_mins if s else r.frequency_mins
            transit_data.append((r.name, r.route_type, crowd, delay, next_arr))
        # Show least crowded first
        transit_data.sort(key=lambda x: x[2])
        lines.append("TRANSIT ROUTES (sorted by crowd, least crowded first):")
        for name, rtype, crowd, delay, next_arr in transit_data[:8]:
            delay_str = f" ⚠ {delay} min delay" if delay > 3 else " on time"
            crowd_label = "Empty" if crowd < 30 else "Comfortable" if crowd < 60 else "Busy" if crowd < 80 else "Packed"
            lines.append(f"  • {name} ({rtype}) — {crowd_label} ({crowd}%){delay_str} · next in {next_arr} min")
        lines.append("")

    # ── Local Services ─────────────────────────────────────────────────────────
    svcs = (await db.execute(select(LocalService).where(LocalService.city == city))).scalars().all()
    if svcs:
        svc_data = []
        for sv in svcs:
            s = await _latest_snap(db, ServiceSnapshot, "service_id", sv.id)
            is_open = s.is_open if s else False
            wait = s.estimated_wait_minutes if s else 0
            svc_data.append((sv.name, sv.category, sv.address, is_open, wait, sv.typical_hours))
        open_svcs = [(n, cat, addr, w, hrs) for n, cat, addr, is_open, w, hrs in svc_data if is_open]
        closed_svcs = [(n, cat) for n, cat, _, is_open, _, _ in svc_data if not is_open]
        lines.append("LOCAL SERVICES:")
        if open_svcs:
            lines.append("  Open now:")
            for name, cat, addr, wait, hrs in sorted(open_svcs, key=lambda x: x[3])[:8]:
                wait_str = f"{wait} min wait" if wait > 0 else "no wait"
                lines.append(f"    • {name} ({cat}) — {wait_str} · {addr}")
        if closed_svcs:
            lines.append(f"  Closed ({len(closed_svcs)}): {', '.join(f'{n} ({c})' for n, c in closed_svcs[:5])}")
        lines.append("")

    # ── Air Quality ────────────────────────────────────────────────────────────
    air_sts = (await db.execute(select(AirStation).where(AirStation.city == city))).scalars().all()
    if air_sts:
        air_data = []
        for a in air_sts:
            s = await _latest_snap(db, AirSnapshot, "station_id", a.id)
            if s:
                air_data.append((a.name, s.aqi, s.category, s.pm25, s.uv_index, s.pollen_level, s.health_advisory))
        if air_data:
            lines.append("AIR QUALITY:")
            for name, aqi, cat, pm25, uv, pollen, advisory in air_data[:4]:
                lines.append(f"  • {name} — AQI {aqi} ({cat}) · PM2.5: {pm25:.1f} · UV: {uv} · Pollen: {pollen}/5")
            if air_data[0][6]:
                lines.append(f"  Advisory: {air_data[0][6]}")
        lines.append("")

    # ── Bikes ──────────────────────────────────────────────────────────────────
    bss = (await db.execute(select(BikeStation).where(BikeStation.city == city))).scalars().all()
    if bss:
        bike_data = []
        for bs in bss:
            s = await _latest_snap(db, BikeSnapshot, "station_id", bs.id)
            if s:
                total = s.available_bikes + s.available_ebikes
                bike_data.append((bs.name, bs.address, s.available_bikes, s.available_ebikes, s.available_docks, total))
        bike_data.sort(key=lambda x: x[5], reverse=True)
        lines.append("BIKE SHARE STATIONS (top available):")
        for name, addr, bikes, ebikes, docks, total in bike_data[:6]:
            lines.append(f"  • {name} — {bikes} bikes + {ebikes} e-bikes · {docks} empty docks · {addr}")
        lines.append("")

    # ── Food Trucks ────────────────────────────────────────────────────────────
    trucks = (await db.execute(select(FoodTruck).where(FoodTruck.city == city))).scalars().all()
    if trucks:
        truck_data = []
        for t in trucks:
            s = await _latest_snap(db, FoodTruckSnapshot, "truck_id", t.id)
            is_open = s.is_open if s else False
            wait = s.wait_minutes if s else 0
            crowd = s.crowd_level if s else 0
            truck_data.append((t.name, t.cuisine, t.address, is_open, wait, crowd))
        open_trucks = [(n, c, addr, w, cr) for n, c, addr, is_open, w, cr in truck_data if is_open]
        lines.append("FOOD TRUCKS:")
        if open_trucks:
            lines.append("  Open now:")
            for name, cuisine, addr, wait, crowd in sorted(open_trucks, key=lambda x: x[3])[:8]:
                wait_str = f"{wait} min wait" if wait > 0 else "no wait"
                crowd_pct = f"{crowd}% full"
                lines.append(f"    • {name} ({cuisine}) — {wait_str} · {crowd_pct} · {addr}")
        else:
            lines.append("  No food trucks open right now")
        lines.append("")

    # ── Noise & Vibe ───────────────────────────────────────────────────────────
    nzs = (await db.execute(select(NoiseZone).where(NoiseZone.city == city))).scalars().all()
    if nzs:
        vibe_data = []
        for nz in nzs:
            s = await _latest_snap(db, NoiseSnapshot, "zone_id", nz.id)
            if s:
                vibe_data.append((nz.name, nz.address, s.vibe_score, s.vibe_label, s.noise_db, s.crowd_density))
        vibe_data.sort(key=lambda x: x[2], reverse=True)
        lines.append("NEIGHBORHOOD VIBE (sorted by energy):")
        for name, addr, vibe, label, noise, crowd in vibe_data[:6]:
            lines.append(f"  • {name} — {label} (vibe {vibe}/100 · {noise}dB · {crowd}% crowd) · {addr}")
        lines.append("")

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
    """
    Answer a natural language question about current city conditions.
    Accepts conversation history for multi-turn interactive chat.
    """
    ctx = await _build_rich_context(db, request.city, request.question)

    client = _get_client()
    if not client:
        return {
            "answer": (
                f"I can see live data for {request.city} right now, but my AI connection isn't available. "
                "Check the individual category pages for real-time details!"
            ),
            "city": request.city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }

    system = (
        f"You are UrbanFlow AI, a sharp and friendly city concierge for {request.city}. "
        "You have access to real-time city data shown below. Always use the SPECIFIC names, numbers, "
        "and addresses from the data — never give vague generic answers. "
        "If the user asks about parking, name actual parking zones. "
        "If they ask about food, name actual open food trucks. "
        "If they ask about transit, mention specific route names and whether they're delayed. "
        "Be conversational, direct, and helpful — like a knowledgeable local. "
        "Keep answers under 120 words unless the user asks for details. "
        "Never say 'I don't have access to real-time data' — you DO have it below.\n\n"
        f"{ctx}"
    )

    # Build multi-turn message history
    messages: list[dict] = []
    for msg in request.history[-10:]:  # keep last 10 exchanges
        messages.append({"role": msg.role, "content": msg.content})
    # Add current question
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
        logger.warning(f"Concierge error: {e}")
        answer = (
            f"I'm having trouble connecting right now. Based on current {request.city} data: "
            "check parking zones, EV stations, and transit routes in the respective pages for live info!"
        )

    return {
        "answer": answer,
        "city": request.city,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
