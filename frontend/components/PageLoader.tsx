"use client";

interface Props {
  label?: string;
}

export default function PageLoader({ label = "Loading city intelligence" }: Props) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "rgba(5,5,8,0.97)",
        backdropFilter: "blur(24px)",
        animation: "loaderFadeIn 0.25s ease forwards",
      }}
    >
      {/* Ambient glow orbs */}
      <div style={{ position: "absolute", top: "18%", left: "22%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "12%", right: "18%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "50%", left: "60%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Orbital ring system */}
      <div style={{ position: "relative", width: 130, height: 130, marginBottom: 36 }}>

        {/* Ring 1 — outermost, slow CW */}
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "1px solid rgba(59,130,246,0.15)",
          animation: "loaderSpin 6s linear infinite",
        }}>
          <div style={{
            position: "absolute", top: -5, left: "50%", marginLeft: -5,
            width: 10, height: 10, borderRadius: "50%",
            background: "#3b82f6",
            boxShadow: "0 0 12px #3b82f6, 0 0 28px rgba(59,130,246,0.5)",
          }} />
        </div>

        {/* Ring 2 — middle, reverse CCW */}
        <div style={{
          position: "absolute", inset: 14, borderRadius: "50%",
          border: "1px solid rgba(139,92,246,0.18)",
          animation: "loaderSpinReverse 4s linear infinite",
        }}>
          <div style={{
            position: "absolute", top: -4.5, left: "50%", marginLeft: -4.5,
            width: 9, height: 9, borderRadius: "50%",
            background: "#8b5cf6",
            boxShadow: "0 0 10px #8b5cf6, 0 0 22px rgba(139,92,246,0.5)",
          }} />
        </div>

        {/* Ring 3 — inner, fast CW */}
        <div style={{
          position: "absolute", inset: 30, borderRadius: "50%",
          border: "1px dashed rgba(236,72,153,0.22)",
          animation: "loaderSpin 2.4s linear infinite",
        }}>
          <div style={{
            position: "absolute", top: -4, left: "50%", marginLeft: -4,
            width: 8, height: 8, borderRadius: "50%",
            background: "#ec4899",
            boxShadow: "0 0 8px #ec4899, 0 0 18px rgba(236,72,153,0.5)",
          }} />
        </div>

        {/* Center logo */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 13,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 20, color: "#fff",
            boxShadow: "0 0 28px rgba(59,130,246,0.6), 0 0 56px rgba(139,92,246,0.25)",
          }}>U</div>
        </div>
      </div>

      {/* Brand name */}
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 22, color: "#e2e8f0", letterSpacing: -0.3 }}>
          UrbanFlow{" "}
        </span>
        <span style={{
          fontWeight: 700, fontSize: 22,
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>AI</span>
      </div>

      {/* Loading label + bouncing dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, color: "#475569", letterSpacing: 0.2 }}>{label}</span>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 5, height: 5, borderRadius: "50%",
                background: "#3b82f6",
                display: "inline-block",
                animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </span>
      </div>

      {/* Bottom sliding gradient bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 3 }}>
        <div style={{
          height: "100%",
          background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #f59e0b, #3b82f6)",
          backgroundSize: "200% 100%",
          animation: "gradientSlide 2.2s linear infinite",
        }} />
      </div>
    </div>
  );
}
