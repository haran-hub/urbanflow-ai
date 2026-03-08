"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import { askConcierge } from "@/lib/api";
import { useDetectedCity } from "@/hooks/useDetectedCity";
import { formatCityTime } from "@/lib/city-time";

// Speech API types (not in all TS DOM configs)
interface SREvent extends Event {
  results: { [i: number]: { [i: number]: { transcript: string } } };
}
interface SRInstance {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((e: SREvent) => void) | null;
  start(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SRInstance;
    webkitSpeechRecognition: new () => SRInstance;
  }
}

interface Message {
  role: "user" | "assistant";
  text: string;
  ts: Date;
}

const SUGGESTED = [
  "Where should I park right now?",
  "Is the air quality safe for a run?",
  "Which transit route is least crowded?",
  "What food trucks are open nearby?",
  "Best time to charge my EV today?",
  "How's the vibe downtown tonight?",
];

function ConciergeContent() {
  const params = useSearchParams();
  const { city, setCity } = useDetectedCity(params.get("city"));
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `Hi! I'm your AI city concierge for ${city || "your city"}. Ask me anything about parking, transit, air quality, food trucks, EV charging, or anything urban!`,
      ts: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SRInstance | null>(null);

  // Update greeting when city changes
  useEffect(() => {
    setMessages([{
      role: "assistant",
      text: `Hi! I'm your AI city concierge for ${city}. Ask me anything about parking, transit, air quality, food trucks, EV charging, or anything urban!`,
      ts: new Date(),
    }]);
  }, [city]);

  useEffect(() => {
    if (messages.length > 1) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e: SREvent) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      // Auto-submit after short delay so user sees transcript
      setTimeout(() => send(transcript), 400);
    };
    rec.start();
    recognitionRef.current = rec;
  }

  function speakResponse(text: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setInput("");
    // Snapshot current messages to build history (exclude greeting, only real exchanges)
    const currentMessages = messages;
    setMessages((prev) => [...prev, { role: "user", text: question, ts: new Date() }]);
    setLoading(true);
    try {
      // Build history from real exchanges only (skip initial greeting at index 0)
      const history = currentMessages
        .slice(1)  // skip the system greeting
        .map((m) => ({ role: m.role, content: m.text }));
      const res = await askConcierge(question, city, history);
      setMessages((prev) => [...prev, { role: "assistant", text: res.answer, ts: new Date() }]);
      speakResponse(res.answer);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        text: "Sorry, I couldn't connect to the city data right now. Please try again!",
        ts: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen pt-14 md:pt-0 md:pl-[220px] flex flex-col" style={{ background: "var(--bg)" }}>
      <Header city={city} onCityChange={setCity} />

      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-8">
        <div className="mb-5">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            💬 <span style={{ color: "var(--accent)" }}>AI</span> City Concierge
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Ask anything about {city} — real-time city intelligence at your fingertips
          </p>
        </div>

        {/* Suggested questions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="text-xs px-3 py-1.5 rounded-full transition-all"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Chat messages */}
        <div
          className="flex-1 flex flex-col gap-3 overflow-y-auto rounded-xl p-4 mb-4"
          style={{ background: "var(--card)", border: "1px solid var(--border)", minHeight: 300, maxHeight: "50vh" }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
            >
              {m.role === "assistant" && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >U</div>
              )}
              <div
                className="max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={{
                  background: m.role === "user" ? "var(--accent)" : "var(--card2)",
                  color: m.role === "user" ? "#fff" : "var(--text)",
                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                }}
              >
                {m.text}
                <div className="text-xs mt-1 opacity-50">
                  {formatCityTime(m.ts, city)}
                </div>
              </div>
              {m.role === "user" && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.1)", color: "var(--text)" }}
                >You</div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: "var(--accent)", color: "#fff" }}>U</div>
              <div className="rounded-2xl px-4 py-3" style={{ background: "var(--card2)" }}>
                <div className="flex gap-1 items-center h-5">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--muted)", animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--muted)", animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--muted)", animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
            placeholder={`Ask about ${city}…`}
            className="flex-1 text-sm px-4 py-3 rounded-xl"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              outline: "none",
            }}
            disabled={loading}
          />
          <button
            onClick={startListening}
            disabled={loading || listening}
            title="Speak your question"
            className="px-3 py-3 rounded-xl text-lg transition-all"
            style={{
              background: listening ? "rgba(239,68,68,0.15)" : "var(--card)",
              border: `1px solid ${listening ? "rgba(239,68,68,0.5)" : "var(--border)"}`,
              color: listening ? "#ef4444" : "var(--muted)",
              animation: listening ? "pulse 1s infinite" : "none",
            }}
          >
            🎙
          </button>
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="btn-primary px-4 py-3 rounded-xl text-sm"
          >
            Send
          </button>
        </div>
        {listening && (
          <p className="text-xs text-center mt-2" style={{ color: "#ef4444" }}>
            Listening… speak now
          </p>
        )}
      </div>
    </main>
  );
}

export default function ConciergePage() {
  return <Suspense><ConciergeContent /></Suspense>;
}
