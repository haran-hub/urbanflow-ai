"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import { getFoodTrucks, predictFoodTruck } from "@/lib/api";
import type { FoodTruck } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { usePolling } from "@/hooks/usePolling";
import type { MapItem } from "@/components/CityMap";
import { nowInCityIso, formatCityTime } from "@/lib/city-time";
import WeatherMetricsCard from "@/components/WeatherMetricsCard";
import type { DirectionsDest } from "@/components/DirectionsPanel";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });
const DirectionsPanel = dynamic(() => import("@/components/DirectionsPanel"), { ssr: false });

const ACCENT = "#f97316";

const WAIT_COLOR: Record<string, string> = {
  "No wait": "#22c55e",
  "Short wait": "#4ade80",
  "Moderate wait": "#f59e0b",
  "Long wait": "#ef4444",
};

function FoodTrucksContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [trucks, setTrucks] = useState<FoodTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [cuisine, setCuisine] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [predicting, setPredicting] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, { wait: number; label: string; explain: string }>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [showFuturePanel, setShowFuturePanel] = useState(false);
  const [futureTime, setFutureTime] = useState(() => nowInCityIso(city));
  const [directionsDest, setDirectionsDest] = useState<DirectionsDest | null>(null);

  const fetchTrucks = useCallback(async () => {
    try {
      const { trucks } = await getFoodTrucks(city, cuisine === "all" ? undefined : cuisine);
      setTrucks(trucks);
    } finally {
      setLoading(false);
    }
  }, [city, cuisine]);

  useEffect(() => { setLoading(true); fetchTrucks(); }, [fetchTrucks]);
  useEffect(() => { setFutureTime(nowInCityIso(city)); }, [city]);
  usePolling(fetchTrucks);

  async function handlePredict(truck: FoodTruck) {
    setPredicting(truck.id);
    try {
      const res = await predictFoodTruck(truck.id, new Date(futureTime).toISOString());
      setPredictions(prev => ({
        ...prev,
        [truck.id]: { wait: res.predicted_wait_minutes, label: res.wait_label, explain: res.explanation },
      }));
    } catch {
      setToast("Prediction failed");
    } finally {
      setPredicting(null);
    }
  }

  // Collect unique cuisines
  const CUISINES = ["all", ...Array.from(new Set(trucks.map(t => t.cuisine))).filter(Boolean).slice(0, 8)];

  return (
    <main className="min-h-screen pt-14 md:pt-[82px] md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              🚚 <span style={{ color: ACCENT }}>Food Trucks</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {trucks.filter(t => t.is_open).length} open · {trucks.length} total in {city}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setViewMode("list")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "list" ? `rgba(249,115,22,0.15)` : "var(--card)", color: viewMode === "list" ? ACCENT : "var(--muted)" }}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "map" ? `rgba(249,115,22,0.15)` : "var(--card)", color: viewMode === "map" ? ACCENT : "var(--muted)" }}
              >
                ⊙ Map
              </button>
            </div>
            <button
              onClick={() => setShowFuturePanel(v => !v)}
              className="btn-ghost text-xs flex items-center gap-1.5"
              style={showFuturePanel ? { borderColor: "rgba(139,92,246,0.5)", color: "#a78bfa" } : {}}
            >
              🔮 {showFuturePanel ? "Hide" : "Future AI Predict"}
            </button>
          </div>
        </div>

        {showFuturePanel && (
          <div className="p-4 rounded-xl mb-6 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-in"
            style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: "#a78bfa" }}>🔮</span>
              <span className="text-xs font-medium" style={{ color: "#a78bfa" }}>Predict for future time:</span>
            </div>
            <input
              type="datetime-local"
              value={futureTime}
              onChange={e => setFutureTime(e.target.value)}
              className="text-xs"
              min={nowInCityIso(city)}
            />
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Click ⬡ Predict on any card below to get AI forecast for this time
            </p>
          </div>
        )}

        {/* Cuisine filter chips */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {CUISINES.map(cat => (
            <button key={cat} onClick={() => setCuisine(cat)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all"
              style={{
                background: cuisine === cat ? `rgba(249,115,22,0.15)` : "var(--card)",
                color: cuisine === cat ? ACCENT : "var(--muted)",
                border: `1px solid ${cuisine === cat ? "rgba(249,115,22,0.3)" : "var(--border)"}`,
              }}>
              {cat === "all" ? "All Cuisines" : cat}
            </button>
          ))}
        </div>

        <WeatherMetricsCard city={city} context="food" />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="card p-5 h-36 skeleton" />)}
          </div>
        ) : viewMode === "map" ? (
          <CityMap items={trucks.map((t): MapItem => ({
            id: t.id,
            name: t.name,
            lat: t.lat,
            lng: t.lng,
            status: t.is_open ? "green" : "gray",
            metric: t.is_open ? `Open · ${t.wait_minutes} min wait` : "Closed",
          }))} />
        ) : trucks.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>No food trucks found for this selection.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trucks.map((t) => {
              const pred = predictions[t.id];
              const waitColor = WAIT_COLOR[pred ? pred.label : t.wait_label] || "#64748b";

              return (
                <div key={t.id} className="card p-5 flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span>🚚</span>
                        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{t.name}</p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{t.address}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{t.typical_hours}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="tag text-xs" style={{
                        background: t.is_open ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                        color: t.is_open ? "#22c55e" : "#ef4444",
                      }}>
                        {t.is_open ? "Open" : "Closed"}
                      </span>
                      <span className="tag text-xs" style={{ background: `rgba(249,115,22,0.1)`, color: ACCENT }}>
                        {t.cuisine}
                      </span>
                    </div>
                  </div>

                  {t.is_open && (
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold" style={{ color: waitColor }}>
                          {pred ? pred.wait : t.wait_minutes}
                        </p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>min wait</p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span style={{ color: "var(--muted)" }}>Crowd: {t.crowd_level}%</span>
                          <span style={{ color: waitColor }}>{pred ? pred.label : t.wait_label}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill"
                            style={{ width: `${t.crowd_level}%`, background: waitColor }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {pred && (
                    <div className="p-2.5 rounded-lg text-xs" style={{ background: `rgba(249,115,22,0.06)`, border: `1px solid rgba(249,115,22,0.15)` }}>
                      <span style={{ color: ACCENT }}>AI at {formatCityTime(futureTime, city)}: </span>
                      <span style={{ color: "var(--text)" }}>{pred.wait} min ({pred.label})</span>
                      <p className="mt-0.5" style={{ color: "var(--muted)" }}>{pred.explain}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { if (!showFuturePanel) setShowFuturePanel(true); handlePredict(t); }} disabled={predicting === t.id} className="btn-ghost text-xs flex-1">
                      {predicting === t.id ? "Predicting…" : "⬡ Predict Wait"}
                    </button>
                    <button onClick={() => setDirectionsDest({ name: t.name, lat: t.lat, lng: t.lng, icon: "🚚", accent: ACCENT, meta: `${t.cuisine} · ${t.is_open ? "Open" : "Closed"}` })} className="btn-ghost text-xs flex-1">
                      📍 Directions
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {directionsDest && <DirectionsPanel {...directionsDest} onClose={() => setDirectionsDest(null)} />}
      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </main>
  );
}

export default function FoodTrucksPage() {
  return <Suspense><FoodTrucksContent /></Suspense>;
}
