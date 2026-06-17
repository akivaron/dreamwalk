import { useEffect, useState } from "react";
import type { WishSample } from "./types";

interface WishViewerProps {
  wish: WishSample;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const WORLD_ICONS: Record<string, string> = {
  "midnight-ocean": "🍾",
  "eternal-winter": "❄️",
  "mystic-valley": "🌿",
  "savana-valley": "🏮",
  "golden-sunrise": "🏮",
  "crimson-dusk": "⭐",
};

export function WishViewer({ wish, onClose }: WishViewerProps) {
  const [entered, setEntered] = useState(false);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true));
  }, []);

  function sendLight() {
    setLit(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 80,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        opacity: entered ? 1 : 0,
        transition: "opacity 0.3s",
      }}
    >
      <style>{`
        @keyframes wishViewUp {
          from { opacity:0; transform: scale(0.93) translateY(16px); }
          to   { opacity:1; transform: scale(1)    translateY(0); }
        }
        @keyframes lightPulse {
          0%   { box-shadow: 0 0 20px rgba(255,220,100,0.15); }
          50%  { box-shadow: 0 0 60px rgba(255,220,100,0.55); }
          100% { box-shadow: 0 0 20px rgba(255,220,100,0.15); }
        }
      `}</style>

      <div
        style={{
          width: "min(88vw, 400px)",
          borderRadius: "1.5rem",
          padding: "2rem",
          background: lit
            ? "rgba(30,22,10,0.85)"
            : "rgba(8,6,20,0.80)",
          border: `1px solid ${lit ? "rgba(255,210,80,0.45)" : "rgba(255,255,255,0.12)"}`,
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          animation: `wishViewUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards${lit ? ", lightPulse 0.8s ease infinite" : ""}`,
          transition: "background 0.6s, border-color 0.6s",
        }}
      >
        <div
          style={{
            fontSize: "2rem",
            marginBottom: "1rem",
            textAlign: "center",
          }}
        >
          {WORLD_ICONS[wish.worldId] ?? "✨"}
        </div>

        <p
          style={{
            fontSize: "1.08rem",
            lineHeight: 1.65,
            color: "rgba(255,255,255,0.88)",
            fontStyle: "italic",
            textAlign: "center",
            margin: "0 0 1.25rem",
          }}
        >
          &ldquo;{wish.wishText}&rdquo;
        </p>

        <div
          style={{
            fontSize: "0.72rem",
            color: "rgba(255,255,255,0.3)",
            textAlign: "center",
            marginBottom: "1.5rem",
            letterSpacing: "0.06em",
          }}
        >
          Anonymous dreamer · {timeAgo(wish.createdAt)}
        </div>

        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "0.6rem",
              borderRadius: "0.75rem",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.45)",
              fontSize: "0.83rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Pass by
          </button>

          <button
            onClick={sendLight}
            disabled={lit}
            style={{
              flex: 2,
              padding: "0.6rem",
              borderRadius: "0.75rem",
              background: lit
                ? "rgba(255,200,60,0.22)"
                : "rgba(255,200,80,0.14)",
              border: `1px solid ${lit ? "rgba(255,210,80,0.5)" : "rgba(255,200,80,0.3)"}`,
              color: lit
                ? "rgba(255,230,140,0.95)"
                : "rgba(255,220,120,0.8)",
              fontSize: "0.83rem",
              fontWeight: 500,
              cursor: lit ? "default" : "pointer",
              fontFamily: "inherit",
              transition: "background 0.3s, border-color 0.3s",
            }}
          >
            {lit ? "🕯️ Light sent" : "🕯️ Send light"}
          </button>
        </div>
      </div>
    </div>
  );
}
