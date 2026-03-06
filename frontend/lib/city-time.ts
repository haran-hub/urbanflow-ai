export const CITY_TIMEZONES: Record<string, string> = {
  "San Francisco": "America/Los_Angeles",
  "New York": "America/New_York",
  "Austin": "America/Chicago",
};

function _formatInTz(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  // en-CA gives "YYYY-MM-DD, HH:MM"
  const str = fmt.format(d);
  // Normalize: some browsers return "YYYY-MM-DD, HH:MM", others "YYYY-MM-DDTHH:MM"
  return str.replace(", ", "T").replace(/ /g, "T");
}

/**
 * Returns current city time (+ optional hour offset) as "YYYY-MM-DDTHH:MM" for
 * datetime-local inputs. offsetHours defaults to 0.
 */
export function nowInCityIso(city: string, offsetHours = 0): string {
  const tz = CITY_TIMEZONES[city] ?? "America/Chicago";
  const d = new Date(Date.now() + offsetHours * 3_600_000);
  return _formatInTz(d, tz);
}

/**
 * Formats a UTC ISO string (or Date) as "H:MM AM/PM" in the city's timezone.
 */
export function formatCityTime(isoOrDate: string | Date, city: string): string {
  const tz = CITY_TIMEZONES[city] ?? "America/Chicago";
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}

/**
 * Returns the current time in the city formatted as "H:MM AM/PM".
 */
export function cityNowString(city: string): string {
  return formatCityTime(new Date(), city);
}

/**
 * Returns a short label like "10:34 PM CST" for the city.
 */
export function cityNowFull(city: string): string {
  const tz = CITY_TIMEZONES[city] ?? "America/Chicago";
  return new Date().toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
