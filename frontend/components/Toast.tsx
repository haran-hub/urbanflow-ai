"use client";
import { useEffect } from "react";

interface ToastProps {
  message: string;
  type?: "info" | "success" | "error";
  onClose: () => void;
}

export default function Toast({ message, type = "info", onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors = {
    info: { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", text: "#60a5fa" },
    success: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", text: "#4ade80" },
    error: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", text: "#f87171" },
  }[type];

  return (
    <div
      className="fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium animate-slide-up"
      style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text, minWidth: 240 }}
    >
      {type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"} {message}
    </div>
  );
}
