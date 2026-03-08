"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { estimateTripCost } from "@/lib/api";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import type { TripCostResponse } from "@/lib/types";

const ACTIVITY_CHIPS = [
  "Dinner", "Lunch", "Coffee", "Concert", "Bar", "Movie",
  "Museum", "Transit", "Uber", "Food Truck", "Brunch", "Parking 2h",
];

function TripContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));

  const [activities, setActivities] = useState<string[]>([]);
  const [duration, setDuration] = useState(3);
  const [hasEV, setHasEV] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TripCostResponse | null>(null);

  function toggleActivity(a: string) {
    setActivities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  async function estimate() {
    setLoading(true);
    setResult(null);
    try {
      const data = await estimateTripCost({
        city,
        activities,
        duration_hours: duration,
        has_ev: hasEV,
      });
      setResult(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen pt-14 md:pt-14 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            💸 <span style={{ color: "var(--accent)" }}>Trip Cost</span> Estimator
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Know your outing cost before you leave — with AI tips to save money
          </p>
        </div>

        {/* Builder */}
        <div className="card p-5 mb-5" style={{ background: "var(--card2)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>What are you doing?</h2>
          <div className="flex flex-wrap gap-2 mb-5">
            {ACTIVITY_CHIPS.map((a) => (
              <button
                key={a}
                onClick={() => toggleActivity(a)}
                className="text-xs px-3 py-1.5 rounded-xl transition-all"
                style={{
                  background: activities.includes(a) ? "var(--accent)" : "var(--card)",
                  color: activities.includes(a) ? "#fff" : "var(--muted)",
                  border: `1px solid ${activities.includes(a) ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {a}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs mb-1.5 block" style={{ color: "var(--muted)" }}>Duration (hours)</label>
              <input
                type="number" min={0.5} max={12} step={0.5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="text-xs w-full px-3 py-2 rounded-lg"
                style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--text)" }}
              />
            </div>
            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasEV}
                  onChange={(e) => setHasEV(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span className="text-xs" style={{ color: "var(--text)" }}>⚡ I have an EV</span>
              </label>
            </div>
          </div>

          <button
            onClick={estimate}
            disabled={loading}
            className="btn-primary w-full text-sm py-2.5 rounded-xl"
          >
            {loading ? "Calculating…" : "💰 Estimate Cost"}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="flex flex-col gap-4">
            {/* Total */}
            <div
              className="card p-6 text-center"
              style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))", borderColor: "rgba(139,92,246,0.2)" }}
            >
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>ESTIMATED TOTAL</p>
              <p className="text-4xl font-black mb-1" style={{ color: "var(--text)" }}>
                ${result.estimated_total.toFixed(2)}
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                {result.activities.length > 0 ? result.activities.join(", ") : "General outing"} · {result.duration_hours}h · {result.city}
              </p>
            </div>

            {/* Breakdown */}
            <div className="card p-5" style={{ background: "var(--card2)" }}>
              <h2 className="text-xs font-bold tracking-wider mb-3" style={{ color: "var(--muted)" }}>BREAKDOWN</h2>
              <div className="flex flex-col gap-2">
                {result.breakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm" style={{ color: "var(--text)" }}>{item.item}</p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>{item.note}</p>
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: "var(--accent)" }}>
                      ${item.cost.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Savings Tips */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span>💡</span>
                <h2 className="text-xs font-bold tracking-wider" style={{ color: "var(--muted)" }}>
                  SAVINGS TIPS {result.ai_generated && <span style={{ color: "#a78bfa" }}>· ✦ AI</span>}
                </h2>
              </div>
              <div className="flex flex-col gap-2">
                {result.savings_tips.map((tip, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-xs shrink-0" style={{ color: "var(--accent)" }}>→</span>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function TripPage() {
  return <Suspense><TripContent /></Suspense>;
}
