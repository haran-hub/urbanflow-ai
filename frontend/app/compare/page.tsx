"use client";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { getCityComparison } from "@/lib/api";
import type { CompareData } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";

const CITIES = ["San Francisco", "New York", "Austin"] as const;

const METRICS: {
  key: keyof NonNullable<CompareData["cities"][string]>;
  label: string;
  unit: string;
  lowerBetter: boolean;
  icon: string;
}[] = [
  { key: "parking_occupancy_pct", label: "Parking Full", unit: "%", lowerBetter: true, icon: "🅿" },
  { key: "parking_available",     label: "Spots Available", unit: "", lowerBetter: false, icon: "🅿" },
  { key: "ev_available_ports",    label: "EV Ports Free", unit: "", lowerBetter: false, icon: "⚡" },
  { key: "ev_avg_wait_min",       label: "EV Avg Wait", unit: "min", lowerBetter: true, icon: "⚡" },
  { key: "transit_crowd_pct",     label: "Transit Crowd", unit: "%", lowerBetter: true, icon: "🚇" },
  { key: "transit_delayed",       label: "Routes Delayed", unit: "", lowerBetter: true, icon: "🚇" },
  { key: "air_aqi",               label: "Air Quality AQI", unit: "", lowerBetter: true, icon: "🌬" },
  { key: "bikes_available",       label: "Bikes Available", unit: "", lowerBetter: false, icon: "🚲" },
  { key: "vibe_score",            label: "Vibe Score", unit: "/100", lowerBetter: false, icon: "🎵" },
];

const CITY_FLAGS: Record<string, string> = {
  "San Francisco": "🌉",
  "New York": "🗽",
  "Austin": "🎸",
};

export default function ComparePage() {
  const { city, setCity } = useDetectedCity();
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCityComparison()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Tally wins per city
  const wins: Record<string, number> = { "San Francisco": 0, "New York": 0, "Austin": 0 };
  if (data) {
    for (const winner of Object.values(data.winners)) {
      if (wins[winner] !== undefined) wins[winner]++;
    }
  }
  const overallWinner = data ? Object.entries(wins).sort((a, b) => b[1] - a[1])[0][0] : null;

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            ⚖ <span style={{ color: "var(--accent)" }}>City</span> Compare
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Live head-to-head across all 3 cities — who's winning right now?
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="card p-4 h-14 animate-pulse" style={{ background: "var(--card2)" }} />
            ))}
          </div>
        ) : data ? (
          <>
            {/* Overall winner banner */}
            {overallWinner && (
              <div
                className="p-4 rounded-xl mb-6 flex items-center gap-3 animate-fade-in"
                style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)" }}
              >
                <span className="text-2xl">{CITY_FLAGS[overallWinner]}</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: "#93c5fd" }}>
                    🏆 Best City Right Now: {overallWinner}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    Wins {wins[overallWinner]} of {METRICS.length} metrics · Updated {new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            )}

            {/* Win counts */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {CITIES.map((c) => (
                <div key={c} className="card p-3 text-center animate-fade-in">
                  <span className="text-2xl">{CITY_FLAGS[c]}</span>
                  <p className="text-xs font-semibold mt-1" style={{ color: "var(--text)" }}>{c}</p>
                  <p className="text-xl font-bold mt-0.5" style={{ color: c === overallWinner ? "#22c55e" : "var(--muted)" }}>
                    {wins[c]} {c === overallWinner ? "🏆" : ""}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>wins</p>
                </div>
              ))}
            </div>

            {/* Metric rows */}
            <div className="card overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-4 gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--card2)" }}>
                <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Metric</span>
                {CITIES.map((c) => (
                  <span key={c} className="text-xs font-semibold text-center" style={{ color: "var(--muted)" }}>
                    {CITY_FLAGS[c]} {c.split(" ")[0]}
                  </span>
                ))}
              </div>

              {METRICS.map((m, idx) => {
                const winner = data.winners[m.key];
                return (
                  <div
                    key={m.key}
                    className="grid grid-cols-4 gap-3 px-4 py-3 items-center"
                    style={{
                      borderBottom: idx < METRICS.length - 1 ? "1px solid var(--border)" : "none",
                      background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{m.icon}</span>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{m.label}</span>
                    </div>
                    {CITIES.map((c) => {
                      const val = data.cities[c]?.[m.key] ?? 0;
                      const isWinner = winner === c;
                      const displayVal = typeof val === "number" ? (Number.isInteger(val) ? val : val.toFixed(1)) : val;
                      return (
                        <div key={c} className="text-center">
                          <span
                            className="text-sm font-semibold"
                            style={{ color: isWinner ? "#22c55e" : "var(--text)" }}
                          >
                            {displayVal}{m.unit}
                          </span>
                          {isWinner && <span className="ml-1 text-xs">👑</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Air category rows */}
            <div className="card p-4 mt-3 animate-fade-in">
              <div className="grid grid-cols-3 gap-3">
                {CITIES.map((c) => (
                  <div key={c} className="text-center">
                    <p className="text-xs" style={{ color: "var(--muted)" }}>Air category</p>
                    <p className="text-sm font-medium mt-0.5" style={{ color: "var(--text)" }}>
                      {data.cities[c]?.air_category || "N/A"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="text-center" style={{ color: "var(--muted)" }}>Failed to load comparison data.</p>
        )}
      </div>
    </main>
  );
}
