"use client";
import { useEffect, useState } from "react";
import { getNarrative } from "@/lib/api";
import type { NarrativeResponse } from "@/lib/types";

const MOOD_ICONS: Record<string, string> = {
  Buzzing:  "🔥",
  Steady:   "🌊",
  Quiet:    "🌿",
  Stressed: "⚡",
};

interface Props { city: string }

export default function NarrativeCard({ city }: Props) {
  const [data, setData] = useState<NarrativeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getNarrative(city)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [city]);

  if (loading) {
    return (
      <div className="card p-4 animate-pulse" style={{ background: "var(--card)" }}>
        <div className="h-3 w-24 rounded mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="h-4 w-full rounded mb-2" style={{ background: "rgba(255,255,255,0.05)" }} />
        <div className="h-4 w-4/5 rounded" style={{ background: "rgba(255,255,255,0.04)" }} />
      </div>
    );
  }

  if (!data) return null;

  const moodColor = data.mood_color || "#3b82f6";

  return (
    <div
      className="card p-4 flex flex-col gap-3"
      style={{ borderColor: `${moodColor}30`, background: `linear-gradient(135deg, ${moodColor}06, var(--card))` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 16 }}>{MOOD_ICONS[data.mood] ?? "🏙"}</span>
          <span className="text-xs font-semibold" style={{ color: moodColor }}>
            City Right Now · {data.mood}
          </span>
        </div>
        {data.ai_generated && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
            ✦ AI
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed italic" style={{ color: "var(--text)", opacity: 0.9 }}>
        "{data.narrative}"
      </p>
    </div>
  );
}
