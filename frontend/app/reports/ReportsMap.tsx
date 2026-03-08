"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";

const CITY_CENTERS: Record<string, [number, number]> = {
  "San Francisco": [37.7749, -122.4194],
  "New York":      [40.7128, -74.006],
  "Austin":        [30.2672, -97.7431],
};

const TYPE_COLORS: Record<string, string> = {
  parking: "#3b82f6",
  ev:      "#f59e0b",
  transit: "#22c55e",
  general: "#a855f7",
};

interface Report {
  id: number;
  lat: number;
  lng: number;
  type: string;
  description: string;
  upvotes: number;
  created_at: string;
}

function RecenterMap({ city }: { city: string }) {
  const map = useMap();
  useEffect(() => {
    const center = CITY_CENTERS[city] ?? [37.7749, -122.4194];
    map.setView(center, 13);
  }, [city, map]);
  return null;
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface Props {
  city: string;
  reports: Report[];
  onMapClick: (lat: number, lng: number) => void;
}

export default function ReportsMap({ city, reports, onMapClick }: Props) {
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
    <div style={{ height: 400, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", cursor: "crosshair" }}>
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <RecenterMap city={city} />
        <ClickHandler onMapClick={onMapClick} />

        {reports.map((r) => {
          const color = TYPE_COLORS[r.type] ?? "#a855f7";
          const radius = 6 + Math.min(r.upvotes * 2, 12);
          return (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lng]}
              radius={radius}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
            >
              <Popup>
                <strong>{r.type}</strong><br />
                {r.description}<br />
                <span style={{ color: "#64748b" }}>▲ {r.upvotes} upvotes</span>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
