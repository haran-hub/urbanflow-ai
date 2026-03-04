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


def generate_service_wait(service: dict, now: datetime | None = None) -> tuple[int, int, bool]:
    """
    Returns (estimated_wait_minutes, queue_length, is_open).
    service dict needs: category, typical_hours
    """
    now = now or datetime.utcnow()
    hour = now.hour
    weekday = now.weekday()

    # Determine if open (simplified: 9-17 weekdays, some weekends)
    is_open = (9 <= hour < 17) and weekday < 6
    if service.get("category") == "hospital":
        is_open = True  # 24/7

    if not is_open:
        return 0, 0, False

    demand = _rush_curve(now.hour + now.minute / 60) * _weekend_factor(weekday, "service")

    # DMV and government services have worst wait times
    if service.get("category") in ("dmv", "post_office"):
        base_wait = 30 + demand * 50
        queue = int(demand * 25)
    elif service.get("category") == "hospital":
        # ER wait varies widely; peaks late evening
        evening = math.exp(-0.5 * ((now.hour - 20) / 3) ** 2)
        base_wait = 30 + (demand + evening) * 40
        queue = int((demand + evening) * 15)
    elif service.get("category") == "bank":
        base_wait = 5 + demand * 20
        queue = int(demand * 10)
    else:
        base_wait = 10 + demand * 25
        queue = int(demand * 12)

    wait = int(_gaussian_clamp(base_wait, base_wait * 0.2, 0, 120))
    queue = max(0, queue + random.randint(-2, 2))
    return wait, queue, True
