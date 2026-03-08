from __future__ import annotations

import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Query

from app.config import settings

router = APIRouter(prefix="/api/events", tags=["events"])

_cache: dict[str, dict] = {}
_cache_expiry: dict[str, float] = {}
CACHE_TTL = 900  # 15 min

CITY_NAMES = {
    "San Francisco": "San Francisco",
    "New York": "New York",
    "Austin": "Austin",
}


def _impact_band(name: str, genre: str) -> str:
    """Infer impact from event name/genre heuristics since Ticketmaster free tier
    doesn't expose attendance numbers."""
    high_keywords = ["stadium", "arena", "fest", "festival", "championship", "playoff", "bowl"]
    low_keywords = ["open mic", "workshop", "reading", "exhibit"]
    name_lower = (name + " " + genre).lower()
    if any(k in name_lower for k in high_keywords):
        return "HIGH"
    if any(k in name_lower for k in low_keywords):
        return "LOW"
    return "MED"


@router.get("")
async def get_events(city: str = Query("San Francisco")):
    now = time.monotonic()
    if city in _cache and now < _cache_expiry.get(city, 0):
        return _cache[city]

    if not settings.ticketmaster_api_key:
        return {"events": [], "city": city, "note": "Configure TICKETMASTER_API_KEY to enable"}

    start_dt = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://app.ticketmaster.com/discovery/v2/events.json",
                params={
                    "city": CITY_NAMES.get(city, city),
                    "apikey": settings.ticketmaster_api_key,
                    "size": 5,
                    "startDateTime": start_dt,
                    "sort": "date,asc",
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {"events": [], "city": city, "note": "Events temporarily unavailable"}

    events = []
    for ev in (data.get("_embedded", {}).get("events", []) or []):
        dates = ev.get("dates", {}).get("start", {})
        venues = (ev.get("_embedded", {}) or {}).get("venues", [{}])
        venue = (venues[0] if venues else {}) or {}
        genre = (
            (ev.get("classifications", [{}]) or [{}])[0].get("genre", {}) or {}
        ).get("name", "")
        name = ev.get("name", "Event")
        events.append({
            "name": name,
            "venue": venue.get("name", ""),
            "date": dates.get("localDate", ""),
            "time": dates.get("localTime", ""),
            "url": ev.get("url", ""),
            "impact": _impact_band(name, genre),
            "genre": genre,
        })

    result = {"events": events, "city": city}
    _cache[city] = result
    _cache_expiry[city] = now + CACHE_TTL
    return result
