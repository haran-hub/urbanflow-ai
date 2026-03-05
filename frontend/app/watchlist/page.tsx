"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { getOverview, getAirStations, getEVStations, getParkingZones, getNoiseZones } from "@/lib/api";
import type { WatchlistItem } from "@/lib/types";

const STORAGE_KEY = "urbanflow_watchlist";

const DOMAIN_OPTIONS = [
  { value: "parking",    label: "Parking",      icon: "🅿",  metrics: [{ key: "occupancy_pct", label: "Occupancy %", scale: 100 }] },
  { value: "ev",         label: "EV Charging",  icon: "⚡",  metrics: [{ key: "avg_wait_minutes", label: "Avg Wait (min)", scale: 1 }, { key: "available_ports", label: "Available Ports", scale: 1 }] },
  { value: "air",        label: "Air Quality",  icon: "🌬",  metrics: [{ key: "aqi", label: "AQI", scale: 1 }] },
  { value: "noise",      label: "Noise & Vibe", icon: "🎵",  metrics: [{ key: "vibe_score", label: "Vibe Score", scale: 1 }, { key: "noise_db", label: "Noise dB", scale: 1 }] },
  { value: "transit",    label: "Transit",      icon: "🚇",  metrics: [{ key: "avg_crowd_level", label: "Avg Crowd %", scale: 1 }] },
];

const DOMAIN_ICONS: Record<string, string> = Object.fromEntries(DOMAIN_OPTIONS.map((d) => [d.value, d.icon]));

