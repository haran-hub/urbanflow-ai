"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useWeatherTheme } from "@/hooks/useWeatherTheme";
import WeatherBackground from "@/components/WeatherBackground";

const CITIES = ["San Francisco", "New York", "Austin"];

const NAV_GROUPS = [
  {
    label: "EXPLORE",
    items: [
      { href: "/dashboard",    label: "Dashboard",    icon: "⬡" },
      { href: "/parking",      label: "Parking",      icon: "🅿" },
      { href: "/ev",           label: "EV Charging",  icon: "⚡" },
      { href: "/transit",      label: "Transit",      icon: "🚇" },
      { href: "/services",     label: "Services",     icon: "🏛" },
      { href: "/air",          label: "Air Quality",  icon: "🌬" },
      { href: "/bikes",        label: "Bikes",        icon: "🚲" },
      { href: "/food-trucks",  label: "Food Trucks",  icon: "🚚" },
      { href: "/noise",        label: "Noise & Vibe", icon: "🎵" },
    ],
  },
  {
    label: "AI FEATURES",
    items: [
      { href: "/plan",      label: "AI Plan",         icon: "✦" },
      { href: "/pulse",     label: "City Pulse",      icon: "◎" },
      { href: "/concierge", label: "AI Concierge",    icon: "💬" },
      { href: "/briefing",  label: "City Briefing",   icon: "☀" },
      { href: "/moment",    label: "Moment Planner",  icon: "⏱" },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { href: "/compare",       label: "City Compare",      icon: "⚖" },
      { href: "/heatmap",       label: "Heat Map",          icon: "🗺" },
      { href: "/watchlist",     label: "Watchlist",         icon: "🔔" },
      { href: "/neighborhoods", label: "Neighborhoods",     icon: "⬡" },
      { href: "/delta",         label: "What Changed",      icon: "📊" },
      { href: "/goout",         label: "Go Out Tonight?",   icon: "🤔" },
      { href: "/trip",          label: "Trip Cost",         icon: "💸" },
      { href: "/reports",       label: "Community Reports", icon: "📍" },
      { href: "/embed/code",    label: "Embed Widget",      icon: "⬡" },
    ],
  },
];

interface HeaderProps {
  city: string;
  onCityChange: (city: string) => void;
  liveStatus?: string;
}

