"use client";
import { useState } from "react";
import Header from "@/components/Header";
import Toast from "@/components/Toast";
import { generateAIPlan } from "@/lib/api";
import type { UrbanPlan } from "@/lib/types";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { formatCityTime } from "@/lib/city-time";

const NEEDS_OPTIONS = [
  { id: "parking", label: "Parking", icon: "🅿", desc: "Find best parking" },
  { id: "ev", label: "EV Charging", icon: "⚡", desc: "Charge your vehicle" },
  { id: "transit", label: "Transit", icon: "🚇", desc: "Optimal route" },
  { id: "services", label: "Services", icon: "🏛", desc: "DMV, banks, etc." },
];

const STEP_ICONS: Record<number, string> = { 1: "①", 2: "②", 3: "③", 4: "④", 5: "⑤", 6: "⑥" };

export default function PlanPage() {
  const { city, setCity } = useDetectedCity();
  const [needs, setNeeds] = useState<string[]>(["parking", "transit"]);
  const [departAt, setDepartAt] = useState(() => {
    const d = new Date(); d.setSeconds(0, 0);
    const p=(n:number)=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  const [plan, setPlan] = useState<UrbanPlan | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function toggleNeed(id: string) {
    setNeeds(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
  }

  async function handleGenerate() {
    if (needs.length === 0) {
      setToast({ msg: "Select at least one need", type: "error" });
      return;
    }
    setLoading(true);
    setPlan(null);
    try {
      const res = await generateAIPlan({
        lat: 37.7749, lng: -122.4194,
        city,
        needs,
        depart_at: new Date(departAt).toISOString(),
      });
      setPlan(res.plan);
      setGeneratedAt(res.generated_at);
    } catch {
      setToast({ msg: "Failed to generate plan. Check API key.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen pt-14 md:pt-14 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            ✦ <span style={{ color: "var(--accent)" }}>AI Urban Plan</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Tell us what you need — we'll generate a step-by-step optimized city plan using live data.
          </p>
        </div>

        {/* Config */}
        <div className="card p-6 mb-6 space-y-6">
          {/* Needs */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--muted)" }}>WHAT DO YOU NEED?</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {NEEDS_OPTIONS.map((n) => {
                const selected = needs.includes(n.id);
                return (
                  <button key={n.id} onClick={() => toggleNeed(n.id)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center"
                    style={{
                      background: selected ? "var(--accent-glow)" : "var(--card2)",
                      borderColor: selected ? "rgba(59,130,246,0.5)" : "var(--border)",
                      color: selected ? "#93c5fd" : "var(--muted)",
                    }}>
                    <span className="text-2xl">{n.icon}</span>
                    <span className="text-xs font-medium">{n.label}</span>
                    <span className="text-xs opacity-70">{n.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Departure */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--muted)" }}>DEPARTURE TIME</p>
            <input type="datetime-local" value={departAt} onChange={e => setDepartAt(e.target.value)} className="w-full" />
          </div>

          <button onClick={handleGenerate} disabled={loading || needs.length === 0} className="btn-primary w-full py-3 text-sm">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner" style={{ width: 16, height: 16 }} />
                Generating AI Plan…
              </span>
            ) : "✦ Generate My Urban Plan"}
          </button>
        </div>

        {/* Plan Output */}
        {plan && (
          <div className="animate-slide-up space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold" style={{ color: "var(--text)" }}>Your Optimized Plan</h2>
                {generatedAt && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Generated {formatCityTime(generatedAt, city)}</p>}
              </div>
              {plan.total_time_saved_mins > 0 && (
                <div className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80" }}>
                  ⏱ Saves ~{plan.total_time_saved_mins} min
                </div>
              )}
            </div>

            {plan.summary && (
              <div className="p-4 rounded-xl text-sm" style={{ background: "var(--accent-glow)", border: "1px solid rgba(59,130,246,0.2)", color: "#93c5fd" }}>
                {plan.summary}
              </div>
            )}

            <div className="space-y-3">
              {plan.steps.map((step) => (
                <div key={step.step} className="card p-4 flex gap-4 animate-fade-in">
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
                    style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid rgba(59,130,246,0.3)" }}>
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{step.action}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-xs" style={{ color: "var(--muted)" }}>
                      <span>📍 {step.location}</span>
                      <span>🕐 {step.timing}</span>
                    </div>
                    {step.tip && (
                      <p className="text-xs mt-2 px-2 py-1 rounded-lg" style={{ background: "rgba(59,130,246,0.06)", color: "#60a5fa" }}>
                        💡 {step.tip}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </main>
  );
}
