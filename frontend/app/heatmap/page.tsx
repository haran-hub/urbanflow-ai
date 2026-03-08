"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { getParkingZones, getEVStations, getNoiseZones, getFoodTrucks, getBikeStations } from "@/lib/api";
import type { ParkingZone, EVStation, NoiseZone, FoodTruck, BikeStation } from "@/lib/types";

const HeatmapMap = dynamic(() => import("./HeatmapMap"), { ssr: false });
const HeatmapMap3D = dynamic(() => import("./HeatmapMap3D"), { ssr: false });

const LAYERS = [
  { key: "parking",     label: "Parking",     icon: "🅿",  desc: "Occupancy — blue→red" },
  { key: "ev",          label: "EV Charging", icon: "⚡",  desc: "Availability — yellow→red" },
  { key: "noise",       label: "Noise & Vibe",icon: "🎵",  desc: "Vibe score — large halos" },
  { key: "food_trucks", label: "Food Trucks", icon: "🚚",  desc: "Open=orange · Closed=outline" },
  { key: "bikes",       label: "Bikes",       icon: "🚲",  desc: "Availability — green→red" },
];

const LAYERS_3D = [
  { key: "parking" as const, label: "Parking",     icon: "🅿",  desc: "Hexagonal occupancy density" },
  { key: "ev"      as const, label: "EV Charging", icon: "⚡",  desc: "Hexagonal EV demand density" },
  { key: "bikes"   as const, label: "Bikes",       icon: "🚲",  desc: "Hexagonal bike demand density" },
];

function HeatmapContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set(["parking", "ev", "noise", "food_trucks", "bikes"]));
  const [parking, setParking] = useState<ParkingZone[]>([]);
  const [ev, setEV] = useState<EVStation[]>([]);
  const [noise, setNoise] = useState<NoiseZone[]>([]);
  const [food, setFood] = useState<FoodTruck[]>([]);
  const [bikes, setBikes] = useState<BikeStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode3D, setMode3D] = useState(false);
  const [active3DLayer, setActive3DLayer] = useState<"parking" | "ev" | "bikes">("parking");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([
      getParkingZones(city),
      getEVStations(city),
      getNoiseZones(city),
      getFoodTrucks(city),
      getBikeStations(city),
    ]).then(([p, e, n, f, b]) => {
      if (cancelled) return;
      if (p.status === "fulfilled") setParking(p.value.zones);
      if (e.status === "fulfilled") setEV(e.value.stations);
      if (n.status === "fulfilled") setNoise(n.value.zones);
      if (f.status === "fulfilled") setFood(f.value.trucks);
      if (b.status === "fulfilled") setBikes(b.value.stations);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [city]);

  function toggleLayer(key: string) {
    setActiveLayers((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <main className="min-h-screen pt-14 md:pt-14 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              🗺 <span style={{ color: "var(--accent)" }}>Neighborhood</span> Heat Map
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {mode3D ? "3D hexagonal density columns — rotate & tilt with right-click drag" : "All 5 city layers on one interactive map — toggle to focus"}
            </p>
          </div>
          {/* 2D/3D toggle */}
          <div className="flex rounded-xl overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
            <button
              onClick={() => setMode3D(false)}
              className="px-4 py-2 text-xs font-semibold transition-all"
              style={{
                background: !mode3D ? "var(--accent)" : "var(--card)",
                color: !mode3D ? "#fff" : "var(--muted)",
              }}
            >
              2D Map
            </button>
            <button
              onClick={() => setMode3D(true)}
              className="px-4 py-2 text-xs font-semibold transition-all"
              style={{
                background: mode3D ? "var(--accent)" : "var(--card)",
                color: mode3D ? "#fff" : "var(--muted)",
              }}
            >
              3D Hex ✦
            </button>
          </div>
        </div>

        {/* Layer toggles */}
        {!mode3D ? (
          <div className="flex flex-wrap gap-2 mb-5">
            {LAYERS.map((l) => {
              const active = activeLayers.has(l.key);
              return (
                <button key={l.key} onClick={() => toggleLayer(l.key)}
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-full transition-all"
                  style={{
                    background: active ? "rgba(59,130,246,0.15)" : "var(--card)",
                    border: `1px solid ${active ? "rgba(59,130,246,0.4)" : "var(--border)"}`,
                    color: active ? "var(--accent)" : "var(--muted)",
                  }}>
                  <span>{l.icon}</span>
                  <span>{l.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-5">
            {LAYERS_3D.map((l) => {
              const active = active3DLayer === l.key;
              return (
                <button key={l.key} onClick={() => setActive3DLayer(l.key)}
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-full transition-all"
                  style={{
                    background: active ? "rgba(59,130,246,0.15)" : "var(--card)",
                    border: `1px solid ${active ? "rgba(59,130,246,0.4)" : "var(--border)"}`,
                    color: active ? "var(--accent)" : "var(--muted)",
                  }}>
                  <span>{l.icon}</span>
                  <span>{l.label}</span>
                  <span style={{ color: "var(--muted)", opacity: 0.6 }}>— {l.desc}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        {!mode3D && (
          <div className="flex flex-wrap gap-4 mb-4">
            {[
              { color: "#22c55e", label: "Available / Low" },
              { color: "#f59e0b", label: "Moderate / Busy" },
              { color: "#ef4444", label: "Full / Congested" },
              { color: "#ec4899", label: "Vibe halo" },
              { color: "#f97316", label: "Food truck open" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.color, display: "inline-block" }} />
                {l.label}
              </div>
            ))}
          </div>
        )}

        {/* Map */}
        {loading ? (
          <div className="rounded-2xl skeleton" style={{ height: 600, background: "var(--card2)", border: "1px solid var(--border)" }} />
        ) : mode3D ? (
          <HeatmapMap3D
            city={city}
            category={active3DLayer}
            parking={parking}
            ev={ev}
            bikes={bikes}
          />
        ) : (
          <HeatmapMap
            city={city}
            layers={activeLayers}
            parking={parking}
            ev={ev}
            noise={noise}
            food={food}
            bikes={bikes}
          />
        )}

        {/* Stats row */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
            {[
              { icon: "🅿",  label: "Parking zones", count: parking.length },
              { icon: "⚡",  label: "EV stations",   count: ev.length },
              { icon: "🎵",  label: "Noise zones",   count: noise.length },
              { icon: "🚚",  label: "Food trucks",   count: food.length },
              { icon: "🚲",  label: "Bike stations", count: bikes.length },
            ].map((s) => (
              <div key={s.label} className="card p-3 text-center">
                <div style={{ fontSize: 20 }}>{s.icon}</div>
                <div className="text-lg font-bold mt-1" style={{ color: "var(--text)" }}>{s.count}</div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function HeatmapPage() {
  return <Suspense><HeatmapContent /></Suspense>;
}
