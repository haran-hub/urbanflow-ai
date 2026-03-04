"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import BestTimeModal from "@/components/BestTimeModal";
import Toast from "@/components/Toast";
import { getEVStations, predictEV, recommendEV } from "@/lib/api";
import type { EVStation, Recommendation } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import type { MapItem } from "@/components/CityMap";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  Available: { color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  Queue: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  Full: { color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

function EVContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [stations, setStations] = useState<EVStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [bestTimeStation, setBestTimeStation] = useState<EVStation | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [predicting, setPredicting] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, { wait: number; explain: string }>>({});
  const [arriveAt, setArriveAt] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 2, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [batteryPct, setBatteryPct] = useState(20);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const fetchStations = useCallback(async () => {
    try {
      const { stations } = await getEVStations(city);
      setStations(stations);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => { setLoading(true); fetchStations(); }, [fetchStations]);

  async function handlePredict(station: EVStation) {
    setPredicting(station.id);
    try {
      const res = await predictEV(station.id, new Date(arriveAt).toISOString());
      setPredictions(prev => ({ ...prev, [station.id]: { wait: res.predicted_wait_minutes, explain: res.explanation } }));
    } catch {
      setToast("Prediction failed");
    } finally {
      setPredicting(null);
    }
  }

  async function handleRecommend() {
    setRecommending(true);
    try {
      const res = await recommendEV(37.7749, -122.4194, batteryPct, 40, city);
      setRecommendation(res.recommendation);
    } catch {
      setToast("Recommendation failed");
    } finally {
      setRecommending(false);
    }
  }

  return (
    <main className="min-h-screen pt-14" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              ⚡ <span style={{ color: "#f59e0b" }}>EV Charging</span> Stations
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{stations.length} stations in {city}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setViewMode("list")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "list" ? "rgba(245,158,11,0.15)" : "var(--card)", color: viewMode === "list" ? "#f59e0b" : "var(--muted)" }}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "map" ? "rgba(245,158,11,0.15)" : "var(--card)", color: viewMode === "map" ? "#f59e0b" : "var(--muted)" }}
              >
                ⊙ Map
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: "var(--muted)" }}>Battery %</label>
              <input
                type="number" min={1} max={100} value={batteryPct}
                onChange={e => setBatteryPct(+e.target.value)}
                className="text-xs w-16"
              />
            </div>
            <input type="datetime-local" value={arriveAt} onChange={e => setArriveAt(e.target.value)} className="text-xs" />
            <button onClick={handleRecommend} disabled={recommending} className="btn-primary text-xs" style={{ background: "#f59e0b" }}>
              {recommending ? "Thinking…" : "✦ Best Station"}
            </button>
          </div>
        </div>

        {recommendation && (
          <div className="p-4 rounded-xl mb-6 animate-slide-up" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#fbbf24" }}>✦ AI Best Station</p>
                <p className="text-sm mt-1" style={{ color: "var(--text)" }}>{recommendation.reason}</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Est. wait: {recommendation.estimated_wait} min</p>
              </div>
              <button onClick={() => setRecommendation(null)} style={{ color: "var(--muted)" }}>✕</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="card p-5 h-40 animate-pulse" style={{ background: "var(--card2)" }} />)}
          </div>
        ) : viewMode === "map" ? (
          <CityMap items={stations.map((s): MapItem => ({
            id: s.id,
            name: s.name,
            lat: s.lat,
            lng: s.lng,
            status: s.status === "Available" ? "green" : s.status === "Queue" ? "yellow" : "red",
            metric: `${s.available_ports} / ${s.total_ports} ports available`,
          }))} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stations.map((s) => {
              const pred = predictions[s.id];
              const ss = STATUS_STYLE[s.status] || STATUS_STYLE.Available;
              const isRec = recommendation?.recommended_id === s.id;
              return (
                <div key={s.id} className="card p-5 flex flex-col gap-3 animate-fade-in"
                  style={isRec ? { borderColor: "rgba(245,158,11,0.5)", background: "rgba(245,158,11,0.03)" } : {}}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{s.name}</p>
                        {isRec && <span className="tag" style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}>★ Recommended</span>}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{s.network} · {s.address}</p>
                    </div>
                    <span className="tag shrink-0" style={{ background: ss.bg, color: ss.color }}>{s.status}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xl font-bold" style={{ color: "var(--text)" }}>{s.available_ports}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>/ {s.total_ports} ports</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(s.port_types).map(([type, count]) => (
                          <span key={type} className="tag" style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
                            {type}: {count}
                          </span>
                        ))}
                      </div>
                      {s.avg_wait_minutes > 0 && (
                        <p className="text-xs mt-1.5" style={{ color: "#f59e0b" }}>⏱ ~{s.avg_wait_minutes} min wait</p>
                      )}
                    </div>
                  </div>

                  {pred && (
                    <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                      <p style={{ color: "#fbbf24" }}>AI Prediction:</p>
                      <p className="mt-1" style={{ color: "var(--text)" }}>Expected wait: {pred.wait} min</p>
                      <p className="mt-0.5" style={{ color: "var(--muted)" }}>{pred.explain}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handlePredict(s)} disabled={predicting === s.id} className="btn-ghost text-xs flex-1">
                      {predicting === s.id ? "…" : "⬡ Predict Wait"}
                    </button>
                    <button onClick={() => setBestTimeStation(s)} className="btn-ghost text-xs flex-1">⏱ Best Time</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {bestTimeStation && (
        <BestTimeModal entityType="ev" entityId={bestTimeStation.id} entityName={bestTimeStation.name} onClose={() => setBestTimeStation(null)} />
      )}
      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </main>
  );
}

export default function EVPage() {
  return <Suspense><EVContent /></Suspense>;
}
