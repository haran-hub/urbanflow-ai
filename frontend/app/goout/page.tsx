"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { getGoOut } from "@/lib/api";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { usePolling } from "@/hooks/usePolling";
import type { GoOutResponse } from "@/lib/types";
import { formatCityTime } from "@/lib/city-time";

const VERDICT_CONFIG = {
  yes:   { emoji: "✅", label: "Go for it!",  color: "#22c55e", bg: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.25)" },
  no:    { emoji: "❌", label: "Stay in.",     color: "#ef4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)" },
  maybe: { emoji: "🤔", label: "Maybe...",    color: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)" },
};

const DOMAIN_ICONS: Record<string, string> = {
  parking: "🅿", transit: "🚇", air: "🌬", vibe: "🎵",
};

function ScoreArc({ score }: { score: number }) {
  const r = 52, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (circ * score) / 100;
  const color = score >= 70 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={128} height={128} className="mx-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={10} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={circ} strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize={22} fontWeight={800}>{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--muted)" fontSize={10}>/100</text>
    </svg>
  );
}

function GoOutContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [data, setData] = useState<GoOutResponse | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    getGoOut(city).then(setData).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [city]); // eslint-disable-line
  usePolling(load, 10 * 60_000);

  const cfg = data ? VERDICT_CONFIG[data.verdict] : null;

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            🤔 <span style={{ color: "var(--accent)" }}>Should I</span> Go Out Tonight?
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            AI reads live city conditions and gives you a straight answer
          </p>
        </div>

        {loading ? (
          <div className="card p-8 skeleton text-center" style={{ background: "var(--card2)" }}>
            <div className="w-28 h-28 rounded-full mx-auto mb-4" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div className="h-5 w-40 rounded mx-auto mb-3" style={{ background: "rgba(255,255,255,0.07)" }} />
            <div className="h-3 w-64 rounded mx-auto" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        ) : data && cfg ? (
          <>
            {/* Verdict Card */}
            <div
              className="card p-8 mb-5 text-center"
              style={{ background: cfg.bg, borderColor: cfg.border, borderWidth: 1 }}
            >
              <ScoreArc score={data.score} />
              <div className="mt-4 mb-2 text-4xl">{cfg.emoji}</div>
              <h2 className="text-2xl font-black mb-2" style={{ color: cfg.color }}>{cfg.label}</h2>
              <p className="text-base leading-relaxed mb-4" style={{ color: "var(--text)", maxWidth: 420, margin: "0 auto 16px" }}>
                {data.reason}
              </p>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--text)" }}
              >
                <span>⏱</span> {data.best_time}
              </div>
              {data.ai_generated && (
                <div className="mt-3">
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                    ✦ AI Powered
                  </span>
                </div>
              )}
            </div>

            {/* Domain breakdown */}
            {Object.keys(data.domains).length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                {Object.entries(data.domains).map(([domain, note]) => (
                  <div key={domain} className="card px-4 py-3" style={{ background: "var(--card2)" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{DOMAIN_ICONS[domain] ?? "⬡"}</span>
                      <span className="text-xs font-semibold capitalize" style={{ color: "var(--text)" }}>{domain}</span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>{note}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Updated {formatCityTime(data.timestamp, city)}
              </p>
              <button onClick={load} disabled={loading} className="btn-ghost text-xs px-3 py-1.5">
                ↻ Refresh
              </button>
            </div>
          </>
        ) : (
          <div className="card p-8 text-center" style={{ color: "var(--muted)" }}>
            Could not load. Try refreshing.
          </div>
        )}
      </div>
    </main>
  );
}

export default function GoOutPage() {
  return <Suspense><GoOutContent /></Suspense>;
}
