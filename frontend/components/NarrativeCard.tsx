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

function detectIcon(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("aqi") || t.includes("pm2.5") || t.includes("monitor") || t.includes("pollen") || t.includes("uv")) return "🌬";
  if (t.includes("metro") || t.includes("subway") || t.includes("bus") || t.includes("train") || t.includes("transit") || t.includes("line") || t.includes("delay")) return "🚇";
  if (t.includes("vibe") || t.includes("noise") || t.includes("lively") || t.includes("quiet") || t.includes("crowd") || t.includes("buzz") || t.includes("db")) return "🎵";
  if (t.includes("ev") || t.includes("charg")) return "⚡";
  if (t.includes("park")) return "🅿";
  if (t.includes("bike") || t.includes("scooter")) return "🚲";
  return "🏙";
}

function parseBullets(text: string): Array<{ icon: string; line: string }> {
  // Strip wrapping quotes
  const clean = text.replace(/^[""\u201C\u201D]|[""\u201C\u201D]$/g, "").trim();
  // Try splitting on bullet separator first
  const byBullet = clean.split(/\s*•\s*/).filter(s => s.trim().length > 8);
  const parts = byBullet.length >= 2
    ? byBullet
    : clean.split(/\.\s+(?=[A-Z])/).filter(s => s.trim().length > 8);
  return parts.slice(0, 5).map(part => ({
    icon: detectIcon(part),
    line: part.replace(/\.$/, "").trim(),
  }));
}

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
      <div className="card p-4 h-full animate-pulse flex flex-col gap-3" style={{ background: "var(--card)" }}>
        <div className="h-3 w-24 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-5 h-5 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
            <div className="h-3 rounded flex-1" style={{ background: "rgba(255,255,255,0.04)", width: `${70 + i * 5}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const moodColor = data.mood_color || "#3b82f6";
  const bullets = parseBullets(data.narrative);

  return (
    <div
      className="card p-4 h-full flex flex-col"
      style={{ borderColor: `${moodColor}30`, background: `linear-gradient(135deg, ${moodColor}06, var(--card))` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
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

      {/* Bullet points */}
      <ul className="flex flex-col gap-2.5 flex-1">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="text-sm shrink-0 mt-0.5">{b.icon}</span>
            <span className="text-xs leading-relaxed" style={{ color: "var(--text)", opacity: 0.88 }}>
              {b.line}
            </span>
          </li>
        ))}
      </ul>

      {/* Mood footer */}
      <div className="mt-3 pt-3 flex items-center gap-1.5" style={{ borderTop: `1px solid ${moodColor}20` }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: moodColor }} />
        <span className="text-[10px] font-medium" style={{ color: moodColor }}>{data.mood} conditions</span>
        <span className="text-[10px] ml-auto" style={{ color: "var(--muted)" }}>Live snapshot</span>
      </div>
    </div>
  );
}
