import axios from "axios";
import type {
  DashboardOverview, ParkingZone, EVStation, TransitRoute, LocalService,
  AirStation, BikeStation, FoodTruck, NoiseZone,
  Prediction, Recommendation, BestTime, UrbanPlan,
  PulseScore, ConciergeResponse, CompareData, SurgeData,
  BriefingResponse, MomentResponse, NarrativeResponse,
  GoOutResponse, NeighborhoodGrade, DeltaResponse, TripCostResponse,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const WS_URL = API_URL.replace("https://", "wss://").replace("http://", "ws://");

const api = axios.create({ baseURL: API_URL });

// Dashboard
export async function getOverview(city: string): Promise<DashboardOverview> {
  const { data } = await api.get("/api/dashboard/overview", { params: { city } });
  return data;
}

export async function getBestTime(entity_type: string, entity_id: string): Promise<BestTime & { entity_type: string; entity_id: string }> {
  const { data } = await api.get("/api/dashboard/best-time", { params: { entity_type, entity_id } });
  return data;
}

export async function generateAIPlan(payload: {
  lat: number; lng: number; city: string;
  needs: string[]; depart_at: string;
}): Promise<{ plan: UrbanPlan; generated_at: string }> {
  const { data } = await api.post("/api/dashboard/ai-plan", payload);
  return data;
}

// Parking
export async function getParkingZones(city: string): Promise<{ zones: ParkingZone[]; count: number }> {
  const { data } = await api.get("/api/parking/zones", { params: { city } });
  return data;
}

export async function getParkingZoneStatus(id: string): Promise<ParkingZone & { history: unknown[] }> {
  const { data } = await api.get(`/api/parking/zones/${id}/status`);
  return data;
}

export async function predictParking(zone_id: string, arrive_at: string): Promise<Prediction & { zone_id: string; predicted_occupancy_pct: number; predicted_available_spots: number }> {
  const { data } = await api.get(`/api/parking/zones/${zone_id}/predict`, { params: { arrive_at } });
  return data;
}

export async function recommendParking(lat: number, lng: number, arrive_by: string, duration_hrs: number, city: string): Promise<{ recommendation: Recommendation; options: ParkingZone[] }> {
  const { data } = await api.get("/api/parking/recommend", { params: { lat, lng, arrive_by, duration_hrs, city } });
  return data;
}

// EV
export async function getEVStations(city: string): Promise<{ stations: EVStation[]; count: number }> {
  const { data } = await api.get("/api/ev/stations", { params: { city } });
  return data;
}

export async function predictEV(station_id: string, arrive_at: string): Promise<Prediction & { predicted_wait_minutes: number }> {
  const { data } = await api.get(`/api/ev/stations/${station_id}/predict`, { params: { arrive_at } });
  return data;
}

export async function recommendEV(lat: number, lng: number, battery_pct: number, charge_needed_kwh: number, city: string): Promise<{ recommendation: Recommendation; options: EVStation[] }> {
  const { data } = await api.get("/api/ev/recommend", { params: { lat, lng, battery_pct, charge_needed_kwh, city } });
  return data;
}

// Transit
export async function getTransitRoutes(city: string): Promise<{ routes: TransitRoute[]; count: number }> {
  const { data } = await api.get("/api/transit/routes", { params: { city } });
  return data;
}

export async function predictTransit(route_id: string, depart_at: string): Promise<Prediction & { predicted_occupancy_level: number; crowd_label: string }> {
  const { data } = await api.get(`/api/transit/routes/${route_id}/predict`, { params: { depart_at } });
  return data;
}

// Services
export async function getServices(city: string, category?: string): Promise<{ services: LocalService[]; count: number }> {
  const { data } = await api.get("/api/services/", { params: { city, ...(category ? { category } : {}) } });
  return data;
}

export async function predictService(service_id: string, arrive_at: string): Promise<Prediction & { predicted_wait_minutes: number; wait_label: string }> {
  const { data } = await api.get(`/api/services/${service_id}/predict`, { params: { arrive_at } });
  return data;
}

export async function recommendService(category: string, lat: number, lng: number, max_wait_minutes: number, city: string): Promise<{ recommendation: Recommendation; options: LocalService[] }> {
  const { data } = await api.get("/api/services/recommend", { params: { category, lat, lng, max_wait_minutes, city } });
  return data;
}

// Air Quality
export async function getAirStations(city: string): Promise<{ stations: AirStation[]; count: number }> {
  const { data } = await api.get("/api/air/stations", { params: { city } });
  return data;
}
export async function predictAir(station_id: string, arrive_at: string) {
  const { data } = await api.get(`/api/air/stations/${station_id}/predict`, { params: { arrive_at } });
  return data;
}

// Bikes
export async function getBikeStations(city: string): Promise<{ stations: BikeStation[]; count: number }> {
  const { data } = await api.get("/api/bikes/stations", { params: { city } });
  return data;
}
export async function recommendBike(lat: number, lng: number, city: string) {
  const { data } = await api.get("/api/bikes/recommend", { params: { lat, lng, city } });
  return data;
}

// Food Trucks
export async function getFoodTrucks(city: string, cuisine?: string): Promise<{ trucks: FoodTruck[]; count: number }> {
  const { data } = await api.get("/api/foodtrucks/", { params: { city, ...(cuisine ? { cuisine } : {}) } });
  return data;
}
export async function predictFoodTruck(truck_id: string, arrive_at: string) {
  const { data } = await api.get(`/api/foodtrucks/${truck_id}/predict`, { params: { arrive_at } });
  return data;
}

// Noise
export async function getNoiseZones(city: string): Promise<{ zones: NoiseZone[]; count: number }> {
  const { data } = await api.get("/api/noise/zones", { params: { city } });
  return data;
}

// Urban Pulse Score
export async function getPulseScore(city: string): Promise<PulseScore> {
  const { data } = await api.get("/api/pulse/score", { params: { city } });
  return data;
}

// AI City Concierge
export async function askConcierge(
  question: string,
  city: string,
  history: { role: "user" | "assistant"; content: string }[] = [],
): Promise<ConciergeResponse> {
  const { data } = await api.post("/api/concierge/ask", { question, city, history });
  return data;
}

// City Comparison
export async function getCityComparison(): Promise<CompareData> {
  const { data } = await api.get("/api/dashboard/compare");
  return data;
}

// Surge Alerts
export async function getSurgeAlerts(city: string): Promise<SurgeData> {
  const { data } = await api.get("/api/surge/alerts", { params: { city } });
  return data;
}

// Daily City Briefing
export async function getBriefing(city: string): Promise<BriefingResponse> {
  const { data } = await api.get("/api/briefing/today", { params: { city } });
  return data;
}

// Micro-moment Planner
export async function planMoment(city: string, query: string): Promise<MomentResponse> {
  const { data } = await api.post("/api/moment/plan", { city, query });
  return data;
}

// City Right Now Narrative
export async function getNarrative(city: string): Promise<NarrativeResponse> {
  const { data } = await api.get("/api/narrative", { params: { city } });
  return data;
}

// Should I Go Out Tonight?
export async function getGoOut(city: string): Promise<GoOutResponse> {
  const { data } = await api.get("/api/goout/tonight", { params: { city } });
  return data;
}

// Neighborhood Report Cards
export async function getNeighborhoods(city: string): Promise<{ city: string; timestamp: string; neighborhoods: NeighborhoodGrade[] }> {
  const { data } = await api.get("/api/neighborhoods/report", { params: { city } });
  return data;
}

// Delta — What Changed Today
export async function getDelta(city: string): Promise<DeltaResponse> {
  const { data } = await api.get("/api/delta/today", { params: { city } });
  return data;
}

// Mini sparkline trends
export async function getMiniTrends(city: string): Promise<{
  city: string;
  parking_occ: number[];
  ev_wait: number[];
  transit_crowd: number[];
  aqi: number[];
  timestamp: string;
}> {
  const { data } = await api.get("/api/trends/mini", { params: { city } });
  return data;
}

// Events (Ticketmaster)
export async function getEvents(city: string): Promise<{
  events: { name: string; venue: string; date: string; time: string; url: string; impact: string; genre: string }[];
  city: string;
  note?: string;
}> {
  const { data } = await api.get("/api/events", { params: { city } });
  return data;
}

// Community Reports
export async function getReports(city: string): Promise<{
  reports: { id: number; city: string; lat: number; lng: number; type: string; description: string; upvotes: number; created_at: string }[];
  city: string;
}> {
  const { data } = await api.get("/api/reports", { params: { city } });
  return data;
}

export async function submitReport(payload: {
  city: string; lat: number; lng: number; type: string; description: string;
}): Promise<{ id: number; success: boolean }> {
  const { data } = await api.post("/api/reports", payload);
  return data;
}

export async function upvoteReport(id: number): Promise<{ id: number; upvotes: number }> {
  const { data } = await api.post(`/api/reports/${id}/upvote`);
  return data;
}

// Email Subscribe
export async function subscribeEmail(email: string, city: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post("/api/subscribe", { email, city });
  return data;
}

// Trip Cost Estimator
export async function estimateTripCost(payload: {
  city: string;
  activities: string[];
  duration_hours: number;
  has_ev: boolean;
  depart_at?: string;
}): Promise<TripCostResponse> {
  const { data } = await api.post("/api/tripcost/estimate", payload);
  return data;
}
