"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import { getAirStations, predictAir } from "@/lib/api";
import type { AirStation } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import type { MapItem } from "@/components/CityMap";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

const ACCENT = "#06b6d4";

const AQI_STYLE = (aqi: number): { color: string; bg: string } => {
  if (aqi <= 50)  return { color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
  if (aqi <= 100) return { color: "#eab308", bg: "rgba(234,179,8,0.1)" };
  if (aqi <= 150) return { color: "#f97316", bg: "rgba(249,115,22,0.1)" };
  if (aqi <= 200) return { color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
  return { color: "#a855f7", bg: "rgba(168,85,247,0.1)" };
};

const AQI_MAP_STATUS = (aqi: number): string => {
  if (aqi <= 50)  return "green";
  if (aqi <= 100) return "yellow";
  return "red";
};

const POLLEN_LABELS = ["None", "Low", "Moderate", "High", "Very High"];
const POLLEN_COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];

function AirContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [stations, setStations] = useState<AirStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [predicting, setPredicting] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, { aqi: number; category: string; advisory: string; explain: string }>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [arriveAt, setArriveAt] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 2, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  const fetchStations = useCallback(async () => {
    try {
      const { stations } = await getAirStations(city);
      setStations(stations);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => { setLoading(true); fetchStations(); }, [fetchStations]);

  async function handlePredict(station: AirStation) {
    setPredicting(station.id);
    try {
      const res = await predictAir(station.id, new Date(arriveAt).toISOString());
      setPredictions(prev => ({
        ...prev,
        [station.id]: {
          aqi: res.predicted_aqi,
          category: res.predicted_category,
          advisory: res.health_advisory,
          explain: res.explanation,
        },
      }));
    } catch {
      setToast("Prediction failed");
    } finally {
      setPredicting(null);
    }
  }

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              🌬 <span style={{ color: ACCENT }}>Air Quality</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{stations.length} monitoring stations in {city}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setViewMode("list")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "list" ? `rgba(6,182,212,0.15)` : "var(--card)", color: viewMode === "list" ? ACCENT : "var(--muted)" }}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "map" ? `rgba(6,182,212,0.15)` : "var(--card)", color: viewMode === "map" ? ACCENT : "var(--muted)" }}
              >
                ⊙ Map
              </button>
            </div>
            <input type="datetime-local" value={arriveAt} onChange={e => setArriveAt(e.target.value)} className="text-xs" />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="card p-5 h-40 animate-pulse" style={{ background: "var(--card2)" }} />)}
          </div>
        ) : viewMode === "map" ? (
          <CityMap items={stations.map((s): MapItem => ({
            id: s.id,
            name: s.name,
            lat: s.lat,
            lng: s.lng,
            status: AQI_MAP_STATUS(s.aqi) as "green" | "yellow" | "red" | "gray",
            metric: `AQI ${s.aqi} · ${s.category}`,
          }))} />
        ) : stations.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>No air quality stations found for this city.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stations.map((s) => {
              const pred = predictions[s.id];
              const displayAqi = pred ? pred.aqi : s.aqi;
              const displayCategory = pred ? pred.category : s.category;
              const { color, bg } = AQI_STYLE(displayAqi);
              const pollen = pred ? s.pollen_level : s.pollen_level;

              return (
                <div key={s.id} className="card p-5 flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{s.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{s.address}</p>
                    </div>
                    <span className="tag text-xs font-semibold" style={{ background: bg, color }}>
                      {displayCategory}
                    </span>
                  </div>

                  {/* AQI large display */}
                  <div className="flex items-end gap-4">
                    <div>
                      <p className="text-4xl font-bold" style={{ color }}>{displayAqi}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>AQI</p>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="p-2 rounded-lg text-center" style={{ background: "var(--card2)" }}>
                        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{s.pm25}</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>PM2.5</p>
                      </div>
                      <div className="p-2 rounded-lg text-center" style={{ background: "var(--card2)" }}>
                        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{s.pm10}</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>PM10</p>
                      </div>
                      <div className="p-2 rounded-lg text-center" style={{ background: "var(--card2)" }}>
                        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{s.o3}</p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>O3</p>
                      </div>
                    </div>
                  </div>

                  {/* Pollen + UV */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: "var(--muted)" }}>Pollen</span>
                        <span style={{ color: POLLEN_COLORS[pollen] }}>{POLLEN_LABELS[pollen]}</span>
                      </div>
                      <div className="flex gap-0.5">
                        {[0, 1, 2, 3, 4].map(i => (
                          <div key={i} className="flex-1 h-1.5 rounded-sm"
                            style={{ background: i <= pollen ? POLLEN_COLORS[pollen] : "var(--card2)" }} />
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>UV {s.uv_index}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>UV Index</p>
                    </div>
                  </div>

                  {/* Health advisory */}
                  <p className="text-xs px-3 py-2 rounded-lg" style={{ background: bg, color, border: `1px solid ${color}30` }}>
                    {pred ? pred.advisory : s.health_advisory}
                  </p>

                  {pred && (
                    <div className="p-2.5 rounded-lg text-xs" style={{ background: `rgba(6,182,212,0.06)`, border: `1px solid rgba(6,182,212,0.15)` }}>
                      <span style={{ color: ACCENT }}>AI at {new Date(arriveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: </span>
                      <span style={{ color: "var(--text)" }}>AQI {pred.aqi} ({pred.category})</span>
                      <p className="mt-0.5" style={{ color: "var(--muted)" }}>{pred.explain}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handlePredict(s)} disabled={predicting === s.id} className="btn-ghost text-xs flex-1">
                      {predicting === s.id ? "Predicting…" : "⬡ Predict AQI"}
                    </button>
                  </div>
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

export default function AirPage() {
  return <Suspense><AirContent /></Suspense>;
}