export default function Header({ city, onCityChange, liveStatus }: HeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { weather, theme } = useWeatherTheme(city);
  const navRef = useRef<HTMLElement>(null);

  // Scroll active nav item into view whenever route changes
  useEffect(() => {
    if (!navRef.current) return;
    const active = navRef.current.querySelector("[data-active='true']");
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [pathname]);

  // Apply weather-based CSS variables globally
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    root.style.setProperty("--bg",           theme.bg);
    root.style.setProperty("--card",         theme.card);
    root.style.setProperty("--card2",        theme.card2);
    root.style.setProperty("--border",       theme.border);
    root.style.setProperty("--accent",       theme.accent);
    root.style.setProperty("--accent-glow",  theme.accentGlow);
    root.style.setProperty("--muted",        theme.muted);
    document.body.style.background = theme.bg;
  }, [theme]);

  const gradientBar = theme?.gradientBar ?? "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)";

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <header className="md:hidden glass fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)]">
        <div style={{ height: 2, background: gradientBar, transition: "background 1.2s ease" }} />

        <div className="h-14 px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", boxShadow: "0 0 10px rgba(139,92,246,0.4)" }}
            >
              U
            </div>
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              UrbanFlow <span style={{ color: "var(--accent)" }}>AI</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <select
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              className="text-xs py-1 px-2 rounded-lg"
              style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)", minWidth: 110 }}
            >
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-sm"
              style={{ color: "var(--muted)", border: "1px solid var(--border)", background: "var(--card2)" }}
            >
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile dropdown nav */}
        {mobileOpen && (
          <nav
            className="border-t border-[var(--border)] px-3 py-3 flex flex-col gap-1 max-h-[80vh] overflow-y-auto"
            style={{ background: "rgba(10,10,15,0.98)" }}
          >
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-2">
                <p className="text-[10px] font-bold tracking-widest px-3 py-1" style={{ color: "var(--muted)", opacity: 0.5 }}>
                  {group.label}
                </p>
                {group.items.map((n) => {
                  const href = `${n.href}?city=${encodeURIComponent(city)}`;
                  const active = pathname === n.href;
                  return (
                    <Link
                      key={n.href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium"
                      style={{
                        color: active ? "white" : "var(--muted)",
                        background: active ? "var(--accent-glow)" : "transparent",
                        borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                      }}
                    >
                      <span>{n.icon}</span>
                      <span>{n.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        )}
      </header>

      {/* ── Desktop left sidebar ───────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-50 w-[220px] border-r border-[var(--border)]"
        style={{ background: "rgba(8,8,14,0.97)", backdropFilter: "blur(16px)" }}
      >
        {/* Gradient top accent line */}
        <div style={{ height: 2, background: gradientBar, transition: "background 1.2s ease", flexShrink: 0 }} />

        {/* Logo */}
        <div className="px-5 py-5 border-b border-[var(--border)]" style={{ flexShrink: 0 }}>
          <Link href="/" className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base"
              style={{
                background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                boxShadow: "0 0 20px rgba(139,92,246,0.45)",
              }}
            >
              U
            </div>
            <div>
              <span className="font-bold text-sm block" style={{ color: "var(--text)" }}>UrbanFlow</span>
              <span
                className="text-[11px] font-semibold"
                style={{
                  background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                AI Intelligence
              </span>
            </div>
          </Link>
        </div>

        {/* Nav groups */}
        <nav ref={navRef} className="flex-1 px-3 py-3 flex flex-col overflow-y-auto" style={{ gap: 0 }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-3">
              <p
                className="text-[9px] font-black tracking-[0.15em] px-3 py-1.5"
                style={{ color: "var(--muted)", opacity: 0.45, letterSpacing: "0.15em" }}
              >
                {group.label}
              </p>
              {group.items.map((n) => {
                const href = `${n.href}?city=${encodeURIComponent(city)}`;
                const active = pathname === n.href;
                return (
                  <Link
                    key={n.href}
                    href={href}
                    data-active={active ? "true" : undefined}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all mb-0.5 group"
                    style={{
                      color: active ? "white" : "var(--muted)",
                      background: active ? "var(--accent-glow)" : "transparent",
                      borderLeft: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                    }}
                  >
                    <span className="w-5 text-center text-base" style={{ opacity: active ? 1 : 0.65 }}>{n.icon}</span>
                    <span className="flex-1 text-[13px]">{n.label}</span>
                    {active && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ── Desktop top bar (right of sidebar) ─────────────────────────────── */}
      <header
        className="hidden md:flex items-center fixed top-0 left-[220px] right-0 h-14 z-40 px-6 border-b border-[var(--border)]"
        style={{ background: "rgba(8,8,14,0.95)", backdropFilter: "blur(16px)" }}
      >
        {/* Gradient accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: gradientBar,
            transition: "background 1.2s ease",
          }}
        />

        {/* Left: live status */}
        <div className="flex-1">
          {liveStatus && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              {liveStatus}
            </div>
          )}
        </div>

        {/* Right: weather badge + city selector */}
        <div className="flex items-center gap-3">
          {weather && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
            >
              <span style={{ fontSize: 15 }}>{weather.icon}</span>
              <span style={{ color: "var(--muted)" }}>{weather.description}</span>
              <span className="font-semibold" style={{ color: "var(--accent)" }}>
                {Math.round(weather.temp_c * 9 / 5 + 32)}°F
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest" style={{ color: "var(--muted)", opacity: 0.45 }}>📍</span>
            <select
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{
                background: "var(--card2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                minWidth: 130,
              }}
            >
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* Weather particle overlay */}
      {weather && theme && (
        <WeatherBackground
          condition={weather.condition}
          particleColor={theme.particleColor}
          particleOpacity={theme.particleOpacity}
          glowColor={theme.glowColor}
        />
      )}
    </>
  );
}
