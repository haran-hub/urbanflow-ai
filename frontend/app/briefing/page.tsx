"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { getBriefing } from "@/lib/api";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { usePolling } from "@/hooks/usePolling";
import type { BriefingResponse } from "@/lib/types";
import { formatCityTime } from "@/lib/city-time";

function BriefingContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    getBriefing(city)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [city]); // eslint-disable-line react-hooks/exhaustive-deps
  usePolling(load, 5 * 60_000); // briefing is AI-generated, refresh every 5 min

  return (
    <main className="min-h-screen pt-14 md:pt-[82px] md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              ☀ <span style={{ color: "var(--accent)" }}>Daily</span> City Briefing
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              AI-generated live summary for {city}
            </p>
          </div>
          <button onClick={load} disabled={loading} className="btn-ghost text-xs px-3 py-1.5">
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4">
            <div className="card p-6 flex flex-col gap-3">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 rounded" style={{ width: "83%" }} />
              <div className="skeleton h-4 rounded" style={{ width: "66%" }} />
            </div>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-5">
            {/* Main briefing card */}
            <div className="card p-6" style={{ borderColor: "rgba(59,130,246,0.25)", background: "linear-gradient(135deg, rgba(59,130,246,0.05), var(--card))" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                    {formatCityTime(data.timestamp, city)} · Live
                  </span>
                </div>
                {data.ai_generated && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                    ✦ AI
                  </span>
                )}
              </div>
              <p className="text-base leading-relaxed" style={{ color: "var(--text)", fontStyle: "italic", lineHeight: 1.8 }}>
                "{data.briefing}"
              </p>
            </div>

            {/* Highlights */}
            {data.highlights.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold mb-3" style={{ color: "var(--muted)" }}>KEY HIGHLIGHTS</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.highlights.map((h, i) => (
                    <div key={i} className="card px-4 py-3 flex items-center gap-3" style={{ background: "var(--card2)" }}>
                      <span className="text-base shrink-0">
                        {["🅿", "🌬", "🚇", "🚚", "⚡", "🚲", "🎵", "🏛"][i % 8]}
                      </span>
                      <span className="text-sm leading-snug" style={{ color: "var(--text)" }}>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
              Briefing refreshes every 5 minutes · Data updates on every page visit
            </p>
          </div>
        ) : (
          <div className="card p-8 text-center" style={{ color: "var(--muted)" }}>
            Could not load briefing. Try refreshing.
          </div>
        )}
      </div>
    </main>
  );
}

export default function BriefingPage() {
  return <Suspense><BriefingContent /></Suspense>;
}
