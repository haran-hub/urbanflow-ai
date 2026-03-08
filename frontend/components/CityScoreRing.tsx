"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  score: number | null;
  label?: string;
  color?: string;
  size?: number;
}

const LABEL_MAP: Record<string, string> = {
  Excellent: "Excellent",
  Good: "Good",
  Fair: "Fair",
  Poor: "Poor",
};

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

function scoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

export default function CityScoreRing({ score, label, color, size = 120 }: Props) {
  const [displayed, setDisplayed] = useState(0);
  const animRef = useRef<ReturnType<typeof requestAnimationFrame>>();

  useEffect(() => {
    if (score === null) return;
    const target = score;
    const start = Date.now();
    const duration = 900;

    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * target));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    }

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [score]);

  const r = (size / 2) * 0.75;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeWidth = size * 0.09;

  const resolvedColor = color ?? (score !== null ? scoreColor(score) : "#3b82f6");
  const resolvedLabel = label ?? (score !== null ? scoreLabel(score) : "Loading…");
  const fraction = score !== null ? score / 100 : 0;
  const dashOffset = circumference * (1 - fraction);

  return (
    <div className="flex flex-col items-center gap-2">
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{
              filter: `drop-shadow(0 0 8px ${resolvedColor})`,
              transition: "stroke-dashoffset 0.1s linear, stroke 0.5s ease",
            }}
          />
        </svg>
        {/* Center text */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ gap: 2 }}
        >
          <span
            className="font-black leading-none"
            style={{ fontSize: size * 0.28, color: resolvedColor }}
          >
            {score !== null ? displayed : "—"}
          </span>
          <span
            className="font-medium"
            style={{ fontSize: size * 0.09, color: "rgba(255,255,255,0.4)" }}
          >
            / 100
          </span>
        </div>
      </div>
      <div className="text-center">
        <div
          className="text-sm font-bold"
          style={{ color: resolvedColor }}
        >
          {resolvedLabel}
        </div>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          City Pulse Score
        </div>
      </div>
    </div>
  );
}
