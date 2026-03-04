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
from app.models import (
    ParkingZone, EVStation, TransitRoute, LocalService,
    AirStation, BikeStation, FoodTruck, NoiseZone,
)

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


GBFS_FEEDS = {
    "San Francisco": "https://gbfs.baywheels.com/gbfs/en/",
    "New York":      "https://gbfs.citibikenyc.com/gbfs/en/",
    "Austin":        "https://gbfs.bcycle.com/bcycle_austin/",
}

OPENAQ_URL = "https://api.openaq.org/v2/latest"


async def fetch_air_stations(city: str, lat: float, lng: float) -> list[dict]:
    """Fetch air quality monitoring stations from OpenAQ."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(OPENAQ_URL, params={
                "coordinates": f"{lat},{lng}",
                "radius": 25000,
                "limit": 10,
                "order_by": "lastUpdated",
                "sort": "desc",
            }, headers={"Accept": "application/json"})
            resp.raise_for_status()
            results = resp.json().get("results", [])
    except Exception as e:
        logger.warning(f"OpenAQ fetch failed for {city}: {e}")
        results = []

    stations = []
    seen = set()
    for r in results:
        coords = r.get("coordinates") or {}
        slat = coords.get("latitude", lat)
        slng = coords.get("longitude", lng)
        name = r.get("location") or f"{city} Air Monitor"
        if name in seen:
            continue
        seen.add(name)
        stations.append({"name": name, "lat": slat, "lng": slng, "address": city})

    # Always seed at least 3 stations per city using city center
    CITY_NEIGHBORHOODS = {
        "San Francisco": [
            ("SF Downtown Monitor", lat, lng),
            ("Mission District Monitor", lat - 0.02, lng + 0.01),
            ("SoMa Monitor", lat - 0.01, lng - 0.01),
        ],
        "New York": [
            ("Manhattan Monitor", lat, lng),
            ("Brooklyn Monitor", lat - 0.05, lng + 0.02),
            ("Queens Monitor", lat + 0.03, lng + 0.05),
        ],
        "Austin": [
            ("Downtown Austin Monitor", lat, lng),
            ("East Austin Monitor", lat + 0.01, lng + 0.02),
            ("South Congress Monitor", lat - 0.02, lng + 0.01),
        ],
    }
    if len(stations) < 3:
        for name, nlat, nlng in CITY_NEIGHBORHOODS.get(city, []):
            if name not in seen:
                stations.append({"name": name, "lat": nlat, "lng": nlng, "address": city})
                seen.add(name)

    return stations[:6]


async def fetch_bike_stations(city: str, lat: float, lng: float) -> list[dict]:
    """Fetch bike share stations from GBFS."""
    base = GBFS_FEEDS.get(city)
    stations = []
    if base:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                info_resp = await client.get(f"{base}station_information.json")
                info_resp.raise_for_status()
                info_data = info_resp.json().get("data", {}).get("stations", [])
            network = {"San Francisco": "Bay Wheels", "New York": "Citi Bike", "Austin": "MetroBike"}.get(city, "Bike Share")
            for s in info_data[:20]:
                slat = s.get("lat", 0.0)
                slng = s.get("lon", 0.0)
                if not slat and not slng:
                    continue
                stations.append({
                    "name": s.get("name") or f"{city} Bike Station",
                    "lat": slat, "lng": slng,
                    "address": s.get("address") or city,
                    "total_docks": s.get("capacity") or s.get("num_docks_available", 10),
                    "station_type": "bike",
                    "network": network,
                    "gbfs_id": s.get("station_id"),
                })
        except Exception as e:
            logger.warning(f"GBFS fetch failed for {city}: {e}")

    # Fallback: seed from OSM bicycle rental nodes
    if len(stations) < 5:
        bbox = {
            "San Francisco": "37.70,-122.52,37.83,-122.35",
            "New York": "40.49,-74.26,40.92,-73.70",
            "Austin": "30.10,-97.93,30.52,-97.56",
        }.get(city, "")
        if bbox:
            query = f'[out:json][timeout:20]; node["amenity"="bicycle_rental"]({bbox}); out {15 - len(stations)};'
            data = await _overpass_query(query)
            if data:
                network = {"San Francisco": "Bay Wheels", "New York": "Citi Bike", "Austin": "MetroBike"}.get(city, "Bike Share")
                for el in data.get("elements", []):
                    tags = el.get("tags", {})
                    stations.append({
                        "name": tags.get("name") or f"{city} Bike Station",
                        "lat": el["lat"], "lng": el["lon"],
                        "address": tags.get("addr:street") or city,
                        "total_docks": int(tags.get("capacity", 12)),
                        "station_type": "bike",
                        "network": network,
                    })

    return stations[:15]


async def fetch_food_trucks(city: str, bbox: str, limit: int = 20) -> list[dict]:
    """Fetch food trucks from OSM."""
    query = f"""
