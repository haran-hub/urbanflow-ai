from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import String, Float, Integer, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


# ── Static Entities ────────────────────────────────────────────────────────────

class ParkingZone(Base):
    __tablename__ = "parking_zones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    total_spots: Mapped[int] = mapped_column(Integer)
    zone_type: Mapped[str] = mapped_column(String)  # street / lot / garage
    hourly_rate: Mapped[float] = mapped_column(Float, default=0.0)
    address: Mapped[str] = mapped_column(String, default="")

    snapshots: Mapped[list["ParkingSnapshot"]] = relationship(back_populates="zone", cascade="all, delete-orphan")


class EVStation(Base):
    __tablename__ = "ev_stations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    total_ports: Mapped[int] = mapped_column(Integer)
    port_types: Mapped[dict] = mapped_column(JSON, default=dict)  # {"Level2": 4, "DCFast": 2}
    network: Mapped[str] = mapped_column(String, default="")
    address: Mapped[str] = mapped_column(String, default="")

    snapshots: Mapped[list["EVSnapshot"]] = relationship(back_populates="station", cascade="all, delete-orphan")


class TransitRoute(Base):
    __tablename__ = "transit_routes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String, index=True)
    route_type: Mapped[str] = mapped_column(String)  # bus / subway / tram / ferry
    stops: Mapped[list] = mapped_column(JSON, default=list)
    frequency_mins: Mapped[int] = mapped_column(Integer, default=10)  # typical headway

    snapshots: Mapped[list["TransitSnapshot"]] = relationship(back_populates="route", cascade="all, delete-orphan")


class LocalService(Base):
    __tablename__ = "local_services"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    category: Mapped[str] = mapped_column(String, index=True)  # dmv / hospital / bank / post_office / pharmacy
    address: Mapped[str] = mapped_column(String, default="")
    typical_hours: Mapped[str] = mapped_column(String, default="9am-5pm")

    snapshots: Mapped[list["ServiceSnapshot"]] = relationship(back_populates="service", cascade="all, delete-orphan")


# ── Time-Series Snapshots ──────────────────────────────────────────────────────

class ParkingSnapshot(Base):
    __tablename__ = "parking_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    zone_id: Mapped[str] = mapped_column(String, ForeignKey("parking_zones.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    available_spots: Mapped[int] = mapped_column(Integer)
    occupancy_pct: Mapped[float] = mapped_column(Float)  # 0.0 – 1.0

    zone: Mapped["ParkingZone"] = relationship(back_populates="snapshots")


class EVSnapshot(Base):
    __tablename__ = "ev_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    station_id: Mapped[str] = mapped_column(String, ForeignKey("ev_stations.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    available_ports: Mapped[int] = mapped_column(Integer)
    avg_wait_minutes: Mapped[int] = mapped_column(Integer, default=0)

    station: Mapped["EVStation"] = relationship(back_populates="snapshots")


class TransitSnapshot(Base):
    __tablename__ = "transit_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    route_id: Mapped[str] = mapped_column(String, ForeignKey("transit_routes.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    occupancy_level: Mapped[int] = mapped_column(Integer)  # 0–100
    delay_minutes: Mapped[int] = mapped_column(Integer, default=0)
    next_arrival_mins: Mapped[int] = mapped_column(Integer, default=5)

    route: Mapped["TransitRoute"] = relationship(back_populates="snapshots")


class ServiceSnapshot(Base):
    __tablename__ = "service_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    service_id: Mapped[str] = mapped_column(String, ForeignKey("local_services.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    estimated_wait_minutes: Mapped[int] = mapped_column(Integer)
    queue_length: Mapped[int] = mapped_column(Integer, default=0)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)

    service: Mapped["LocalService"] = relationship(back_populates="snapshots")


# ── AI & User Layer ────────────────────────────────────────────────────────────

class Prediction(Base):
    __tablename__ = "predictions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    entity_type: Mapped[str] = mapped_column(String)  # parking / ev / transit / service
    entity_id: Mapped[str] = mapped_column(String, index=True)
    predict_for_time: Mapped[datetime] = mapped_column(DateTime)
    predicted_value: Mapped[float] = mapped_column(Float)  # occupancy_pct or wait_minutes
    confidence: Mapped[float] = mapped_column(Float)       # 0.0 – 1.0
    explanation: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UserSession(Base):
    __tablename__ = "user_sessions"

    session_id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    city: Mapped[str] = mapped_column(String, default="")
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ── New Categories ─────────────────────────────────────────────────────────────

