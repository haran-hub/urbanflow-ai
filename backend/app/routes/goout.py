"""GET /api/goout/tonight?city=
"Should I go out tonight?" — AI verdict with score and reasoning.
"""
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

router = APIRouter(prefix="/api/goout", tags=["goout"])

_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 600  # 10 min

CITY_TIMEZONES = {
    "San Francisco": "America/Los_Angeles",
    "New York": "America/New_York",
    "Austin": "America/Chicago",
}


def _next_good_hour(hour: int) -> str:
    """Return a human-readable 'after X pm' string 2 hours from now."""
    target = hour + 2
    if target >= 24:
        return "Early tomorrow morning looks ideal"
    suffix = "am" if target < 12 else "pm"
    display = target if target <= 12 else target - 12
    if display == 0:
        display = 12
    return f"After {display} {suffix} looks smoother"


@router.get("/tonight")
async def get_goout(city: str = "San Francisco", db: AsyncSession = Depends(get_db)):
    now = time.time()
    if city in _cache and now - _cache[city][0] < _CACHE_TTL:
        return _cache[city][1]

    from app.routes.concierge import _build_rich_context
    context = await _build_rich_context(db, city)

    tz = ZoneInfo(CITY_TIMEZONES.get(city, "UTC"))
    local_now = datetime.now(tz)
    hour = local_now.hour
    day_name = local_now.strftime("%A")

    verdict = "maybe"
    score = 65
    reason = f"Conditions in {city} are moderate right now."
    best_time = "Check back in 30 minutes."
    domains: dict[str, str] = {}
    ai_generated = False

    if settings.anthropic_api_key:
        try:
            import anthropic
            import json
            import re

            client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            msg = await client.messages.create(
                model=settings.ai_model,
                max_tokens=500,
                system="""You are an urban intelligence assistant. Based on real-time city data, give a direct verdict on whether NOW is a good time to go out.
Return ONLY valid JSON (no extra text):
{
  "verdict": "yes" | "no" | "maybe",
  "score": <integer 0-100>,
  "reason": "<2 sentences max — specific and actionable>",
  "best_time": "<brief when-to-go suggestion>",
  "domains": {
    "parking": "<one-line note>",
    "transit": "<one-line note>",
    "air": "<one-line note>",
    "vibe": "<one-line note>"
  }
}""",
                messages=[{
                    "role": "user",
                    "content": (
                        f"City: {city}\n"
                        f"Local time: {day_name} {local_now.strftime('%I:%M %p')}\n\n"
                        f"Live city data:\n{context[:2500]}\n\n"
                        "Should someone go out right now? Be direct."
                    ),
                }],
            )
            raw = msg.content[0].text.strip()
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if m:
                data = json.loads(m.group())
                verdict = str(data.get("verdict", verdict))
                score = int(data.get("score", score))
                reason = str(data.get("reason", reason))
                best_time = str(data.get("best_time", best_time))
                domains = {k: str(v) for k, v in data.get("domains", {}).items()}
                ai_generated = True
        except Exception:
            pass

    if not ai_generated:
        ctx = context.lower()
        if "peak rush" in ctx or "packed" in ctx or "high" in ctx:
            verdict, score = "maybe", 42
            reason = (
                f"Peak conditions detected in {city}. Parking is scarce and "
                "transit is crowded. Consider waiting 1–2 hours."
            )
            best_time = _next_good_hour(hour)
        elif hour < 9 or hour > 22:
            verdict, score = "yes", 88
            reason = (
                f"Off-peak hours in {city}. Parking is available, "
                "transit is comfortable — great time to head out."
            )
            best_time = "Right now is ideal"
        elif "off-peak" in ctx or "empty" in ctx:
            verdict, score = "yes", 82
            reason = (
                f"City conditions in {city} are relaxed. "
                "Good availability across parking, transit, and services."
            )
            best_time = "Anytime in the next hour"
        else:
            verdict, score = "maybe", 58
            reason = (
                f"Moderate activity in {city}. "
                "Conditions are manageable but check parking near your destination."
            )
            best_time = "Next 30–60 min should be fine"

        domains = {
            "parking": "Check availability before leaving",
            "transit": "Normal service expected",
            "air": "Air quality acceptable",
            "vibe": "Normal neighborhood activity",
        }

    result = {
        "city": city,
        "verdict": verdict,
        "score": score,
        "reason": reason,
        "best_time": best_time,
        "domains": domains,
        "ai_generated": ai_generated,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
    _cache[city] = (now, result)
    return result
