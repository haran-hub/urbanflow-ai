"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getOverview, getPulseScore } from "@/lib/api";
import { usePolling } from "@/hooks/usePolling";
import type { DashboardOverview, PulseScore } from "@/lib/types";

// Minimal embeddable widget — no sidebar, no header
// Usage: <iframe src="https://your-app.vercel.app/widget?city=Austin" .../>

function WidgetContent() {
  const params = useSearchParams();
  const city = params.get("city") ?? "San Francisco";
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [pulse, setPulse] = useState<PulseScore | null>(null);

  function load() {
    getOverview(city).then(setOverview).catch(() => {});
    getPulseScore(city).then(setPulse).catch(() => {});
  }

  useEffect(() => { load(); }, [city]); // eslint-disable-line
  usePolling(load, 30_000);

  const o = overview;

  return (
    <div
      style={{
        background: "#0a0a0f",
        minHeight: "100vh",
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: 16,
        color: "#e2e8f0",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 7,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 800, color: "#fff",
          }}>U</div>
          <span style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>
            {city} <span style={{ color: "#3b82f6" }}>· Live</span>
          </span>
        </div>
        {pulse && (
          <div style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))",
            border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: 8, padding: "3px 10px",
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#a78bfa" }}>
              ◎ {pulse.pulse_score} Pulse
            </span>
          </div>
        )}
      </div>

      {/* Metrics grid */}
      {o ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { icon: "🅿", label: "Parking", value: `${o.parking.occupancy_pct}%`, sub: "full", color: o.parking.occupancy_pct > 80 ? "#ef4444" : o.parking.occupancy_pct > 55 ? "#f59e0b" : "#22c55e" },
            { icon: "⚡", label: "EV Wait", value: `${o.ev_charging.avg_wait_minutes}m`, sub: `${o.ev_charging.available_ports} ports free`, color: o.ev_charging.avg_wait_minutes > 20 ? "#ef4444" : o.ev_charging.avg_wait_minutes > 10 ? "#f59e0b" : "#22c55e" },
            { icon: "🚇", label: "Transit", value: `${o.transit.avg_crowd_level}%`, sub: o.transit.crowd_label, color: o.transit.avg_crowd_level > 80 ? "#ef4444" : o.transit.avg_crowd_level > 55 ? "#f59e0b" : "#22c55e" },
            { icon: "🌬", label: "Air AQI", value: o.air_quality ? String(o.air_quality.avg_aqi) : "–", sub: o.air_quality?.category ?? "–", color: (o.air_quality?.avg_aqi ?? 50) > 100 ? "#ef4444" : (o.air_quality?.avg_aqi ?? 50) > 50 ? "#f59e0b" : "#22c55e" },
          ].map((m) => (
            <div key={m.label} style={{
              background: "#0f1117",
              border: "1px solid #1a1d2e",
              borderRadius: 10,
              padding: "10px 12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{m.icon}</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{
              background: "#0f1117", border: "1px solid #1a1d2e",
              borderRadius: 10, padding: "10px 12px", height: 68,
              animation: "pulse 2s infinite",
            }} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          <span style={{ fontSize: 10, color: "#64748b" }}>Live · updates every 30s</span>
        </div>
        <a
          href="https://urbanflow-ai.vercel.app"
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 10, color: "#3b82f6", textDecoration: "none", fontWeight: 600 }}
        >
          UrbanFlow AI →
        </a>
      </div>
    </div>
  );
}

export default function WidgetPage() {
  return <Suspense><WidgetContent /></Suspense>;
}
