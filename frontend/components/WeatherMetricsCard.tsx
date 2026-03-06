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
    if (rain > 1) return "Rain is washing particulates out of the air — AQI typically drops 10–20% during showers.";
    if (gusts > 40) return "Strong gusts are dispersing pollutants — air quality is likely better than baseline readings.";
    if (hum > 75) return "High humidity traps fine particles close to ground level — sensitive individuals should limit outdoor exposure.";
    return "Conditions are stable. Monitor AQI before heading out.";
  }

  if (ctx === "bikes") {
    if (rain > 0.5) return "Light rain detected — roads may be slippery. Consider deferring your ride or take it slow.";
    if (gusts > 30) return "Gusty winds can affect balance on two wheels. Stick to sheltered routes today.";
    if (feels < 5) return "Feels very cold outside. Layer up or consider transit as an alternative.";
    if (feels > 35) return "Heat advisory conditions — stay hydrated and ride during cooler morning or evening hours.";
    return "Good cycling conditions right now. Grab a bike and go!";
  }

  if (ctx === "food") {
    if (rain > 1) return "Rain is keeping crowds away — expect shorter lines at food trucks. Many may close early.";
    if (feels < 8) return "Cold weather means fewer outdoor diners — food trucks may have shorter waits but limited seating.";
    if (feels > 32) return "Scorching heat — look for shaded trucks or those with indoor queuing areas.";
    if (wx.condition === "clear-day") return "Beautiful weather driving outdoor foot traffic — popular trucks may have longer queues today.";
    return "Outdoor dining conditions are moderate. Check if your truck has covered seating.";
  }

  // vibe / noise
  if (rain > 2) return "Heavy rain is dampening outdoor activity — expect quieter streets and lower crowd energy.";
  if (wx.condition === "clear-day" && feels >= 18 && feels <= 28) return "Perfect evening weather is boosting outdoor vibes — expect lively streets and great energy.";
  if (gusts > 35) return "Strong winds may drive crowds indoors, shifting the vibe from streets to bars and venues.";
  if (wx.condition === "stormy") return "Storm conditions — outdoor zones will be quiet. Indoor venues are where the energy is.";
  return "Comfortable conditions for outdoor activity. Vibe levels are weather-neutral tonight.";
}

function MetricPill({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg" style={{ background: "var(--card2)", border: "1px solid var(--border)" }}>
      <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        {value}<span className="text-xs font-normal" style={{ color: "var(--muted)" }}>{unit}</span>
      </span>
    </div>
  );
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
      className="rounded-xl mb-6 p-4 animate-fade-in"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{weather.icon}</span>
          <div>
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {weather.description}
            </span>
            <span className="text-xs ml-2" style={{ color: "var(--muted)" }}>
              {Math.round(weather.temp_c)}°C
              {feels !== weather.temp_c && ` · feels ${Math.round(feels)}°C`}
            </span>
          </div>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
          Weather Impact
        </span>
      </div>

      <div className="flex gap-2 flex-wrap mb-3">
        <MetricPill label="Humidity" value={Math.round(hum)} unit="%" />
        <MetricPill label="Wind" value={Math.round(weather.wind_kph)} unit=" kph" />
        {gusts > weather.wind_kph + 5 && (
          <MetricPill label="Gusts" value={Math.round(gusts)} unit=" kph" />
        )}
        <MetricPill label="Rain" value={rain > 0 ? rain.toFixed(1) : "0"} unit=" mm" />
      </div>

      <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
        {insight}
      </p>
    </div>
  );
}
