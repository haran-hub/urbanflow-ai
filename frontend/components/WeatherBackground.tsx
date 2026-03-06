"use client";
import { useMemo } from "react";
import type { WeatherCondition } from "@/lib/weather-themes";

interface Props {
  condition: WeatherCondition;
  particleColor: string;
  particleOpacity: number;
  glowColor: string;
}

// Deterministic pseudo-random from index (no Math.random() on every render)
function det(i: number, mod: number, offset = 0) {
  return ((i * 2654435761 + offset) >>> 0) % mod;
}

export default function WeatherBackground({
  condition,
  particleColor,
  particleOpacity,
  glowColor,
}: Props) {
  const particles = useMemo(() => {
    const list: React.CSSProperties[] = [];

    if (condition === "rainy" || condition === "drizzle" || condition === "stormy") {
      const count = condition === "stormy" ? 45 : condition === "rainy" ? 30 : 16;
      for (let i = 0; i < count; i++) {
        list.push({
          position: "absolute",
          left: `${det(i, 100, 3)}%`,
          top: `-${det(i, 40, 7) + 10}px`,
          width: "1px",
          height: `${det(i, 16, 11) + 10}px`,
          background: `linear-gradient(transparent, ${particleColor})`,
          opacity: (particleOpacity * (0.5 + det(i, 5, 17) * 0.1)),
          animation: `wxRain ${(det(i, 6, 23) * 0.15 + 0.55).toFixed(2)}s linear -${(det(i, 20, 31) * 0.1).toFixed(1)}s infinite`,
        });
      }
    } else if (condition === "snowy") {
      for (let i = 0; i < 35; i++) {
        const size = det(i, 3, 5) + 2;
        list.push({
          position: "absolute",
          left: `${det(i, 100, 7)}%`,
          top: `-${det(i, 20, 13) + 5}px`,
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          background: particleColor,
          opacity: particleOpacity * (0.5 + det(i, 5, 19) * 0.1),
          animation: `wxSnow ${(det(i, 10, 29) * 0.4 + 5).toFixed(1)}s linear -${(det(i, 40, 37) * 0.25).toFixed(1)}s infinite`,
        });
      }
    } else if (condition === "clear-night" || condition === "partly-cloudy-night") {
      for (let i = 0; i < 70; i++) {
        const size = det(i, 2, 3) === 0 ? 2 : 1;
        list.push({
          position: "absolute",
          left: `${det(i, 100, 11)}%`,
          top: `${det(i, 70, 17)}%`,
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          background: particleColor,
          opacity: particleOpacity * (0.3 + det(i, 7, 23) * 0.1),
          animation: `wxStars ${(det(i, 8, 41) * 0.3 + 2).toFixed(1)}s ease-in-out -${(det(i, 30, 53) * 0.2).toFixed(1)}s infinite alternate`,
        });
      }
    } else if (condition === "windy") {
      for (let i = 0; i < 12; i++) {
        list.push({
          position: "absolute",
          left: `-5%`,
          top: `${det(i, 80, 7) + 5}%`,
          width: `${det(i, 120, 11) + 60}px`,
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${particleColor}, transparent)`,
          opacity: particleOpacity * (0.4 + det(i, 6, 19) * 0.1),
          animation: `wxWind ${(det(i, 5, 23) * 0.3 + 1.5).toFixed(1)}s ease-in-out -${(det(i, 20, 31) * 0.15).toFixed(1)}s infinite`,
        });
      }
    }

    return list;
  }, [condition, particleColor, particleOpacity]);

  const isFoggy = condition === "foggy";
  const isClearDay = condition === "clear-day";
  const isStormy = condition === "stormy";
  const isOvercast = condition === "overcast";
  const isPartlyCloudy = condition === "partly-cloudy-day" || condition === "partly-cloudy-night";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 45,
        overflow: "hidden",
      }}
    >
      {/* Ambient glow at top — taller so it's visible on normal pages */}
      {glowColor !== "transparent" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "80%",
            height: "280px",
            background: `radial-gradient(ellipse at 50% 0%, ${glowColor} 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Sunny day warm glow blob */}
      {isClearDay && (
        <div
          style={{
            position: "absolute",
            top: "-60px",
            right: "10%",
            width: "500px",
            height: "500px",
            background: `radial-gradient(circle, rgba(251,191,36,0.04) 0%, transparent 70%)`,
            animation: "wxSunPulse 6s ease-in-out infinite alternate",
          }}
        />
      )}

      {/* Overcast — slow drifting grey bands */}
      {isOvercast && [0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "-30%",
            top: `${10 + i * 30}%`,
            width: "160%",
            height: "120px",
            background: `linear-gradient(90deg, transparent, rgba(148,163,184,0.035), transparent)`,
            filter: "blur(40px)",
            animation: `wxFog ${12 + i * 5}s ease-in-out -${i * 4}s infinite alternate`,
          }}
        />
      ))}

      {/* Partly cloudy — subtle cloud wisps */}
      {isPartlyCloudy && [0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "-20%",
            top: `${8 + i * 35}%`,
            width: "140%",
            height: "90px",
            background: `linear-gradient(90deg, transparent, ${particleColor.replace(")", ", 0.03)").replace("rgb", "rgba")}, transparent)`,
            filter: "blur(35px)",
            animation: `wxFog ${10 + i * 6}s ease-in-out -${i * 3}s infinite alternate`,
          }}
        />
      ))}

      {/* Fog bands */}
      {isFoggy && [0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "-20%",
            top: `${20 + i * 28}%`,
            width: "140%",
            height: "100px",
            background: `linear-gradient(90deg, transparent, rgba(229,231,235,0.022), transparent)`,
            filter: "blur(30px)",
            animation: `wxFog ${7 + i * 4}s ease-in-out -${i * 3}s infinite alternate`,
          }}
        />
      ))}

      {/* Storm lightning flash */}
      {isStormy && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            animation: "wxLightning 9s ease-in-out 2s infinite",
          }}
        />
      )}

      {/* Particles (rain / snow / stars / wind) */}
      {particles.map((style, i) => (
        <div key={i} style={style} />
      ))}
    </div>
  );
}