[out:json][timeout:25];
(
  node["amenity"="food_truck"]({bbox});
  node["amenity"="mobile_food_vendor"]({bbox});
  node["amenity"="fast_food"]["operator:type"="mobile"]({bbox});
);
out tags {limit};
"""
    data = await _overpass_query(query)
    results = []
    if data:
        for el in data.get("elements", [])[:limit]:
            tags = el.get("tags", {})
            name = tags.get("name") or tags.get("description") or f"{city} Food Truck"
            cuisine = tags.get("cuisine") or tags.get("food") or "Various"
            hours = tags.get("opening_hours") or "11am-9pm"
            results.append({
                "name": name,
                "lat": el.get("lat", 0.0),
                "lng": el.get("lon", 0.0),
                "address": tags.get("addr:street") or city,
                "cuisine": cuisine[:50],
                "typical_hours": hours,
            })

    # Fallback: well-known food truck parks
    if len(results) < 5:
        KNOWN_TRUCKS = {
            "Austin": [
                {"name": "East Side King", "lat": 30.2623, "lng": -97.7295, "cuisine": "Asian Fusion", "typical_hours": "5pm-midnight"},
                {"name": "Tyson's Tacos", "lat": 30.2511, "lng": -97.7519, "cuisine": "Tex-Mex", "typical_hours": "11am-3pm"},
                {"name": "Veracruz All Natural", "lat": 30.2650, "lng": -97.7160, "cuisine": "Mexican", "typical_hours": "8am-3pm"},
                {"name": "Juan in a Million", "lat": 30.2599, "lng": -97.7201, "cuisine": "Breakfast/Mexican", "typical_hours": "7am-2pm"},
                {"name": "G'Raj Mahal", "lat": 30.2720, "lng": -97.7400, "cuisine": "Indian", "typical_hours": "11am-10pm"},
                {"name": "Bouldin Creek Food Truck Park", "lat": 30.2510, "lng": -97.7529, "cuisine": "Various", "typical_hours": "10am-10pm"},
                {"name": "South Congress Food Park", "lat": 30.2499, "lng": -97.7505, "cuisine": "Various", "typical_hours": "11am-9pm"},
                {"name": "Rainey St Food Truck Row", "lat": 30.2596, "lng": -97.7382, "cuisine": "Various", "typical_hours": "4pm-midnight"},
            ],
            "San Francisco": [
                {"name": "Off the Grid Fort Mason", "lat": 37.8055, "lng": -122.4326, "cuisine": "Various", "typical_hours": "5pm-10pm Fri"},
                {"name": "Chairman Bao", "lat": 37.7849, "lng": -122.4194, "cuisine": "Bao/Asian", "typical_hours": "11am-2:30pm"},
                {"name": "El Tonayense", "lat": 37.7590, "lng": -122.4147, "cuisine": "Mexican", "typical_hours": "10am-8pm"},
                {"name": "Roli Roti", "lat": 37.7955, "lng": -122.3937, "cuisine": "Rotisserie", "typical_hours": "Sat 10am-2pm"},
                {"name": "The Kebab Guys", "lat": 37.7751, "lng": -122.4050, "cuisine": "Middle Eastern", "typical_hours": "11am-3pm"},
            ],
            "New York": [
                {"name": "The Halal Guys", "lat": 40.7614, "lng": -73.9798, "cuisine": "Halal", "typical_hours": "10am-4am"},
                {"name": "Wafels & Dinges", "lat": 40.7580, "lng": -73.9855, "cuisine": "Belgian Waffles", "typical_hours": "8am-8pm"},
                {"name": "Calexico Cart", "lat": 40.7453, "lng": -73.9942, "cuisine": "Mexican", "typical_hours": "11:30am-3pm"},
                {"name": "Korilla BBQ", "lat": 40.7282, "lng": -73.9939, "cuisine": "Korean BBQ", "typical_hours": "11am-4pm"},
                {"name": "Luke's Lobster Truck", "lat": 40.7128, "lng": -74.0059, "cuisine": "Seafood", "typical_hours": "11am-3pm"},
            ],
        }
        for t in KNOWN_TRUCKS.get(city, []):
            if len(results) >= limit:
                break
            results.append({**t, "address": city})

    return results[:limit]


async def fetch_noise_zones(city: str, bbox: str, limit: int = 12) -> list[dict]:
    """Fetch entertainment/venue areas from OSM to build noise zones."""
    query = f"""
