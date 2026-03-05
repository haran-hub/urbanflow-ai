"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY  = "urbanflow_city";        // manual city selected by user
const MANUAL_KEY   = "urbanflow_city_manual"; // flag — set only on explicit user pick
const DETECTED_KEY = "urbanflow_city_auto";   // last auto-detected city (no permission required)

const SUPPORTED_CITIES = ["San Francisco", "New York", "Austin"] as const;
type City = (typeof SUPPORTED_CITIES)[number];

const CITY_CENTERS: Record<City, { lat: number; lng: number }> = {
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  "New York":      { lat: 40.7128, lng: -74.006  },
  "Austin":        { lat: 30.2672, lng: -97.7431  },
};

function nearestCity(lat: number, lng: number): City {
  let best: City = "San Francisco";
  let bestDist = Infinity;
  for (const [city, c] of Object.entries(CITY_CENTERS) as [City, { lat: number; lng: number }][]) {
    const d = Math.hypot(lat - c.lat, lng - c.lng);
    if (d < bestDist) { bestDist = d; best = city; }
  }
  return best;
}

function readManual(): string | null {
  if (typeof window === "undefined") return null;
  if (!localStorage.getItem(MANUAL_KEY)) return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v && SUPPORTED_CITIES.includes(v as City) ? v : null;
}

function readAutoDetected(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(DETECTED_KEY);
  return v && SUPPORTED_CITIES.includes(v as City) ? v : null;
}

function saveDetected(city: City) {
  localStorage.setItem(DETECTED_KEY, city);
}

/** Try IP-based geolocation — no permission prompt, works even when GPS is denied. */
async function detectFromIP(): Promise<City | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const { latitude, longitude } = await res.json();
    if (typeof latitude === "number" && typeof longitude === "number") {
      return nearestCity(latitude, longitude);
    }
  } catch {
    // network error or timeout — fail silently
  }
  return null;
}

/**
 * Returns the best city for the current user.
 *
 * Priority:
 *   1. URL param (e.g. ?city=Austin)
 *   2. Manual localStorage pick (user explicitly chose from the dropdown)
 *   3. Last auto-detected city (cached from a previous session)
 *   4. Browser GPS geolocation (updates immediately if allowed)
 *   5. IP-based geolocation (silent fallback — no permission needed)
 *   6. "San Francisco" (absolute last resort)
 *
 * Only step 2 (explicit user pick) sets MANUAL_KEY and persists across sessions
 * as a true preference. All other detection runs fresh every visit.
 */
export function useDetectedCity(urlCity?: string | null) {
  const [city, setCityState] = useState<string>(() => {
    if (urlCity) return urlCity;
    // Show last known auto-detected city immediately (no SF flash on return visits)
    return readManual() ?? readAutoDetected() ?? "San Francisco";
  });

  useEffect(() => {
    if (urlCity) {
      setCityState(urlCity);
      return;
    }

    // Respect an explicit user choice — don't override
    if (readManual()) return;

    // Try browser GPS first (fast & accurate when allowed)
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const detected = nearestCity(coords.latitude, coords.longitude);
          saveDetected(detected);
          setCityState(detected);
        },
        async () => {
          // GPS denied or unavailable → fall back to IP geolocation silently
          const detected = await detectFromIP();
          if (detected) {
            saveDetected(detected);
            setCityState(detected);
          }
        },
        { timeout: 6000, maximumAge: 60_000 },
      );
    } else {
      // No GPS API at all → go straight to IP detection
      detectFromIP().then((detected) => {
        if (detected) {
          saveDetected(detected);
          setCityState(detected);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCity]);

  /** Call this when the user explicitly picks a city from the dropdown. */
  const setCity = (c: string) => {
    localStorage.setItem(STORAGE_KEY, c);
    localStorage.setItem(MANUAL_KEY, "1");
    setCityState(c);
  };

  return { city, setCity };
}
