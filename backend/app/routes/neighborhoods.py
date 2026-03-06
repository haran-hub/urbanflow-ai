"""GET /api/neighborhoods/report?city=
Neighborhood report cards — grades A–F per domain.
"""
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    ParkingZone, ParkingSnapshot,
    EVStation, EVSnapshot,
    NoiseZone, NoiseSnapshot,
    AirStation, AirSnapshot,
    TransitRoute, TransitSnapshot,
)

router = APIRouter(prefix="/api/neighborhoods", tags=["neighborhoods"])

# lat_min, lat_max, lng_min, lng_max
NEIGHBORHOODS: dict[str, dict[str, tuple]] = {
    "San Francisco": {
        "Financial District": (37.788, 37.800, -122.408, -122.394),
        "SoMa":               (37.772, 37.788, -122.415, -122.394),
        "Mission":            (37.748, 37.768, -122.430, -122.408),
        "Marina":             (37.798, 37.810, -122.450, -122.420),
        "Castro":             (37.758, 37.772, -122.446, -122.428),
    },
    "New York": {
        "Midtown":            (40.748, 40.770, -74.002, -73.970),
        "Lower Manhattan":    (40.700, 40.722, -74.020, -73.993),
        "Brooklyn":           (40.640, 40.700, -73.990, -73.930),
        "Queens":             (40.720, 40.762, -73.940, -73.860),
        "Upper West Side":    (40.770, 40.800, -74.000, -73.970),
    },
    "Austin": {
        "Downtown":           (30.255, 30.278, -97.760, -97.730),
        "South Congress":     (30.230, 30.255, -97.760, -97.740),
        "East Side":          (30.255, 30.285, -97.730, -97.700),
        "North Loop":         (30.310, 30.340, -97.755, -97.725),
        "West Campus":        (30.278, 30.310, -97.760, -97.735),
    },
}

GRADE_LABELS = {"A": "Excellent", "B": "Good", "C": "Fair", "D": "Poor", "F": "Bad"}
GRADE_COLORS = {"A": "#22c55e", "B": "#84cc16", "C": "#f59e0b", "D": "#f97316", "F": "#ef4444"}


def _grade_lower_better(val: float, thresholds: tuple) -> str:
    """Lower val = better grade. thresholds = (A_max, B_max, C_max, D_max)."""
    a, b, c, d = thresholds
    if val <= a: return "A"
    if val <= b: return "B"
    if val <= c: return "C"
    if val <= d: return "D"
    return "F"


def _grade_higher_better(val: float, thresholds: tuple) -> str:
    """Higher val = better grade. thresholds = (A_min, B_min, C_min, D_min)."""
    a, b, c, d = thresholds
    if val >= a: return "A"
    if val >= b: return "B"
    if val >= c: return "C"
    if val >= d: return "D"
    return "F"


def _overall_grade(grades: list[str]) -> str:
    pts = {"A": 4, "B": 3, "C": 2, "D": 1, "F": 0}
    valid = [g for g in grades if g in pts]
    if not valid:
        return "C"
    avg = sum(pts[g] for g in valid) / len(valid)
    if avg >= 3.5: return "A"
    if avg >= 2.5: return "B"
    if avg >= 1.5: return "C"
    if avg >= 0.5: return "D"
    return "F"


def _in_box(lat: float, lng: float, box: tuple) -> bool:
    lat_min, lat_max, lng_min, lng_max = box
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max


@router.get("/report")
async def get_neighborhoods(city: str = "San Francisco", db: AsyncSession = Depends(get_db)):
    hoods = NEIGHBORHOODS.get(city, {})

    # Fetch all snapshots for this city
    p_rows = (await db.execute(
        select(ParkingZone, ParkingSnapshot)
        .join(ParkingSnapshot, ParkingSnapshot.zone_id == ParkingZone.id)
        .where(ParkingZone.city == city)
    )).all()

    e_rows = (await db.execute(
        select(EVStation, EVSnapshot)
        .join(EVSnapshot, EVSnapshot.station_id == EVStation.id)
        .where(EVStation.city == city)
    )).all()

    n_rows = (await db.execute(
        select(NoiseZone, NoiseSnapshot)
        .join(NoiseSnapshot, NoiseSnapshot.zone_id == NoiseZone.id)
        .where(NoiseZone.city == city)
    )).all()

    a_rows = (await db.execute(
        select(AirStation, AirSnapshot)
        .join(AirSnapshot, AirSnapshot.station_id == AirStation.id)
        .where(AirStation.city == city)
    )).all()

    t_rows = (await db.execute(
        select(TransitRoute, TransitSnapshot)
        .join(TransitSnapshot, TransitSnapshot.route_id == TransitRoute.id)
        .where(TransitRoute.city == city)
    )).all()

    # City-wide transit average (transit routes span entire city)
    t_avg = (
        sum(s.occupancy_level for _, s in t_rows) / len(t_rows)
        if t_rows else 50.0
    )
    t_grade = _grade_lower_better(t_avg, (30, 50, 70, 85))

    results = []
    for name, box in hoods.items():
        lat_c = (box[0] + box[1]) / 2
        lng_c = (box[2] + box[3]) / 2

        p_snaps = [s for z, s in p_rows if _in_box(z.lat, z.lng, box)]
        e_snaps = [s for st, s in e_rows if _in_box(st.lat, st.lng, box)]
        n_snaps = [s for z, s in n_rows if _in_box(z.lat, z.lng, box)]
        a_snaps = [s for st, s in a_rows if _in_box(st.lat, st.lng, box)]

        p_occ = (
            sum(s.occupancy_pct for s in p_snaps) / len(p_snaps) * 100
            if p_snaps else 55.0
        )
        ev_wait = (
            sum(s.avg_wait_minutes for s in e_snaps) / len(e_snaps)
            if e_snaps else 12.0
        )
        vibe = (
            sum(s.vibe_score for s in n_snaps) / len(n_snaps)
            if n_snaps else 55.0
        )
        aqi = (
            sum(s.aqi for s in a_snaps) / len(a_snaps)
            if a_snaps else 65.0
        )

        p_grade = _grade_lower_better(p_occ, (40, 60, 75, 88))
        ev_grade = _grade_lower_better(ev_wait, (5, 10, 20, 30))
        v_grade = _grade_higher_better(vibe, (75, 60, 45, 30))
        air_grade = _grade_lower_better(aqi, (30, 50, 75, 100))

        grades = [p_grade, ev_grade, v_grade, air_grade, t_grade]
        overall = _overall_grade(grades)

        results.append({
            "name": name,
            "city": city,
            "lat": round(lat_c, 4),
            "lng": round(lng_c, 4),
            "overall": overall,
            "overall_label": GRADE_LABELS[overall],
            "overall_color": GRADE_COLORS[overall],
            "grades": {
                "parking": p_grade,
                "ev": ev_grade,
                "vibe": v_grade,
                "air": air_grade,
                "transit": t_grade,
            },
            "metrics": {
                "parking_occ": round(p_occ),
                "ev_wait_min": round(ev_wait, 1),
                "vibe_score": round(vibe),
                "aqi": round(aqi),
                "transit_crowd": round(t_avg),
            },
        })

    grade_order = {"A": 0, "B": 1, "C": 2, "D": 3, "F": 4}
    results.sort(key=lambda x: grade_order.get(x["overall"], 5))

    return {
        "city": city,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "neighborhoods": results,
    }
