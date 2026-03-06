"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import StatCard from "@/components/StatCard";
import Toast from "@/components/Toast";
import SurgeWidget from "@/components/SurgeWidget";
import NarrativeCard from "@/components/NarrativeCard";
import ShareCard from "@/components/ShareCard";
import { getOverview, getPulseScore } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { usePolling } from "@/hooks/usePolling";
import type { DashboardOverview, PulseScore } from "@/lib/types";
import WeatherMetricsCard from "@/components/WeatherMetricsCard";

const RUSH_COLOR: Record<string, string> = {
  "Peak Rush Hour": "#ef4444",
  "Normal Hours": "#3b82f6",
  "Off-Peak": "#22c55e",
};

function DashboardContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [pulse, setPulse] = useState<PulseScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOverview(city)
      .then((data) => { if (!cancelled) setOverview(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    getPulseScore(city).then((d) => { if (!cancelled) setPulse(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [city]);

  const cityRef = useRef(city);
  cityRef.current = city;

  usePolling(() => {
    getOverview(cityRef.current).then(setOverview).catch(() => {});
    getPulseScore(cityRef.current).then(setPulse).catch(() => {});
  });

  useWebSocket(city, () => {
    getOverview(cityRef.current).then(setOverview).catch(() => {});
    getPulseScore(cityRef.current).then(setPulse).catch(() => {});
    setToast("Live update received");
  });

  const o = overview;

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} liveStatus="Live · refreshes on every visit" />

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
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <Link href="/goout" className="btn-ghost text-sm flex items-center gap-2">
                🤔 Go Out?
              </Link>
              <Link href="/plan" className="btn-primary text-sm flex items-center gap-2">
                ✦ Generate AI Plan
              </Link>
            </div>
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
                trend={o && o.services.total > 0
                  ? o.services.open_now / o.services.total >= 0.5 ? "good" : "bad"
                  : "neutral"}
              />
            </div>
          )}

          <WeatherMetricsCard city={city} context="vibe" />
        </div>
      </section>

      {/* City Right Now narrative + Share */}
      <section className="px-4 pb-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div className="md:col-span-2">
            <NarrativeCard city={city} />
          </div>
          <div>
            <ShareCard city={city} overview={overview} pulse={pulse} />
          </div>
        </div>
      </section>

      {/* Pulse + Surge row */}
      <section className="px-4 pb-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pulse mini-card */}
          <Link href={`/pulse?city=${encodeURIComponent(city)}`} className="card p-4 flex items-center gap-4 hover:border-blue-500/40 transition-all group">
            <div className="relative shrink-0" style={{ width: 64, height: 64 }}>
              <svg width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <circle
                  cx="32" cy="32" r="26"
                  fill="none"
                  stroke={pulse?.color ?? "#3b82f6"}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${((pulse?.pulse_score ?? 0) / 100) * 2 * Math.PI * 26} ${2 * Math.PI * 26}`}
                  transform="rotate(-90 32 32)"
                  style={{ filter: `drop-shadow(0 0 4px ${pulse?.color ?? "#3b82f6"})` }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold" style={{ color: pulse?.color ?? "#3b82f6" }}>
                  {pulse?.pulse_score ?? "—"}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>City Pulse Score</p>
              <p className="text-xs mt-0.5" style={{ color: pulse?.color ?? "var(--muted)" }}>
                {pulse?.label ?? "Loading…"}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Composite livability index →</p>
            </div>
          </Link>

          {/* Surge widget */}
          <SurgeWidget city={city} />
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

            {/* ── Air Quality ── */}
            <Link href={`/air?city=${encodeURIComponent(city)}`}
              className="card p-5 flex flex-col gap-3 group cursor-pointer explore-air" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "#06b6d415", color: "#06b6d4" }}>🌬</div>
              <div className="flex items-end gap-1" style={{ height: 28 }}>
                {[50, 35, 65, 45, 55, 30, 70].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm air-bar"
                    style={{ height: h / 4, background: h < 40 ? "rgba(34,197,94,0.6)" : h < 60 ? "rgba(234,179,8,0.6)" : "rgba(239,68,68,0.6)", "--d": `${i * 0.04}s` } as React.CSSProperties} />
                ))}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Air Quality</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>AQI, PM2.5, pollen, UV index — real-time monitoring</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#06b6d4" }}>
                Explore <span>→</span>
              </div>
            </Link>

            {/* ── Bikes & Scooters ── */}
            <Link href={`/bikes?city=${encodeURIComponent(city)}`}
              className="card p-5 flex flex-col gap-3 group cursor-pointer explore-bikes" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "#10b98115", color: "#10b981" }}>🚲</div>
              <div className="flex items-center justify-center gap-1.5 py-1">
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full bike-dot"
                    style={{ background: i < 3 ? "#10b981" : "rgba(16,185,129,0.2)", "--d": `${i * 0.07}s` } as React.CSSProperties} />
                ))}
                <span className="text-xs ml-1" style={{ color: "#10b981" }}>3/5 bikes</span>
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Bikes & Scooters</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>Live dock availability, e-bikes, AI station recommendations</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#10b981" }}>
                Explore <span>→</span>
              </div>
            </Link>

            {/* ── Food Trucks ── */}
            <Link href={`/food-trucks?city=${encodeURIComponent(city)}`}
              className="card p-5 flex flex-col gap-3 group cursor-pointer explore-food" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "#f9731615", color: "#f97316" }}>🚚</div>
              <div className="flex items-center gap-2 text-xl">
                {["🌮", "🍜", "🥙", "🧇"].map((icon, i) => (
                  <span key={i} className="food-icon" style={{ "--d": `${i * 0.08}s` } as React.CSSProperties}>{icon}</span>
                ))}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Food Trucks</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>Open trucks, crowd levels, wait times by cuisine</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#f97316" }}>
                Explore <span>→</span>
              </div>
            </Link>

            {/* ── Noise & Vibe ── */}
            <Link href={`/noise?city=${encodeURIComponent(city)}`}
              className="card p-5 flex flex-col gap-3 group cursor-pointer explore-noise" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "#ec489915", color: "#ec4899" }}>🎵</div>
              <div className="flex items-end gap-0.5" style={{ height: 28 }}>
                {[30, 55, 45, 75, 60, 80, 50, 40, 65, 35].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm noise-bar"
                    style={{ height: `${h}%`, background: `rgba(236,72,153,${0.3 + h / 200})`, "--d": `${i * 0.07}s` } as React.CSSProperties} />
                ))}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Noise & Vibe</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>Neighborhood energy, crowd density, night scene activity</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#ec4899" }}>
                Explore <span>→</span>
              </div>
            </Link>

          </div>

          {/* ── Unique Features Row ── */}
          <h2 className="text-sm font-semibold mt-8 mb-4" style={{ color: "var(--muted)" }}>UNIQUE FEATURES</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* City Pulse */}
            <Link href={`/pulse?city=${encodeURIComponent(city)}`}
              className="card p-5 flex flex-col gap-3 group cursor-pointer" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>◎</div>
              <div className="flex items-center justify-center">
                <div className="relative" style={{ width: 56, height: 56 }}>
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                    <circle cx="28" cy="28" r="22" fill="none" stroke={pulse?.color ?? "#3b82f6"}
                      strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={`${((pulse?.pulse_score ?? 72) / 100) * 2 * Math.PI * 22} ${2 * Math.PI * 22}`}
                      transform="rotate(-90 28 28)"
                      style={{ filter: `drop-shadow(0 0 4px ${pulse?.color ?? "#3b82f6"})` }} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-bold" style={{ color: pulse?.color ?? "#3b82f6" }}>
                      {pulse?.pulse_score ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>City Pulse Score</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>Composite livability index across all 8 urban domains in real-time</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#3b82f6" }}>
                View Score <span>→</span>
              </div>
            </Link>

            {/* AI Concierge */}
            <Link href={`/concierge?city=${encodeURIComponent(city)}`}
              className="card p-5 flex flex-col gap-3 group cursor-pointer" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa" }}>💬</div>
              <div className="flex flex-col gap-1.5">
                {["Where should I park?", "Is the air safe for a run?", "Best transit route?"].map((q, i) => (
                  <div key={i} className="px-2 py-1 rounded-lg text-xs" style={{ background: "var(--card2)", color: "var(--muted)" }}>
                    {q}
                  </div>
                ))}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>AI City Concierge</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>Ask anything about city conditions — Claude answers with live data</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#a78bfa" }}>
                Ask Now <span>→</span>
              </div>
            </Link>

            {/* City Compare */}
            <Link href="/compare"
              className="card p-5 flex flex-col gap-3 group cursor-pointer" style={{ transition: "border-color 0.2s, box-shadow 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>⚖</div>
              <div className="flex items-center justify-around py-1">
                {["🌉", "🗽", "🎸"].map((flag, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="text-xl">{flag}</span>
                    <div className="w-8 rounded-sm" style={{
                      height: [36, 28, 44][i],
                      background: ["rgba(59,130,246,0.5)", "rgba(245,158,11,0.5)", "rgba(34,197,94,0.5)"][i],
                    }} />
                  </div>
                ))}
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>Live City Compare</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>SF vs NY vs Austin — who's winning right now across all metrics?</p>
              </div>
              <div className="text-xs font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style={{ color: "#22c55e" }}>
                Compare <span>→</span>
              </div>
            </Link>

          </div>
        </div>
      </section>

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </main>
  );
}

export default function DashboardPage() {
  return <Suspense><DashboardContent /></Suspense>;
}
