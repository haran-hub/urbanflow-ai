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
    // Simple Euclidean distance — good enough for city-level matching
    const d = Math.hypot(lat - center.lat, lng - center.lng);
    if (d < bestDist) { bestDist = d; best = city; }
  }
  return best;
}

/**
 * Returns the best city for the current user.
 * Priority: urlCity param > localStorage saved preference > geolocation > "San Francisco"
 *
 * setCity() persists the choice to localStorage.
 */
export function useDetectedCity(urlCity?: string | null) {
  const [city, setCityState] = useState<string>(urlCity || "San Francisco");

  useEffect(() => {
    // URL param always wins — save it and stop
    if (urlCity) {
      localStorage.setItem(STORAGE_KEY, urlCity);
      setCityState(urlCity);
      return;
    }

    // Saved preference wins over geolocation
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_CITIES.includes(saved as City)) {
      setCityState(saved);
      return;
    }

    // Auto-detect via geolocation
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
