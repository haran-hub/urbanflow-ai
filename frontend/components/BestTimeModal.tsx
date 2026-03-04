"use client";
import { useEffect, useState } from "react";
import { getBestTime } from "@/lib/api";
import type { BestTime } from "@/lib/types";

interface Props {
  entityType: string;
  entityId: string;
  entityName: string;
  onClose: () => void;
}

export default function BestTimeModal({ entityType, entityId, entityName, onClose }: Props) {
  const [data, setData] = useState<BestTime | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBestTime(entityType, entityId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold" style={{ color: "var(--text)" }}>Best Time to Visit</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{entityName}</p>
          </div>
          <button onClick={onClose} className="text-lg" style={{ color: "var(--muted)" }}>✕</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><div className="spinner" /></div>
        ) : data ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "#22c55e" }}>✓ Best Windows</p>
              <div className="space-y-2">
                {data.best_windows.map((w, i) => (
                  <div key={i} className="p-3 rounded-lg" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
                    <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{w.day} · {w.time_range}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{w.reason}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "#ef4444" }}>✕ Avoid</p>
              <div className="space-y-2">
                {data.worst_windows.map((w, i) => (
                  <div key={i} className="p-3 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                    <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{w.day} · {w.time_range}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{w.reason}</p>
                  </div>
                ))}
              </div>
            </div>
            {data.general_tip && (
              <div className="p-3 rounded-lg text-xs" style={{ background: "var(--accent-glow)", color: "#93c5fd" }}>
                💡 {data.general_tip}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
