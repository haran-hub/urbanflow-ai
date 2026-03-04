"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import { getNoiseZones } from "@/lib/api";
import type { NoiseZone } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import type { MapItem } from "@/components/CityMap";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

const ACCENT = "#ec4899";

const VIBE_STYLE = (score: number): { color: string; bg: string } => {
  if (score < 15)  return { color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
  if (score < 35)  return { color: "#84cc16", bg: "rgba(132,204,22,0.1)" };
  if (score < 60)  return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)" };
  if (score < 80)  return { color: "#f97316", bg: "rgba(249,115,22,0.1)" };
  return { color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
};

const VIBE_MAP_STATUS = (score: number): string => {
  if (score < 35)  return "green";
  if (score < 65)  return "yellow";
  return "red";
};

const ZONE_TYPE_ICON: Record<string, string> = {
  entertainment: "🎭",
  commercial: "🏢",
  residential: "🏡",
  transit: "🚉",
  mixed: "⬡",
};

function NoiseContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [zones, setZones] = useState<NoiseZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [toast, setToast] = useState<string | null>(null);

  const fetchZones = useCallback(async () => {
    try {
      const { zones } = await getNoiseZones(city);
      setZones(zones);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => { setLoading(true); fetchZones(); }, [fetchZones]);

  return (
    <main className="min-h-screen pt-14" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              🎵 <span style={{ color: ACCENT }}>Noise & Vibe</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{zones.length} zones in {city} · sorted by energy</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setViewMode("list")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "list" ? `rgba(236,72,153,0.15)` : "var(--card)", color: viewMode === "list" ? ACCENT : "var(--muted)" }}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "map" ? `rgba(236,72,153,0.15)` : "var(--card)", color: viewMode === "map" ? ACCENT : "var(--muted)" }}
              >
                ⊙ Map
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="card p-5 h-40 animate-pulse" style={{ background: "var(--card2)" }} />)}
          </div>
        ) : viewMode === "map" ? (
          <CityMap items={zones.map((z): MapItem => ({
            id: z.id,
            name: z.name,
            lat: z.lat,
            lng: z.lng,
            status: VIBE_MAP_STATUS(z.vibe_score) as "green" | "yellow" | "red" | "gray",
            metric: `${z.vibe_label} · ${z.noise_db} dB`,
          }))} />
        ) : zones.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>No noise zones found for this city.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {zones.map((z) => {
              const { color, bg } = VIBE_STYLE(z.vibe_score);

              return (
                <div key={z.id} className="card p-5 flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span>{ZONE_TYPE_ICON[z.zone_type] || "⬡"}</span>
                        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{z.name}</p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{z.address}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="tag text-xs" style={{ background: bg, color }}>
                        {z.vibe_label}
                      </span>
                      <span className="tag text-xs" style={{
                        background: "rgba(236,72,153,0.1)",
                        color: ACCENT,
                      }}>
                        {z.zone_type}
                      </span>
                    </div>
                  </div>

                  {/* Vibe score large display */}
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold" style={{ color }}>{z.vibe_score}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>vibe</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: "var(--muted)" }}>Energy level</span>
                        <span style={{ color: "var(--muted)" }}>{z.noise_db} dB</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill"
                          style={{ width: `${z.vibe_score}%`, background: color }} />
                      </div>
                    </div>
                  </div>

                  {/* Crowd density */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span style={{ color: "var(--muted)" }}>Crowd density</span>
                      <span style={{ color: "var(--muted)" }}>{z.crowd_density}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill"
                        style={{ width: `${z.crowd_density}%`, background: ACCENT }} />
                    </div>
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

export default function NoisePage() {
  return <Suspense><NoiseContent /></Suspense>;
}
