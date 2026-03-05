"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

const DOMAINS = [
  { icon: "🅿",  label: "Smart Parking",    desc: "Real-time spot availability, occupancy predictions, AI recommendations",     color: "#3b82f6",  bg: "#3b82f610" },
  { icon: "⚡",  label: "EV Charging",      desc: "Live port status, queue estimates, best charging options near you",           color: "#f59e0b",  bg: "#f59e0b10" },
  { icon: "🚇",  label: "Transit",          desc: "Crowd levels, delay alerts, optimal departure windows",                       color: "#22c55e",  bg: "#22c55e10" },
  { icon: "🏛",  label: "Local Services",   desc: "Hospitals, banks, pharmacies — predicted wait times",                         color: "#a855f7",  bg: "#a855f710" },
  { icon: "🌬",  label: "Air Quality",      desc: "AQI, PM2.5, ozone, UV index, pollen — real-time sensors",                    color: "#06b6d4",  bg: "#06b6d410" },
  { icon: "🚲",  label: "Bike Share",       desc: "Live dock availability, e-bikes, AI station recommendations via GBFS",        color: "#10b981",  bg: "#10b98110" },
  { icon: "🚚",  label: "Food Trucks",      desc: "Open trucks, crowd levels, wait times by cuisine",                            color: "#f97316",  bg: "#f9731610" },
  { icon: "🎵",  label: "Noise & Vibe",     desc: "Neighborhood energy, crowd density, night scene activity",                    color: "#ec4899",  bg: "#ec489910" },
];

const AI_FEATURES = [
  {
    icon: "◎",
    label: "City Pulse Score",
    desc: "Composite 0–100 livability index computed in real time across all 8 domains — weighted by impact on daily life.",
    color: "#3b82f6",
    href: "/pulse",
  },
  {
    icon: "💬",
    label: "AI City Concierge",
    desc: "Multi-turn chat powered by Claude. Answers questions with live entity-level data — actual names, addresses, real numbers.",
    color: "#a78bfa",
    href: "/concierge",
  },
  {
    icon: "⚖",
    label: "Live City Compare",
    desc: "SF vs New York vs Austin head-to-head across 9 metrics. Real-time winner detection with per-metric crowns.",
    color: "#22c55e",
    href: "/compare",
  },
  {
    icon: "⚡",
    label: "Surge Predictor",
    desc: "AI-powered early warnings for emerging congestion in parking, transit, and EV — with severity levels and actionable tips.",
    color: "#f59e0b",
    href: "/dashboard",
  },
  {
    icon: "✦",
    label: "AI Urban Planner",
    desc: "Multi-modal travel plan across all domains. Tell it your needs and departure time — Claude builds the optimal route.",
    color: "#f472b6",
    href: "/plan",
  },
  {
    icon: "🔮",
    label: "Future AI Predict",
    desc: "Predict occupancy, wait times, and crowd levels at any future time for any entity across the city.",
    color: "#60a5fa",
    href: "/dashboard",
  },
];

const CITIES = [
  { name: "San Francisco", emoji: "🌉", color: "#3b82f6" },
  { name: "New York",      emoji: "🗽", color: "#f59e0b" },
  { name: "Austin",        emoji: "🎸", color: "#22c55e" },
];

const STATS = [
  { label: "Parking Zones",    value: "240+",  icon: "🅿",  color: "#3b82f6" },
  { label: "EV Stations",      value: "180+",  icon: "⚡",  color: "#f59e0b" },
  { label: "Transit Routes",   value: "90+",   icon: "🚇",  color: "#22c55e" },
  { label: "AI Predictions",   value: "Real-time", icon: "✦", color: "#a78bfa" },
];

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        observer.disconnect();
        let start = 0;
        const step = Math.ceil(target / 60);
        const timer = setInterval(() => {
          start = Math.min(start + step, target);
          setVal(start);
          if (start >= target) clearInterval(timer);
        }, 16);
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

