interface OccupancyBarProps {
  pct: number; // 0-100
  showLabel?: boolean;
}

export default function OccupancyBar({ pct, showLabel = true }: OccupancyBarProps) {
  const color = pct < 50 ? "#22c55e" : pct < 80 ? "#f59e0b" : "#ef4444";
  const label = pct < 50 ? "Available" : pct < 80 ? "Busy" : "Full";

  return (
    <div className="flex items-center gap-2">
      <div className="progress-bar flex-1">
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium w-16 shrink-0" style={{ color }}>
          {pct.toFixed(0)}% {label}
        </span>
      )}
    </div>
  );
}
