"use client";
import { useEffect, useState } from "react";
import { getDelta } from "@/lib/api";

interface Anomaly {
  icon: string;
  label: string;
  change_pct: number;
  direction: "up" | "down";
  current: number;
  unit: string;
  sentiment: "bad";
}

interface Props { city: string }

export default function AnomalyAlert({ city }: Props) {
  const [anomaly, setAnomaly] = useState<Anomaly | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    getDelta(city).then((d) => {
      if (!d.has_data || !d.metrics?.length) return;
      const worst = d.metrics
        .filter((m: { sentiment: string; change_pct: number }) =>
          m.sentiment === "bad" && Math.abs(m.change_pct) >= 15
        )
        .sort((a: { change_pct: number }, b: { change_pct: number }) =>
          Math.abs(b.change_pct) - Math.abs(a.change_pct)
        )[0];
      if (worst) setAnomaly(worst as Anomaly);
    }).catch(() => {});
  }, [city]);

  if (!anomaly || dismissed) return null;

  const arrow = anomaly.direction === "up" ? "↑" : "↓";
  const pct   = Math.abs(anomaly.change_pct);

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl mb-4 animate-fade-in"
      style={{
        background: "rgba(239,68,68,0.07)",
        border: "1px solid rgba(239,68,68,0.25)",
      }}
    >
      <span className="text-base mt-0.5 shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: "#f87171" }}>
          Unusual activity detected
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text)", opacity: 0.85 }}>
          {anomaly.icon} {anomaly.label} is{" "}
          <span style={{ color: "#f87171" }}>
            {arrow}{pct}% {anomaly.direction === "up" ? "higher" : "lower"} than earlier today
          </span>
          {" "}— now at {anomaly.current}{anomaly.unit}. This could indicate a nearby event or incident.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs shrink-0"
        style={{ color: "var(--muted)" }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
