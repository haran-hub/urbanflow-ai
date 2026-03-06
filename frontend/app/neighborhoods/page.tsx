"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { getNeighborhoods } from "@/lib/api";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { usePolling } from "@/hooks/usePolling";
import type { NeighborhoodGrade } from "@/lib/types";

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e", B: "#84cc16", C: "#f59e0b", D: "#f97316", F: "#ef4444",
};
const GRADE_BG: Record<string, string> = {
  A: "rgba(34,197,94,0.1)", B: "rgba(132,204,22,0.1)", C: "rgba(245,158,11,0.1)",
  D: "rgba(249,115,22,0.1)", F: "rgba(239,68,68,0.1)",
};
const DOMAIN_ICONS: Record<string, string> = {
  parking: "🅿", ev: "⚡", vibe: "🎵", air: "🌬", transit: "🚇",
};

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-black"
      style={{ background: GRADE_BG[grade] ?? "rgba(100,116,139,0.1)", color: GRADE_COLORS[grade] ?? "#64748b" }}
    >
      {grade}
    </span>
  );
}

function NeighborhoodsContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [hoods, setHoods] = useState<NeighborhoodGrade[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    getNeighborhoods(city)
      .then((d) => setHoods(d.neighborhoods))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [city]); // eslint-disable-line
  usePolling(load);

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            ⬡ <span style={{ color: "var(--accent)" }}>Neighborhood</span> Report Cards
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Live A–F grades across parking, EV, transit, air quality & vibe for every district in {city}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="card p-5 animate-pulse" style={{ background: "var(--card2)" }}>
                <div className="h-4 w-36 rounded mb-2" style={{ background: "rgba(255,255,255,0.07)" }} />
                <div className="h-3 w-full rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {hoods.map((hood, i) => (
              <div
                key={hood.name}
                className="card p-5"
                style={{
                  borderColor: i === 0 ? hood.overall_color : "var(--border)",
                  background: i === 0 ? `${GRADE_BG[hood.overall] ?? "var(--card)"}` : "var(--card)",
                }}
              >
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {i === 0 && <span className="text-base">👑</span>}
                    <div>
                      <h2 className="text-base font-bold" style={{ color: "var(--text)" }}>{hood.name}</h2>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>{hood.overall_label} neighborhood</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-2xl font-black"
                      style={{ color: hood.overall_color }}
                    >
                      {hood.overall}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ background: GRADE_BG[hood.overall], color: hood.overall_color }}>
                      Overall
                    </span>
                  </div>
                </div>

                {/* Domain grades */}
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(hood.grades).map(([domain, grade]) => (
                    <div key={domain} className="text-center">
                      <div className="text-base mb-1">{DOMAIN_ICONS[domain] ?? "⬡"}</div>
                      <GradeBadge grade={grade} />
                      <p className="text-[10px] mt-1 capitalize" style={{ color: "var(--muted)" }}>{domain}</p>
                    </div>
                  ))}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="text-center">
                    <p className="text-xs font-bold" style={{ color: "var(--text)" }}>{hood.metrics.parking_occ}%</p>
                    <p className="text-[10px]" style={{ color: "var(--muted)" }}>Parking full</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold" style={{ color: "var(--text)" }}>{hood.metrics.ev_wait_min}m</p>
                    <p className="text-[10px]" style={{ color: "var(--muted)" }}>EV wait</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold" style={{ color: "var(--text)" }}>{hood.metrics.vibe_score}</p>
                    <p className="text-[10px]" style={{ color: "var(--muted)" }}>Vibe /100</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold" style={{ color: "var(--text)" }}>{hood.metrics.aqi}</p>
                    <p className="text-[10px]" style={{ color: "var(--muted)" }}>AQI</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold" style={{ color: "var(--text)" }}>{hood.metrics.transit_crowd}%</p>
                    <p className="text-[10px]" style={{ color: "var(--muted)" }}>Transit</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function NeighborhoodsPage() {
  return <Suspense><NeighborhoodsContent /></Suspense>;
}
