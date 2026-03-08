"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { getReports, submitReport, upvoteReport } from "@/lib/api";

const ReportsMap = dynamic(() => import("./ReportsMap"), { ssr: false });

interface Report {
  id: number;
  city: string;
  lat: number;
  lng: number;
  type: string;
  description: string;
  upvotes: number;
  created_at: string;
}

const TYPE_OPTIONS = [
  { value: "parking",  label: "🅿 Parking issue" },
  { value: "ev",       label: "⚡ EV charger problem" },
  { value: "transit",  label: "🚇 Transit delay" },
  { value: "general",  label: "📌 General report" },
];

function ReportsContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [clickedLatLng, setClickedLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [reportType, setReportType] = useState("general");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  async function fetchReports() {
    try {
      const d = await getReports(city);
      setReports(d.reports ?? []);
    } catch {}
  }

  useEffect(() => {
    setLoading(true);
    fetchReports().finally(() => setLoading(false));
  }, [city]);

  function handleMapClick(lat: number, lng: number) {
    setClickedLatLng({ lat, lng });
    setFormOpen(true);
    setSubmitSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clickedLatLng || !description.trim()) return;
    setSubmitting(true);
    try {
      await submitReport({
        city,
        lat: clickedLatLng.lat,
        lng: clickedLatLng.lng,
        type: reportType,
        description,
      });
      setSubmitSuccess(true);
      setDescription("");
      setFormOpen(false);
      setClickedLatLng(null);
      await fetchReports();
    } catch {}
    setSubmitting(false);
  }

  async function handleUpvote(id: number) {
    try {
      const updated = await upvoteReport(id);
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, upvotes: updated.upvotes } : r));
    } catch {}
  }

  return (
    <main className="min-h-screen pt-14 md:pt-14 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-5">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            📍 <span style={{ color: "var(--accent)" }}>Community</span> Reports
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Click the map to pin a report · Last 24 hours · Upvote to highlight issues
          </p>
        </div>

        {submitSuccess && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
            ✓ Report submitted — thank you!
          </div>
        )}

        {/* Map */}
        <div className="mb-6">
          {loading ? (
            <div className="rounded-2xl skeleton" style={{ height: 400, background: "var(--card2)", border: "1px solid var(--border)" }} />
          ) : (
            <ReportsMap city={city} reports={reports} onMapClick={handleMapClick} />
          )}
        </div>

        {/* Inline form (appears after map click) */}
        {formOpen && clickedLatLng && (
          <div className="card p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>
                📌 New report at {clickedLatLng.lat.toFixed(4)}, {clickedLatLng.lng.toFixed(4)}
              </h3>
              <button onClick={() => setFormOpen(false)} style={{ color: "var(--muted)" }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="text-sm px-3 py-2 rounded-xl"
                style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)" }}
              >
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Describe the issue… (max 280 chars)"
                className="text-sm px-3 py-2 rounded-xl resize-none"
                style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--text)", outline: "none" }}
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting || !description.trim()}
                  className="btn-primary text-sm px-4 py-2 rounded-xl"
                >
                  {submitting ? "Submitting…" : "Submit Report"}
                </button>
                <button type="button" onClick={() => setFormOpen(false)} className="btn-ghost text-sm px-4 py-2 rounded-xl">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Reports list */}
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--muted)" }}>
          RECENT REPORTS ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <div className="card p-8 text-center" style={{ color: "var(--muted)" }}>
            No reports in the last 24 hours. Click the map to be the first!
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((r) => (
              <div key={r.id} className="card p-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6" }}>
                      {TYPE_OPTIONS.find((t) => t.value === r.type)?.label ?? r.type}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--text)" }}>{r.description}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    📍 {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                  </p>
                </div>
                <button
                  onClick={() => handleUpvote(r.id)}
                  className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all shrink-0"
                  style={{ background: "var(--card2)", border: "1px solid var(--border)", color: "var(--muted)" }}
                >
                  <span className="text-base">▲</span>
                  <span className="text-xs font-bold" style={{ color: "var(--text)" }}>{r.upvotes}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export default function ReportsPage() {
  return <Suspense><ReportsContent /></Suspense>;
}
