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

// ── Find My Scene ───────────────────────────────────────────────────────────

type Answers = { vibe: string; transport: string; setting: string };

const QUESTIONS = [
  {
    key: "vibe",
    label: "What's your vibe tonight?",
    options: [
      { value: "lively", label: "🎉 Lively", desc: "Energy, crowd, music" },
      { value: "chill",  label: "☕ Chill",   desc: "Relaxed, quiet, cozy" },
      { value: "artsy",  label: "🎨 Artsy",   desc: "Culture, street art, cafes" },
      { value: "night",  label: "🌙 Night out", desc: "Bars, late-night, social" },
    ],
  },
  {
    key: "transport",
    label: "How are you getting there?",
    options: [
      { value: "walking",  label: "🚶 Walking",   desc: "On foot, close by" },
      { value: "transit",  label: "🚇 Transit",   desc: "Bus or subway" },
      { value: "driving",  label: "🚗 Driving",   desc: "Need parking nearby" },
      { value: "rideshare",label: "🚕 Rideshare", desc: "Uber / Lyft" },
    ],
  },
  {
    key: "setting",
    label: "Indoor or outdoor?",
    options: [
      { value: "outdoor", label: "🌳 Outdoors", desc: "Parks, plazas, streets" },
      { value: "indoor",  label: "🏠 Indoors",  desc: "Venues, restaurants" },
      { value: "mixed",   label: "⬡ Mixed",    desc: "Both work for me" },
      { value: "any",     label: "🤷 Don't care", desc: "Show me the best" },
    ],
  },
];

const gradeNum = (g: string) => ({ A: 4, B: 3, C: 2, D: 1, F: 0 }[g] ?? 2);

function scoreHood(hood: NeighborhoodGrade, ans: Answers): number {
  let s = 0;
  // Vibe weight
  if (ans.vibe === "lively" || ans.vibe === "night") s += hood.metrics.vibe_score * 0.4;
  else if (ans.vibe === "chill") s += (100 - hood.metrics.vibe_score) * 0.35;
  else s += 50 * 0.2; // artsy → neutral

  // Transport weight
  if (ans.transport === "driving") s += gradeNum(hood.grades.parking) * 8;
  else if (ans.transport === "transit" || ans.transport === "walking") s += gradeNum(hood.grades.transit) * 8;
  else s += 16; // rideshare → neutral

  // Setting weight
  if (ans.setting === "outdoor") s += gradeNum(hood.grades.air) * 5;
  else if (ans.setting === "indoor") s += gradeNum(hood.grades.vibe) * 3;
  else s += 10;

  // Overall grade bonus
  s += gradeNum(hood.overall) * 4;
  return s;
}

function buildReason(hood: NeighborhoodGrade, ans: Answers): string {
  const parts: string[] = [];
  if (ans.vibe === "lively" || ans.vibe === "night")
    parts.push(`vibe score ${hood.metrics.vibe_score}/100`);
  if (ans.vibe === "chill")
    parts.push(`relaxed energy (${hood.metrics.vibe_score}/100 vibe)`);
  if (ans.transport === "driving")
    parts.push(`${hood.grades.parking}-grade parking`);
  if (ans.transport === "transit")
    parts.push(`${hood.grades.transit}-grade transit access`);
  if (ans.setting === "outdoor")
    parts.push(`clean air (AQI ${hood.metrics.aqi})`);
  parts.push(`overall ${hood.overall} neighborhood rating`);
  return parts.join(" · ");
}

function FindMyScene({ hoods }: { hoods: NeighborhoodGrade[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [result, setResult] = useState<NeighborhoodGrade | null>(null);

  function pick(val: string) {
    const q = QUESTIONS[step];
    const next = { ...answers, [q.key]: val } as Answers;
    setAnswers(next);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      // Score and pick best
      const scored = hoods
        .map(h => ({ hood: h, score: scoreHood(h, next) }))
        .sort((a, b) => b.score - a.score);
      setResult(scored[0]?.hood ?? null);
    }
  }

  function reset() {
    setStep(0);
    setAnswers({});
    setResult(null);
  }

  return (
    <div className="card p-5 mb-6" style={{ borderColor: "rgba(139,92,246,0.3)", background: "rgba(139,92,246,0.05)" }}>
      <button
        className="w-full flex items-center justify-between"
        onClick={() => { setOpen(v => !v); reset(); }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🔮</span>
          <span className="text-sm font-semibold" style={{ color: "#a78bfa" }}>Find My Scene</span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>— AI neighborhood match</span>
        </div>
        <span className="text-xs" style={{ color: "var(--muted)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && !result && (
        <div className="mt-4 animate-fade-in">
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            Question {step + 1} of {QUESTIONS.length}
          </p>
          <p className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
            {QUESTIONS[step].label}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {QUESTIONS[step].options.map(opt => (
              <button
                key={opt.value}
                onClick={() => pick(opt.value)}
                className="text-left px-3 py-2.5 rounded-xl transition-all"
                style={{
                  background: "var(--card2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
              >
                <span className="text-sm block">{opt.label}</span>
                <span className="text-[10px]" style={{ color: "var(--muted)" }}>{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && result && (
        <div className="mt-4 animate-fade-in">
          <div className="flex items-start gap-3 p-4 rounded-xl"
            style={{ background: GRADE_BG[result.overall] ?? "var(--card2)", border: `1px solid ${GRADE_COLORS[result.overall]}40` }}>
            <span className="text-2xl font-black shrink-0" style={{ color: GRADE_COLORS[result.overall] }}>
              {result.overall}
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                👑 {result.name} is your best match
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                {buildReason(result, answers as Answers)}
              </p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {Object.entries(result.grades).map(([domain, grade]) => (
                  <span key={domain} className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: GRADE_BG[grade], color: GRADE_COLORS[grade] }}>
                    {DOMAIN_ICONS[domain]} {grade}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={reset} className="mt-3 text-xs" style={{ color: "#a78bfa" }}>
            ↩ Try again
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

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

        {!loading && hoods.length > 0 && <FindMyScene hoods={hoods} />}

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
                    <span className="text-2xl font-black" style={{ color: hood.overall_color }}>
                      {hood.overall}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ background: GRADE_BG[hood.overall], color: hood.overall_color }}>
                      Overall
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(hood.grades).map(([domain, grade]) => (
                    <div key={domain} className="text-center">
                      <div className="text-base mb-1">{DOMAIN_ICONS[domain] ?? "⬡"}</div>
                      <GradeBadge grade={grade} />
                      <p className="text-[10px] mt-1 capitalize" style={{ color: "var(--muted)" }}>{domain}</p>
                    </div>
                  ))}
                </div>

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