class AirStation(Base):
    __tablename__ = "air_stations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    address: Mapped[str] = mapped_column(String, default="")

    snapshots: Mapped[list["AirSnapshot"]] = relationship(back_populates="station", cascade="all, delete-orphan")


class AirSnapshot(Base):
    __tablename__ = "air_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    station_id: Mapped[str] = mapped_column(String, ForeignKey("air_stations.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    aqi: Mapped[int] = mapped_column(Integer, default=0)
    pm25: Mapped[float] = mapped_column(Float, default=0.0)
    pm10: Mapped[float] = mapped_column(Float, default=0.0)
    o3: Mapped[float] = mapped_column(Float, default=0.0)
    pollen_level: Mapped[int] = mapped_column(Integer, default=0)   # 0=None 1=Low 2=Med 3=High 4=VeryHigh
    uv_index: Mapped[float] = mapped_column(Float, default=0.0)
    category: Mapped[str] = mapped_column(String, default="Good")   # Good/Moderate/Unhealthy for Sensitive/Unhealthy/Very Unhealthy/Hazardous

    station: Mapped["AirStation"] = relationship(back_populates="snapshots")


class BikeStation(Base):
    __tablename__ = "bike_stations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    address: Mapped[str] = mapped_column(String, default="")
    total_docks: Mapped[int] = mapped_column(Integer, default=0)
    station_type: Mapped[str] = mapped_column(String, default="bike")  # bike / scooter / mixed
    network: Mapped[str] = mapped_column(String, default="")

    snapshots: Mapped[list["BikeSnapshot"]] = relationship(back_populates="station", cascade="all, delete-orphan")


class BikeSnapshot(Base):
    __tablename__ = "bike_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    station_id: Mapped[str] = mapped_column(String, ForeignKey("bike_stations.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    available_bikes: Mapped[int] = mapped_column(Integer, default=0)
    available_ebikes: Mapped[int] = mapped_column(Integer, default=0)
    available_docks: Mapped[int] = mapped_column(Integer, default=0)
    is_renting: Mapped[bool] = mapped_column(Boolean, default=True)

    station: Mapped["BikeStation"] = relationship(back_populates="snapshots")


class FoodTruck(Base):
    __tablename__ = "food_trucks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    address: Mapped[str] = mapped_column(String, default="")
    cuisine: Mapped[str] = mapped_column(String, default="Various")
    typical_hours: Mapped[str] = mapped_column(String, default="")

    snapshots: Mapped[list["FoodTruckSnapshot"]] = relationship(back_populates="truck", cascade="all, delete-orphan")


class FoodTruckSnapshot(Base):
    __tablename__ = "food_truck_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    truck_id: Mapped[str] = mapped_column(String, ForeignKey("food_trucks.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    is_open: Mapped[bool] = mapped_column(Boolean, default=False)
    wait_minutes: Mapped[int] = mapped_column(Integer, default=0)
    crowd_level: Mapped[int] = mapped_column(Integer, default=0)  # 0-100

    truck: Mapped["FoodTruck"] = relationship(back_populates="snapshots")


class NoiseZone(Base):
    __tablename__ = "noise_zones"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String)
    city: Mapped[str] = mapped_column(String, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    address: Mapped[str] = mapped_column(String, default="")
    zone_type: Mapped[str] = mapped_column(String, default="mixed")  # entertainment/residential/commercial/transit

    snapshots: Mapped[list["NoiseSnapshot"]] = relationship(back_populates="zone", cascade="all, delete-orphan")


class NoiseSnapshot(Base):
    __tablename__ = "noise_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    zone_id: Mapped[str] = mapped_column(String, ForeignKey("noise_zones.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    noise_db: Mapped[float] = mapped_column(Float, default=45.0)
    vibe_score: Mapped[int] = mapped_column(Integer, default=50)    # 0-100
    crowd_density: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    vibe_label: Mapped[str] = mapped_column(String, default="Quiet")  # Quiet/Calm/Lively/Buzzing/Wild

    zone: Mapped["NoiseZone"] = relationship(back_populates="snapshots")


# ── Community & Subscriber Models ──────────────────────────────────────────────

class CommunityReport(Base):
    __tablename__ = "community_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    city: Mapped[str] = mapped_column(String, index=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    type: Mapped[str] = mapped_column(String)        # parking | ev | transit | general
    description: Mapped[str] = mapped_column(String(280))
    upvotes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EmailSubscriber(Base):
    __tablename__ = "email_subscribers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    city: Mapped[str] = mapped_column(String, default="San Francisco")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    unsubscribe_token: Mapped[str] = mapped_column(String, unique=True, default=new_uuid)