function readWatchlist(): WatchlistItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveWatchlist(items: WatchlistItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

interface Alert { item: WatchlistItem; current: number; message: string }

function WatchlistContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Add form state
  const [domain, setDomain] = useState("parking");
  const [metric, setMetric] = useState("occupancy_pct");
  const [label, setLabel] = useState("");
  const [threshold, setThreshold] = useState(80);
  const [condition, setCondition] = useState<"above" | "below">("above");

  useEffect(() => { setItems(readWatchlist()); }, []);

  // When domain changes, reset metric to first option
  useEffect(() => {
    const d = DOMAIN_OPTIONS.find((o) => o.value === domain);
    if (d) setMetric(d.metrics[0].key);
  }, [domain]);

  // Check alerts against live data
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;

    async function check() {
      try {
        const [overview, airData, evData, parkingData, noiseData] = await Promise.allSettled([
          getOverview(city),
          getAirStations(city),
          getEVStations(city),
          getParkingZones(city),
          getNoiseZones(city),
        ]);

        const triggered: Alert[] = [];

        for (const item of items) {
          if (item.city !== city) continue;
          let current: number | null = null;

          if (item.domain === "transit" && overview.status === "fulfilled") {
            current = overview.value.transit?.avg_crowd_level ?? null;
          } else if (item.domain === "air" && airData.status === "fulfilled") {
            const st = airData.value.stations[0];
            if (st) current = (st as Record<string, number>)[item.metric] ?? null;
          } else if (item.domain === "ev" && evData.status === "fulfilled") {
            const agg = evData.value.stations;
            if (agg.length) {
              if (item.metric === "avg_wait_minutes") current = agg.reduce((s, x) => s + x.avg_wait_minutes, 0) / agg.length;
              if (item.metric === "available_ports") current = agg.reduce((s, x) => s + x.available_ports, 0);
            }
          } else if (item.domain === "parking" && parkingData.status === "fulfilled") {
            if (parkingData.value.zones.length) {
              const total = parkingData.value.zones.reduce((s, x) => s + x.total_spots, 0);
              const avail = parkingData.value.zones.reduce((s, x) => s + x.available_spots, 0);
              current = total > 0 ? Math.round(((total - avail) / total) * 100) : null;
            }
          } else if (item.domain === "noise" && noiseData.status === "fulfilled") {
            const zones = noiseData.value.zones;
            if (zones.length) {
              if (item.metric === "vibe_score") current = Math.round(zones.reduce((s, x) => s + x.vibe_score, 0) / zones.length);
              if (item.metric === "noise_db") current = Math.round(zones.reduce((s, x) => s + x.noise_db, 0) / zones.length);
            }
          }

          if (current !== null) {
            const triggered_condition = item.condition === "above" ? current > item.threshold : current < item.threshold;
            if (triggered_condition) {
              triggered.push({
                item,
                current: Math.round(current),
                message: `${item.label}: ${current.toFixed(0)} is ${item.condition} ${item.threshold}`,
              });
            }
          }
        }

        if (!cancelled) setAlerts(triggered);
      } catch { /* silent */ }
    }

    check();
    return () => { cancelled = true; };
  }, [items, city]);

  function addItem() {
    if (!label.trim()) return;
    const item: WatchlistItem = {
      id: Math.random().toString(36).slice(2),
      domain, metric, label: label.trim(), threshold, condition, city,
    };
    const updated = [...items, item];
    setItems(updated);
    saveWatchlist(updated);
    setLabel("");
  }

  function removeItem(id: string) {
    const updated = items.filter((i) => i.id !== id);
    setItems(updated);
    saveWatchlist(updated);
  }

  const domainMetrics = DOMAIN_OPTIONS.find((d) => d.value === domain)?.metrics ?? [];
  const cityItems = items.filter((i) => i.city === city);
  const otherItems = items.filter((i) => i.city !== city);

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            🔔 <span style={{ color: "var(--accent)" }}>Personal</span> Watchlist
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Set thresholds — get instant alerts when city conditions cross them
          </p>
        </div>

        {/* Triggered alerts */}
        {alerts.length > 0 && (
          <div className="card p-4 mb-6 flex flex-col gap-2" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-sm font-semibold text-red-400">
                {alerts.length} alert{alerts.length > 1 ? "s" : ""} triggered
              </span>
            </div>
            {alerts.map((a, i) => (
              <div key={i} className="text-sm px-3 py-2 rounded-lg"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--text)" }}>
                <span className="mr-2">{DOMAIN_ICONS[a.item.domain] ?? "⚠"}</span>
                {a.message}
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        <div className="card p-5 mb-6" style={{ background: "var(--card2)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text)" }}>Add Alert</h2>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--muted)" }}>Domain</label>
              <select value={domain} onChange={(e) => setDomain(e.target.value)}
                className="text-xs w-full px-3 py-2 rounded-lg"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}>
                {DOMAIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--muted)" }}>Metric</label>
              <select value={metric} onChange={(e) => setMetric(e.target.value)}
                className="text-xs w-full px-3 py-2 rounded-lg"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}>
                {domainMetrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--muted)" }}>Condition</label>
              <select value={condition} onChange={(e) => setCondition(e.target.value as "above" | "below")}
                className="text-xs w-full px-3 py-2 rounded-lg"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}>
                <option value="above">goes above</option>
                <option value="below">drops below</option>
              </select>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--muted)" }}>Threshold</label>
              <input type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
                className="text-xs w-full px-3 py-2 rounded-lg"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
          </div>
          <div className="flex gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="Alert label, e.g. Parking getting full"
              className="flex-1 text-xs px-3 py-2 rounded-lg"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }} />
            <button onClick={addItem} disabled={!label.trim()} className="btn-primary text-xs px-4 rounded-lg">
              + Add
            </button>
          </div>
        </div>

        {/* Watchlist items */}
        {cityItems.length === 0 && otherItems.length === 0 ? (
          <div className="card p-8 text-center" style={{ color: "var(--muted)" }}>
            No alerts set yet. Add one above to start monitoring {city}.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cityItems.length > 0 && (
              <>
                <h2 className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{city.toUpperCase()}</h2>
                {cityItems.map((item) => {
                  const triggered = alerts.some((a) => a.item.id === item.id);
                  return (
                    <div key={item.id} className="card px-4 py-3 flex items-center gap-3"
                      style={{ borderColor: triggered ? "rgba(239,68,68,0.3)" : "var(--border)" }}>
                      <span style={{ fontSize: 18 }}>{DOMAIN_ICONS[item.domain] ?? "⚠"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: triggered ? "#ef4444" : "var(--text)" }}>
                            {triggered && "🔴 "}{item.label}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                          Alert when {item.metric.replace(/_/g, " ")} {item.condition} {item.threshold}
                        </p>
                      </div>
                      <button onClick={() => removeItem(item.id)}
                        className="text-xs px-2 py-1 rounded"
                        style={{ color: "var(--muted)", background: "var(--card2)" }}>
                        ✕
                      </button>
                    </div>
                  );
                })}
              </>
            )}
            {otherItems.length > 0 && (
              <>
                <h2 className="text-xs font-semibold mt-2" style={{ color: "var(--muted)" }}>OTHER CITIES</h2>
                {otherItems.map((item) => (
                  <div key={item.id} className="card px-4 py-3 flex items-center gap-3 opacity-50">
                    <span style={{ fontSize: 18 }}>{DOMAIN_ICONS[item.domain] ?? "⚠"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm" style={{ color: "var(--text)" }}>{item.label}</span>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{item.city}</p>
                    </div>
                    <button onClick={() => removeItem(item.id)}
                      className="text-xs px-2 py-1 rounded"
                      style={{ color: "var(--muted)", background: "var(--card2)" }}>
                      ✕
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function WatchlistPage() {
  return <Suspense><WatchlistContent /></Suspense>;
}
