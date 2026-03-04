"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import StatCard from "@/components/StatCard";
import Toast from "@/components/Toast";
import { getOverview } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { DashboardOverview } from "@/lib/types";

const RUSH_COLOR: Record<string, string> = {
  "Peak Rush Hour": "#ef4444",
  "Normal Hours": "#3b82f6",
  "Off-Peak": "#22c55e",
};

export default function DashboardPage() {
  const [city, setCity] = useState("San Francisco");
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const data = await getOverview(city);
      setOverview(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    setLoading(true);
    fetchOverview();
  }, [fetchOverview]);

  useWebSocket(city, () => {
    fetchOverview();
    setToast("Live update received");
  });

  const o = overview;

  return (
    <main className="min-h-screen pt-14" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} liveStatus="Live · updates every 2 min" />

      {/* Hero */}
      <section className="pt-12 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: o ? RUSH_COLOR[o.rush_status] || "#3b82f6" : "#64748b" }} />
                <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                  {o?.rush_status ?? "Loading..."}
                </span>
              </div>
              <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>
                {city} <span style={{ color: "var(--accent)" }}>Overview</span>
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
                AI-powered real-time city intelligence
              </p>
            </div>
            <Link href="/plan" className="btn-primary text-sm flex items-center gap-2 self-start sm:self-auto">
              ✦ Generate AI Plan
            </Link>
          </div>

          {/* Stats Grid */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card p-5 h-32 animate-pulse" style={{ background: "var(--card2)" }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon="🅿"
                label="Parking Available"
                value={o?.parking.available_spots.toLocaleString() ?? "—"}
                sub={`${o?.parking.zones_count} zones · ${o?.parking.occupancy_pct.toFixed(0)}% full`}
                accent="blue"
                trend={o && o.parking.occupancy_pct < 70 ? "good" : "bad"}
              />
              <StatCard
                icon="⚡"
                label="EV Ports Available"
                value={o?.ev_charging.available_ports ?? "—"}
                sub={`Avg wait: ${o?.ev_charging.avg_wait_minutes ?? 0} min · ${o?.ev_charging.stations_count} stations`}
                accent="yellow"
                trend={o && o.ev_charging.available_ports > 0 ? "good" : "bad"}
              />
              <StatCard
                icon="🚇"
                label="Transit Crowd"
                value={o ? `${o.transit.avg_crowd_level}%` : "—"}
                sub={`${o?.transit.crowd_label} · ${o?.transit.delayed_routes} routes delayed`}
                accent={o && o.transit.avg_crowd_level > 70 ? "red" : "green"}
                trend={o && o.transit.avg_crowd_level < 60 ? "good" : "bad"}
              />
              <StatCard
                icon="🏛"
                label="Services Open"
                value={`${o?.services.open_now ?? 0}/${o?.services.total ?? 0}`}
                sub={`Avg wait: ${o?.services.avg_wait_minutes ?? 0} min`}
                accent="purple"
                trend="neutral"
              />
            </div>
          )}
        </div>
      </section>

      {/* Quick Access */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--muted)" }}>EXPLORE</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { href: "/parking", icon: "🅿", label: "Parking", desc: "Find available spots, predict occupancy, get recommendations", color: "#3b82f6" },
              { href: "/ev", icon: "⚡", label: "EV Charging", desc: "Check station availability, wait times, best charging options", color: "#f59e0b" },
              { href: "/transit", icon: "🚇", label: "Transit", desc: "Live crowd levels, delays, optimal departure times", color: "#22c55e" },
              { href: "/services", icon: "🏛", label: "Local Services", desc: "DMV, hospitals, banks — predicted wait times", color: "#a855f7" },
            ].map((item) => (
              <Link
                key={item.href}
                href={`${item.href}?city=${encodeURIComponent(city)}`}
                className="card p-5 flex flex-col gap-3 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: `${item.color}15`, color: item.color }}>
                  {item.icon}
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{item.label}</p>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>{item.desc}</p>
                </div>
                <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: item.color }}>
                  Explore <span>→</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </main>
  );
}
