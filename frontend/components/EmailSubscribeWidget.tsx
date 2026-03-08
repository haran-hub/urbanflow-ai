"use client";
import { useState } from "react";
import { subscribeEmail } from "@/lib/api";

const CITIES = ["San Francisco", "New York", "Austin"];

export default function EmailSubscribeWidget() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("San Francisco");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await subscribeEmail(email, city);
      setStatus("success");
      setMessage(res.message ?? "Subscribed!");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <div
      className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2"
      style={{ pointerEvents: "none" }}
    >
      {/* Expanded form */}
      {open && (
        <div
          className="rounded-2xl p-4 w-72"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            pointerEvents: "auto",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--text)" }}>
                ☀ Morning City Brief
              </p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>
                Daily 7am AI briefing for your city
              </p>
            </div>
            <button
              onClick={() => { setOpen(false); setStatus("idle"); }}
              style={{ color: "var(--muted)", fontSize: 18, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {status === "success" ? (
            <div className="text-sm text-center py-3" style={{ color: "#22c55e" }}>
              ✓ {message}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="text-sm px-3 py-2 rounded-xl"
                style={{
                  background: "var(--card2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="text-sm px-3 py-2 rounded-xl"
                style={{
                  background: "var(--card2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
              >
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {status === "error" && (
                <p className="text-xs" style={{ color: "#ef4444" }}>{message}</p>
              )}
              <button
                type="submit"
                disabled={status === "loading"}
                className="btn-primary text-sm py-2 rounded-xl"
              >
                {status === "loading" ? "Subscribing…" : "Subscribe"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Subscribe to morning city briefings"
        className="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg transition-all"
        style={{
          background: "linear-gradient(135deg, #f59e0b, #f97316)",
          boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
          pointerEvents: "auto",
        }}
      >
        ☀
      </button>
    </div>
  );
}
