from __future__ import annotations

"""
City Right Now — 3-sentence AI narrative of the city's current mood and atmosphere.
Cached 5 minutes per city. Used as a real-time "vibe card" on the dashboard.
"""
import json
import logging
import re
import time as _time
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.routes.concierge import _build_rich_context, _get_client

router = APIRouter(prefix="/api/narrative", tags=["Narrative"])
logger = logging.getLogger(__name__)

_CACHE_TTL = 300  # 5 minutes
_cache: dict[str, tuple[float, dict]] = {}

_MOOD_COLORS = {
    "Buzzing": "#f59e0b",
    "Steady":  "#3b82f6",
    "Quiet":   "#22c55e",
    "Stressed": "#ef4444",
}


def _parse_json(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    return json.loads(cleaned)


def _rule_based_narrative(city: str, ctx: str) -> dict:
    lines = ctx.splitlines()
    noise_lines = [l for l in lines if "vibe" in l.lower() and "•" in l]
    air_lines = [l for l in lines if "AQI" in l]
    transit_lines = [l for l in lines if "%" in l and "min" in l and "•" in l]

    vibe = noise_lines[0].strip(" •") if noise_lines else "the city"
    air = air_lines[0].strip() if air_lines else "air quality is normal"
    transit = transit_lines[0].strip(" •") if transit_lines else "transit is running"

    narrative = f"{city} is active right now — {vibe}. {air}. {transit}."
    mood = "Steady"
    return {"narrative": narrative, "mood": mood}


@router.get("")
async def get_narrative(
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    """3-sentence AI city mood narrative for the current moment."""

    now = _time.monotonic()
    if city in _cache and now - _cache[city][0] < _CACHE_TTL:
        return _cache[city][1]

    try:
        ctx = await _build_rich_context(db, city)
    except Exception as e:
        logger.error(f"Narrative context failed for {city}: {e}", exc_info=True)
        ctx = f"City: {city}"

    client = _get_client()
    if not client:
        rb = _rule_based_narrative(city, ctx)
        result = {
            "city": city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "narrative": rb["narrative"],
            "mood": rb["mood"],
            "mood_color": _MOOD_COLORS.get(rb["mood"], "#3b82f6"),
            "ai_generated": False,
        }
        _cache[city] = (_time.monotonic(), result)
        return result

    system = (
        f"You are a city journalist writing a real-time mood snapshot for {city}. "
        "Write EXACTLY 3 sentences describing the city's current atmosphere. "
        "Be vivid and specific — use actual location names, real AQI numbers, real zone names. "
        "Example style: 'Downtown Austin is buzzing tonight with 6th Street at 82% vibe. "
        "The air is clean at AQI 38, making outdoor patios packed. "
        "Route 1 bus is 71% full — consider grabbing a bike instead.'\n\n"
        "Return ONLY this JSON (no markdown):\n"
        '{"narrative": "sentence1. sentence2. sentence3.", "mood": "Buzzing|Steady|Quiet|Stressed"}'
    )

    try:
        msg = await client.messages.create(
            model=settings.ai_model,
            max_tokens=250,
            system=system,
            messages=[{"role": "user", "content": f"Current {city} conditions:\n{ctx[:2000]}"}],
        )
        parsed = _parse_json(msg.content[0].text)
        mood = parsed.get("mood", "Steady")
        result = {
            "city": city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "narrative": parsed.get("narrative", ""),
            "mood": mood,
            "mood_color": _MOOD_COLORS.get(mood, "#3b82f6"),
            "ai_generated": True,
        }
    except Exception as e:
        logger.warning(f"Narrative AI failed for {city}: {e}")
        rb = _rule_based_narrative(city, ctx)
        result = {
            "city": city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "narrative": rb["narrative"],
            "mood": rb["mood"],
            "mood_color": _MOOD_COLORS.get(rb["mood"], "#3b82f6"),
            "ai_generated": False,
        }

    _cache[city] = (_time.monotonic(), result)
    return result
