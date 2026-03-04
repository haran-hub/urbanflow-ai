"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";

export interface MapItem {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "green" | "yellow" | "red" | "gray";
  metric: string;
}

const STATUS_COLORS: Record<string, string> = {
  green: "#22c55e",
  yellow: "#f59e0b",
  red: "#ef4444",
  gray: "#64748b",
};

function FitBounds({ items }: { items: MapItem[] }) {
  const map = useMap();
  useEffect(() => {
    if (items.length === 0) return;
    const bounds: LatLngBoundsExpression = items.map((i) => [i.lat, i.lng]);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [items, map]);
  return null;
}

export default function CityMap({ items }: { items: MapItem[] }) {
  useEffect(() => {
    // Fix Leaflet default icon path issue with webpack/Next.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet");
    delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 rounded-xl" style={{ background: "var(--card)", color: "var(--muted)" }}>
        No locations to display
      </div>
    );
  }

  const center: [number, number] = [items[0].lat, items[0].lng];

  return (
    <div className="rounded-xl overflow-hidden" style={{ height: "480px", border: "1px solid var(--border)" }}>
      <MapContainer
        center={center}
        zoom={12}
        style={{ height: "100%", width: "100%", background: "#0f172a" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds items={items} />
        {items.map((item) => {
          const color = STATUS_COLORS[item.status] ?? STATUS_COLORS.gray;
          return (
            <CircleMarker
              key={item.id}
              center={[item.lat, item.lng]}
              radius={9}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.85, weight: 2 }}
            >
              <Popup>
                <div style={{ minWidth: 140 }}>
                  <strong style={{ fontSize: 13 }}>{item.name}</strong>
                  <br />
                  <span style={{ fontSize: 12, color: "#64748b" }}>{item.metric}</span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
