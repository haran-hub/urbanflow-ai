export interface ParkingZone {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  address: string;
  zone_type: "street" | "lot" | "garage";
  hourly_rate: number;
  total_spots: number;
  available_spots: number;
  occupancy_pct: number;
  last_updated: string | null;
  distance_km?: number;
}

export interface EVStation {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  address: string;
  network: string;
  total_ports: number;
  port_types: Record<string, number>;
  available_ports: number;
  avg_wait_minutes: number;
  status: "Available" | "Queue" | "Full";
  last_updated: string | null;
  distance_km?: number;
}

export interface TransitRoute {
  id: string;
  name: string;
  city: string;
  route_type: "bus" | "subway" | "tram" | "ferry";
  stops: string[];
  frequency_mins: number;
  occupancy_level: number;
  crowd_label: "Empty" | "Comfortable" | "Busy" | "Packed";
  delay_minutes: number;
  next_arrival_mins: number;
  last_updated: string | null;
}

export interface LocalService {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  address: string;
  category: "dmv" | "hospital" | "bank" | "post_office" | "pharmacy";
  typical_hours: string;
  is_open: boolean;
  estimated_wait_minutes: number;
  queue_length: number;
  wait_label: "No wait" | "Short wait" | "Moderate wait" | "Long wait";
  last_updated: string | null;
  distance_km?: number;
}

export interface DashboardOverview {
  city: string;
  timestamp: string;
  rush_status: string;
  parking: {
    total_spots: number;
    available_spots: number;
    occupancy_pct: number;
    zones_count: number;
  };
  ev_charging: {
    total_ports: number;
    available_ports: number;
    avg_wait_minutes: number;
    stations_count: number;
  };
  transit: {
    routes_count: number;
    avg_crowd_level: number;
    delayed_routes: number;
    crowd_label: string;
  };
  services: {
    total: number;
    open_now: number;
    avg_wait_minutes: number;
  };
  air_quality?: {
    avg_aqi: number;
    category: string;
    stations_count: number;
  };
  bikes?: {
    total_available: number;
    stations_count: number;
  };
  food_trucks?: {
    open_count: number;
    total: number;
  };
  noise_vibe?: {
    avg_vibe: number;
    hottest_zone: string;
    zones_count: number;
  };
}

export interface AirStation {
  id: string; name: string; city: string; lat: number; lng: number; address: string;
  aqi: number; pm25: number; pm10: number; o3: number;
  pollen_level: number; pollen_label: string; uv_index: number; category: string;
  health_advisory: string;
  last_updated: string | null;
}

export interface BikeStation {
  id: string; name: string; city: string; lat: number; lng: number; address: string;
  total_docks: number; network: string; station_type: string;
  available_bikes: number; available_ebikes: number; available_docks: number;
  is_renting: boolean; last_updated: string | null;
}

export interface FoodTruck {
  id: string; name: string; city: string; lat: number; lng: number; address: string;
  cuisine: string; typical_hours: string;
  is_open: boolean; wait_minutes: number; crowd_level: number; wait_label: string;
  last_updated: string | null;
}

export interface NoiseZone {
  id: string; name: string; city: string; lat: number; lng: number; address: string;
  zone_type: string; noise_db: number; vibe_score: number;
  crowd_density: number; vibe_label: string; last_updated: string | null;
}

export interface PulseScore {
  city: string;
  timestamp: string;
  pulse_score: number;
  label: string;
  color: string;
  breakdown: Record<string, { score: number; [key: string]: unknown }>;
  weights: Record<string, number>;
}

export interface ConciergeResponse {
  answer: string;
  city: string;
  timestamp: string;
}

export interface CompareData {
  timestamp: string;
  cities: Record<string, {
    parking_occupancy_pct: number;
    parking_available: number;
    ev_available_ports: number;
    ev_avg_wait_min: number;
    transit_crowd_pct: number;
    transit_delayed: number;
    air_aqi: number;
    air_category: string;
    bikes_available: number;
    vibe_score: number;
  }>;
  winners: Record<string, string>;
}

export interface SurgeAlert {
  domain: string;
  severity: "low" | "medium" | "high";
  message: string;
  tip: string;
  predicted_peak_in_mins: number;
}

export interface SurgeData {
  city: string;
  timestamp: string;
  alerts: SurgeAlert[];
  causality_chains: string[];
  ai_generated: boolean;
}

export interface BriefingResponse {
  city: string;
  timestamp: string;
  briefing: string;
  highlights: string[];
  ai_generated: boolean;
}

export interface TimeWindow {
  time_range: string;
  score: number;
  reason: string;
  conditions: Record<string, string>;
}

export interface MomentResponse {
  city: string;
  query: string;
  timestamp: string;
  best_window: TimeWindow;
  alternative_windows: TimeWindow[];
  avoid_window: TimeWindow;
  summary: string;
  ai_generated: boolean;
}

export interface NarrativeResponse {
  city: string;
  timestamp: string;
  narrative: string;
  mood: string;
  mood_color: string;
  ai_generated: boolean;
}

export interface WatchlistItem {
  id: string;
  domain: string;
  label: string;
  metric: string;
  threshold: number;
  condition: "above" | "below";
  city: string;
}

export interface Prediction {
  predicted_value: number;
  confidence: number;
  explanation: string;
}

export interface Recommendation {
  recommended_id: string | null;
  reason: string;
  alternatives: { id: string; reason: string }[];
  estimated_wait: number;
}

export interface BestTime {
  best_windows: { day: string; time_range: string; reason: string }[];
  worst_windows: { day: string; time_range: string; reason: string }[];
  general_tip: string;
}

export interface PlanStep {
  step: number;
  action: string;
  location: string;
  timing: string;
  tip: string;
}

export interface UrbanPlan {
  steps: PlanStep[];
  summary: string;
  total_time_saved_mins: number;
}
