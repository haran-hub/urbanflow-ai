from __future__ import annotations

"""
Daily City Briefing — AI-generated morning summary of city conditions.
Covers all 8 domains with specific names, numbers, and actionable highlights.
Cached 5 minutes per city to avoid redundant Claude calls.
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

router = APIRouter(prefix="/api/briefing", tags=["Briefing"])
logger = logging.getLogger(__name__)

_CACHE_TTL = 300  # 5 minutes
_cache: dict[str, tuple[float, dict]] = {}


def _parse_json(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    return json.loads(cleaned)


def _rule_based_briefing(city: str, ctx: str) -> dict:
    """Build a basic briefing from the raw context string when Claude is unavailable."""
    lines = ctx.splitlines()

    def _find(heading: str) -> str:
        for i, l in enumerate(lines):
            if heading in l:
                parts = [x.strip() for x in lines[i + 1:i + 4] if x.strip() and x.startswith("  •")]
                return parts[0] if parts else ""
        return ""

    parking_line = _find("PARKING")
    air_line = _find("AIR QUALITY")
    transit_line = _find("TRANSIT")
    food_line = _find("FOOD TRUCKS")

    briefing = (
        f"Live city update for {city}: "
        f"{parking_line or 'Parking data loading'}. "
        f"{air_line or 'Air quality data loading'}. "
        f"{transit_line or 'Transit running normally'}."
    )
    highlights = [x for x in [parking_line, air_line, transit_line, food_line] if x][:4]
    return {"briefing": briefing, "highlights": highlights or ["Live city data available — check individual sections."]}


@router.get("/today")
async def get_briefing(
    city: str = Query(default="San Francisco"),
    db: AsyncSession = Depends(get_db),
):
    """AI-generated daily city briefing covering all 8 urban domains."""

    now = _time.monotonic()
    if city in _cache and now - _cache[city][0] < _CACHE_TTL:
        return _cache[city][1]

    try:
        ctx = await _build_rich_context(db, city)
    except Exception as e:
        logger.error(f"Briefing context failed for {city}: {e}", exc_info=True)
        ctx = f"City: {city} (live data temporarily unavailable)"

    client = _get_client()
    if not client:
        fallback = _rule_based_briefing(city, ctx)
        result = {
            "city": city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "briefing": fallback["briefing"],
            "highlights": fallback["highlights"],
            "ai_generated": False,
        }
        _cache[city] = (_time.monotonic(), result)
        return result

    system = (
        f"You are UrbanFlow AI writing a live city briefing for {city}. "
        "Write a 3-4 sentence morning briefing paragraph that sounds like a friendly, sharp radio host. "
        "Reference SPECIFIC named locations, ACTUAL AQI numbers, REAL zone names, REAL food truck names. "
        "Then return ONLY this JSON (no markdown, no extra text):\n"
        '{"briefing": "...", "highlights": ["...", "...", "...", "..."]}\n'
        "Highlights: 3-5 short facts under 12 words each. Examples: "
        "'Barton Springs parking 78% full by 9am', 'AQI 42 — excellent day for a run', "
        "'Route 803 delayed 8 min — try bike share'."
    )

    try:
        msg = await client.messages.create(
            model=settings.ai_model,
            max_tokens=450,
            system=system,
            messages=[{"role": "user", "content": f"{city} live conditions:\n{ctx}"}],
        )
        parsed = _parse_json(msg.content[0].text)
        result = {
            "city": city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "briefing": parsed.get("briefing", ""),
            "highlights": parsed.get("highlights", []),
            "ai_generated": True,
        }
    except Exception as e:
        logger.warning(f"Briefing AI failed for {city}: {e}")
        fallback = _rule_based_briefing(city, ctx)
        result = {
            "city": city,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "briefing": fallback["briefing"],
            "highlights": fallback["highlights"],
            "ai_generated": False,
        }

    _cache[city] = (_time.monotonic(), result)
    return result
