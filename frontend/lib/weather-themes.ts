export type WeatherCondition =
  | "clear-day"
  | "clear-night"
  | "partly-cloudy-day"
  | "partly-cloudy-night"
  | "overcast"
  | "foggy"
  | "drizzle"
  | "rainy"
  | "stormy"
  | "snowy"
  | "windy";

export interface WeatherData {
  condition: WeatherCondition;
  temp_c: number;
  wind_kph: number;
  description: string;
  icon: string;
}

export interface WeatherTheme {
  bg: string;
  card: string;
  card2: string;
  border: string;
  accent: string;
  accentGlow: string;
  muted: string;
  gradientBar: string;
  particleColor: string;
  particleOpacity: number;
  glowColor: string;
  label: string;
}

const THEMES: Record<WeatherCondition, WeatherTheme> = {
  "clear-day": {
    bg: "#0d0a05",
    card: "#181205",
    card2: "#1e1608",
    border: "#2e200a",
    accent: "#f59e0b",
    accentGlow: "rgba(245,158,11,0.15)",
    muted: "#8a7050",
    gradientBar: "linear-gradient(90deg, #f59e0b, #f97316, #ef4444)",
    particleColor: "#fde68a",
    particleOpacity: 0.12,
    glowColor: "rgba(251,191,36,0.08)",
    label: "Sunny",
  },
  "clear-night": {
    bg: "#060810",
    card: "#0a0c1a",
    card2: "#0d1020",
    border: "#161c30",
    accent: "#818cf8",
    accentGlow: "rgba(129,140,248,0.15)",
    muted: "#5a6080",
    gradientBar: "linear-gradient(90deg, #4f46e5, #818cf8, #c084fc)",
    particleColor: "#e2e8f0",
    particleOpacity: 0.85,
    glowColor: "rgba(129,140,248,0.05)",
    label: "Clear Night",
  },
  "partly-cloudy-day": {
    bg: "#090a0f",
    card: "#111318",
    card2: "#161820",
    border: "#1e2230",
    accent: "#60a5fa",
    accentGlow: "rgba(96,165,250,0.15)",
    muted: "#5a6070",
    gradientBar: "linear-gradient(90deg, #60a5fa, #818cf8, #a78bfa)",
    particleColor: "#bfdbfe",
    particleOpacity: 0.08,
    glowColor: "rgba(96,165,250,0.04)",
    label: "Partly Cloudy",
  },
  "partly-cloudy-night": {
    bg: "#07080e",
    card: "#0e1018",
    card2: "#121520",
    border: "#181e2e",
    accent: "#6366f1",
    accentGlow: "rgba(99,102,241,0.15)",
    muted: "#4a5068",
    gradientBar: "linear-gradient(90deg, #4338ca, #6366f1, #818cf8)",
    particleColor: "#c7d2fe",
    particleOpacity: 0.55,
    glowColor: "rgba(99,102,241,0.04)",
    label: "Cloudy Night",
  },
  overcast: {
    bg: "#090a0d",
    card: "#111215",
    card2: "#16171c",
    border: "#1e2025",
    accent: "#94a3b8",
    accentGlow: "rgba(148,163,184,0.12)",
    muted: "#525870",
    gradientBar: "linear-gradient(90deg, #475569, #64748b, #94a3b8)",
    particleColor: "#94a3b8",
    particleOpacity: 0.04,
    glowColor: "transparent",
    label: "Overcast",
  },
  foggy: {
    bg: "#0b0c10",
    card: "#131418",
    card2: "#18191e",
    border: "#20222a",
    accent: "#9ca3af",
    accentGlow: "rgba(156,163,175,0.12)",
    muted: "#525870",
    gradientBar: "linear-gradient(90deg, #6b7280, #9ca3af, #d1d5db)",
    particleColor: "#e5e7eb",
    particleOpacity: 0.07,
    glowColor: "rgba(156,163,175,0.03)",
    label: "Foggy",
  },
  drizzle: {
    bg: "#080d12",
    card: "#0e1520",
    card2: "#121c28",
    border: "#1a2535",
    accent: "#7dd3fc",
    accentGlow: "rgba(125,211,252,0.15)",
    muted: "#4a6070",
    gradientBar: "linear-gradient(90deg, #0ea5e9, #7dd3fc, #38bdf8)",
    particleColor: "#7dd3fc",
    particleOpacity: 0.07,
    glowColor: "rgba(125,211,252,0.04)",
    label: "Drizzle",
  },
  rainy: {
    bg: "#060c14",
    card: "#0a1220",
    card2: "#0e1828",
    border: "#162035",
    accent: "#3b82f6",
    accentGlow: "rgba(59,130,246,0.15)",
    muted: "#3a5070",
    gradientBar: "linear-gradient(90deg, #1d4ed8, #3b82f6, #0ea5e9)",
    particleColor: "#60a5fa",
    particleOpacity: 0.09,
    glowColor: "rgba(59,130,246,0.05)",
    label: "Rainy",
  },
  stormy: {
    bg: "#050508",
    card: "#08080f",
    card2: "#0c0c16",
    border: "#141425",
    accent: "#a855f7",
    accentGlow: "rgba(168,85,247,0.15)",
    muted: "#3a3060",
    gradientBar: "linear-gradient(90deg, #7c3aed, #a855f7, #ec4899)",
    particleColor: "#c084fc",
    particleOpacity: 0.11,
    glowColor: "rgba(168,85,247,0.07)",
    label: "Thunderstorm",
  },
  snowy: {
    bg: "#080c14",
    card: "#0e1420",
    card2: "#131a28",
    border: "#1e2a3c",
    accent: "#7dd3fc",
    accentGlow: "rgba(125,211,252,0.15)",
    muted: "#4a6080",
    gradientBar: "linear-gradient(90deg, #bae6fd, #7dd3fc, #e0f2fe)",
    particleColor: "#f0f9ff",
    particleOpacity: 0.9,
    glowColor: "rgba(186,230,253,0.04)",
    label: "Snowy",
  },
  windy: {
    bg: "#07090e",
    card: "#0e1118",
    card2: "#131820",
    border: "#1c2535",
    accent: "#2dd4bf",
    accentGlow: "rgba(45,212,191,0.15)",
    muted: "#3a5560",
    gradientBar: "linear-gradient(90deg, #0d9488, #2dd4bf, #22d3ee)",
    particleColor: "#5eead4",
    particleOpacity: 0.09,
    glowColor: "rgba(45,212,191,0.04)",
    label: "Windy",
  },
};

