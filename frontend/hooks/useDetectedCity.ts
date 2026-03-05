"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY  = "urbanflow_city";       // current city value
const MANUAL_KEY   = "urbanflow_city_manual"; // set only on explicit user selection

const SUPPORTED_CITIES = ["San Francisco", "New York", "Austin"] as const;
type City = (typeof SUPPORTED_CITIES)[number];

const CITY_CENTERS: Record<City, { lat: number; lng: number }> = {
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  "New York":      { lat: 40.7128, lng: -74.006 },
  "Austin":        { lat: 30.2672, lng: -97.7431 },
};

function nearestCity(lat: number, lng: number): City {
  let best: City = "San Francisco";
  let bestDist = Infinity;
  for (const [city, center] of Object.entries(CITY_CENTERS) as [City, { lat: number; lng: number }][]) {
    const d = Math.hypot(lat - center.lat, lng - center.lng);
    if (d < bestDist) { bestDist = d; best = city; }
  }
  return best;
}

/** Returns the manually-saved city, or null if city was auto-detected (not user-chosen). */
function readManual(): string | null {
  if (typeof window === "undefined") return null;
  if (!localStorage.getItem(MANUAL_KEY)) return null;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && SUPPORTED_CITIES.includes(saved as City) ? saved : null;
}

/**
 * Returns the best city for the current user.
 * Priority: urlCity param > manual localStorage > geolocation > "San Francisco"
 *
 * Only manual city selections (via setCity) are persisted across sessions.
 * Geolocation runs every visit if no manual preference — so location stays fresh.
 */
export function useDetectedCity(urlCity?: string | null) {
  const [city, setCityState] = useState<string>(() => {
    if (urlCity) return urlCity;
    return readManual() ?? "San Francisco";
  });

  useEffect(() => {
    if (urlCity) {
      setCityState(urlCity);
      return;
    }

    // If the user explicitly chose a city, always respect it
    if (readManual()) return;

    // No manual preference — try geolocation every visit
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const detected = nearestCity(coords.latitude, coords.longitude);
        // Store value but NOT the manual flag — so geolocation re-runs next visit
        localStorage.setItem(STORAGE_KEY, detected);
        setCityState(detected);
      },
      () => { /* permission denied or timeout — keep default */ },
      { timeout: 6000, maximumAge: 30_000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCity]);

  /** Call this when the user explicitly picks a city from the UI. */
  const setCity = (c: string) => {
    localStorage.setItem(STORAGE_KEY, c);
    localStorage.setItem(MANUAL_KEY, "1"); // marks as manual — geolocation won't override
    setCityState(c);
  };

  return { city, setCity };
}
