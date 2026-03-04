import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.config import settings
from app.database import create_tables, AsyncSessionLocal
from app.models import ParkingZone, EVStation, TransitRoute, LocalService, AirStation, BikeStation, FoodTruck, NoiseZone
from app.scheduler import start_scheduler, stop_scheduler
from app.routes import parking, ev, transit, services, dashboard, ws, air, bikes, foodtrucks, noise

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


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
