"use client";
import { useEffect, useState } from "react";
import { getDelta } from "@/lib/api";

interface TickerItem {
  icon: string;
  text: string;
  sentiment: "good" | "bad" | "neutral";
}

const SENTINEL_COLOR = { good: "#22c55e", bad: "#ef4444", neutral: "#64748b" };

interface Props { city: string }

export default function LiveTicker({ city }: Props) {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    getDelta(city).then((d) => {
      if (!d.has_data || !d.metrics?.length) return;
      const built: TickerItem[] = d.metrics.map((m: {
        icon: string; label: string; current: number; unit: string;
        change_pct: number; direction: string; sentiment: string;
      }) => {
        const arrow = m.direction === "up" ? "↑" : m.direction === "down" ? "↓" : "→";
        const changeStr = m.change_pct !== 0 ? ` ${arrow}${Math.abs(m.change_pct)}%` : "";
        return {
          icon: m.icon,
          text: `${m.label}: ${m.current}${m.unit}${changeStr}`,
          sentiment: m.sentiment as "good" | "bad" | "neutral",
        };
      });
      setItems(built);
    }).catch(() => {});
  }, [city]);

  if (!items.length) return null;

  // Duplicate items for seamless loop
  const repeated = [...items, ...items, ...items];

  return (
    <div
      className="overflow-hidden relative"
      style={{
        background: "var(--card2)",
        borderBottom: "1px solid var(--border)",
        height: 34,
      }}
    >
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, var(--card2), transparent)" }} />
      <div className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left, var(--card2), transparent)" }} />

      <div
        className="flex items-center h-full gap-0"
        style={{
          animation: "ticker-scroll 40s linear infinite",
          whiteSpace: "nowrap",
          width: "max-content",
        }}
      >
        {repeated.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 px-5 text-xs font-medium">
            <span>{item.icon}</span>
            <span style={{ color: SENTINEL_COLOR[item.sentiment] }}>{item.text}</span>
            <span className="opacity-20 mx-2" style={{ color: "var(--muted)" }}>·</span>
          </span>
        ))}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
