"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const CITIES = ["San Francisco", "New York", "Austin"];

const NAV = [
  { href: "/",           label: "Dashboard",   icon: "⬡" },
  { href: "/parking",    label: "Parking",      icon: "🅿" },
  { href: "/ev",         label: "EV Charging",  icon: "⚡" },
  { href: "/transit",    label: "Transit",      icon: "🚇" },
  { href: "/services",   label: "Services",     icon: "🏛" },
  { href: "/air",        label: "Air Quality",  icon: "🌬" },
  { href: "/bikes",      label: "Bikes",        icon: "🚲" },
  { href: "/food-trucks",label: "Food Trucks",  icon: "🚚" },
  { href: "/noise",      label: "Noise & Vibe", icon: "🎵" },
  { href: "/plan",       label: "AI Plan",      icon: "✦" },
];

interface HeaderProps {
  city: string;
  onCityChange: (city: string) => void;
  liveStatus?: string;
}

export default function Header({ city, onCityChange, liveStatus }: HeaderProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Mobile top bar ─────────────────────────────────────────── */}
      <header className="md:hidden glass fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)]">
        <div className="h-14 px-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">U</div>
            <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
              UrbanFlow <span style={{ color: "var(--accent)" }}>AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <select
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              className="text-xs py-1 px-2"
              style={{ minWidth: 110 }}
            >
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-1.5 rounded-lg"
              style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
            >
              {mobileOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>
        {/* Mobile dropdown nav */}
        {mobileOpen && (
          <nav className="border-t border-[var(--border)] px-3 py-2 flex flex-col gap-0.5"
            style={{ background: "rgba(15,17,23,0.97)" }}>
            {NAV.map((n) => {
              const href = n.href === "/" ? "/" : `${n.href}?city=${encodeURIComponent(city)}`;
              const active = pathname === n.href;
              return (
                <Link key={n.href} href={href} onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium"
                  style={{
                    color: active ? "var(--accent)" : "var(--muted)",
                    background: active ? "var(--accent-glow)" : "transparent",
                  }}>
                  <span>{n.icon}</span>
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* ── Desktop left sidebar ────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-50 w-[220px] border-r border-[var(--border)]"
        style={{ background: "rgba(15,17,23,0.95)", backdropFilter: "blur(12px)" }}>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white text-sm font-bold shadow-lg"
              style={{ boxShadow: "0 0 16px rgba(59,130,246,0.4)" }}>U</div>
            <div>
              <span className="font-semibold text-sm block" style={{ color: "var(--text)" }}>UrbanFlow</span>
              <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>AI</span>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          {NAV.map((n) => {
            const href = n.href === "/" ? "/" : `${n.href}?city=${encodeURIComponent(city)}`;
            const active = pathname === n.href;
            return (
              <Link key={n.href} href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  color: active ? "var(--accent)" : "var(--muted)",
                  background: active ? "var(--accent-glow)" : "transparent",
                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                }}>
                <span className="text-base">{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* City selector + live status */}
        <div className="px-4 py-4 border-t border-[var(--border)] flex flex-col gap-3">
          {liveStatus && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
              {liveStatus}
            </div>
          )}
          <select
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            className="text-xs w-full"
          >
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </aside>
    </>
  );
}
