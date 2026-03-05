from __future__ import annotations

"""
Micro-moment Planner — finds the optimal time window today for any urban activity.
Combines air quality, food trucks, noise/vibe, parking, and transit to answer
queries like "best time for an outdoor lunch" or "when to charge my EV".
"""
import json
import logging
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.routes.concierge import _build_rich_context, _get_client

router = APIRouter(prefix="/api/moment", tags=["Moment"])
logger = logging.getLogger(__name__)

CITY_TIMEZONES = {
    "San Francisco": "America/Los_Angeles",
    "New York":      "America/New_York",
    "Austin":        "America/Chicago",
}


class MomentRequest(BaseModel):
    city: str = "San Francisco"
    query: str


def _parse_json(text: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    return json.loads(cleaned)


def _local_time_str(city: str) -> str:
    tz = ZoneInfo(CITY_TIMEZONES.get(city, "UTC"))
    return datetime.now(tz).strftime("%A %H:%M %Z")


def _rule_based_moment(query: str, city: str) -> dict:
    q = query.lower()
    if any(k in q for k in ("lunch", "eat", "food", "truck")):
        return {
            "best_window": {"time_range": "12:00–13:30", "score": 78, "reason": "Food trucks peak at midday with most variety", "conditions": {"food_trucks": "Most open", "air": "Typical daytime AQI"}},
            "alternative_windows": [{"time_range": "11:30–12:00", "score": 65, "reason": "Early lunch — shorter queues", "conditions": {}}],
            "avoid_window": {"time_range": "13:30–14:30", "score": 30, "reason": "Post-lunch rush — long waits", "conditions": {}},
            "summary": "Midday is best for food trucks — aim for 12:00–13:30.",
        }
    if any(k in q for k in ("run", "jog", "exercise", "outdoor", "walk", "air")):
        return {
            "best_window": {"time_range": "07:00–09:00", "score": 85, "reason": "Morning air is cleanest before traffic builds", "conditions": {"air": "Lowest AQI of day", "noise": "Quiet"}},
            "alternative_windows": [{"time_range": "17:30–19:00", "score": 70, "reason": "Evening cool-down window", "conditions": {}}],
            "avoid_window": {"time_range": "09:00–11:00", "score": 40, "reason": "Rush hour raises PM2.5 and ozone", "conditions": {}},
            "summary": "Early morning is ideal for outdoor activity — best air quality.",
        }
    if any(k in q for k in ("ev", "charg", "electric")):
        return {
            "best_window": {"time_range": "10:00–12:00", "score": 80, "reason": "Mid-morning has shortest EV queue", "conditions": {"ev": "Lowest wait times", "parking": "Available nearby"}},
            "alternative_windows": [{"time_range": "14:00–16:00", "score": 68, "reason": "Post-lunch lull before evening rush", "conditions": {}}],
            "avoid_window": {"time_range": "17:00–20:00", "score": 25, "reason": "Evening rush — EV stations backed up", "conditions": {}},
            "summary": "Mid-morning is the sweet spot for EV charging with minimal wait.",
        }
    return {
        "best_window": {"time_range": "10:00–12:00", "score": 75, "reason": "Mid-morning is generally optimal for most city activities", "conditions": {}},
        "alternative_windows": [{"time_range": "14:00–16:00", "score": 65, "reason": "Afternoon lull", "conditions": {}}],
        "avoid_window": {"time_range": "17:00–19:00", "score": 30, "reason": "Evening rush hour across all domains", "conditions": {}},
        "summary": "Mid-morning or early afternoon are the best windows for most activities.",
    }


@router.post("/plan")
async def plan_moment(request: MomentRequest, db: AsyncSession = Depends(get_db)):
    """Find the optimal time window today for a user-specified urban activity."""

    try:
        ctx = await _build_rich_context(db, request.city)
    except Exception as e:
        logger.error(f"Moment context failed: {e}", exc_info=True)
        ctx = f"City: {request.city}"

    local_time = _local_time_str(request.city)

    client = _get_client()
    if not client:
        rb = _rule_based_moment(request.query, request.city)
        return {
            "city": request.city,
            "query": request.query,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            **rb,
            "ai_generated": False,
        }

    system = (
        f"You are an urban timing optimizer for {request.city}. "
        "Given a user's activity query and current city conditions, find the optimal time window today. "
        "Consider: air quality for outdoor activities, food truck open hours, noise/vibe levels, "
        "parking availability, transit crowd levels, EV charger wait times. "
        "Use SPECIFIC location names and real numbers from the data. "
        "Return ONLY valid JSON (no markdown):\n"
        "{\n"
        '  "best_window": {"time_range": "HH:MM–HH:MM", "score": 0-100, "reason": str, "conditions": {"domain": "detail"}},\n'
        '  "alternative_windows": [{"time_range": str, "score": int, "reason": str, "conditions": {}}],\n'
        '  "avoid_window": {"time_range": str, "score": int, "reason": str, "conditions": {}},\n'
        '  "summary": "one sentence"\n'
        "}"
    )
    user_msg = (
        f"Query: {request.query}\n"
        f"City: {request.city}\n"
        f"Current local time: {local_time}\n\n"
        f"Live city data:\n{ctx}"
    )

    try:
        msg = await client.messages.create(
            model=settings.ai_model,
            max_tokens=500,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )
        parsed = _parse_json(msg.content[0].text)
        return {
            "city": request.city,
            "query": request.query,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "best_window": parsed.get("best_window", {}),
            "alternative_windows": parsed.get("alternative_windows", []),
            "avoid_window": parsed.get("avoid_window", {}),
            "summary": parsed.get("summary", ""),
            "ai_generated": True,
        }
    except Exception as e:
        logger.warning(f"Moment AI failed: {e}")
        rb = _rule_based_moment(request.query, request.city)
        return {
            "city": request.city,
            "query": request.query,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            **rb,
            "ai_generated": False,
        }
