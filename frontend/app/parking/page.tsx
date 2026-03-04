"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import OccupancyBar from "@/components/OccupancyBar";
import BestTimeModal from "@/components/BestTimeModal";
import Toast from "@/components/Toast";
import { getParkingZones, predictParking, recommendParking } from "@/lib/api";
import type { ParkingZone, Recommendation } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import type { MapItem } from "@/components/CityMap";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

const ZONE_ICONS: Record<string, string> = { garage: "🏢", lot: "⬜", street: "🛣" };

function ParkingContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [bestTimeZone, setBestTimeZone] = useState<ParkingZone | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Predict state
  const [predicting, setPredicting] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, { pct: number; spots: number; explain: string }>>({});
  const [arriveAt, setArriveAt] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 2, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });

  // Recommend state
  const [showRecommend, setShowRecommend] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommending, setRecommending] = useState(false);

  const fetchZones = useCallback(async () => {
    try {
      const { zones } = await getParkingZones(city);
      setZones(zones);
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => { setLoading(true); fetchZones(); }, [fetchZones]);

  async function handlePredict(zone: ParkingZone) {
    setPredicting(zone.id);
    try {
      const res = await predictParking(zone.id, new Date(arriveAt).toISOString());
      setPredictions(prev => ({
        ...prev,
        [zone.id]: {
          pct: res.predicted_occupancy_pct,
          spots: res.predicted_available_spots,
          explain: res.explanation,
        },
      }));
    } catch {
      setToast("Prediction failed");
    } finally {
      setPredicting(null);
    }
  }

  async function handleRecommend() {
    setRecommending(true);
    try {
      const res = await recommendParking(37.7749, -122.4194, new Date(arriveAt).toISOString(), 2, city);
      setRecommendation(res.recommendation);
      setShowRecommend(true);
    } catch {
      setToast("Recommendation failed");
    } finally {
      setRecommending(false);
    }
  }

  return (
    <main className="min-h-screen pt-14" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
              🅿 <span style={{ color: "var(--accent)" }}>Parking</span> Zones
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{zones.length} zones in {city}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <button
                onClick={() => setViewMode("list")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "list" ? "rgba(59,130,246,0.15)" : "var(--card)", color: viewMode === "list" ? "#60a5fa" : "var(--muted)" }}
              >
                ☰ List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className="text-xs px-3 py-1.5 transition-all"
                style={{ background: viewMode === "map" ? "rgba(59,130,246,0.15)" : "var(--card)", color: viewMode === "map" ? "#60a5fa" : "var(--muted)" }}
              >
                ⊙ Map
              </button>
            </div>
            <input
              type="datetime-local"
              value={arriveAt}
              onChange={e => setArriveAt(e.target.value)}
              className="text-xs"
            />
            <button onClick={handleRecommend} disabled={recommending} className="btn-primary text-xs">
              {recommending ? "Thinking…" : "✦ AI Recommend"}
            </button>
          </div>
        </div>

        {/* AI Recommendation */}
        {showRecommend && recommendation && (
          <div className="p-4 rounded-xl mb-6 animate-slide-up" style={{ background: "var(--accent-glow)", border: "1px solid rgba(59,130,246,0.3)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#93c5fd" }}>
                  ✦ AI Recommendation
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--text)" }}>{recommendation.reason}</p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Est. wait: {recommendation.estimated_wait} min
                </p>
              </div>
              <button onClick={() => setShowRecommend(false)} style={{ color: "var(--muted)" }}>✕</button>
            </div>
          </div>
        )}

        {/* Zones */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="card p-5 h-40 animate-pulse" style={{ background: "var(--card2)" }} />
            ))}
          </div>
        ) : viewMode === "map" ? (
          <CityMap items={zones.map((z): MapItem => ({
            id: z.id,
            name: z.name,
            lat: z.lat,
            lng: z.lng,
            status: z.occupancy_pct > 0.8 ? "red" : z.occupancy_pct > 0.5 ? "yellow" : "green",
            metric: `${z.available_spots} / ${z.total_spots} spots available`,
          }))} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {zones.map((zone) => {
              const pred = predictions[zone.id];
              return (
                <div key={zone.id} className="card p-5 flex flex-col gap-3 animate-fade-in">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span>{ZONE_ICONS[zone.zone_type]}</span>
                        <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{zone.name}</p>
                        <span className="tag" style={{ background: "rgba(59,130,246,0.1)", color: "#60a5fa" }}>
                          {zone.zone_type}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{zone.address}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold" style={{ color: "var(--text)" }}>{zone.available_spots}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>/ {zone.total_spots} spots</p>
                    </div>
                  </div>

                  <OccupancyBar pct={zone.occupancy_pct} />

                  <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted)" }}>
                    <span>
                      {zone.hourly_rate > 0 ? `$${zone.hourly_rate}/hr` : "Free"}
                    </span>
                    {zone.last_updated && (
                      <span>Updated {new Date(zone.last_updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    )}
                  </div>

                  {pred && (
                    <div className="p-3 rounded-lg text-xs" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                      <p style={{ color: "#93c5fd" }}>AI Prediction for {new Date(arriveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}:</p>
                      <p className="mt-1" style={{ color: "var(--text)" }}>
                        {pred.spots} spots available ({pred.pct.toFixed(0)}% full)
                      </p>
                      <p className="mt-0.5" style={{ color: "var(--muted)" }}>{pred.explain}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handlePredict(zone)}
                      disabled={predicting === zone.id}
                      className="btn-ghost text-xs flex-1"
                    >
                      {predicting === zone.id ? "Predicting…" : "⬡ Predict"}
                    </button>
                    <button
                      onClick={() => setBestTimeZone(zone)}
                      className="btn-ghost text-xs flex-1"
                    >
                      ⏱ Best Time
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {bestTimeZone && (
        <BestTimeModal
          entityType="parking"
          entityId={bestTimeZone.id}
          entityName={bestTimeZone.name}
          onClose={() => setBestTimeZone(null)}
        />
      )}
      {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
    </main>
  );
}

export default function ParkingPage() {
  return <Suspense><ParkingContent /></Suspense>;
}