export default function LandingPage() {
  const [activeCity, setActiveCity] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveCity((c) => (c + 1) % 3), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background: "#050508", color: "#e2e8f0", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", overflowX: "hidden" }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(5,5,8,0.8)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff", boxShadow: "0 0 20px rgba(59,130,246,0.4)" }}>U</div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>UrbanFlow <span style={{ color: "#3b82f6" }}>AI</span></span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/dashboard" style={{ padding: "8px 20px", borderRadius: 8, background: "#3b82f6", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none", boxShadow: "0 0 16px rgba(59,130,246,0.35)" }}>
              Launch App →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 24px 60px", position: "relative", overflow: "hidden" }}>
        {/* Background orbs */}
        <div style={{ position: "absolute", top: "15%", left: "10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "40%", left: "50%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

        {/* Live badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.06)", marginBottom: 32 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px #22c55e", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 500 }}>Live data · San Francisco · New York · Austin</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: "clamp(40px, 7vw, 80px)", fontWeight: 800, textAlign: "center", lineHeight: 1.1, marginBottom: 24, maxWidth: 900 }}>
          AI-Powered{" "}
          <span style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            City Intelligence
          </span>
          <br />at Your Fingertips
        </h1>

        <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: "#94a3b8", textAlign: "center", maxWidth: 680, lineHeight: 1.7, marginBottom: 48 }}>
          Real-time data across 8 urban domains — parking, transit, EV charging, air quality, bikes, food trucks, noise & vibe — powered by Claude AI.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginBottom: 72 }}>
          <Link href="/dashboard" style={{ padding: "14px 32px", borderRadius: 12, background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontWeight: 700, fontSize: 16, textDecoration: "none", boxShadow: "0 0 32px rgba(59,130,246,0.4)", letterSpacing: 0.3 }}>
            Launch App →
          </Link>
          <Link href="/concierge" style={{ padding: "14px 28px", borderRadius: 12, background: "transparent", color: "#e2e8f0", fontWeight: 600, fontSize: 16, textDecoration: "none", border: "1px solid rgba(255,255,255,0.15)" }}>
            💬 Ask AI Concierge
          </Link>
        </div>

        {/* Floating stat pills */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* City switcher preview */}
        <div style={{ display: "flex", gap: 12, marginTop: 40, justifyContent: "center" }}>
          {CITIES.map((c, i) => (
            <button key={c.name} onClick={() => setActiveCity(i)}
              style={{ padding: "8px 20px", borderRadius: 100, border: `1px solid ${activeCity === i ? c.color : "rgba(255,255,255,0.1)"}`, background: activeCity === i ? `${c.color}18` : "transparent", color: activeCity === i ? c.color : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.3s" }}>
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </section>

      {/* ── STATS ROW ───────────────────────────────────────────────────── */}
      <section style={{ padding: "40px 24px", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 24, textAlign: "center" }}>
          {[
            { n: 8,    suffix: " domains",    label: "Urban domains tracked" },
            { n: 3,    suffix: " cities",     label: "Cities covered live" },
            { n: 510,  suffix: "+",           label: "Real locations seeded" },
            { n: 100,  suffix: "%",           label: "On-demand refresh" },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 42, fontWeight: 800, color: "#3b82f6", lineHeight: 1 }}>
                <AnimatedCounter target={s.n} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 8 DOMAINS ───────────────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 13, color: "#3b82f6", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>8 Urban Domains</p>
            <h2 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, lineHeight: 1.2 }}>
              Everything happening in your city,<br />
              <span style={{ color: "#3b82f6" }}>right now</span>
            </h2>
            <p style={{ color: "#64748b", fontSize: 16, marginTop: 16, maxWidth: 560, margin: "16px auto 0" }}>
              Real data from OpenStreetMap, Open Charge Map, OpenAQ, GBFS, and 511.org — simulated with time-aware patterns for a live experience.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 20 }}>
            {DOMAINS.map((d) => (
              <Link key={d.label} href={`/dashboard`}
                style={{ padding: "28px 24px", borderRadius: 16, background: "#0d0d14", border: "1px solid rgba(255,255,255,0.07)", textDecoration: "none", display: "flex", flexDirection: "column", gap: 16, transition: "all 0.2s", cursor: "pointer" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = d.color + "50"; (e.currentTarget as HTMLElement).style.background = d.bg; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.background = "#0d0d14"; }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, background: d.bg, border: `1px solid ${d.color}25` }}>{d.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#e2e8f0", marginBottom: 8 }}>{d.label}</div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{d.desc}</div>
                </div>
                <div style={{ fontSize: 13, color: d.color, fontWeight: 600, marginTop: "auto" }}>Explore →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI FEATURES ─────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 13, color: "#a78bfa", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Unique AI Features</p>
            <h2 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, lineHeight: 1.2 }}>
              Not just data —{" "}
              <span style={{ background: "linear-gradient(135deg,#a78bfa,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>intelligence</span>
            </h2>
            <p style={{ color: "#64748b", fontSize: 16, marginTop: 16, maxWidth: 520, margin: "16px auto 0" }}>
              Claude AI turns raw city data into specific, actionable answers — with real names, actual numbers, and live context.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 20 }}>
            {AI_FEATURES.map((f) => (
              <Link key={f.label} href={f.href}
                style={{ padding: "28px 24px", borderRadius: 16, background: "#0d0d14", border: "1px solid rgba(255,255,255,0.07)", textDecoration: "none", display: "flex", flexDirection: "column", gap: 14, transition: "all 0.2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = f.color + "50"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                <div style={{ fontSize: 28 }}>{f.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: f.color, marginBottom: 8 }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>{f.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CITIES SHOWCASE ─────────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800 }}>
              Three cities.{" "}
              <span style={{ color: "#22c55e" }}>One dashboard.</span>
            </h2>
            <p style={{ color: "#64748b", fontSize: 16, marginTop: 16 }}>
              Switch cities instantly — data refreshes on every visit.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
            {[
              { ...CITIES[0], desc: "Bay Area real-time transit via 511.org, OCM EV stations, Bay Wheels GBFS bikes", metrics: ["BART + Muni routes", "ChargePoint & Blink", "Bay Wheels docks"] },
              { ...CITIES[1], desc: "NYC subway + MTA routes, Citi Bike live docks, Manhattan EV charging", metrics: ["Subway + MTA buses", "Citi Bike network", "NYC EV grid"] },
              { ...CITIES[2], desc: "Austin MetroBike, ACC-area EV stations, downtown food truck scene", metrics: ["MetroBike GBFS", "Austin EV corridors", "6th Street vibe"] },
            ].map((c) => (
              <Link key={c.name} href={`/dashboard?city=${encodeURIComponent(c.name)}`}
                style={{ padding: "32px 28px", borderRadius: 20, background: `linear-gradient(135deg, ${c.color}0a, #0d0d14)`, border: `1px solid ${c.color}25`, textDecoration: "none", display: "flex", flexDirection: "column", gap: 20, transition: "all 0.2s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = c.color + "60"; (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = c.color + "25"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                <div style={{ fontSize: 40 }}>{c.emoji}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0", marginBottom: 8 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>{c.desc}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {c.metrics.map((m) => (
                    <div key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.color, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ color: "#94a3b8" }}>{m}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: c.color, fontWeight: 700 }}>Open {c.name} →</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────── */}
      <section style={{ padding: "80px 24px", background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#f59e0b", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>How it works</p>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800, marginBottom: 56 }}>Data refresh on every visit</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 32, textAlign: "left" }}>
            {[
              { step: "01", title: "Open any page", desc: "Every GET request triggers an on-demand snapshot refresh for your city — data is never stale.", color: "#3b82f6" },
              { step: "02", title: "Live simulation", desc: "Time-aware engine generates occupancy, wait times, and crowd levels based on rush hours and city timezone.", color: "#a78bfa" },
              { step: "03", title: "AI enrichment", desc: "Claude answers with actual entity names, real numbers, and specific addresses from the live snapshot.", color: "#22c55e" },
              { step: "04", title: "WebSocket push", desc: "Dashboard auto-refreshes when new snapshots are broadcast — no manual reload needed.", color: "#f59e0b" },
            ].map((s) => (
              <div key={s.step} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.color, letterSpacing: 1 }}>{s.step}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────────────── */}
      <section style={{ padding: "120px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.08) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ fontSize: "clamp(32px, 6vw, 64px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>
            Your city, in real time.<br />
            <span style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Powered by AI.
            </span>
          </h2>
          <p style={{ color: "#64748b", fontSize: 18, marginBottom: 48, maxWidth: 500, margin: "0 auto 48px" }}>
            Auto-detects your nearest city. Real data, live scores, and Claude AI — ready the moment you open it.
          </p>
          <Link href="/dashboard" style={{ display: "inline-block", padding: "18px 48px", borderRadius: 16, background: "linear-gradient(135deg,#3b82f6,#6366f1)", color: "#fff", fontWeight: 800, fontSize: 18, textDecoration: "none", boxShadow: "0 0 48px rgba(59,130,246,0.5)", letterSpacing: 0.5 }}>
            Launch UrbanFlow AI →
          </Link>
          <p style={{ color: "#374151", fontSize: 13, marginTop: 20 }}>Free · No account needed · Auto city detection</p>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer style={{ padding: "32px 24px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: "#fff" }}>U</div>
          <span style={{ fontSize: 14, color: "#475569" }}>UrbanFlow AI — real-time city intelligence</span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "Dashboard", href: "/dashboard" },
            { label: "AI Concierge", href: "/concierge" },
            { label: "City Compare", href: "/compare" },
            { label: "City Pulse", href: "/pulse" },
          ].map((l) => (
            <Link key={l.label} href={l.href} style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>{l.label}</Link>
          ))}
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
