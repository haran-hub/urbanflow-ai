"use client";
import { useEffect, useRef, useState } from "react";

export type SectionKey =
  | "parking" | "ev" | "transit" | "services"
  | "air" | "bikes" | "food_trucks" | "noise";

const SECTIONS: { key: SectionKey; label: string; icon: string }[] = [
  { key: "parking",     label: "Parking",       icon: "🅿" },
  { key: "ev",          label: "EV Charging",   icon: "⚡" },
  { key: "transit",     label: "Transit",       icon: "🚇" },
  { key: "services",    label: "Services",      icon: "🏛" },
  { key: "air",         label: "Air Quality",   icon: "🌬" },
  { key: "bikes",       label: "Bikes",         icon: "🚲" },
  { key: "food_trucks", label: "Food Trucks",   icon: "🚚" },
  { key: "noise",       label: "Noise & Vibe",  icon: "🎵" },
];

const STORAGE_KEY = "urbanflow-dashboard-prefs";

function loadPrefs(): Set<SectionKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { pinnedSections: SectionKey[] };
      return new Set(parsed.pinnedSections);
    }
  } catch {}
  return new Set(SECTIONS.map((s) => s.key));
}

function savePrefs(enabled: Set<SectionKey>) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ pinnedSections: Array.from(enabled) })
  );
}

interface Props {
  enabled: Set<SectionKey>;
  onChange: (enabled: Set<SectionKey>) => void;
}

export function useDashboardPrefs(): [Set<SectionKey>, (e: Set<SectionKey>) => void] {
  const [enabled, setEnabled] = useState<Set<SectionKey>>(
    () => new Set(SECTIONS.map((s) => s.key))
  );

  useEffect(() => {
    setEnabled(loadPrefs());
  }, []);

  function onChange(next: Set<SectionKey>) {
    setEnabled(next);
    savePrefs(next);
  }

  return [enabled, onChange];
}

export default function DashboardPrefs({ enabled, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(key: SectionKey) {
    const next = new Set(enabled);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  }

  return (
    <div style={{ position: "relative" }} ref={drawerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Customize dashboard sections"
        className="flex items-center justify-center rounded-xl transition-all"
        style={{
          width: 36,
          height: 36,
          background: open ? "rgba(59,130,246,0.15)" : "var(--card)",
          border: `1px solid ${open ? "rgba(59,130,246,0.4)" : "var(--border)"}`,
          color: open ? "var(--accent)" : "var(--muted)",
          fontSize: 16,
        }}
      >
        ⚙
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 rounded-2xl p-4 z-50"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            width: 240,
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          }}
        >
          <p
            className="text-xs font-bold mb-3 tracking-widest"
            style={{ color: "var(--muted)" }}
          >
            SHOW SECTIONS
          </p>
          <div className="flex flex-col gap-2">
            {SECTIONS.map((s) => {
              const on = enabled.has(s.key);
              return (
                <button
                  key={s.key}
                  onClick={() => toggle(s.key)}
                  className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm transition-all"
                  style={{
                    background: on ? "rgba(59,130,246,0.08)" : "transparent",
                    border: `1px solid ${on ? "rgba(59,130,246,0.25)" : "transparent"}`,
                    color: on ? "var(--text)" : "var(--muted)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </span>
                  <span
                    className="w-8 h-4 rounded-full relative transition-all"
                    style={{ background: on ? "var(--accent)" : "rgba(255,255,255,0.1)" }}
                  >
                    <span
                      className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                      style={{
                        background: "#fff",
                        left: on ? "calc(100% - 14px)" : "2px",
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onChange(new Set(SECTIONS.map((s) => s.key)))}
            className="text-xs mt-3 w-full text-center"
            style={{ color: "var(--muted)" }}
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
