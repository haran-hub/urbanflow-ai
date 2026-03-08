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

const CITY_INTRO: Record<string, { tagline: string; tags: string[] }> = {
  "San Francisco": {
    tagline: "Tech capital on the bay — fog, hills, and relentless innovation meeting Pacific culture.",
    tags: ["Golden Gate", "Dense transit", "Mild year-round", "Tech hub", "Bay views"],
  },
  "New York": {
    tagline: "8 million stories, one city that never sleeps — the world's most electric urban pulse.",
    tags: ["Times Square", "24/7 subway", "World finance", "5 boroughs", "Global culture"],
  },
  "Austin": {
    tagline: "Live music capital of the world — where weird is a virtue and tech meets Texas soul.",
    tags: ["6th Street", "Live music", "Tech boom", "Year-round sun", "BBQ & tacos"],
  },
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
  const clean = text.replace(/^[""\u201C\u201D]|[""\u201C\u201D]$/g, "").trim();
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

  const intro = CITY_INTRO[city];

  if (loading) {
    return (
      <div className="card p-4 h-full flex flex-col gap-3">
        <div className="skeleton h-3 w-24 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 rounded" style={{ width: "80%" }} />
        <div className="flex gap-1.5 mt-1">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-5 w-16 rounded-full" />)}
        </div>
        <div className="skeleton h-px my-1 rounded" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="skeleton w-5 h-5 rounded" />
            <div className="skeleton h-3 rounded flex-1" />
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
      className="card p-4 h-full flex flex-col justify-between"
      style={{ borderColor: `${moodColor}30`, background: `linear-gradient(135deg, ${moodColor}06, var(--card))` }}
    >
      {/* Top: header + city intro */}
      <div>
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

        {/* City introduction */}
        {intro && (
          <div className="mb-3">
            <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--text)", opacity: 0.75 }}>
              {intro.tagline}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {intro.tags.map(tag => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: `${moodColor}14`, color: moodColor, border: `1px solid ${moodColor}28` }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="mb-3" style={{ height: 1, background: `${moodColor}20` }} />
      </div>

      {/* Middle: live bullet points */}
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

      {/* Footer */}
      <div className="mt-3 pt-3 flex items-center gap-1.5" style={{ borderTop: `1px solid ${moodColor}20` }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: moodColor }} />
        <span className="text-[10px] font-medium" style={{ color: moodColor }}>{data.mood} conditions</span>
        <span className="text-[10px] ml-auto" style={{ color: "var(--muted)" }}>Live snapshot</span>
      </div>
    </div>
  );
}
