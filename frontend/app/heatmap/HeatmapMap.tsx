"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { ParkingZone, EVStation, NoiseZone, FoodTruck, BikeStation } from "@/lib/types";

const CITY_CENTERS: Record<string, [number, number]> = {
  "San Francisco": [37.7749, -122.4194],
  "New York":      [40.7128, -74.006],
  "Austin":        [30.2672, -97.7431],
};

function RecenterMap({ city }: { city: string }) {
  const map = useMap();
  useEffect(() => {
    const center = CITY_CENTERS[city] ?? [37.7749, -122.4194];
    map.setView(center, 12);
  }, [city, map]);
  return null;
}

interface Props {
  city: string;
  layers: Set<string>;
  parking: ParkingZone[];
  ev: EVStation[];
  noise: NoiseZone[];
  food: FoodTruck[];
  bikes: BikeStation[];
}

export default function HeatmapMap({ city, layers, parking, ev, noise, food, bikes }: Props) {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet");
    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  const center = CITY_CENTERS[city] ?? [37.7749, -122.4194];

  return (
    <div style={{ height: "600px", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <RecenterMap city={city} />

        {/* Noise/Vibe — large translucent circles as background layer */}
        {layers.has("noise") && noise.filter((z) => z.lat && z.lng).map((z) => {
          const hue = z.vibe_score >= 70 ? "#ec4899" : z.vibe_score >= 40 ? "#f59e0b" : "#64748b";
          return (
            <CircleMarker key={`noise-${z.id}`} center={[z.lat, z.lng]}
              radius={Math.max(12, z.vibe_score / 4)}
              pathOptions={{ color: hue, fillColor: hue, fillOpacity: 0.18, weight: 1 }}>
              <Popup>
                <strong>{z.name}</strong><br />
                Vibe {z.vibe_score}/100 · {z.vibe_label}<br />
                {z.noise_db?.toFixed(0)}dB · {z.crowd_density}% crowd
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Parking */}
        {layers.has("parking") && parking.filter((z) => z.lat && z.lng).map((z) => {
          const occ = z.occupancy_pct ?? 0;
          const color = occ < 50 ? "#3b82f6" : occ < 80 ? "#f59e0b" : "#ef4444";
          return (
            <CircleMarker key={`park-${z.id}`} center={[z.lat, z.lng]}
              radius={9}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight: 2 }}>
              <Popup>
                <strong>{z.name}</strong><br />
                {z.available_spots}/{z.total_spots} spots · {Math.round(occ)}% full<br />
                {z.hourly_rate > 0 ? `$${z.hourly_rate}/hr` : "Free"} · {z.zone_type}
              </Popup>
            </CircleMarker>
          );
        })}

        {/* EV Charging */}
        {layers.has("ev") && ev.filter((s) => s.lat && s.lng).map((s) => {
          const color = s.available_ports > 2 ? "#f59e0b" : s.available_ports > 0 ? "#fbbf24" : "#ef4444";
          return (
            <CircleMarker key={`ev-${s.id}`} center={[s.lat, s.lng]}
              radius={8}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.9, weight: 2 }}>
              <Popup>
                <strong>{s.name}</strong><br />
                {s.available_ports}/{s.total_ports} ports · {s.avg_wait_minutes}min wait<br />
                {s.network} · {s.status}
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Food Trucks */}
        {layers.has("food_trucks") && food.filter((t) => t.lat && t.lng).map((t) => {
          const color = t.is_open ? "#f97316" : "#374151";
          return (
            <CircleMarker key={`food-${t.id}`} center={[t.lat, t.lng]}
              radius={7}
              pathOptions={{ color, fillColor: t.is_open ? color : "transparent", fillOpacity: t.is_open ? 0.85 : 0, weight: 2 }}>
              <Popup>
                <strong>{t.name}</strong><br />
                {t.cuisine} · {t.is_open ? `Open · ${t.wait_minutes}min wait` : "Closed"}
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Bikes */}
        {layers.has("bikes") && bikes.filter((b) => b.lat && b.lng).map((b) => {
          const total = b.available_bikes + b.available_ebikes;
          const color = total > 3 ? "#10b981" : total > 0 ? "#f59e0b" : "#ef4444";
          return (
            <CircleMarker key={`bike-${b.id}`} center={[b.lat, b.lng]}
              radius={7}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}>
              <Popup>
                <strong>{b.name}</strong><br />
                {b.available_bikes} bikes · {b.available_ebikes} e-bikes<br />
                {b.available_docks} empty docks
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
