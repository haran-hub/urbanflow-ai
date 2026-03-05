"use client";
import { useEffect, useState } from "react";
import { getSurgeAlerts } from "@/lib/api";
import type { SurgeAlert } from "@/lib/types";

const DOMAIN_ICONS: Record<string, string> = {
  parking: "🅿",
  ev: "⚡",
  transit: "🚇",
  all: "✦",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#ef4444",
};

const SEVERITY_BG: Record<string, string> = {
  low: "rgba(34,197,94,0.08)",
  medium: "rgba(245,158,11,0.08)",
  high: "rgba(239,68,68,0.08)",
};

const SEVERITY_BORDER: Record<string, string> = {
  low: "rgba(34,197,94,0.2)",
  medium: "rgba(245,158,11,0.2)",
  high: "rgba(239,68,68,0.25)",
};

interface Props {
  city: string;
}

export default function SurgeWidget({ city }: Props) {
  const [alerts, setAlerts] = useState<SurgeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiGenerated, setAiGenerated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSurgeAlerts(city)
      .then((d) => {
        if (!cancelled) {
          setAlerts(d.alerts);
          setAiGenerated(d.ai_generated);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [city]);

  if (loading) {
    return (
      <div className="card p-4 animate-pulse" style={{ background: "var(--card2)" }}>
        <div className="h-4 w-32 rounded mb-3" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="h-16 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
      </div>
    );
  }

  const hasSurge = alerts.some((a) => a.severity === "high" || a.severity === "medium");

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: hasSurge ? "#ef4444" : "#22c55e",
              boxShadow: `0 0 6px ${hasSurge ? "#ef4444" : "#22c55e"}`,
              animation: hasSurge ? "pulse 1.5s infinite" : "none",
            }}
          />
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>Surge Predictor</span>
        </div>
        {aiGenerated && (
          <span className="tag" style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", fontSize: "10px" }}>
            ✦ AI
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className="p-3 rounded-xl"
            style={{
              background: SEVERITY_BG[alert.severity],
              border: `1px solid ${SEVERITY_BORDER[alert.severity]}`,
            }}
          >
            <div className="flex items-start gap-2">
              <span>{DOMAIN_ICONS[alert.domain] ?? "⚠"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: SEVERITY_COLORS[alert.severity] }}
                  >
                    {alert.severity}
                  </span>
                  {alert.severity !== "low" && (
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      · peaks in ~{alert.predicted_peak_in_mins} min
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: "var(--text)" }}>{alert.message}</p>
                {alert.severity !== "low" && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>💡 {alert.tip}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
