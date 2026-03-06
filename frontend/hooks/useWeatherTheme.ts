"use client";
import { useState, useEffect } from "react";
import {
  parseWeatherCode,
  getTheme,
  getWeatherIcon,
  getWeatherDescription,
  type WeatherData,
  type WeatherTheme,
} from "@/lib/weather-themes";

const CITY_COORDS: Record<string, { lat: number; lon: number; tz: string }> = {
  "San Francisco": { lat: 37.77, lon: -122.42, tz: "America/Los_Angeles" },
  "New York":      { lat: 40.71, lon: -74.01,  tz: "America/New_York"    },
  "Austin":        { lat: 30.27, lon: -97.74,  tz: "America/Chicago"     },
};

const _cache: Record<string, { data: WeatherData; at: number }> = {};
const CACHE_MS = 30 * 60 * 1000; // 30 min

function fallbackWeather(): WeatherData {
  const hour = new Date().getHours();
  const isDay = hour >= 6 && hour < 20;
  const condition = isDay ? "partly-cloudy-day" : "clear-night";
  return {
    condition,
    temp_c: 20,
    wind_kph: 10,
    description: isDay ? "Daytime" : "Night",
    icon: getWeatherIcon(condition),
  };
}

export function useWeatherTheme(city: string): {
  weather: WeatherData | null;
  theme: WeatherTheme | null;
} {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const coords = CITY_COORDS[city];
    if (!coords) {
      setWeather(fallbackWeather());
      return;
    }

    // Serve from cache if fresh
    const cached = _cache[city];
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setWeather(cached.data);
      return;
    }

    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${coords.lat}&longitude=${coords.lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,is_day` +
      `&timezone=${coords.tz}&forecast_days=1`;

    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        const c = json.current;
        const code: number = c.weather_code;
        const isDay: boolean = c.is_day === 1;
        const temp_c: number = c.temperature_2m;
        const wind_kph: number = c.wind_speed_10m;

        const condition = parseWeatherCode(code, isDay, wind_kph);
        const data: WeatherData = {
          condition,
          temp_c,
          wind_kph,
          description: getWeatherDescription(code, isDay),
          icon: getWeatherIcon(condition),
        };

        _cache[city] = { data, at: Date.now() };
        setWeather(data);
      })
      .catch(() => {
        setWeather(fallbackWeather());
      });
  }, [city]);

  const theme = weather ? getTheme(weather.condition) : null;
  return { weather, theme };
}
