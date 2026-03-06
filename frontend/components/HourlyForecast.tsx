"use client";
import { useMemo } from "react";
import { getHourlySlice, busyColor, busyLabel, type HourlyDomain } from "@/lib/hourly-patterns";

const DOMAIN_LABEL: Record<HourlyDomain, string> = {
  parking: "Parking demand",
  ev: "EV charging demand",
  transit: "Transit crowd",
};

interface Props {
  domain: HourlyDomain;
  city: string;
  cityTz: string;          // e.g. "America/Chicago"
}

function getCityHour(tz: string): number {
  const str = new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false });
  return parseInt(str, 10) % 24;
}

function fmt12(h: number): string {
  if (h === 0)  return "12a";
  if (h < 12)   return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

const CITY_TZ: Record<string, string> = {
  "San Francisco": "America/Los_Angeles",
  "New York":      "America/New_York",
  "Austin":        "America/Chicago",
};

export default function HourlyForecast({ domain, city }: Props) {
  const tz   = CITY_TZ[city] ?? "America/Chicago";
  const now  = getCityHour(tz);
  const bars = useMemo(() => getHourlySlice(domain, now, 16), [domain, now]);

  const MAX_H = 40; // bar max height px

  return (
    <div className="rounded-xl p-4 mb-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
          Popular Times — {DOMAIN_LABEL[domain]}
        </span>
        <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}>
          Today's forecast
        </span>
      </div>

      <div className="flex items-end gap-1" style={{ height: MAX_H + 20 }}>
        {bars.map(({ hour, value }, i) => {
          const isCurrent = i === 0;
          const color = busyColor(value);
          const barH = Math.max(4, Math.round((value / 100) * MAX_H));
          return (
            <div key={hour} className="flex flex-col items-center flex-1 gap-1">
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: barH,
                  background: isCurrent ? color : `${color}60`,
                  outline: isCurrent ? `2px solid ${color}` : "none",
                  outlineOffset: 1,
                }}
                title={`${fmt12(hour)}: ${busyLabel(value)}`}
              />
              {i % 2 === 0 && (
                <span className="text-[9px]" style={{ color: isCurrent ? "var(--text)" : "var(--muted)" }}>
                  {fmt12(hour)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {[["Quiet", "#22c55e"], ["Moderate", "#84cc16"], ["Busy", "#f59e0b"], ["Peak", "#ef4444"]].map(([label, color]) => (
          <span key={label} className="flex items-center gap-1 text-[10px]" style={{ color: "var(--muted)" }}>
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="text-[10px] ml-auto" style={{ color: "var(--muted)" }}>
          Highlighted bar = now ({fmt12(now)})
        </span>
      </div>
    </div>
  );
}
