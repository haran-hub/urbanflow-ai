from __future__ import annotations

"""
Fetches real entity data from public APIs on startup:
- Open Charge Map (EV stations)
- Overpass/OSM (parking, services, transit routes)
"""
import logging
import math
import uuid
from typing import Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import ParkingZone, EVStation, TransitRoute, LocalService

logger = logging.getLogger(__name__)

CITY_CONFIGS = {
    "San Francisco": {
        "lat": 37.7749, "lng": -122.4194,
        "bbox": "37.70,-122.52,37.83,-122.35",
    },
    "New York": {
        "lat": 40.7128, "lng": -74.0060,
        "bbox": "40.49,-74.26,40.92,-73.70",
    },
    "Austin": {
        "lat": 30.2672, "lng": -97.7431,
        "bbox": "30.10,-97.93,30.52,-97.56",
    },
}

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OCM_URL = "https://api.openchargemap.io/v3/poi/"


def _uid() -> str:
    return str(uuid.uuid4())


async def _overpass_query(query: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error(f"Overpass query failed: {e}")
        return None


def _extract_center(element: dict) -> tuple[float, float]:
    """Return (lat, lng) for node or way (center)."""
    if element["type"] == "node":
        return element["lat"], element["lon"]
    center = element.get("center", {})
    return center.get("lat", 0.0), center.get("lon", 0.0)


def _tag(element: dict, key: str, default: str = "") -> str:
    return element.get("tags", {}).get(key, default)


# ── Parking ────────────────────────────────────────────────────────────────────

async def fetch_parking_zones(city: str, bbox: str, limit: int = 15) -> list[dict]:
    query = f"""
[out:json][timeout:25];
(
  node["amenity"="parking"]["access"!="private"]({bbox});
  way["amenity"="parking"]["access"!="private"]({bbox});
);
out center tags {limit};
"""
    data = await _overpass_query(query)
    if not data:
        return []

    results = []
    for el in data.get("elements", [])[:limit]:
        lat, lng = _extract_center(el)
        if not lat and not lng:
            continue
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("description") or f"{city} Parking"
        fee_raw = tags.get("fee", "")
        hourly_rate = 2.0 if fee_raw.lower() in ("yes", "meter") else 0.0
        parking_type = tags.get("parking", "surface")
        if "garage" in parking_type or "multi-storey" in parking_type:
            zone_type = "garage"
        elif "surface" in parking_type or "lot" in parking_type:
            zone_type = "lot"
        else:
            zone_type = "street"
        capacity_str = tags.get("capacity", "")
        try:
            total_spots = int(capacity_str)
        except (ValueError, TypeError):
            total_spots = {"garage": 400, "lot": 150, "street": 60}.get(zone_type, 100)
        address = tags.get("addr:full") or (
            f"{tags.get('addr:housenumber', '')} {tags.get('addr:street', '')}".strip()
            or city
        )
        results.append({
            "name": name, "lat": lat, "lng": lng,
            "total_spots": total_spots, "zone_type": zone_type,
            "hourly_rate": hourly_rate, "address": address,
        })
    return results


# ── EV Stations ────────────────────────────────────────────────────────────────

async def fetch_ev_stations(city: str, lat: float, lng: float, limit: int = 20) -> list[dict]:
    params: dict = {
        "latitude": lat, "longitude": lng,
        "distance": 15, "distanceunit": "km",
        "maxresults": limit,
        "compact": "true", "verbose": "false",
    }
    if settings.ocm_api_key:
        params["key"] = settings.ocm_api_key

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(OCM_URL, params=params)
            resp.raise_for_status()
            pois = resp.json()
    except Exception as e:
        logger.error(f"OCM fetch failed for {city}: {e}")
        return []

    results = []
    for poi in pois[:limit]:
        # Skip unavailable/removed stations
        status_id = (poi.get("StatusType") or {}).get("ID", 50)
        if status_id in (150, 200):
            continue

        addr_info = poi.get("AddressInfo", {})
        name = addr_info.get("Title") or f"{city} EV Station"
        poi_lat = addr_info.get("Latitude", 0.0)
        poi_lng = addr_info.get("Longitude", 0.0)
        address = addr_info.get("AddressLine1") or addr_info.get("Town") or city

        connections = poi.get("Connections") or []
        level2 = sum(1 for c in connections if (c.get("LevelID") or 0) == 2)
        dcfast = sum(1 for c in connections if (c.get("LevelID") or 0) == 3)
        total_ports = max(len(connections), 1)
        port_types: dict = {}
        if level2:
            port_types["Level2"] = level2
        if dcfast:
            port_types["DCFast"] = dcfast
        if not port_types:
            port_types["Level2"] = total_ports

        network = (poi.get("OperatorInfo") or {}).get("Title") or "Unknown"

        results.append({
            "name": name, "lat": poi_lat, "lng": poi_lng,
            "total_ports": total_ports, "port_types": port_types,
            "network": network, "address": address,
            "_ocm_id": poi.get("ID"),
            "_status_id": status_id,
        })
    return results


# ── Services ───────────────────────────────────────────────────────────────────

async def fetch_services(city: str, bbox: str, limit: int = 20) -> list[dict]:
    query = f"""
[out:json][timeout:25];
(
  node["amenity"~"hospital|bank|post_office|pharmacy"]({bbox});
  way["amenity"~"hospital|bank|post_office|pharmacy"]({bbox});
  node["office"="government"]({bbox});
  way["office"="government"]({bbox});
);
out center tags {limit};
"""
    data = await _overpass_query(query)
    if not data:
        return []

    results = []
    for el in data.get("elements", [])[:limit]:
        lat, lng = _extract_center(el)
        if not lat and not lng:
            continue
        tags = el.get("tags", {})
        name = tags.get("name") or f"{city} Service"
        amenity = tags.get("amenity") or tags.get("office", "government")
        category_map = {
            "hospital": "hospital", "clinic": "hospital",
            "bank": "bank",
            "post_office": "post_office",
            "pharmacy": "pharmacy", "chemist": "pharmacy",
            "government": "dmv",
        }
        category = category_map.get(amenity, "hospital")
        hours = tags.get("opening_hours") or {
            "hospital": "24/7", "bank": "9am-5pm Mon-Fri",
            "post_office": "9am-5pm Mon-Sat", "pharmacy": "8am-9pm",
            "dmv": "8am-5pm Mon-Fri",
        }.get(category, "9am-5pm")
        address = tags.get("addr:full") or (
            f"{tags.get('addr:housenumber', '')} {tags.get('addr:street', '')}".strip()
            or city
        )
        results.append({
            "name": name, "lat": lat, "lng": lng,
            "category": category, "address": address, "typical_hours": hours,
        })
    return results


# ── Transit Routes ─────────────────────────────────────────────────────────────

async def fetch_transit_routes(city: str, bbox: str, limit: int = 10) -> list[dict]:
    query = f"""
[out:json][timeout:30];
relation["type"="route"]["route"~"bus|subway|tram|ferry"]({bbox});
out body {limit};
"""
    data = await _overpass_query(query)
    if not data:
        return []

    results = []
    for el in data.get("elements", [])[:limit]:
        if el.get("type") != "relation":
            continue
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("ref") or f"{city} Route"
        route_type = tags.get("route", "bus")
        stops = []
        for member in el.get("members", []):
            if member.get("role") in ("stop", "stop_entry_only", "stop_exit_only", "platform"):
                ref_name = member.get("ref", "")
                if ref_name:
                    stops.append(str(ref_name))
        if not stops:
            stops = [name]
        freq = 10
        interval = tags.get("interval") or tags.get("headway")
        if interval:
            try:
                freq = int(interval) // 60
            except (ValueError, TypeError):
                pass
        results.append({
            "name": name, "route_type": route_type,
            "stops": stops[:20], "frequency_mins": max(freq, 5),
        })
    return results


# ── Haversine distance ─────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Seeding ────────────────────────────────────────────────────────────────────

async def seed_city_real(db: AsyncSession, city_name: str) -> None:
    cfg = CITY_CONFIGS[city_name]
    lat, lng, bbox = cfg["lat"], cfg["lng"], cfg["bbox"]

    logger.info(f"Fetching real data for {city_name}...")

    parking_data = await fetch_parking_zones(city_name, bbox)
    ev_data = await fetch_ev_stations(city_name, lat, lng)
    service_data = await fetch_services(city_name, bbox)
    transit_data = await fetch_transit_routes(city_name, bbox)

    # Fallback counts for logging
    logger.info(
        f"{city_name}: parking={len(parking_data)}, ev={len(ev_data)}, "
        f"services={len(service_data)}, transit={len(transit_data)}"
    )

    for p in parking_data:
        db.add(ParkingZone(
            id=_uid(), city=city_name,
            name=p["name"], lat=p["lat"], lng=p["lng"],
            total_spots=p["total_spots"], zone_type=p["zone_type"],
            hourly_rate=p["hourly_rate"], address=p["address"],
        ))

    for e in ev_data:
        db.add(EVStation(
            id=_uid(), city=city_name,
            name=e["name"], lat=e["lat"], lng=e["lng"],
            total_ports=e["total_ports"], port_types=e["port_types"],
            network=e["network"], address=e["address"],
        ))

    for t in transit_data:
        db.add(TransitRoute(
            id=_uid(), city=city_name,
            name=t["name"], route_type=t["route_type"],
            stops=t["stops"], frequency_mins=t["frequency_mins"],
        ))

    for s in service_data:
        db.add(LocalService(
            id=_uid(), city=city_name,
            name=s["name"], lat=s["lat"], lng=s["lng"],
            category=s["category"], address=s["address"],
            typical_hours=s["typical_hours"],
        ))

    await db.commit()
    logger.info(f"Seeded {city_name} from real APIs.")


async def seed_all_real(db: AsyncSession) -> None:
    for city in CITY_CONFIGS:
        try:
            await seed_city_real(db, city)
        except Exception as e:
            logger.error(f"Failed to seed {city}: {e}")
