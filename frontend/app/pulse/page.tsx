"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { getPulseScore } from "@/lib/api";
import type { PulseScore } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { usePolling } from "@/hooks/usePolling";
import { formatCityTime } from "@/lib/city-time";

const DOMAIN_ICONS: Record<string, string> = {
  parking: "🅿",
  ev: "⚡",
  transit: "🚇",
  services: "🏛",
  air: "🌬",
  bikes: "🚲",
  food_trucks: "🚚",
  vibe: "🎵",
};

const DOMAIN_LABELS: Record<string, string> = {
  parking: "Parking",
  ev: "EV Charging",
  transit: "Transit",
  services: "Services",
  air: "Air Quality",
  bikes: "Bike Share",
  food_trucks: "Food Trucks",
  vibe: "Noise & Vibe",
};

function PulseRing({ score, color, label }: { score: number; color: string; label: string }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      <svg width="220" height="220" viewBox="0 0 220 220" className="absolute">
        {/* Background ring */}
        <circle
          cx="110" cy="110" r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16"
        />
        {/* Score ring */}
        <circle
          cx="110" cy="110" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          strokeDashoffset={0}
          transform="rotate(-90 110 110)"
          style={{
            filter: `drop-shadow(0 0 8px ${color})`,
            transition: "stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </svg>
      <div className="text-center z-10">
        <p className="text-5xl font-bold" style={{ color }}>{score}</p>
        <p className="text-sm font-semibold mt-1" style={{ color }}>{label}</p>
        <p className="text-xs" style={{ color: "var(--muted)" }}>/ 100</p>
      </div>
    </div>
  );
}

function PulseContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [pulse, setPulse] = useState<PulseScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPulseScore(city)
      .then((d) => { if (!cancelled) setPulse(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [city]);

  const cityRef = useRef(city);
  cityRef.current = city;
  usePolling(() => {
    getPulseScore(cityRef.current).then(setPulse).catch(() => {});
  });

  const DOMAIN_ORDER = ["parking", "ev", "transit", "services", "air", "bikes", "food_trucks", "vibe"];

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            ◎ <span style={{ color: "var(--accent)" }}>City Pulse</span> Score
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Composite livability index across all 8 urban domains — updated every 2 minutes
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-8">
            <div className="w-[220px] h-[220px] rounded-full animate-pulse" style={{ background: "var(--card2)" }} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="card p-4 h-24 animate-pulse" style={{ background: "var(--card2)" }} />
              ))}
            </div>
          </div>
        ) : pulse ? (
          <>
            {/* Big ring */}
            <div className="flex flex-col items-center gap-2 mb-10">
              <PulseRing score={pulse.pulse_score} color={pulse.color} label={pulse.label} />
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {city} · {formatCityTime(pulse.timestamp, city)}
              </p>
            </div>

            {/* Domain breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DOMAIN_ORDER.map((domain) => {
                const d = pulse.breakdown[domain];
                if (!d) return null;
                const score = d.score as number;
                const weight = Math.round((pulse.weights[domain] || 0) * 100);
                const barColor = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={domain} className="card p-4 flex flex-col gap-2 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{DOMAIN_ICONS[domain]}</span>
                        <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{DOMAIN_LABELS[domain]}</span>
                      </div>
                      <span className="text-xs" style={{ color: "var(--muted)" }}>{weight}%</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-2xl font-bold" style={{ color: barColor }}>{score}</span>
                      <span className="text-xs mb-0.5" style={{ color: "var(--muted)" }}>/ 100</span>
                    </div>
                    <div className="w-full rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${score}%`, background: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info note */}
            <p className="text-xs text-center mt-8" style={{ color: "var(--muted)" }}>
              Pulse Score weights: Air Quality 20% · Parking 15% · EV 15% · Transit 15% · Bikes 10% · Vibe 10% · Services 10% · Food 5%
            </p>
          </>
        ) : (
          <p className="text-center" style={{ color: "var(--muted)" }}>Failed to load pulse score.</p>
        )}
      </div>
    </main>
  );
}

export default function PulsePage() {
  return <Suspense><PulseContent /></Suspense>;
}
