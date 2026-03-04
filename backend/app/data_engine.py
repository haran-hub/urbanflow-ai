from __future__ import annotations

"""
Time-aware simulated data engine.
Generates realistic occupancy / availability values based on:
  - Hour of day  (rush hours drive peaks)
  - Day of week  (weekday vs weekend differ by domain)
  - Gaussian noise for natural variation
  - Entity-specific quirks (DMV busy Mondays, garages stay full longer, etc.)
"""
import random
import math
from datetime import datetime
from typing import Optional


# ── Helpers ────────────────────────────────────────────────────────────────────

def _gaussian_clamp(value: float, sigma: float, lo: float, hi: float) -> float:
    noisy = value + random.gauss(0, sigma)
    return max(lo, min(hi, noisy))


def _rush_curve(hour: float) -> float:
    """Returns 0-1 demand multiplier based on hour (0–23)."""
    # Two peaks: morning rush ~8am and evening rush ~17:30
    am = math.exp(-0.5 * ((hour - 8.0) / 1.2) ** 2)
    pm = math.exp(-0.5 * ((hour - 17.5) / 1.5) ** 2)
    midday = 0.35 * math.exp(-0.5 * ((hour - 12.5) / 2.0) ** 2)
    night = 0.05
    return max(night, am * 0.9 + pm + midday)


def _weekend_factor(weekday: int, domain: str) -> float:
    """0=Monday … 6=Sunday. Returns multiplier relative to weekday baseline."""
    is_weekend = weekday >= 5
    if domain == "transit":
        return 0.55 if is_weekend else 1.0
    if domain == "parking":
        return 0.75 if is_weekend else 1.0
    if domain == "ev":
        return 0.80 if is_weekend else 1.0
    if domain == "service":
        # DMV / banks closed or half-day weekends → lower demand
        return 0.20 if is_weekend else 1.0
    return 1.0


# ── Public generators ──────────────────────────────────────────────────────────

def generate_parking_occupancy(zone: dict, now: datetime | None = None) -> tuple[float, int]:
    """
    Returns (occupancy_pct, available_spots).
    zone dict needs: total_spots, zone_type
    """
    now = now or datetime.utcnow()
    hour = now.hour + now.minute / 60
    weekday = now.weekday()

    base = _rush_curve(hour) * _weekend_factor(weekday, "parking")

    # Garages stay fuller longer; street spots turn over faster
    if zone.get("zone_type") == "garage":
        base = min(base * 1.1, 0.95)
    elif zone.get("zone_type") == "street":
        base = base * 0.85

    occupancy = _gaussian_clamp(base, 0.08, 0.0, 1.0)
    available = max(0, round((1 - occupancy) * zone["total_spots"]))
    return round(occupancy, 3), available


def generate_ev_wait(station: dict, now: datetime | None = None) -> tuple[int, int]:
    """
    Returns (available_ports, avg_wait_minutes).
    station dict needs: total_ports
    """
    now = now or datetime.utcnow()
    hour = now.hour + now.minute / 60
    weekday = now.weekday()

    demand = _rush_curve(hour) * _weekend_factor(weekday, "ev")
    busy_ports = round(demand * station["total_ports"])
    busy_ports = max(0, min(station["total_ports"], busy_ports + random.randint(-1, 1)))
    available = station["total_ports"] - busy_ports

    # Wait: if full, queue builds; otherwise minimal wait
    if available == 0:
        avg_wait = int(_gaussian_clamp(20 + demand * 15, 5, 5, 60))
    elif available <= 1:
        avg_wait = int(_gaussian_clamp(8, 3, 0, 30))
    else:
        avg_wait = 0

    return available, avg_wait


def generate_transit_crowd(route: dict, now: datetime | None = None) -> tuple[int, int, int]:
    """
    Returns (occupancy_level 0-100, delay_minutes, next_arrival_mins).
    route dict needs: frequency_mins, route_type
    """
    now = now or datetime.utcnow()
    hour = now.hour + now.minute / 60
    weekday = now.weekday()

    demand = _rush_curve(hour) * _weekend_factor(weekday, "transit")

    # Subway handles crowds better than buses
    if route.get("route_type") == "subway":
        occupancy = int(_gaussian_clamp(demand * 90, 8, 0, 100))
    else:
        occupancy = int(_gaussian_clamp(demand * 100, 10, 0, 100))

    # Delays correlate with crowd pressure during rush
    max_delay = 3 if demand < 0.5 else 8
    delay = int(_gaussian_clamp(demand * max_delay, 1, 0, 15))

    freq = route.get("frequency_mins", 10)
    next_arrival = int(_gaussian_clamp(freq / 2, freq / 4, 1, freq))

    return occupancy, delay, next_arrival


