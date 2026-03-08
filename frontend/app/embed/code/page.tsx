"use client";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { useDetectedCity } from "@/hooks/useDetectedCity";

const TYPES = [
  { value: "parking",  label: "🅿 Parking",      color: "#3b82f6" },
  { value: "ev",       label: "⚡ EV Charging",   color: "#f59e0b" },
  { value: "transit",  label: "🚇 Transit",       color: "#22c55e" },
  { value: "services", label: "🏛 Services",      color: "#a855f7" },
  { value: "pulse",    label: "◎ City Pulse",     color: "#818cf8" },
];

function EmbedCodeContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [type, setType] = useState("parking");
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");

  const SIZES = {
    small:  { w: 260, h: 160, label: "Small" },
    medium: { w: 320, h: 200, label: "Medium" },
    large:  { w: 420, h: 240, label: "Large" },
  };

  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : "https://urbanflow-ai.vercel.app";

  const { w, h } = SIZES[size];
  const embedUrl = `${baseUrl}/embed?city=${encodeURIComponent(city)}&type=${type}`;
  const code = `<iframe\n  src="${embedUrl}"\n  width="${w}"\n  height="${h}"\n  frameborder="0"\n  style="border-radius:16px;overflow:hidden"\n  title="UrbanFlow AI — ${city} ${type}"\n></iframe>`;

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const activeType = TYPES.find((t) => t.value === type)!;

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px]" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>
            ⬡ <span style={{ color: "var(--accent)" }}>Embed</span> Widget Generator
          </h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Drop live city data into any website — no API key, no login required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Left: Config */}
          <div className="flex flex-col gap-5">

            {/* Data type */}
            <div>
              <label className="text-xs font-semibold tracking-widest block mb-3" style={{ color: "var(--muted)" }}>
                DATA TYPE
              </label>
              <div className="grid grid-cols-1 gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-all"
                    style={{
                      background: type === t.value ? `${t.color}18` : "var(--card)",
                      border: `1px solid ${type === t.value ? t.color + "55" : "var(--border)"}`,
                      color: type === t.value ? t.color : "var(--muted)",
                    }}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: type === t.value ? t.color : "var(--border)" }} />
                    {t.label}
                    {type === t.value && (
                      <span className="ml-auto text-xs" style={{ color: t.color }}>selected</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <label className="text-xs font-semibold tracking-widest block mb-3" style={{ color: "var(--muted)" }}>
                SIZE
              </label>
              <div className="flex gap-2">
                {(Object.entries(SIZES) as [typeof size, typeof SIZES[typeof size]][]).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setSize(key)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: size === key ? "var(--accent)" : "var(--card)",
                      border: `1px solid ${size === key ? "var(--accent)" : "var(--border)"}`,
                      color: size === key ? "#fff" : "var(--muted)",
                    }}
                  >
                    {val.label}
                    <span className="block text-[10px] mt-0.5 opacity-60">{val.w}×{val.h}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right: Preview + code */}
          <div className="flex flex-col gap-5">

            {/* Live preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold tracking-widest" style={{ color: "var(--muted)" }}>
                  LIVE PREVIEW
                </label>
                <span className="text-[10px] flex items-center gap-1.5" style={{ color: "#22c55e" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  Real data
                </span>
              </div>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid var(--border)", background: "var(--card2)" }}
              >
                <iframe
                  src={embedUrl}
                  width="100%"
                  height={h}
                  frameBorder="0"
                  style={{ display: "block" }}
                  title="Embed Preview"
                />
              </div>
            </div>

            {/* Embed code */}
            <div>
              <label className="text-xs font-semibold tracking-widest block mb-3" style={{ color: "var(--muted)" }}>
                EMBED CODE
              </label>
              <div className="relative rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <pre
                  className="text-xs leading-relaxed p-4 pr-20 overflow-x-auto"
                  style={{ background: "var(--card)", color: "rgba(255,255,255,0.65)", margin: 0 }}
                >
                  {code}
                </pre>
                <button
                  onClick={copyCode}
                  className="absolute top-3 right-3 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: copied ? "rgba(34,197,94,0.15)" : "rgba(59,130,246,0.15)",
                    border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(59,130,246,0.4)"}`,
                    color: copied ? "#22c55e" : "#3b82f6",
                  }}
                >
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Info strip */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              <span style={{ fontSize: 16 }}>{activeType.label.split(" ")[0]}</span>
              <div>
                <span className="font-medium" style={{ color: "var(--text)" }}>{city} · {activeType.label.replace(/^\S+ /, "")}</span>
                <span className="ml-2">· Updates every 30s · Free · No API key</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </main>
  );
}

export default function EmbedCodePage() {
  return <Suspense><EmbedCodeContent /></Suspense>;
}
