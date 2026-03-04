interface StatCardProps {
  icon: string;
  label: string;
  value: string | number;
  sub?: string;
  accent?: "blue" | "green" | "yellow" | "red" | "purple";
  trend?: "good" | "bad" | "neutral";
}

const ACCENT_COLORS: Record<string, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#f59e0b",
  red: "#ef4444",
  purple: "#a855f7",
};

export default function StatCard({ icon, label, value, sub, accent = "blue", trend }: StatCardProps) {
  const color = ACCENT_COLORS[accent];
  return (
    <div className="card p-5 flex flex-col gap-3 animate-fade-in">
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
    </div>
  );
}
