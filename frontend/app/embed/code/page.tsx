"use client";
import { useState } from "react";

const CITIES = ["San Francisco", "New York", "Austin"];
const TYPES = [
  { value: "parking",  label: "Parking" },
  { value: "ev",       label: "EV Charging" },
  { value: "transit",  label: "Transit" },
  { value: "services", label: "Services" },
  { value: "pulse",    label: "City Pulse" },
];

export default function EmbedCodePage() {
  const [city, setCity] = useState("San Francisco");
  const [type, setType] = useState("parking");
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : "https://urbanflow-ai.com";

  const embedUrl = `${baseUrl}/embed?city=${encodeURIComponent(city)}&type=${type}`;
  const code = `<iframe\n  src="${embedUrl}"\n  width="320"\n  height="200"\n  frameborder="0"\n  style="border-radius:16px;overflow:hidden"\n  title="UrbanFlow AI — ${city} ${type}"\n></iframe>`;

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
      padding: "40px 24px",
    }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          <span style={{ color: "#3b82f6" }}>UrbanFlow AI</span> Embed Generator
        </h1>
        <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 32, fontSize: 14 }}>
          Embed live city data on any webpage — no API key required.
        </p>

        {/* Config */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>CITY</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 14,
              }}
            >
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 6 }}>DATA TYPE</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", fontSize: 14,
              }}
            >
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Preview */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 8 }}>PREVIEW</label>
          <iframe
            src={embedUrl}
            width="320"
            height="200"
            frameBorder="0"
            style={{ borderRadius: 16, overflow: "hidden", display: "block" }}
            title="Embed Preview"
          />
        </div>

        {/* Code */}
        <div>
          <label style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", display: "block", marginBottom: 8 }}>EMBED CODE</label>
          <div style={{ position: "relative" }}>
            <pre style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "16px 20px",
              fontSize: 12,
              color: "rgba(255,255,255,0.75)",
              overflowX: "auto",
              lineHeight: 1.6,
              marginBottom: 0,
            }}>
              {code}
            </pre>
            <button
              onClick={copyCode}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                padding: "6px 14px",
                borderRadius: 8,
                background: copied ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)",
                border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(59,130,246,0.4)"}`,
                color: copied ? "#22c55e" : "#3b82f6",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
