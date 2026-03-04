"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import StatCard from "@/components/StatCard";
import Toast from "@/components/Toast";
import { getOverview } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import type { DashboardOverview } from "@/lib/types";

const RUSH_COLOR: Record<string, string> = {
  "Peak Rush Hour": "#ef4444",
  "Normal Hours": "#3b82f6",
  "Off-Peak": "#22c55e",
};

export default function DashboardPage() {
  const { city, setCity } = useDetectedCity();
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
                sub={o ? `${o.parking.zones_count} zones · ${o.parking.occupancy_pct.toFixed(0)}% full` : "—"}
                accent="blue"
                trend={o && o.parking.occupancy_pct < 70 ? "good" : "bad"}
              />
              <StatCard
                icon="⚡"
                label="EV Ports Available"
                value={o?.ev_charging.available_ports ?? "—"}
                sub={o ? `Avg wait: ${o.ev_charging.avg_wait_minutes} min · ${o.ev_charging.stations_count} stations` : "—"}
                accent="yellow"
                trend={o && o.ev_charging.available_ports > 0 ? "good" : "bad"}
              />
              <StatCard
                icon="🚇"
                label="Transit Crowd"
                value={o ? `${o.transit.avg_crowd_level}%` : "—"}
                sub={o ? `${o.transit.crowd_label} · ${o.transit.delayed_routes} routes delayed` : "—"}
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

            {/* ── Parking ── */}
            <Link href={`/parking?city=${encodeURIComponent(city)}`}
              className="card p-5 flex flex-col gap-3 group cursor-pointer explore-parking" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "#3b82f615", color: "#3b82f6" }}>🅿</div>
              {/* Parking spot mini-grid */}
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {(["#22c55e","#22c55e","#22c55e","#22c55e",
                   "#22c55e","#f59e0b","#f59e0b","#22c55e",
                   "#ef4444","#ef4444","#f59e0b","#22c55e"] as const).map((color, i) => (
                  <div key={i} className="p-spot rounded-sm"
                    style={{ height: 7, background: color, "--d": `${i * 0.045}s` } as React.CSSProperties} />
                ))}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Parking</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>Find available spots, predict occupancy, get recommendations</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#3b82f6" }}>
                Explore <span>→</span>
              </div>
            </Link>

            {/* ── EV Charging ── */}
            <Link href={`/ev?city=${encodeURIComponent(city)}`}
              className="card p-5 flex flex-col gap-3 group cursor-pointer explore-ev" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "#f59e0b15", color: "#f59e0b" }}>⚡</div>
              {/* Animated battery */}
              <div className="flex items-center gap-2">
                <div style={{ flex: 1, height: 14, border: "1.5px solid rgba(245,158,11,0.35)", borderRadius: 3, padding: 2, background: "rgba(245,158,11,0.04)" }}>
                  <div className="ev-charge-bar" style={{ height: "100%", width: "10%", background: "linear-gradient(90deg,#f59e0b,#fbbf24)", borderRadius: 2 }} />
                </div>
                <div style={{ width: 5, height: 8, background: "rgba(245,158,11,0.45)", borderRadius: "0 2px 2px 0", marginLeft: -1 }} />
                <span className="ev-bolt" style={{ fontSize: 20, color: "#f59e0b", lineHeight: 1 }}>⚡</span>
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>EV Charging</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>Check station availability, wait times, best charging options</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#f59e0b" }}>
                Explore <span>→</span>
              </div>
            </Link>

            {/* ── Transit ── */}
            <Link href={`/transit?city=${encodeURIComponent(city)}`}
              className="card p-5 flex flex-col gap-3 group cursor-pointer explore-transit" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "#22c55e15", color: "#22c55e" }}>🚇</div>
              {/* Animated track + train */}
              <div style={{ position: "relative", height: 24, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1.5, background: "rgba(34,197,94,0.2)", transform: "translateY(-50%)" }} />
                {[0,1,2,3].map(i => (
                  <div key={i} className="stop-dot" style={{
                    position: "absolute", top: "50%",
                    left: `${10 + i * 25}%`,
                    width: 7, height: 7, borderRadius: "50%",
                    background: "rgba(34,197,94,0.25)",
                    "--d": `${i * 0.38}s`,
                  } as React.CSSProperties} />
                ))}
                <span className="transit-train" style={{ position: "absolute", top: "50%", fontSize: 16, lineHeight: 1, userSelect: "none" }}>🚇</span>
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Transit</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>Live crowd levels, delays, optimal departure times</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#22c55e" }}>
                Explore <span>→</span>
              </div>
            </Link>

            {/* ── Local Services ── */}
            <Link href={`/services?city=${encodeURIComponent(city)}`}
              className="card p-5 flex flex-col gap-3 group cursor-pointer explore-services" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "#a855f715", color: "#a855f7" }}>🏛</div>
              {/* Service icons that burst outward */}
              <div style={{ position: "relative", height: 30 }}>
                {([
                  { icon: "🏥", tx: "-22px", ty: "-10px", d: "0s" },
                  { icon: "💊", tx:  "22px", ty: "-10px", d: "0.08s" },
                  { icon: "🏦", tx: "-22px", ty:  "10px", d: "0.16s" },
                  { icon: "📮", tx:  "22px", ty:  "10px", d: "0.24s" },
                ]).map((s, i) => (
                  <span key={i} className="svc-icon" style={{
                    position: "absolute", top: "50%", left: "50%",
                    fontSize: 15, marginTop: -8, marginLeft: -8,
                    "--tx": s.tx, "--ty": s.ty, "--d": s.d,
                  } as React.CSSProperties}>{s.icon}</span>
                ))}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Local Services</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>DMV, hospitals, banks — predicted wait times</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#a855f7" }}>
                Explore <span>→</span>
              </div>
            </Link>

          </div>
        </div>
      </section>

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </main>
  );
}
