"use client";
import { useState } from "react";

const FEEDBACK_URL = process.env.NEXT_PUBLIC_FEEDBACK_URL;

const EMOJIS = [
  { v: 1, e: "😕", label: "Poor" },
  { v: 2, e: "😐", label: "Okay" },
  { v: 3, e: "😊", label: "Good" },
  { v: 4, e: "🤩", label: "Love it" },
];

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);

  function handleSubmit() {
    if (!rating) return;
    const emoji = EMOJIS.find((e) => e.v === rating);
    if (FEEDBACK_URL) {
      window.open(FEEDBACK_URL, "_blank", "width=600,height=700,noopener");
    } else {
      const subject = encodeURIComponent(`UrbanFlow AI Feedback — ${emoji?.e} ${emoji?.label}`);
      const body = encodeURIComponent(`Rating: ${emoji?.e} ${emoji?.label}\n\n${text || "(no comment)"}\n\nPage: ${window.location.href}`);
      window.open(`mailto:?subject=${subject}&body=${body}`);
    }
    setSent(true);
    setTimeout(() => { setSent(false); setOpen(false); setRating(null); setText(""); }, 2500);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 150,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderRadius: 24,
          fontSize: 12,
          fontWeight: 600,
          background: "rgba(20,22,32,0.92)",
          border: "1px solid rgba(99,102,241,0.35)",
          color: "#a5b4fc",
          backdropFilter: "blur(12px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.35), 0 0 0 1px rgba(99,102,241,0.1)",
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <span style={{ fontSize: 14 }}>💬</span>
        Feedback
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 66,
            right: 20,
            zIndex: 151,
            width: 280,
            borderRadius: 16,
            background: "rgba(14,16,24,0.97)",
            border: "1px solid rgba(99,102,241,0.25)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "12px 14px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div>
              <p style={{ color: "white", fontWeight: 700, fontSize: 13 }}>Share your feedback</p>
              <p style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}>Help us improve UrbanFlow AI</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ color: "#475569", fontSize: 16, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {sent ? (
            <div style={{ padding: "28px 14px", textAlign: "center" }}>
              <p style={{ fontSize: 28 }}>🎉</p>
              <p style={{ color: "white", fontWeight: 600, fontSize: 13, marginTop: 8 }}>Thanks for your feedback!</p>
              <p style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>It really helps us improve.</p>
            </div>
          ) : (
            <div style={{ padding: "14px" }}>
              {/* Emoji rating */}
              <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 8 }}>How's your experience?</p>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {EMOJIS.map((e) => (
                  <button
                    key={e.v}
                    onClick={() => setRating(e.v)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 10,
                      fontSize: 20,
                      background: rating === e.v ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${rating === e.v ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.07)"}`,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <span>{e.e}</span>
                    <span style={{ fontSize: 9, color: rating === e.v ? "#a5b4fc" : "#475569" }}>{e.label}</span>
                  </button>
                ))}
              </div>

              {/* Text input */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What could be better? (optional)"
                rows={2}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "white",
                  fontSize: 12,
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  marginBottom: 10,
                }}
              />

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!rating}
                style={{
                  width: "100%",
                  padding: "9px 0",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  background: rating ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.06)",
                  color: rating ? "white" : "#475569",
                  border: "none",
                  cursor: rating ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                  boxShadow: rating ? "0 2px 12px rgba(99,102,241,0.35)" : "none",
                }}
              >
                {FEEDBACK_URL ? "Open Feedback Form ↗" : "Send Feedback"}
              </button>

              <p style={{ color: "#334155", fontSize: 10, textAlign: "center", marginTop: 8 }}>
                Your feedback is anonymous
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
