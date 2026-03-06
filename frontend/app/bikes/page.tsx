"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import { getBikeStations, recommendBike } from "@/lib/api";
import type { BikeStation, Recommendation } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { usePolling } from "@/hooks/usePolling";
import type { MapItem } from "@/components/CityMap";
import WeatherMetricsCard from "@/components/WeatherMetricsCard";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

const ACCENT = "#10b981";

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  "New York": { lat: 40.7128, lng: -74.0060 },
  "Austin": { lat: 30.2672, lng: -97.7431 },
};

function BikesContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [stations, setStations] = useState<BikeStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchStations = useCallback(async () => {
    try {
      const { stations } = await getBikeStations(city);
      setStations(stations);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => { setLoading(true); fetchStations(); }, [fetchStations]);
  usePolling(fetchStations);

  async function handleRecommend() {
    setRecommending(true);
    try {
      const center = CITY_CENTERS[city] || CITY_CENTERS["San Francisco"];
      const res = await recommendBike(center.lat, center.lng, city);
      setRecommendation(res.recommendation);
    } catch {
      setToast("Recommendation failed");
    } finally {
      setRecommending(false);
    }
  }

  const dockPct = (s: BikeStation) =>
    s.total_docks > 0 ? Math.round((s.available_docks / s.total_docks) * 100) : 0;

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              🚲 <span style={{ color: ACCENT }}>Bikes & Scooters</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{stations.length} stations in {city}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setViewMode("list")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "list" ? `rgba(16,185,129,0.15)` : "var(--card)", color: viewMode === "list" ? ACCENT : "var(--muted)" }}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "map" ? `rgba(16,185,129,0.15)` : "var(--card)", color: viewMode === "map" ? ACCENT : "var(--muted)" }}
              >
                ⊙ Map
              </button>
            </div>
            <button onClick={handleRecommend} disabled={recommending} className="btn-primary text-xs">
              {recommending ? "Finding…" : "⬡ AI Recommend"}
            </button>
          </div>
        </div>

        {/* AI Recommendation Banner */}
        {recommendation && (
          <div className="card p-4 mb-6" style={{ borderColor: `rgba(16,185,129,0.3)`, background: `rgba(16,185,129,0.06)` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: ACCENT }}>AI Recommendation</p>
            <p className="text-sm" style={{ color: "var(--text)" }}>{recommendation.reason}</p>
            {recommendation.alternatives.length > 0 && (
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                Alternatives: {recommendation.alternatives.map(a => a.reason).join(" · ")}
              </p>
            )}
          </div>
        )}

        <WeatherMetricsCard city={city} context="bikes" />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="card p-5 h-36 animate-pulse" style={{ background: "var(--card2)" }} />)}
          </div>
        ) : viewMode === "map" ? (
          <CityMap items={stations.map((s): MapItem => ({
            id: s.id,
            name: s.name,
            lat: s.lat,
            lng: s.lng,
            status: (s.available_bikes + s.available_ebikes) > 2 ? "green" : (s.available_bikes + s.available_ebikes) > 0 ? "yellow" : "red",
            metric: `${s.available_bikes + s.available_ebikes} bikes · ${s.available_docks} docks`,
          }))} />
        ) : stations.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>No bike stations found for this city.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stations.map((s) => {
              const totalAvail = s.available_bikes + s.available_ebikes;
              const availColor = totalAvail > 2 ? "#22c55e" : totalAvail > 0 ? "#f59e0b" : "#ef4444";

              return (
                <div key={s.id} className="card p-5 flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{s.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{s.address}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="tag text-xs" style={{
                        background: `rgba(16,185,129,0.1)`,
                        color: ACCENT,
                      }}>
                        {s.network}
                      </span>
                      <span className="tag text-xs" style={{
                        background: s.is_renting ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                        color: s.is_renting ? "#22c55e" : "#ef4444",
                      }}>
                        {s.is_renting ? "Renting" : "Closed"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold" style={{ color: availColor }}>{totalAvail}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>bikes</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: "var(--muted)" }}>
                          {s.available_bikes} regular · {s.available_ebikes} e-bike
                        </span>
                        <span style={{ color: "var(--muted)" }}>{s.available_docks} docks free</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill"
                          style={{ width: `${dockPct(s)}%`, background: ACCENT }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                        {dockPct(s)}% dock availability · {s.total_docks} total
                      </p>
                    </div>
                  </div>

                  {recommendation?.recommended_id === s.id && (
                    <div className="p-2 rounded-lg text-xs" style={{ background: `rgba(16,185,129,0.08)`, border: `1px solid rgba(16,185,129,0.2)` }}>
                      <span style={{ color: ACCENT }}>AI Pick — </span>
                      <span style={{ color: "var(--text)" }}>{recommendation.reason}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </main>
  );
}

export default function BikesPage() {
  return <Suspense><BikesContent /></Suspense>;
}
