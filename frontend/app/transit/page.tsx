"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import OccupancyBar from "@/components/OccupancyBar";
import BestTimeModal from "@/components/BestTimeModal";
import Toast from "@/components/Toast";
import { getTransitRoutes, predictTransit } from "@/lib/api";
import type { TransitRoute } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { usePolling } from "@/hooks/usePolling";

const TYPE_ICONS: Record<string, string> = { bus: "🚌", subway: "🚇", tram: "🚋", ferry: "⛴" };
const TYPE_COLOR: Record<string, string> = { bus: "#f59e0b", subway: "#3b82f6", tram: "#22c55e", ferry: "#0ea5e9" };

function TransitContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [routes, setRoutes] = useState<TransitRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [bestTimeRoute, setBestTimeRoute] = useState<TransitRoute | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const [predicting, setPredicting] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, { level: number; label: string; explain: string }>>({});
  const [departAt, setDepartAt] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0);
    const p=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });

  const fetchRoutes = useCallback(async () => {
    try {
      const { routes } = await getTransitRoutes(city);
      setRoutes(routes);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => { setLoading(true); fetchRoutes(); }, [fetchRoutes]);
  usePolling(fetchRoutes);

  async function handlePredict(route: TransitRoute) {
    setPredicting(route.id);
    try {
      const res = await predictTransit(route.id, new Date(departAt).toISOString());
      setPredictions(prev => ({ ...prev, [route.id]: { level: res.predicted_occupancy_level, label: res.crowd_label, explain: res.explanation } }));
    } catch {
      setToast("Prediction failed");
    } finally {
      setPredicting(null);
    }
  }

  const types = ["all", ...Array.from(new Set(routes.map(r => r.route_type)))];
  const filtered = filter === "all" ? routes : routes.filter(r => r.route_type === filter);

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              🚇 <span style={{ color: "#22c55e" }}>Transit</span> Routes
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{routes.length} routes in {city}</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="datetime-local" value={departAt} onChange={e => setDepartAt(e.target.value)} className="text-xs" />
          </div>
        </div>

        {/* Type filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium capitalize whitespace-nowrap transition-all"
              style={{
                background: filter === t ? "rgba(34,197,94,0.15)" : "var(--card)",
                color: filter === t ? "#4ade80" : "var(--muted)",
                border: `1px solid ${filter === t ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
              }}>
              {t === "all" ? "All" : `${TYPE_ICONS[t] ?? ""} ${t}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="card p-5 h-36 animate-pulse" style={{ background: "var(--card2)" }} />)}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((route) => {
              const pred = predictions[route.id];
              const typeColor = TYPE_COLOR[route.route_type] || "#3b82f6";
              const displayLevel = pred ? pred.level : route.occupancy_level;
              const displayLabel = pred ? pred.label : route.crowd_label;
              return (
                <div key={route.id} className="card p-5 animate-fade-in">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ background: `${typeColor}15`, color: typeColor }}>
                      {TYPE_ICONS[route.route_type] ?? "🚍"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{route.name}</p>
                        <span className="tag capitalize" style={{ background: `${typeColor}15`, color: typeColor }}>{route.route_type}</span>
                        {route.delay_minutes > 0 && (
                          <span className="tag" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                            +{route.delay_minutes} min delay
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-1 truncate" style={{ color: "var(--muted)" }}>
                        {route.stops.slice(0, 4).join(" → ")}{route.stops.length > 4 ? " …" : ""}
                      </p>

                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span style={{ color: "var(--muted)" }}>Crowd</span>
                            <span style={{ color: displayLevel > 70 ? "#ef4444" : displayLevel > 50 ? "#f59e0b" : "#22c55e" }}>
                              {displayLabel}
                            </span>
                          </div>
                          <OccupancyBar pct={displayLevel} showLabel={false} />
                        </div>
                        <div className="text-xs text-right shrink-0" style={{ color: "var(--muted)" }}>
                          <p>Every {route.frequency_mins} min</p>
                          <p className="mt-0.5" style={{ color: "#60a5fa" }}>Next: {route.next_arrival_mins} min</p>
                        </div>
                      </div>

                      {pred && (
                        <div className="mt-3 p-2.5 rounded-lg text-xs" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                          <span style={{ color: "#4ade80" }}>AI at {new Date(departAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: </span>
                          <span style={{ color: "var(--text)" }}>{pred.label} ({pred.level}%)</span>
                          <span style={{ color: "var(--muted)" }}> — {pred.explain}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => handlePredict(route)} disabled={predicting === route.id} className="btn-ghost text-xs flex-1">
                      {predicting === route.id ? "Predicting…" : "⬡ Predict Crowd"}
                    </button>
                    <button onClick={() => setBestTimeRoute(route)} className="btn-ghost text-xs flex-1">⏱ Best Time</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {bestTimeRoute && (
        <BestTimeModal entityType="transit" entityId={bestTimeRoute.id} entityName={bestTimeRoute.name} onClose={() => setBestTimeRoute(null)} />
      )}
      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </main>
  );
}

export default function TransitPage() {
  return <Suspense><TransitContent /></Suspense>;
}
