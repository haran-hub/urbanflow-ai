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
