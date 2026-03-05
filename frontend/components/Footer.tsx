"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const QUICK_LINKS = [
  { href: "/dashboard",  label: "Dashboard" },
  { href: "/parking",    label: "Parking" },
  { href: "/ev",         label: "EV Charging" },
  { href: "/transit",    label: "Transit" },
  { href: "/air",        label: "Air Quality" },
  { href: "/concierge",  label: "AI Concierge" },
  { href: "/compare",    label: "City Compare" },
  { href: "/pulse",      label: "City Pulse" },
  { href: "/briefing",   label: "City Briefing" },
  { href: "/moment",     label: "Moment Planner" },
  { href: "/heatmap",    label: "Heat Map" },
  { href: "/watchlist",  label: "Watchlist" },
];

const DOMAINS = [
  { icon: "🅿", label: "Parking" },
  { icon: "⚡", label: "EV Charging" },
  { icon: "🚇", label: "Transit" },
  { icon: "🌬", label: "Air Quality" },
  { icon: "🚲", label: "Bikes" },
  { icon: "🚚", label: "Food Trucks" },
  { icon: "🎵", label: "Noise & Vibe" },
  { icon: "🏛", label: "Services" },
];

export default function Footer() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const year = new Date().getFullYear();

  return (
    <footer style={{ background: "var(--card)", borderTop: "1px solid var(--border)", position: "relative" }}>
      {/* Gradient accent line */}
      <div
        className={isLanding ? "" : "md:ml-[220px]"}
        style={{ height: 2, background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)", opacity: 0.7 }}
      />

      <div className={`px-6 py-10 ${isLanding ? "" : "md:ml-[220px]"}`}>
        <div className="max-w-5xl mx-auto">

          {/* Main grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">

            {/* ── Brand ── */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base"
                  style={{
                    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                    boxShadow: "0 0 20px rgba(139,92,246,0.45)",
                  }}
                >
                  U
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: "var(--text)" }}>UrbanFlow</p>
                  <p
                    className="text-xs font-semibold"
                    style={{
                      background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    AI Intelligence
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed mb-5" style={{ color: "var(--muted)" }}>
                Real-time city intelligence for smarter urban navigation. AI-powered predictions for parking, EV, transit, air quality, and more across 3 cities.
              </p>

              {/* Live indicator */}
              <div className="flex items-center gap-2 mb-5">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
                  Live · Refreshes every 2 min
                </span>
              </div>

              {/* Domain pills */}
              <div className="flex flex-wrap gap-1.5">
                {DOMAINS.map((d) => (
                  <span
                    key={d.label}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}
                  >
                    {d.icon}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Quick Links ── */}
            <div>
              <h3
                className="text-[10px] font-bold tracking-widest mb-5"
                style={{ color: "var(--muted)", opacity: 0.65 }}
              >
                QUICK LINKS
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {QUICK_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-xs transition-all hover:translate-x-1"
                    style={{ color: "var(--muted)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
                  >
                    <span style={{ color: "var(--accent)", marginRight: 4 }}>→</span>
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* ── Developer + Info ── */}
            <div>
              <h3
                className="text-[10px] font-bold tracking-widest mb-5"
                style={{ color: "var(--muted)", opacity: 0.65 }}
              >
                ABOUT
              </h3>

              {/* Developer card */}
              <div
                className="p-4 rounded-2xl mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))",
                  border: "1px solid rgba(139,92,246,0.2)",
                }}
              >
                <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>Designed & Developed by</p>
                <p
                  className="text-lg font-black tracking-tight"
                  style={{
                    background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Haran
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Full-stack · AI · Urban Tech
                </p>
              </div>

              {/* Tech badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { label: "✦ AI Powered", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
                  { label: "◎ Real-time",  color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
                  { label: "⬡ 3 Cities",  color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
                ].map((badge) => (
                  <span
                    key={badge.label}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium"
                    style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.bg}` }}
                  >
                    {badge.label}
                  </span>
                ))}
              </div>

              <p className="text-xs" style={{ color: "var(--muted)", opacity: 0.6 }}>
                © {year} UrbanFlow AI<br />All rights reserved.
              </p>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <p className="text-xs" style={{ color: "var(--muted)", opacity: 0.6 }}>
              © {year} UrbanFlow AI — Smart City Intelligence Platform. All rights reserved.
            </p>
            <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              Built with{" "}
              <span style={{ color: "#ef4444" }}>♥</span>
              {" "}by{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontWeight: 700,
                }}
              >
                Haran
              </span>
              {" "}· Powered by AI
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
