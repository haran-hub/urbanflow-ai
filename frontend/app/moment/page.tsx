"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { planMoment } from "@/lib/api";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import type { MomentResponse, TimeWindow } from "@/lib/types";

const SUGGESTIONS = [
  "Best time for an outdoor lunch",
  "When should I go for a run?",
  "Optimal window to charge my EV",
  "Least crowded time to visit DMV",
  "Best evening for outdoor dining",
  "When is transit least packed?",
];

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 70 ? "#22c55e" : score >= 45 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={`${fill} ${circ}`}
          transform="rotate(-90 28 28)" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{score}</span>
      </div>
    </div>
  );
}

function WindowCard({ window: w, variant }: { window: TimeWindow; variant: "best" | "alt" | "avoid" }) {
  const bg = variant === "best" ? "rgba(34,197,94,0.07)" : variant === "avoid" ? "rgba(239,68,68,0.07)" : "rgba(59,130,246,0.07)";
  const border = variant === "best" ? "rgba(34,197,94,0.25)" : variant === "avoid" ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)";
  const label = variant === "best" ? "Best window" : variant === "avoid" ? "Avoid" : "Alternative";
  const labelColor = variant === "best" ? "#22c55e" : variant === "avoid" ? "#ef4444" : "#3b82f6";

  return (
    <div className="card p-4 flex items-start gap-4" style={{ background: bg, borderColor: border }}>
      <ScoreRing score={w.score} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: labelColor }}>{label}</span>
          <span className="font-bold text-sm" style={{ color: "var(--text)" }}>{w.time_range}</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text)" }}>{w.reason}</p>
        {Object.entries(w.conditions || {}).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(w.conditions).map(([k, v]) => (
              <span key={k} className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--muted)" }}>
                {k}: {v}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MomentContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<MomentResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(q: string) {
    if (!q.trim() || loading) return;
    setQuery(q);
    setLoading(true);
    setResult(null);
    try {
      const res = await planMoment(city, q);
      setResult(res);
    } catch {
      // keep null
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen pt-14 md:pt-14 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            ⏱ <span style={{ color: "var(--accent)" }}>Micro-moment</span> Planner
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Tell me what you want to do in {city} — I'll find the optimal time window today
          </p>
        </div>

        {/* Search */}
        <div className="flex gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search(query)}
            placeholder="e.g. Best time for an outdoor lunch…"
            className="flex-1 text-sm px-4 py-3 rounded-xl"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
            disabled={loading}
          />
          <button onClick={() => search(query)} disabled={!query.trim() || loading} className="btn-primary px-5 rounded-xl text-sm">
            {loading ? "…" : "Find"}
          </button>
        </div>

        {/* Suggestions */}
        {!result && !loading && (
          <div className="flex flex-wrap gap-2 mb-8">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => search(s)}
                className="text-xs px-3 py-1.5 rounded-full transition-all"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col gap-3 mt-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-4 h-20 skeleton" />
            ))}
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                Results for: <em style={{ color: "var(--accent)" }}>{result.query}</em>
              </p>
              {result.ai_generated && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>✦ AI</span>
              )}
            </div>

            {result.summary && (
              <p className="text-sm italic" style={{ color: "var(--muted)" }}>{result.summary}</p>
            )}

            {result.best_window && <WindowCard window={result.best_window} variant="best" />}
            {result.alternative_windows?.map((w, i) => <WindowCard key={i} window={w} variant="alt" />)}
            {result.avoid_window && <WindowCard window={result.avoid_window} variant="avoid" />}

            <button onClick={() => { setResult(null); setQuery(""); }}
              className="btn-ghost text-xs self-start mt-2">
              ← New search
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function MomentPage() {
  return <Suspense><MomentContent /></Suspense>;
}
