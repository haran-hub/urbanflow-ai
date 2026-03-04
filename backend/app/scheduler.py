from __future__ import annotations

"""
Background scheduler: generates new snapshots every N minutes
and trims old data (keep last 24h).
"""
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, delete

from app.config import settings
from app.database import AsyncSessionLocal
from app.models import (
    ParkingZone, ParkingSnapshot,
    EVStation, EVSnapshot,
    TransitRoute, TransitSnapshot,
    LocalService, ServiceSnapshot,
)
from app.data_engine import (
    generate_parking_occupancy, generate_ev_wait,
    generate_transit_crowd, generate_service_wait,
)
from app.websocket_manager import manager

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def _update_snapshots():
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=24)

    async with AsyncSessionLocal() as db:
        # ── Parking ────────────────────────────────────────────────────────────
        zones = (await db.execute(select(ParkingZone))).scalars().all()
        for zone in zones:
            occ, available = generate_parking_occupancy(
                {"total_spots": zone.total_spots, "zone_type": zone.zone_type}, now
            )
            db.add(ParkingSnapshot(
                zone_id=zone.id,
                timestamp=now,
                available_spots=available,
                occupancy_pct=occ,
            ))

        # ── EV ─────────────────────────────────────────────────────────────────
        stations = (await db.execute(select(EVStation))).scalars().all()
        for station in stations:
            available, wait = generate_ev_wait({"total_ports": station.total_ports}, now)
            db.add(EVSnapshot(
                station_id=station.id,
                timestamp=now,
                available_ports=available,
                avg_wait_minutes=wait,
            ))

        # ── Transit ────────────────────────────────────────────────────────────
        routes = (await db.execute(select(TransitRoute))).scalars().all()
        for route in routes:
            crowd, delay, next_arr = generate_transit_crowd(
                {"frequency_mins": route.frequency_mins, "route_type": route.route_type}, now
            )
            db.add(TransitSnapshot(
                route_id=route.id,
                timestamp=now,
                occupancy_level=crowd,
                delay_minutes=delay,
                next_arrival_mins=next_arr,
            ))

        # ── Services ───────────────────────────────────────────────────────────
        services = (await db.execute(select(LocalService))).scalars().all()
        for service in services:
            wait, queue, is_open = generate_service_wait(
                {"category": service.category, "typical_hours": service.typical_hours}, now
            )
            db.add(ServiceSnapshot(
                service_id=service.id,
                timestamp=now,
                estimated_wait_minutes=wait,
                queue_length=queue,
                is_open=is_open,
            ))

        await db.commit()

        # ── Trim old snapshots ─────────────────────────────────────────────────
        for model in (ParkingSnapshot, EVSnapshot, TransitSnapshot, ServiceSnapshot):
            await db.execute(delete(model).where(model.timestamp < cutoff))
        await db.commit()

    # Broadcast city-wide update
    cities = {z.city for z in zones}
    for city in cities:
        await manager.broadcast_to_city(city, {
            "type": "snapshot_update",
            "city": city,
            "timestamp": now.isoformat(),
        })

    logger.info(f"Snapshots updated at {now.isoformat()}")


def start_scheduler():
    scheduler.add_job(
        _update_snapshots,
        "interval",
        minutes=settings.snapshot_interval_minutes,
        id="snapshot_update",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started (interval: {settings.snapshot_interval_minutes} min)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
