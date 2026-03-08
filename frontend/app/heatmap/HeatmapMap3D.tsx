"use client";
import { useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { HexagonLayer } from "@deck.gl/aggregation-layers";
import Map from "react-map-gl/maplibre";
import type { ParkingZone, EVStation, BikeStation } from "@/lib/types";

const CITY_CENTERS: Record<string, { longitude: number; latitude: number; zoom: number }> = {
  "San Francisco": { longitude: -122.4194, latitude: 37.7749, zoom: 12 },
  "New York":      { longitude: -74.006,   latitude: 40.7128, zoom: 11.5 },
  "Austin":        { longitude: -97.7431,  latitude: 30.2672, zoom: 12 },
};

interface Point {
  lat: number;
  lng: number;
  weight: number;
}

interface Props {
  city: string;
  category: "parking" | "ev" | "bikes";
  parking: ParkingZone[];
  ev: EVStation[];
  bikes: BikeStation[];
}

export default function HeatmapMap3D({ city, category, parking, ev, bikes }: Props) {
  const viewState = CITY_CENTERS[city] ?? CITY_CENTERS["San Francisco"];

  const points = useMemo<Point[]>(() => {
    if (category === "parking") {
      return parking
        .filter((z) => z.lat && z.lng)
        .map((z) => ({ lat: z.lat, lng: z.lng, weight: (z.occupancy_pct ?? 0) / 100 }));
    }
    if (category === "ev") {
      return ev
        .filter((s) => s.lat && s.lng)
        .map((s) => ({
          lat: s.lat,
          lng: s.lng,
          weight: s.total_ports > 0 ? 1 - (s.available_ports ?? 0) / s.total_ports : 0,
        }));
    }
    return bikes
      .filter((b) => b.lat && b.lng)
      .map((b) => ({
        lat: b.lat,
        lng: b.lng,
        weight: b.total_docks > 0 ? 1 - (b.available_bikes + b.available_ebikes) / b.total_docks : 0,
      }));
  }, [category, parking, ev, bikes]);

  const COLOR_RANGE = [
    [34, 197, 94, 200],
    [132, 225, 188, 200],
    [250, 204, 21, 200],
    [251, 146, 60, 200],
    [239, 68, 68, 200],
    [185, 28, 28, 220],
  ];

  const LABEL: Record<string, string> = {
    parking: "Parking occupancy",
    ev: "EV demand",
    bikes: "Bike demand",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layer = new (HexagonLayer as any)({
    id: "hexagon-density",
    data: points,
    getPosition: (d: Point) => [d.lng, d.lat],
    getElevationWeight: (d: Point) => d.weight,
    getColorWeight: (d: Point) => d.weight,
    radius: 200,
    elevationScale: 30,
    extruded: true,
    pickable: true,
    colorRange: COLOR_RANGE,
    coverage: 0.88,
    upperPercentile: 100,
  });

  return (
    <div style={{ position: "relative", height: 600, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      <DeckGL
        initialViewState={viewState}
        controller={true}
        layers={[layer]}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        getTooltip={({ object }: any) =>
          object
            ? {
                html: `<div style="background:#1e293b;color:#fff;padding:8px 12px;border-radius:8px;font-size:12px">
                  <strong>${LABEL[category]}</strong><br/>
                  ${object.points?.length ?? 0} locations<br/>
                  Intensity: ${((object.elevationValue ?? 0) * 100).toFixed(0)}%
                </div>`,
              }
            : null
        }
      >
        <Map
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          attributionControl={false}
        />
      </DeckGL>

      <div style={{
        position: "absolute",
        bottom: 16,
        left: 16,
        background: "rgba(10,10,15,0.85)",
        borderRadius: 10,
        padding: "8px 12px",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
          {LABEL[category]} — taller = higher
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {COLOR_RANGE.map(([r, g, b], i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: 3, background: `rgb(${r},${g},${b})` }} />
          ))}
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginLeft: 4 }}>low → high</span>
        </div>
      </div>
    </div>
  );
}
