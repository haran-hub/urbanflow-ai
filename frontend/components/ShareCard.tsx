"use client";
import { useRef, useState } from "react";
import type { DashboardOverview, PulseScore } from "@/lib/types";

interface Props {
  city: string;
  overview: DashboardOverview | null;
  pulse: PulseScore | null;
}

const CITY_FLAGS: Record<string, string> = {
  "San Francisco": "🌉",
  "New York": "🗽",
  "Austin": "🎸",
};

export default function ShareCard({ city, overview, pulse }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const o = overview;
  const flag = CITY_FLAGS[city] ?? "🏙";
  const pulseColor = pulse
    ? pulse.pulse_score >= 70 ? "#22c55e" : pulse.pulse_score >= 45 ? "#f59e0b" : "#ef4444"
    : "#3b82f6";

  async function handleShare() {
    setSharing(true);
    try {
      const text =
        `📍 ${city} Right Now (via UrbanFlow AI)\n` +
        (o ? `🅿 Parking: ${o.parking.occupancy_pct}% full\n` : "") +
        (o ? `⚡ EV wait: ${o.ev_charging.avg_wait_minutes} min\n` : "") +
        (o ? `🚇 Transit: ${o.transit.crowd_label}\n` : "") +
        (o?.air_quality ? `🌬 Air: ${o.air_quality.category} (AQI ${o.air_quality.avg_aqi})\n` : "") +
        (pulse ? `◎ City Pulse: ${pulse.pulse_score}/100\n` : "") +
        `\nExplore live: ${window.location.origin}/dashboard?city=${encodeURIComponent(city)}`;

      if (navigator.share) {
        await navigator.share({ title: `${city} City Snapshot`, text, url: `${window.location.origin}/dashboard?city=${encodeURIComponent(city)}` });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // user cancelled
    } finally {
      setSharing(false);
    }
  }

  if (!o) return null;

  return (
    <div>
      {/* Preview card */}
      <div
        ref={cardRef}
        className="card p-5 mb-3"
        style={{
          background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))",
          borderColor: "rgba(139,92,246,0.2)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">{flag}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>{city}</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Live
              </p>
            </div>
          </div>
          {pulse && (
            <div className="text-right">
              <p className="text-xl font-black" style={{ color: pulseColor }}>{pulse.pulse_score}</p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>Pulse Score</p>
            </div>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: "🅿", label: "Parking", value: `${o.parking.occupancy_pct}%`, sub: "full", bad: o.parking.occupancy_pct > 80 },
            { icon: "⚡", label: "EV Wait",  value: `${o.ev_charging.avg_wait_minutes}m`, sub: `${o.ev_charging.available_ports} free`, bad: o.ev_charging.avg_wait_minutes > 20 },
            { icon: "🚇", label: "Transit",  value: `${o.transit.avg_crowd_level}%`, sub: o.transit.crowd_label, bad: o.transit.avg_crowd_level > 75 },
            { icon: "🌬", label: "Air AQI",  value: o.air_quality ? String(o.air_quality.avg_aqi) : "–", sub: o.air_quality?.category ?? "–", bad: (o.air_quality?.avg_aqi ?? 0) > 100 },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-base">{m.icon}</span>
              <div>
                <p className="text-xs font-bold" style={{ color: m.bad ? "#ef4444" : "#22c55e" }}>{m.value}</p>
                <p className="text-[10px]" style={{ color: "var(--muted)" }}>{m.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Branding */}
        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-[10px] font-bold" style={{ color: "var(--muted)" }}>UrbanFlow AI</span>
          <span className="text-[10px]" style={{ color: "var(--muted)" }}>urbanflow-ai.vercel.app</span>
        </div>
      </div>

      {/* Share button */}
      <button
        onClick={handleShare}
        disabled={sharing}
        className="w-full text-sm py-2.5 rounded-xl font-semibold transition-all"
        style={{
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          color: "#fff",
          border: "none",
        }}
      >
        {sharing ? "Sharing…" : copied ? "✓ Copied to clipboard!" : "📤 Share City Snapshot"}
      </button>
    </div>
  );
}
