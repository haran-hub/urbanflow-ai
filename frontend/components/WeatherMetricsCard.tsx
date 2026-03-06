"use client";
import { useWeatherTheme } from "@/hooks/useWeatherTheme";
import type { WeatherData } from "@/lib/weather-themes";

type Context = "air" | "bikes" | "food" | "vibe";

interface Props {
  city: string;
  context: Context;
}

function getInsight(wx: WeatherData, ctx: Context): string {
  const feels = wx.feels_like_c ?? wx.temp_c;
  const rain = wx.precipitation_mm ?? 0;
  const gusts = wx.wind_gusts_kph ?? wx.wind_kph;
  const hum = wx.humidity ?? 50;

  if (ctx === "air") {
    if (rain > 1) return "Rain is washing particulates out of the air — AQI typically drops during showers.";
    if (gusts > 40) return "Strong gusts dispersing pollutants — air quality is likely better than baseline.";
    if (hum > 75) return "High humidity traps fine particles near ground level.";
    return "Stable conditions. Monitor AQI before heading out.";
  }
  if (ctx === "bikes") {
    if (rain > 0.5) return "Light rain — roads may be slippery. Ride carefully or consider transit.";
    if (gusts > 30) return "Gusty winds can affect balance. Stick to sheltered routes.";
    if (feels < 5) return "Very cold outside. Layer up or consider transit as an alternative.";
    if (feels > 35) return "Heat advisory — ride during cooler morning or evening hours.";
    return "Good cycling conditions right now. Grab a bike and go!";
  }
  if (ctx === "food") {
    if (rain > 1) return "Rain keeping crowds away — expect shorter lines, but some trucks may close early.";
    if (feels < 8) return "Cold weather means fewer outdoor diners — shorter waits but limited seating.";
    if (feels > 32) return "Scorching heat — look for shaded trucks or those with indoor queuing.";
    if (wx.condition === "clear-day") return "Beautiful weather driving foot traffic — popular trucks may have longer queues.";
    return "Moderate outdoor dining conditions. Check if your truck has covered seating.";
  }
  // vibe
  if (rain > 2) return "Heavy rain dampening outdoor activity — expect quieter streets.";
  if (wx.condition === "clear-day" && feels >= 18 && feels <= 28) return "Perfect weather boosting outdoor vibes — expect lively streets tonight.";
  if (gusts > 35) return "Strong winds driving crowds indoors — energy shifts to bars and venues.";
  if (wx.condition === "stormy") return "Storm conditions — outdoor zones quiet. Indoor venues are where the energy is.";
  return "Comfortable conditions for outdoor activity tonight.";
}

export default function WeatherMetricsCard({ city, context }: Props) {
  const { weather } = useWeatherTheme(city);
  if (!weather) return null;

  const feels = weather.feels_like_c ?? weather.temp_c;
  const rain = weather.precipitation_mm ?? 0;
  const gusts = weather.wind_gusts_kph ?? weather.wind_kph;
  const hum = weather.humidity ?? 50;
  const insight = getInsight(weather, context);

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 rounded-lg mt-4"
      style={{ background: "var(--card2)", borderTop: "1px solid var(--border)" }}
    >
      {/* Condition + temp */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-sm">{weather.icon}</span>
        <span className="text-xs font-medium" style={{ color: "var(--text)" }}>{weather.description}</span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {Math.round(weather.temp_c)}°C
          {Math.round(feels) !== Math.round(weather.temp_c) && ` · feels ${Math.round(feels)}°`}
        </span>
      </div>

      <span className="text-xs hidden sm:block" style={{ color: "var(--border)" }}>|</span>

      {/* Metrics inline */}
      <div className="flex items-center gap-3 text-xs shrink-0" style={{ color: "var(--muted)" }}>
        <span>💧 {Math.round(hum)}%</span>
        <span>💨 {Math.round(weather.wind_kph)} kph</span>
        {gusts > weather.wind_kph + 5 && <span>🌬 {Math.round(gusts)} gusts</span>}
        {rain > 0 && <span>🌧 {rain.toFixed(1)} mm</span>}
      </div>

      <span className="text-xs hidden md:block" style={{ color: "var(--border)" }}>—</span>

      {/* Insight */}
      <p className="text-xs min-w-0" style={{ color: "var(--muted)" }}>{insight}</p>
    </div>
  );
}
