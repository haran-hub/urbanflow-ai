"use client";
import { useEffect, useState } from "react";
import { getEvents } from "@/lib/api";

interface CityEvent {
  name: string;
  venue: string;
  date: string;
  time: string;
  url: string;
  impact: string;
  genre: string;
}

const IMPACT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  HIGH: { bg: "rgba(239,68,68,0.15)",  color: "#ef4444", label: "HIGH IMPACT" },
  MED:  { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", label: "MED IMPACT" },
  LOW:  { bg: "rgba(34,197,94,0.12)",  color: "#22c55e", label: "LOW IMPACT" },
};

export default function EventsSurgePanel({ city }: { city: string }) {
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getEvents(city)
      .then((d) => {
        if (cancelled) return;
        setEvents(d.events ?? []);
        setNote(d.note ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [city]);

  if (loading) {
    return (
      <div className="card p-4 animate-pulse" style={{ minHeight: 80 }}>
        <div className="h-4 rounded" style={{ background: "var(--card2)", width: "40%" }} />
      </div>
    );
  }

  if (note || events.length === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🎟</span>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Upcoming Events</h3>
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {note ?? "No upcoming events found for this city."}
          {note && (
            <span> Add a <code className="text-xs px-1 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>TICKETMASTER_API_KEY</code> to enable.</span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🎟</span>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Event Surge Prediction</h3>
        <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>Next 5 events</span>
      </div>
      <div className="flex flex-col gap-2">
        {events.map((ev, i) => {
          const style = IMPACT_STYLE[ev.impact] ?? IMPACT_STYLE.MED;
          return (
            <div
              key={i}
              className="flex items-start justify-between gap-3 px-3 py-2 rounded-xl text-xs"
              style={{ background: "var(--card2)", border: "1px solid var(--border)" }}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold truncate"
                  style={{ color: "var(--text)" }}
                  title={ev.name}
                >
                  {ev.url ? (
                    <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
                      {ev.name}
                    </a>
                  ) : ev.name}
                </p>
                <p className="truncate mt-0.5" style={{ color: "var(--muted)" }}>
                  {ev.venue} · {ev.date}{ev.time ? ` @ ${ev.time.slice(0, 5)}` : ""}
                </p>
                {ev.impact === "HIGH" && (
                  <p className="mt-0.5" style={{ color: "#ef4444" }}>
                    Surge likely — avoid transit 2h before/after
                  </p>
                )}
              </div>
              <span
                className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ background: style.bg, color: style.color }}
              >
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
