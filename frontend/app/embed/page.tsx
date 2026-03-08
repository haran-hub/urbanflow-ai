"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getOverview, getPulseScore } from "@/lib/api";
import type { DashboardOverview, PulseScore } from "@/lib/types";

const TYPE_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  parking:  { icon: "🅿",  label: "Parking",       color: "#3b82f6" },
  ev:       { icon: "⚡",  label: "EV Charging",   color: "#f59e0b" },
  transit:  { icon: "🚇",  label: "Transit",       color: "#22c55e" },
  services: { icon: "🏛",  label: "Services",      color: "#a855f7" },
  pulse:    { icon: "◎",   label: "City Pulse",    color: "#3b82f6" },
};

function EmbedContent() {
  const params = useSearchParams();
  const city = params.get("city") || "San Francisco";
  const type = params.get("type") || "parking";
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [pulse, setPulse] = useState<PulseScore | null>(null);

  useEffect(() => {
    getOverview(city).then(setOverview).catch(() => {});
    getPulseScore(city).then(setPulse).catch(() => {});
    const t = setInterval(() => {
      getOverview(city).then(setOverview).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [city]);

  const meta = TYPE_LABELS[type] ?? TYPE_LABELS.parking;
  const o = overview;

  function getMetric() {
    if (!o) return { primary: "—", secondary: "Loading…", status: "neutral" as const };
    if (type === "parking") {
      const pct = o.parking.occupancy_pct;
      return {
        primary: `${o.parking.available_spots.toLocaleString()} spots`,
        secondary: `${pct.toFixed(0)}% full · ${o.parking.zones_count} zones`,
        status: (pct < 50 ? "good" : pct < 80 ? "warn" : "bad") as "good" | "warn" | "bad",
      };
    }
    if (type === "ev") {
      return {
        primary: `${o.ev_charging.available_ports} ports`,
        secondary: `${o.ev_charging.avg_wait_minutes}min wait · ${o.ev_charging.stations_count} stations`,
        status: (o.ev_charging.available_ports > 0 ? "good" : "bad") as "good" | "bad",
      };
    }
    if (type === "transit") {
      return {
        primary: `${o.transit.avg_crowd_level}% crowd`,
        secondary: `${o.transit.crowd_label} · ${o.transit.delayed_routes} routes delayed`,
        status: (o.transit.avg_crowd_level < 60 ? "good" : "warn") as "good" | "warn",
      };
    }
    if (type === "services") {
      return {
        primary: `${o.services.open_now}/${o.services.total} open`,
        secondary: `Avg wait: ${o.services.avg_wait_minutes}min`,
        status: "neutral" as const,
      };
    }
    if (type === "pulse" && pulse) {
      return {
        primary: `${pulse.pulse_score}/100`,
        secondary: pulse.label,
        status: (pulse.pulse_score >= 70 ? "good" : pulse.pulse_score >= 40 ? "warn" : "bad") as "good" | "warn" | "bad",
      };
    }
    return { primary: "—", secondary: "—", status: "neutral" as const };
  }

  const { primary, secondary, status } = getMetric();
  const statusColor = status === "good" ? "#22c55e" : status === "warn" ? "#f59e0b" : status === "bad" ? "#ef4444" : "rgba(255,255,255,0.5)";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: "20px 24px",
        width: "100%",
        maxWidth: 320,
        color: "#fff",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>{meta.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{meta.label}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{city}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Live</span>
          </div>
        </div>

        {/* Metric */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: statusColor, lineHeight: 1 }}>{primary}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{secondary}</div>
        </div>

        {/* Branding */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 8, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Powered by</span>
          <a href="https://urbanflow-ai.com" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", textDecoration: "none" }}>
            UrbanFlow AI
          </a>
        </div>
      </div>
    </div>
  );
}

export default function EmbedPage() {
  return <Suspense><EmbedContent /></Suspense>;
}