export function getTheme(condition: WeatherCondition): WeatherTheme {
  return THEMES[condition];
}

export function parseWeatherCode(
  code: number,
  isDay: boolean,
  windKph: number
): WeatherCondition {
  if (windKph > 45 && code < 20) return "windy";
  if (code === 0) return isDay ? "clear-day" : "clear-night";
  if (code <= 2) return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
  if (code === 3) return "overcast";
  if (code <= 48) return "foggy";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rainy";
  if (code <= 77) return "snowy";
  if (code <= 82) return "rainy";
  if (code <= 86) return "snowy";
  if (code >= 95) return "stormy";
  return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
}

export function getWeatherIcon(condition: WeatherCondition): string {
  const icons: Record<WeatherCondition, string> = {
    "clear-day": "☀️",
    "clear-night": "🌙",
    "partly-cloudy-day": "⛅",
    "partly-cloudy-night": "🌤",
    overcast: "☁️",
    foggy: "🌫️",
    drizzle: "🌦️",
    rainy: "🌧️",
    stormy: "⛈️",
    snowy: "❄️",
    windy: "💨",
  };
  return icons[condition] ?? "🌤";
}

export function getWeatherDescription(code: number, isDay: boolean): string {
  const d: Record<number, string> = {
    0: isDay ? "Clear sky" : "Clear night",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Icy fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snowfall",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm + hail",
    99: "Heavy thunderstorm",
  };
  return d[code] ?? "Variable";
}
