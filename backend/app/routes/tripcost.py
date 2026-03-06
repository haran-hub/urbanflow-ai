"""POST /api/tripcost/estimate
Estimate the real cost of a city outing + AI money-saving tips.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import ParkingZone, EVStation

router = APIRouter(prefix="/api/tripcost", tags=["tripcost"])


class TripRequest(BaseModel):
    city: str = "San Francisco"
    activities: list[str] = []     # e.g. ["dinner", "concert", "parking 2h"]
    depart_at: str = ""            # ISO datetime string (optional)
    has_ev: bool = False
    duration_hours: float = 3.0


@router.post("/estimate")
async def estimate_trip_cost(req: TripRequest, db: AsyncSession = Depends(get_db)):
    # Get live parking rates
    p_result = await db.execute(
        select(func.avg(ParkingZone.hourly_rate)).where(ParkingZone.city == req.city)
    )
    avg_hourly_rate = float(p_result.scalar() or 4.0)

    # Build activity-based cost breakdown
    breakdown: list[dict] = []
    estimated_total = 0.0

    act_lower = [a.lower() for a in req.activities]

    # Parking
    has_parking = any("park" in a for a in act_lower) or True  # always estimate
    if has_parking:
        parking_cost = round(avg_hourly_rate * req.duration_hours, 2)
        breakdown.append({
            "item": f"Parking ({req.duration_hours:.0f}h at ${avg_hourly_rate:.2f}/hr)",
            "cost": parking_cost,
            "note": f"Based on live {req.city} average rates",
        })
        estimated_total += parking_cost

    # EV charging
    if req.has_ev:
        ev_cost = round(req.duration_hours * 0.35 * 7, 2)  # ~0.35/kWh, 7kW avg charger
        breakdown.append({
            "item": f"EV charging (~{req.duration_hours:.0f}h)",
            "cost": ev_cost,
            "note": "Estimated at $0.35/kWh Level 2",
        })
        estimated_total += ev_cost

    # Activity-based estimates
    ACTIVITY_COSTS = {
        "dinner":    ("Dinner (avg)",              45.0, "Per person, mid-range restaurant"),
        "lunch":     ("Lunch",                     18.0, "Per person"),
        "coffee":    ("Coffee/drinks",              7.0, "Per person"),
        "concert":   ("Concert / event ticket",    65.0, "Average ticket price"),
        "bar":       ("Bar / nightlife",            30.0, "Per person, 2-3 drinks"),
        "movie":     ("Movie ticket",              16.0, "Per person"),
        "museum":    ("Museum entry",              25.0, "Per person"),
        "transit":   ("Transit (round trip)",       5.0, "Bus/subway fare x2"),
        "uber":      ("Rideshare (round trip)",     28.0, "Estimated Uber/Lyft"),
        "food truck":("Food truck",                 14.0, "Per person"),
        "brunch":    ("Brunch",                     25.0, "Per person"),
    }

    for act in req.activities:
        for key, (label, cost, note) in ACTIVITY_COSTS.items():
            if key in act.lower():
                breakdown.append({"item": label, "cost": cost, "note": note})
                estimated_total += cost
                break

    if not req.activities:
        # Default generic outing
        breakdown.append({"item": "Food & drinks (estimate)", "cost": 35.0, "note": "Per person average"})
        estimated_total += 35.0

    savings_tips = [
        f"Park 2–3 blocks away from your destination in {req.city} to cut parking cost by 40–60%.",
        "Use transit for the last mile — saves parking and reduces trip cost by $8–15.",
    ]

    ai_generated = False

    if settings.anthropic_api_key and req.activities:
        try:
            import anthropic
            import json
            import re

            client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            msg = await client.messages.create(
                model=settings.ai_model,
                max_tokens=400,
                system="""You are a city cost advisor. Return ONLY valid JSON:
{"savings_tips": ["<tip 1>", "<tip 2>", "<tip 3>"]}
Tips must be specific, actionable, city-aware, and reference real alternatives.""",
                messages=[{
                    "role": "user",
                    "content": (
                        f"City: {req.city}\n"
                        f"Activities: {', '.join(req.activities)}\n"
                        f"Duration: {req.duration_hours}h\n"
                        f"Has EV: {req.has_ev}\n"
                        f"Estimated total: ${estimated_total:.2f}\n\n"
                        "Give 3 specific money-saving tips for this trip."
                    ),
                }],
            )
            raw = msg.content[0].text.strip()
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if m:
                data = json.loads(m.group())
                tips = data.get("savings_tips", [])
                if tips:
                    savings_tips = [str(t) for t in tips[:3]]
                    ai_generated = True
        except Exception:
            pass

    return {
        "city": req.city,
        "activities": req.activities,
        "duration_hours": req.duration_hours,
        "estimated_total": round(estimated_total, 2),
        "breakdown": breakdown,
        "savings_tips": savings_tips,
        "ai_generated": ai_generated,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
