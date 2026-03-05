import asyncio
import logging
import time as _time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.config import settings
from app.database import create_tables, AsyncSessionLocal
from app.models import ParkingZone, EVStation, TransitRoute, LocalService, AirStation, BikeStation, FoodTruck, NoiseZone
from app.scheduler import start_scheduler, stop_scheduler
from app.routes import parking, ev, transit, services, dashboard, ws, air, bikes, foodtrucks, noise, pulse, concierge, surge

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── On-demand city refresh (one refresh per city per N seconds) ────────────────
_REFRESH_COOLDOWN = 5          # seconds between refreshes for the same city
_city_last_refresh: dict[str, float] = {}
_city_refresh_locks: dict[str, asyncio.Lock] = {}


async def _on_demand_refresh(city: str) -> None:
    """Regenerate all snapshots for `city` at most once per cooldown window."""
    now = _time.monotonic()
    if now - _city_last_refresh.get(city, 0) < _REFRESH_COOLDOWN:
        return  # still fresh enough

    if city not in _city_refresh_locks:
        _city_refresh_locks[city] = asyncio.Lock()
    lock = _city_refresh_locks[city]

    if lock.locked():
        return  # another request is already refreshing this city

    async with lock:
        # Re-check after acquiring lock
        if _time.monotonic() - _city_last_refresh.get(city, 0) < _REFRESH_COOLDOWN:
            return
        _city_last_refresh[city] = _time.monotonic()

        from app.scheduler import update_city_snapshots
        try:
            async with AsyncSessionLocal() as db:
                await update_city_snapshots(city, db)
            logger.debug(f"On-demand refresh done for {city}")
        except Exception as e:
            logger.warning(f"On-demand refresh failed for {city}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    async with AsyncSessionLocal() as db:
        from app.real_data_fetcher import seed_all_real, seed_category_all_cities

        # Map each category to its model — seed any that are empty
        CATEGORY_MODELS = [
            ("parking",    ParkingZone),
            ("ev",         EVStation),
            ("transit",    TransitRoute),
            ("services",   LocalService),
            ("air",        AirStation),
            ("bikes",      BikeStation),
            ("food_trucks", FoodTruck),
            ("noise",      NoiseZone),
        ]

        empty_categories = []
        for cat, model in CATEGORY_MODELS:
            count = await db.scalar(select(func.count(model.id)))
            if count == 0:
                empty_categories.append(cat)

        if len(empty_categories) == len(CATEGORY_MODELS):
            # Fully empty DB — seed everything at once (faster)
            logger.info("Empty DB detected — seeding all categories from real APIs...")
            await seed_all_real(db)
        elif empty_categories:
            # Partial DB (new categories added) — seed only missing ones
            logger.info(f"Seeding missing categories: {empty_categories}")
            for cat in empty_categories:
                await seed_category_all_cities(db, cat)
    start_scheduler()
    logger.info("UrbanFlow AI backend started")
    yield
    stop_scheduler()
    logger.info("UrbanFlow AI backend stopped")


app = FastAPI(
    title="UrbanFlow AI",
    description="AI-powered urban mobility predictions: parking, EV charging, transit, and local services.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000", "http://localhost:5173"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def refresh_on_city_request(request: Request, call_next):
    """
    Before serving any GET /api/* request that includes a ?city= param,
    regenerate snapshots for that city (at most once per cooldown window).
    This ensures users always see fresh data on navigation / page reload.
    """
    city = request.query_params.get("city")
    if (
        city
        and request.method == "GET"
        and request.url.path.startswith("/api/")
        # Skip endpoints that don't use snapshot data
        and not request.url.path.startswith("/api/concierge")
        and not request.url.path.startswith("/api/surge")
        and not request.url.path.startswith("/api/dashboard/compare")
    ):
        await _on_demand_refresh(city)

    return await call_next(request)


app.include_router(parking.router)
app.include_router(ev.router)
app.include_router(transit.router)
app.include_router(services.router)
app.include_router(dashboard.router)
app.include_router(ws.router)
app.include_router(air.router)
app.include_router(bikes.router)
app.include_router(foodtrucks.router)
app.include_router(noise.router)
app.include_router(pulse.router)
app.include_router(concierge.router)
app.include_router(surge.router)


@app.get("/")
async def root():
    return {
        "name": "UrbanFlow AI",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
