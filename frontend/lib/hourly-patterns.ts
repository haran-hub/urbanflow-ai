/**
 * Typical city occupancy/busyness by hour (0–23) for each domain.
 * Index = hour of day. Values = 0–100 busyness level.
 */
export const HOURLY_PATTERNS: Record<string, number[]> = {
  parking: [
    8,  6,  5,  5,  10, 28, 62, 82, 78, 72, 68, 74,
    80, 74, 68, 74, 88, 94, 84, 68, 52, 38, 24, 14,
  ],
  ev: [
    18, 14, 12, 12, 20, 48, 72, 84, 76, 66, 62, 66,
    72, 66, 62, 70, 86, 90, 80, 62, 46, 34, 26, 20,
  ],
  transit: [
    4,  3,  3,  4,  16, 58, 88, 94, 76, 56, 50, 56,
    66, 56, 52, 58, 84, 92, 74, 52, 36, 26, 16,  8,
  ],
};

export type HourlyDomain = keyof typeof HOURLY_PATTERNS;

/** Return the next `count` hours starting from `startHour`, wrapping at 24. */
export function getHourlySlice(domain: HourlyDomain, startHour: number, count = 16) {
  const pattern = HOURLY_PATTERNS[domain];
  return Array.from({ length: count }, (_, i) => {
    const h = (startHour + i) % 24;
    return { hour: h, value: pattern[h] };
  });
}

export function busyLabel(v: number): string {
  if (v < 30) return "Quiet";
  if (v < 55) return "Moderate";
  if (v < 75) return "Busy";
  return "Peak";
}

export function busyColor(v: number): string {
  if (v < 30) return "#22c55e";
  if (v < 55) return "#84cc16";
  if (v < 75) return "#f59e0b";
  return "#ef4444";
}