def _parse_is_open(category: str, typical_hours: str, local_now: datetime) -> bool:
    h = typical_hours.strip().lower()
    hour = local_now.hour
    weekday = local_now.weekday()  # 0=Mon, 6=Sun

    if "24/7" in h or "24 hours" in h:
        return True

    DEFAULTS: dict[str, tuple] = {
        "hospital":    (0, 24, range(7)),
        "pharmacy":    (8, 22, range(7)),
        "bank":        (9, 17, range(5)),
        "post_office": (9, 17, list(range(5)) + [5]),
        "dmv":         (8, 17, [1, 2, 3, 4, 5]),
    }
    open_h, close_h, open_days = DEFAULTS.get(category, (9, 17, range(5)))
    return (open_h <= hour < close_h) and (weekday in open_days)


def generate_service_wait(service: dict, now: datetime | None = None) -> tuple[int, int, bool]:
    """
    Returns (estimated_wait_minutes, queue_length, is_open).
    service dict needs: category, typical_hours
    """
    now = now or datetime.utcnow()

    category = service.get("category", "")
    typical_hours = service.get("typical_hours", "")
    is_open = _parse_is_open(category, typical_hours, now)

    if not is_open:
        return 0, 0, False

    demand = _rush_curve(now.hour + now.minute / 60) * _weekend_factor(now.weekday(), "service")

    # DMV and government services have worst wait times
    if category in ("dmv", "post_office"):
        base_wait = 30 + demand * 50
        queue = int(demand * 25)
    elif category == "hospital":
        # ER wait varies widely; peaks late evening
        evening = math.exp(-0.5 * ((now.hour - 20) / 3) ** 2)
        base_wait = 30 + (demand + evening) * 40
        queue = int((demand + evening) * 15)
    elif category == "bank":
        base_wait = 5 + demand * 20
        queue = int(demand * 10)
    else:
        base_wait = 10 + demand * 25
        queue = int(demand * 12)

    wait = int(_gaussian_clamp(base_wait, base_wait * 0.2, 0, 120))
    queue = max(0, queue + random.randint(-2, 2))
    return wait, queue, True


def generate_air_quality(station: dict, now: Optional[datetime] = None) -> tuple[int, float, float, float, int, float, str]:
    """Returns (aqi, pm25, pm10, o3, pollen_level, uv_index, category)."""
    now = now or datetime.utcnow()
    hour = now.hour
    month = now.month  # 1-12

    # Base AQI varies by time of day (morning/evening peaks from traffic)
    traffic_factor = _rush_curve(hour)
    base_aqi = 30 + traffic_factor * 40
    aqi = int(_gaussian_clamp(base_aqi, 8, 10, 180))

    pm25 = round(_gaussian_clamp(aqi * 0.25, 3, 1, 60), 1)
    pm10 = round(_gaussian_clamp(aqi * 0.4, 5, 2, 80), 1)
    o3 = round(_gaussian_clamp(30 + traffic_factor * 20, 5, 10, 80), 1)

    # Pollen: seasonal (spring + fall peaks) — 0=None 1=Low 2=Mod 3=High 4=VeryHigh
    spring = math.exp(-0.5 * ((month - 4) / 1.5) ** 2)
    fall = math.exp(-0.5 * ((month - 9) / 1.5) ** 2)
    cedar = math.exp(-0.5 * ((month - 1) / 0.8) ** 2)  # Austin cedar fever Jan
    pollen_raw = (spring + fall) * 3 + cedar * 2
    pollen_level = min(4, int(_gaussian_clamp(pollen_raw, 0.5, 0, 4)))

    # UV: peaks midday, seasonal, zero at night
    uv_peak = max(0, math.sin(math.pi * (hour - 6) / 12)) if 6 <= hour <= 18 else 0
    uv_index = round(_gaussian_clamp(uv_peak * 8, 1, 0, 11), 1)

    # Category
    if aqi <= 50:
        category = "Good"
    elif aqi <= 100:
        category = "Moderate"
    elif aqi <= 150:
        category = "Unhealthy for Sensitive Groups"
    elif aqi <= 200:
        category = "Unhealthy"
    elif aqi <= 300:
        category = "Very Unhealthy"
    else:
        category = "Hazardous"

    return aqi, pm25, pm10, o3, pollen_level, uv_index, category


