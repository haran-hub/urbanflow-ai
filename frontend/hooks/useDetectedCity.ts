"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "urbanflow_city";
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

function readSaved(): string | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && SUPPORTED_CITIES.includes(saved as City) ? saved : null;
}

/**
 * Returns the best city for the current user.
 * Priority: urlCity param > localStorage saved preference > geolocation > "San Francisco"
 *
 * Reads localStorage synchronously on first render to avoid SF→Austin flash.
 */
export function useDetectedCity(urlCity?: string | null) {
  // Initialise synchronously from localStorage so there's no "SF flash"
  // before the useEffect runs — prevents stale fetches with wrong city.
  const [city, setCityState] = useState<string>(() => {
    if (urlCity) return urlCity;
    return readSaved() ?? "San Francisco";
  });

  useEffect(() => {
    // URL param always wins
    if (urlCity) {
      localStorage.setItem(STORAGE_KEY, urlCity);
      setCityState(urlCity);
      return;
    }

    // Saved preference already applied in useState initializer
    const saved = readSaved();
    if (saved) {
      // already set, nothing to do
      return;
    }

    // No saved preference — try geolocation
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const detected = nearestCity(coords.latitude, coords.longitude);
        localStorage.setItem(STORAGE_KEY, detected);
        setCityState(detected);
      },
      () => { /* permission denied — keep default */ },
      { timeout: 5000, maximumAge: 60_000 },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCity]);

  const setCity = (c: string) => {
    localStorage.setItem(STORAGE_KEY, c);
    setCityState(c);
  };

  return { city, setCity };
}
