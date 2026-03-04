"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import BestTimeModal from "@/components/BestTimeModal";
import Toast from "@/components/Toast";
import { getServices, predictService } from "@/lib/api";
import type { LocalService } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import type { MapItem } from "@/components/CityMap";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

const CAT_ICONS: Record<string, string> = {
  dmv: "🏛", hospital: "🏥", bank: "🏦", post_office: "📮", pharmacy: "💊",
};
const CAT_LABELS: Record<string, string> = {
  dmv: "DMV", hospital: "Hospital", bank: "Bank", post_office: "Post Office", pharmacy: "Pharmacy",
};
const WAIT_COLOR: Record<string, string> = {
  "No wait": "#22c55e",
  "Short wait": "#4ade80",
  "Moderate wait": "#f59e0b",
  "Long wait": "#ef4444",
};

function ServicesContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [services, setServices] = useState<LocalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [bestTimeService, setBestTimeService] = useState<LocalService | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [predicting, setPredicting] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, { wait: number; label: string; explain: string }>>({});
  const [arriveAt, setArriveAt] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 2, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  const fetchServices = useCallback(async () => {
    try {
      const { services } = await getServices(city, category === "all" ? undefined : category);
      setServices(services);
    } finally {
      setLoading(false);
    }
  }, [city, category]);

  useEffect(() => { setLoading(true); fetchServices(); }, [fetchServices]);

  async function handlePredict(service: LocalService) {
    setPredicting(service.id);
    try {
      const res = await predictService(service.id, new Date(arriveAt).toISOString());
      setPredictions(prev => ({ ...prev, [service.id]: { wait: res.predicted_wait_minutes, label: res.wait_label, explain: res.explanation } }));
    } catch {
      setToast("Prediction failed");
    } finally {
      setPredicting(null);
    }
  }

  const CATEGORIES = ["all", "dmv", "hospital", "bank", "post_office", "pharmacy"];

  return (
    <main className="min-h-screen pt-14" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              🏛 <span style={{ color: "#a855f7" }}>Local Services</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{services.length} services in {city}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setViewMode("list")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "list" ? "rgba(168,85,247,0.15)" : "var(--card)", color: viewMode === "list" ? "#c084fc" : "var(--muted)" }}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "map" ? "rgba(168,85,247,0.15)" : "var(--card)", color: viewMode === "map" ? "#c084fc" : "var(--muted)" }}
              >
                ⊙ Map
              </button>
            </div>
            <input type="datetime-local" value={arriveAt} onChange={e => setArriveAt(e.target.value)} className="text-xs" />
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all"
              style={{
                background: category === cat ? "rgba(168,85,247,0.15)" : "var(--card)",
                color: category === cat ? "#c084fc" : "var(--muted)",
                border: `1px solid ${category === cat ? "rgba(168,85,247,0.3)" : "var(--border)"}`,
              }}>
              {cat === "all" ? "All Services" : `${CAT_ICONS[cat]} ${CAT_LABELS[cat]}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="card p-5 h-36 animate-pulse" style={{ background: "var(--card2)" }} />)}
          </div>
        ) : viewMode === "map" ? (
          <CityMap items={services.map((s): MapItem => ({
            id: s.id,
            name: `${s.name}`,
            lat: s.lat,
            lng: s.lng,
            status: s.is_open ? "green" : "gray",
            metric: s.is_open ? `Open · ${s.estimated_wait_minutes} min wait` : "Closed",
          }))} />
        ) : services.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--muted)" }}>No services found for this category.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((s) => {
              const pred = predictions[s.id];
              const waitColor = WAIT_COLOR[pred ? pred.label : s.wait_label] || "#64748b";
              return (
                <div key={s.id} className="card p-5 flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span>{CAT_ICONS[s.category]}</span>
                        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{s.name}</p>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{s.address}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{s.typical_hours}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="tag" style={{
                        background: s.is_open ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                        color: s.is_open ? "#22c55e" : "#ef4444",
                      }}>
                        {s.is_open ? "Open" : "Closed"}
                      </span>
                    </div>
                  </div>

                  {s.is_open && (
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-2xl font-bold" style={{ color: waitColor }}>
                          {pred ? pred.wait : s.estimated_wait_minutes}
                        </p>
                        <p className="text-xs" style={{ color: "var(--muted)" }}>min wait</p>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span style={{ color: "var(--muted)" }}>Queue: {s.queue_length} people</span>
                          <span style={{ color: waitColor }}>{pred ? pred.label : s.wait_label}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill"
                            style={{ width: `${Math.min(100, (s.estimated_wait_minutes / 90) * 100)}%`, background: waitColor }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {pred && (
                    <div className="p-2.5 rounded-lg text-xs" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
                      <span style={{ color: "#c084fc" }}>AI at {new Date(arriveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: </span>
                      <span style={{ color: "var(--text)" }}>{pred.wait} min ({pred.label})</span>
                      <p className="mt-0.5" style={{ color: "var(--muted)" }}>{pred.explain}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handlePredict(s)} disabled={predicting === s.id} className="btn-ghost text-xs flex-1">
                      {predicting === s.id ? "Predicting…" : "⬡ Predict Wait"}
                    </button>
                    <button onClick={() => setBestTimeService(s)} className="btn-ghost text-xs flex-1">⏱ Best Time</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {bestTimeService && (
        <BestTimeModal entityType="service" entityId={bestTimeService.id} entityName={bestTimeService.name} onClose={() => setBestTimeService(null)} />
      )}
      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </main>
  );
}

export default function ServicesPage() {
  return <Suspense><ServicesContent /></Suspense>;
}
