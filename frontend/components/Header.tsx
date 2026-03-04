"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const CITIES = ["San Francisco", "New York", "Austin"];

const NAV = [
  { href: "/", label: "Dashboard", icon: "⬡" },
  { href: "/parking", label: "Parking", icon: "🅿" },
  { href: "/ev", label: "EV Charging", icon: "⚡" },
  { href: "/transit", label: "Transit", icon: "🚇" },
  { href: "/services", label: "Services", icon: "🏛" },
  { href: "/air", label: "Air Quality", icon: "🌬" },
  { href: "/bikes", label: "Bikes", icon: "🚲" },
  { href: "/food-trucks", label: "Food Trucks", icon: "🚚" },
  { href: "/noise", label: "Noise & Vibe", icon: "🎵" },
  { href: "/plan", label: "AI Plan", icon: "✦" },
];

interface HeaderProps {
  city: string;
  onCityChange: (city: string) => void;
  liveStatus?: string;
}

export default function Header({ city, onCityChange, liveStatus }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="glass fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">U</div>
          <span className="font-semibold text-sm hidden sm:block" style={{ color: "var(--text)" }}>
            UrbanFlow <span style={{ color: "var(--accent)" }}>AI</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
          {NAV.map((n) => {
            const href = n.href === "/" ? "/" : `${n.href}?city=${encodeURIComponent(city)}`;
            return (
            <Link
              key={n.href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
              style={{
                color: pathname === n.href ? "var(--accent)" : "var(--muted)",
                background: pathname === n.href ? "var(--accent-glow)" : "transparent",
              }}
            >
              <span>{n.icon}</span>
              <span className="hidden sm:block">{n.label}</span>
            </Link>
            );
          })}
        </nav>

        {/* Live indicator + City selector */}
        <div className="flex items-center gap-3 shrink-0">
          {liveStatus && (
            <div className="hidden md:flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {liveStatus}
            </div>
          )}
          <select
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            className="text-xs py-1.5 px-2"
            style={{ minWidth: 120 }}
          >
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
}