[out:json][timeout:25];
(
  node["amenity"~"bar|nightclub|concert_hall|theatre|stadium|restaurant"]({bbox});
  way["amenity"~"bar|nightclub|stadium"]({bbox});
  node["leisure"~"park|sports_centre"]({bbox});
);
out center tags {limit};
"""
    data = await _overpass_query(query)
    results = []
    seen_names = set()

    if data:
        for el in data.get("elements", [])[:limit]:
            lat, lng = _extract_center(el)
            if not lat and not lng:
                continue
            tags = el.get("tags", {})
            name = tags.get("name") or f"{city} Area"
            if name in seen_names:
                continue
            seen_names.add(name)
            amenity = tags.get("amenity") or tags.get("leisure", "")
            if amenity in ("nightclub", "bar", "concert_hall"):
                zone_type = "entertainment"
            elif amenity in ("stadium",):
                zone_type = "entertainment"
            elif amenity in ("park", "sports_centre"):
                zone_type = "residential"
            else:
                zone_type = "commercial"
            results.append({
                "name": name,
                "lat": lat,
                "lng": lng,
                "address": tags.get("addr:street") or city,
                "zone_type": zone_type,
            })

    # Fallback: well-known neighborhoods
    FALLBACK_ZONES = {
        "Austin": [
            {"name": "6th Street Entertainment District", "lat": 30.2673, "lng": -97.7406, "zone_type": "entertainment"},
            {"name": "Rainey Street", "lat": 30.2598, "lng": -97.7381, "zone_type": "entertainment"},
            {"name": "South Congress Ave", "lat": 30.2500, "lng": -97.7506, "zone_type": "commercial"},
            {"name": "Downtown Austin", "lat": 30.2672, "lng": -97.7431, "zone_type": "commercial"},
            {"name": "East Austin", "lat": 30.2623, "lng": -97.7209, "zone_type": "residential"},
            {"name": "Barton Springs", "lat": 30.2638, "lng": -97.7714, "zone_type": "residential"},
        ],
        "San Francisco": [
            {"name": "The Castro", "lat": 37.7609, "lng": -122.4350, "zone_type": "entertainment"},
            {"name": "North Beach / Fisherman's Wharf", "lat": 37.8030, "lng": -122.4102, "zone_type": "entertainment"},
            {"name": "SoMa", "lat": 37.7786, "lng": -122.3956, "zone_type": "entertainment"},
            {"name": "Mission District", "lat": 37.7599, "lng": -122.4148, "zone_type": "commercial"},
            {"name": "Financial District", "lat": 37.7946, "lng": -122.3999, "zone_type": "commercial"},
            {"name": "Golden Gate Park", "lat": 37.7694, "lng": -122.4862, "zone_type": "residential"},
        ],
        "New York": [
            {"name": "Times Square", "lat": 40.7580, "lng": -73.9855, "zone_type": "entertainment"},
            {"name": "Lower East Side", "lat": 40.7150, "lng": -73.9856, "zone_type": "entertainment"},
            {"name": "Brooklyn Williamsburg", "lat": 40.7081, "lng": -73.9571, "zone_type": "entertainment"},
            {"name": "Midtown Manhattan", "lat": 40.7549, "lng": -73.9840, "zone_type": "commercial"},
            {"name": "Wall Street", "lat": 40.7074, "lng": -74.0113, "zone_type": "commercial"},
            {"name": "Central Park", "lat": 40.7851, "lng": -73.9683, "zone_type": "residential"},
        ],
    }
    for z in FALLBACK_ZONES.get(city, []):
        if len(results) >= limit:
            break
        if z["name"] not in seen_names:
            results.append({**z, "address": city})
            seen_names.add(z["name"])

    return results[:limit]


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
    air_data = await fetch_air_stations(city_name, lat, lng)
    bike_data = await fetch_bike_stations(city_name, lat, lng)
    food_truck_data = await fetch_food_trucks(city_name, bbox)
    noise_data = await fetch_noise_zones(city_name, bbox)

    # Fallback counts for logging
    logger.info(
        f"{city_name}: parking={len(parking_data)}, ev={len(ev_data)}, "
        f"services={len(service_data)}, transit={len(transit_data)}, "
        f"air={len(air_data)}, bikes={len(bike_data)}, "
        f"food_trucks={len(food_truck_data)}, noise={len(noise_data)}"
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

    for a in air_data:
        db.add(AirStation(
            id=_uid(), city=city_name,
            name=a["name"], lat=a["lat"], lng=a["lng"],
            address=a["address"],
        ))

    for b in bike_data:
        db.add(BikeStation(
            id=_uid(), city=city_name,
            name=b["name"], lat=b["lat"], lng=b["lng"],
            address=b["address"],
            total_docks=b.get("total_docks", 12),
            station_type=b.get("station_type", "bike"),
            network=b.get("network", ""),
        ))

    for f in food_truck_data:
        db.add(FoodTruck(
            id=_uid(), city=city_name,
            name=f["name"], lat=f["lat"], lng=f["lng"],
            address=f["address"],
            cuisine=f.get("cuisine", "Various"),
            typical_hours=f.get("typical_hours", ""),
        ))

    for n in noise_data:
        db.add(NoiseZone(
            id=_uid(), city=city_name,
            name=n["name"], lat=n["lat"], lng=n["lng"],
            address=n["address"],
            zone_type=n.get("zone_type", "commercial"),
        ))

    await db.commit()
    logger.info(f"Seeded {city_name} from real APIs.")


async def seed_all_real(db: AsyncSession) -> None:
    for city in CITY_CONFIGS:
        try:
            await seed_city_real(db, city)
        except Exception as e:
            logger.error(f"Failed to seed {city}: {e}")


async def seed_category_for_city(db: AsyncSession, category: str, city_name: str) -> None:
    """Seed a single category for one city. Used for incremental seeding."""
    cfg = CITY_CONFIGS[city_name]
    lat, lng, bbox = cfg["lat"], cfg["lng"], cfg["bbox"]

    if category == "parking":
        data = await fetch_parking_zones(city_name, bbox)
        for p in data:
            db.add(ParkingZone(
                id=_uid(), city=city_name,
                name=p["name"], lat=p["lat"], lng=p["lng"],
                total_spots=p["total_spots"], zone_type=p["zone_type"],
                hourly_rate=p["hourly_rate"], address=p["address"],
            ))
    elif category == "ev":
        data = await fetch_ev_stations(city_name, lat, lng)
        for e in data:
            db.add(EVStation(
                id=_uid(), city=city_name,
                name=e["name"], lat=e["lat"], lng=e["lng"],
                total_ports=e["total_ports"], port_types=e["port_types"],
                network=e["network"], address=e["address"],
            ))
    elif category == "transit":
        data = await fetch_transit_routes(city_name, bbox)
        for t in data:
            db.add(TransitRoute(
                id=_uid(), city=city_name,
                name=t["name"], route_type=t["route_type"],
                stops=t["stops"], frequency_mins=t["frequency_mins"],
            ))
    elif category == "services":
        data = await fetch_services(city_name, bbox)
        for s in data:
            db.add(LocalService(
                id=_uid(), city=city_name,
                name=s["name"], lat=s["lat"], lng=s["lng"],
                category=s["category"], address=s["address"],
                typical_hours=s["typical_hours"],
            ))
    elif category == "air":
        data = await fetch_air_stations(city_name, lat, lng)
        for a in data:
            db.add(AirStation(
                id=_uid(), city=city_name,
                name=a["name"], lat=a["lat"], lng=a["lng"],
                address=a["address"],
            ))
    elif category == "bikes":
        data = await fetch_bike_stations(city_name, lat, lng)
        for b in data:
            db.add(BikeStation(
                id=_uid(), city=city_name,
                name=b["name"], lat=b["lat"], lng=b["lng"],
                address=b["address"],
                total_docks=b.get("total_docks", 12),
                station_type=b.get("station_type", "bike"),
                network=b.get("network", ""),
            ))
    elif category == "food_trucks":
        data = await fetch_food_trucks(city_name, bbox)
        for f in data:
            db.add(FoodTruck(
                id=_uid(), city=city_name,
                name=f["name"], lat=f["lat"], lng=f["lng"],
                address=f["address"],
                cuisine=f.get("cuisine", "Various"),
                typical_hours=f.get("typical_hours", ""),
            ))
    elif category == "noise":
        data = await fetch_noise_zones(city_name, bbox)
        for n in data:
            db.add(NoiseZone(
                id=_uid(), city=city_name,
                name=n["name"], lat=n["lat"], lng=n["lng"],
                address=n["address"],
                zone_type=n.get("zone_type", "commercial"),
            ))

    await db.commit()
    logger.info(f"Seeded category '{category}' for {city_name}.")


async def seed_category_all_cities(db: AsyncSession, category: str) -> None:
    """Seed a single category across all cities."""
    for city in CITY_CONFIGS:
        try:
            await seed_category_for_city(db, category, city)
        except Exception as e:
            logger.error(f"Failed to seed {category} for {city}: {e}")