def generate_bike_availability(station: dict, now: Optional[datetime] = None) -> tuple[int, int, int, bool]:
    """Returns (available_bikes, available_ebikes, available_docks, is_renting)."""
    now = now or datetime.utcnow()
    hour = now.hour + now.minute / 60
    weekday = now.weekday()

    total_docks = station.get("total_docks", 12)
    demand = _rush_curve(hour) * _weekend_factor(weekday, "transit")

    busy_bikes = round(demand * total_docks * 0.7)
    busy_bikes = max(0, min(total_docks - 1, busy_bikes + random.randint(-1, 1)))
    available = total_docks - busy_bikes
    ebikes = max(0, int(available * 0.4) + random.randint(-1, 1))
    regular = max(0, available - ebikes)
    docks = busy_bikes

    return regular, ebikes, docks, True


def generate_food_truck(truck: dict, now: Optional[datetime] = None) -> tuple[bool, int, int]:
    """Returns (is_open, wait_minutes, crowd_level)."""
    now = now or datetime.utcnow()
    hour = now.hour
    weekday = now.weekday()

    typical_hours = truck.get("typical_hours", "11am-9pm").lower()

    # Determine open hours
    is_open = False
    if "midnight" in typical_hours or "2am" in typical_hours or "4am" in typical_hours:
        # Late night (evening/night trucks)
        is_open = (hour >= 17 or hour < 2)
    elif "breakfast" in typical_hours or "7am" in typical_hours or "8am" in typical_hours:
        is_open = (7 <= hour < 15)
    elif "lunch" in typical_hours or "11am" in typical_hours:
        is_open = (11 <= hour < 15)
    else:
        is_open = (11 <= hour < 21)  # default lunch-dinner

    # Weekend-only handling
    if "fri" in typical_hours and weekday not in (4, 5, 6):
        is_open = False
    if "sat" in typical_hours and weekday != 5:
        is_open = False

    if not is_open:
        return False, 0, 0

    demand = _rush_curve(hour) * (0.8 if weekday < 5 else 1.2)
    crowd = int(_gaussian_clamp(demand * 80, 10, 5, 100))
    wait = int(_gaussian_clamp(demand * 15, 3, 0, 45))
    return True, wait, crowd


def generate_noise_vibe(zone: dict, now: Optional[datetime] = None) -> tuple[float, int, int, str]:
    """Returns (noise_db, vibe_score, crowd_density, vibe_label)."""
    now = now or datetime.utcnow()
    hour = now.hour + now.minute / 60
    weekday = now.weekday()  # 0=Mon 6=Sun

    zone_type = zone.get("zone_type", "commercial")
    is_weekend = weekday >= 4  # Thu-Sun

    if zone_type == "entertainment":
        # Peaks late night (Thu-Sat 10pm-2am)
        night = math.exp(-0.5 * ((hour - 23) / 2.5) ** 2)
        evening = math.exp(-0.5 * ((hour - 20) / 2.0) ** 2)
        base = (night * 0.9 + evening * 0.6) * (1.5 if is_weekend else 0.7)
    elif zone_type == "residential":
        base = _rush_curve(hour) * 0.3 + 0.05
    else:  # commercial
        base = _rush_curve(hour) * 0.7 + 0.1

    vibe_raw = _gaussian_clamp(base, 0.1, 0.0, 1.0)
    noise_db = round(_gaussian_clamp(35 + vibe_raw * 55, 3, 30, 95), 1)
    vibe_score = int(vibe_raw * 100)
    crowd_density = int(_gaussian_clamp(vibe_raw * 90, 8, 0, 100))

    if vibe_score < 15:
        vibe_label = "Quiet"
    elif vibe_score < 35:
        vibe_label = "Calm"
    elif vibe_score < 60:
        vibe_label = "Lively"
    elif vibe_score < 80:
        vibe_label = "Buzzing"
    else:
        vibe_label = "Wild"

    return noise_db, vibe_score, crowd_density, vibe_label
