from __future__ import annotations

"""
Claude-powered AI predictions and recommendations for UrbanFlow.
All functions degrade gracefully when no API key is present.
"""
import json
import logging
import re
from datetime import datetime

import anthropic

from app.config import settings
from app.data_engine import (
    generate_parking_occupancy, generate_ev_wait,
    generate_transit_crowd, generate_service_wait,
)

logger = logging.getLogger(__name__)

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic | None:
    global _client
    if not settings.anthropic_api_key:
        return None
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def _parse_json(text: str) -> dict:
    """Strip markdown fences and parse JSON from Claude response."""
    cleaned = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    return json.loads(cleaned)


async def _call_claude(prompt: str, system: str) -> str:
    client = _get_client()
    if not client:
        raise RuntimeError("No API key")
    msg = await client.messages.create(
        model=settings.ai_model,
        max_tokens=600,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


# ── Prediction ─────────────────────────────────────────────────────────────────

async def predict_availability(
    entity_type: str,
    entity: dict,
    target_time: datetime,
    recent_snapshots: list[dict],
) -> dict:
    """
    Predicts occupancy / wait at target_time.
    Returns: {predicted_value, confidence, explanation}
    """
    system = (
        "You are an urban mobility AI analyst. "
        "Analyze historical snapshot data and predict resource availability. "
        "Return ONLY valid JSON with keys: predicted_value (float), confidence (0-1 float), explanation (string)."
    )
    snapshot_summary = recent_snapshots[-12:] if len(recent_snapshots) > 12 else recent_snapshots
    prompt = (
        f"Entity type: {entity_type}\n"
        f"Entity details: {json.dumps(entity)}\n"
        f"Target prediction time: {target_time.isoformat()}\n"
        f"Recent snapshots (last {len(snapshot_summary)} readings): {json.dumps(snapshot_summary)}\n\n"
        f"For {entity_type}, predicted_value means:\n"
        f"  parking → occupancy_pct (0.0-1.0)\n"
        f"  ev → avg_wait_minutes (integer)\n"
        f"  transit → occupancy_level (0-100)\n"
        f"  service → estimated_wait_minutes (integer)\n\n"
        "Predict for the target time. Return JSON only."
    )

    try:
        raw = await _call_claude(prompt, system)
        result = _parse_json(raw)
        return {
            "predicted_value": float(result.get("predicted_value", 0)),
            "confidence": float(result.get("confidence", 0.5)),
            "explanation": str(result.get("explanation", "")),
        }
    except Exception as e:
        logger.warning(f"predict_availability fallback: {e}")
        # Fallback: use data engine for target_time
        return _fallback_predict(entity_type, entity, target_time)


def _fallback_predict(entity_type: str, entity: dict, target_time: datetime) -> dict:
    if entity_type == "parking":
        occ, _ = generate_parking_occupancy(entity, target_time)
        return {"predicted_value": occ, "confidence": 0.6, "explanation": "Based on typical time-of-day patterns."}
    if entity_type == "ev":
        _, wait = generate_ev_wait(entity, target_time)
        return {"predicted_value": wait, "confidence": 0.6, "explanation": "Based on typical charging demand patterns."}
    if entity_type == "transit":
        crowd, _, _ = generate_transit_crowd(entity, target_time)
        return {"predicted_value": crowd, "confidence": 0.6, "explanation": "Based on typical transit ridership patterns."}
    if entity_type == "service":
        wait, _, _ = generate_service_wait(entity, target_time)
        return {"predicted_value": wait, "confidence": 0.6, "explanation": "Based on typical service demand patterns."}
    return {"predicted_value": 0, "confidence": 0.0, "explanation": "Unknown entity type."}


# ── Recommendation ─────────────────────────────────────────────────────────────

async def recommend_best_option(
    entity_type: str,
    options: list[dict],
    user_request: dict,
) -> dict:
    """
    Recommends the best option from a list.
    Returns: {recommended_id, reason, alternatives, estimated_wait}
    """
    if not options:
        return {"recommended_id": None, "reason": "No options available.", "alternatives": [], "estimated_wait": 0}

    system = (
        "You are an urban mobility AI assistant. "
        "Given a list of options with current status, pick the best one for the user. "
        "Return ONLY valid JSON with keys: recommended_id (string), reason (string), "
        "alternatives (list of {id, reason}), estimated_wait (int minutes)."
    )
    prompt = (
        f"User request: {json.dumps(user_request)}\n"
        f"Available {entity_type} options: {json.dumps(options[:10])}\n\n"
        "Consider distance, current availability, wait time, and user preferences. "
        "Return JSON only."
    )

    try:
        raw = await _call_claude(prompt, system)
        result = _parse_json(raw)
        return {
            "recommended_id": result.get("recommended_id"),
            "reason": result.get("reason", ""),
            "alternatives": result.get("alternatives", []),
            "estimated_wait": int(result.get("estimated_wait", 0)),
        }
    except Exception as e:
        logger.warning(f"recommend_best_option fallback: {e}")
        best = options[0]
        return {
            "recommended_id": best.get("id"),
            "reason": "Closest available option with best current availability.",
            "alternatives": [{"id": o["id"], "reason": "Alternative option"} for o in options[1:3]],
            "estimated_wait": best.get("avg_wait_minutes", 0),
        }


# ── Urban Plan ─────────────────────────────────────────────────────────────────

async def generate_urban_plan(
    location: dict,
    needs: list[str],
    depart_at: str,
    all_options: dict,
) -> dict:
    """
    Generates a step-by-step multi-modal urban plan.
    Returns: {steps: [{step, action, location, timing, tip}], summary, total_time_saved_mins}
    """
    system = (
        "You are an expert urban mobility planner. "
        "Create a practical, time-optimized step-by-step plan for navigating the city. "
        "Return ONLY valid JSON with keys: steps (list of {step, action, location, timing, tip}), "
        "summary (string), total_time_saved_mins (int)."
    )
    prompt = (
        f"User location: {json.dumps(location)}\n"
        f"User needs: {needs}\n"
        f"Departure time: {depart_at}\n"
        f"Available options: {json.dumps(all_options)}\n\n"
        "Create an optimized urban plan. Prioritize low wait times, proximity, and efficiency. "
        "Return JSON only."
    )

    try:
        raw = await _call_claude(prompt, system)
        result = _parse_json(raw)
        return {
            "steps": result.get("steps", []),
            "summary": result.get("summary", ""),
            "total_time_saved_mins": int(result.get("total_time_saved_mins", 0)),
        }
    except Exception as e:
        logger.warning(f"generate_urban_plan fallback: {e}")
        steps = []
        for i, need in enumerate(needs, 1):
            steps.append({
                "step": i,
                "action": f"Handle {need}",
                "location": "See available options",
                "timing": "Check current availability",
                "tip": "Visit during off-peak hours for shorter waits.",
            })
        return {"steps": steps, "summary": "Plan generated based on your needs.", "total_time_saved_mins": 10}


# ── Best Time ──────────────────────────────────────────────────────────────────

async def find_best_time(entity_type: str, entity: dict) -> dict:
    """
    Returns best and worst time windows for visiting an entity.
    Returns: {best_windows: [{day, time_range, reason}], worst_windows: [...], general_tip}
    """
    system = (
        "You are an urban efficiency AI. "
        "Based on the entity type and characteristics, recommend best and worst times to visit. "
        "Return ONLY valid JSON with keys: best_windows (list of {day, time_range, reason}), "
        "worst_windows (list of {day, time_range, reason}), general_tip (string)."
    )
    prompt = (
        f"Entity type: {entity_type}\n"
        f"Entity details: {json.dumps(entity)}\n\n"
        "Provide 2-3 best time windows and 2 worst time windows based on typical urban patterns. "
        "Return JSON only."
    )

    try:
        raw = await _call_claude(prompt, system)
        result = _parse_json(raw)
        return {
            "best_windows": result.get("best_windows", []),
            "worst_windows": result.get("worst_windows", []),
            "general_tip": result.get("general_tip", ""),
        }
    except Exception as e:
        logger.warning(f"find_best_time fallback: {e}")
        return _fallback_best_time(entity_type)


def _fallback_best_time(entity_type: str) -> dict:
    tips = {
        "parking": {
            "best_windows": [
                {"day": "Any", "time_range": "10am–11:30am", "reason": "After morning rush, before lunch crowd"},
                {"day": "Any", "time_range": "2pm–4pm", "reason": "Midday lull before evening rush"},
            ],
            "worst_windows": [
                {"day": "Weekday", "time_range": "8am–9:30am", "reason": "Peak morning commute"},
                {"day": "Weekday", "time_range": "5pm–6:30pm", "reason": "Peak evening commute"},
            ],
            "general_tip": "Arrive 15 min before the hour to catch departing parkers.",
        },
        "ev": {
            "best_windows": [
                {"day": "Any", "time_range": "11pm–6am", "reason": "Overnight charging, minimal queue"},
                {"day": "Any", "time_range": "10am–2pm", "reason": "Mid-morning lull"},
            ],
            "worst_windows": [
                {"day": "Weekday", "time_range": "6pm–9pm", "reason": "Post-commute charging surge"},
            ],
            "general_tip": "Schedule charging sessions during off-peak hours to avoid queues.",
        },
        "transit": {
            "best_windows": [
                {"day": "Any", "time_range": "10am–3pm", "reason": "Off-peak, comfortable rides"},
                {"day": "Weekend", "time_range": "Morning", "reason": "Lighter weekend ridership"},
            ],
            "worst_windows": [
                {"day": "Weekday", "time_range": "7:30am–9am", "reason": "Morning rush crush"},
                {"day": "Weekday", "time_range": "5pm–7pm", "reason": "Evening rush"},
            ],
            "general_tip": "Travel 30 min before or after peak for a noticeably less crowded ride.",
        },
        "service": {
            "best_windows": [
                {"day": "Any", "time_range": "9am–10am", "reason": "First hour after opening"},
                {"day": "Wednesday", "time_range": "2pm–4pm", "reason": "Mid-week, mid-afternoon lull"},
            ],
            "worst_windows": [
                {"day": "Monday", "time_range": "All day", "reason": "Post-weekend backlog"},
                {"day": "Any", "time_range": "12pm–1pm", "reason": "Lunch rush"},
            ],
            "general_tip": "Avoid Mondays and the first/last day of the month for government services.",
        },
    }
    return tips.get(entity_type, {"best_windows": [], "worst_windows": [], "general_tip": ""})
