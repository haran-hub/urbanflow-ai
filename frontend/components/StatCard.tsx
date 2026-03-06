interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "blue" | "green" | "yellow" | "red" | "purple";
  trend?: "good" | "bad" | "neutral";
  sparkline?: number[];
}

const ACCENT_COLORS: Record<string, string> = {
  blue:   "#3b82f6",
  green:  "#22c55e",
  yellow: "#f59e0b",
  red:    "#ef4444",
  purple: "#a855f7",
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 100;
  const H = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: H, display: "block", marginTop: 4 }}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
      {/* Gradient fill under line */}
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${H} ${pts} ${W},${H}`}
        fill={`url(#sg-${color.replace("#","")})`}
      />
    </svg>
  );
}

export default function StatCard({ icon, label, value, sub, accent = "blue", trend, sparkline }: StatCardProps) {
  const color = ACCENT_COLORS[accent];
  return (
    <div className="card p-5 flex flex-col gap-2 animate-fade-in">
      <div className="flex items-center justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{ background: `${color}18`, color }}
        >
          {icon}
        </div>
        {trend && (
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: trend === "good" ? "rgba(34,197,94,0.1)" : trend === "bad" ? "rgba(239,68,68,0.1)" : "rgba(100,116,139,0.1)",
              color: trend === "good" ? "#22c55e" : trend === "bad" ? "#ef4444" : "#64748b",
            }}>
            {trend === "good" ? "↑ Good" : trend === "bad" ? "↓ High" : "—"}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: "var(--text)" }}>{value}</div>
        <div className="text-sm font-medium mt-0.5" style={{ color: "var(--muted)" }}>{label}</div>
        {sub && <div className="text-xs mt-1" style={{ color: "var(--muted)", opacity: 0.7 }}>{sub}</div>}
      </div>
      {sparkline && sparkline.length >= 2 && (
        <Sparkline data={sparkline} color={color} />
      )}
    </div>
  );
}
