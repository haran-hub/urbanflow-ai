"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { getDelta } from "@/lib/api";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { usePolling } from "@/hooks/usePolling";
import type { DeltaResponse, DeltaMetric } from "@/lib/types";

function DirectionArrow({ dir, sentiment }: { dir: string; sentiment: string }) {
  const color = sentiment === "good" ? "#22c55e" : sentiment === "bad" ? "#ef4444" : "#64748b";
  const symbol = dir === "up" ? "↑" : dir === "down" ? "↓" : "→";
  return <span style={{ color, fontWeight: 800, fontSize: 16 }}>{symbol}</span>;
}

function MetricCard({ m }: { m: DeltaMetric }) {
  const sentimentBg = m.sentiment === "good"
    ? "rgba(34,197,94,0.06)"
    : m.sentiment === "bad"
    ? "rgba(239,68,68,0.06)"
    : "var(--card2)";
  const sentimentBorder = m.sentiment === "good"
    ? "rgba(34,197,94,0.2)"
    : m.sentiment === "bad"
    ? "rgba(239,68,68,0.2)"
    : "var(--border)";

  return (
    <div className="card px-4 py-4 flex items-center gap-4" style={{ background: sentimentBg, borderColor: sentimentBorder }}>
      <span className="text-2xl">{m.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>{m.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {m.previous}{m.unit} → {m.current}{m.unit}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center justify-end gap-1">
          <DirectionArrow dir={m.direction} sentiment={m.sentiment} />
          <span
            className="text-sm font-bold"
            style={{
              color: m.sentiment === "good" ? "#22c55e" : m.sentiment === "bad" ? "#ef4444" : "#64748b",
            }}
          >
            {m.change_pct > 0 ? "+" : ""}{m.change_pct}%
          </span>
        </div>
        <p className="text-[10px] capitalize mt-0.5" style={{ color: "var(--muted)" }}>{m.sentiment}</p>
      </div>
    </div>
  );
}

function DeltaContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [data, setData] = useState<DeltaResponse | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    getDelta(city).then(setData).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [city]); // eslint-disable-line
  usePolling(load, 60_000);

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            📊 <span style={{ color: "var(--accent)" }}>What Changed</span> Today
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            How {city} metrics have shifted since earlier today
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card px-4 py-4 animate-pulse flex items-center gap-4">
                <div className="w-8 h-8 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
                <div className="flex-1">
                  <div className="h-3 w-32 rounded mb-2" style={{ background: "rgba(255,255,255,0.07)" }} />
                  <div className="h-2 w-48 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.has_data ? (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">📸</div>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text)" }}>Baseline captured!</h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {data?.message ?? "Come back in a few minutes to see what's changed."}
            </p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="card px-5 py-4 mb-5 flex items-center justify-between gap-4 flex-wrap"
              style={{ background: "var(--card2)" }}>
              <p className="text-sm" style={{ color: "var(--text)" }}>{data.summary}</p>
              <div className="flex gap-3 shrink-0">
                <span className="text-xs font-semibold" style={{ color: "#22c55e" }}>
                  ↑ {data.improved} improved
                </span>
                <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                  ↓ {data.worsened} worsened
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {data.metrics.map((m) => <MetricCard key={m.key} m={m} />)}
            </div>

            <p className="text-xs text-center mt-5" style={{ color: "var(--muted)" }}>
              Compared to baseline captured at session start · Updates every minute
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function DeltaPage() {
  return <Suspense><DeltaContent /></Suspense>;
}
