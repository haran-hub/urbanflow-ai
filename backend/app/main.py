import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_tables
from app.scheduler import start_scheduler, stop_scheduler
from app.routes import parking, ev, transit, services, dashboard, ws

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
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
