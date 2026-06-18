import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface WishButtonProps {
  onOpen: () => void;
  hasWished: boolean;
}

export function WishButton({ onOpen, hasWished }: WishButtonProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 15000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-auto"
      style={{
        position: "fixed",
        bottom: "2.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        animation: "wishBtnFadeIn 1.2s ease forwards",
        zIndex: 60,
      }}
    >
      <style>{`
        @keyframes wishBtnFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <button
        onClick={onOpen}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.65rem 1.4rem",
          borderRadius: "9999px",
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.25)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          color: "rgba(255,255,255,0.88)",
          fontSize: "0.82rem",
          fontWeight: 500,
          letterSpacing: "0.04em",
          cursor: "pointer",
          transition: "background 0.2s, border-color 0.2s, transform 0.15s",
          boxShadow: "0 0 20px rgba(200,180,255,0.12)",
          fontFamily: "inherit",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.18)";
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "rgba(255,255,255,0.45)";
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.04)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.10)";
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "rgba(255,255,255,0.25)";
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        }}
      >
        <Sparkles style={{ width: "1rem", height: "1rem", flexShrink: 0 }} />
        {hasWished ? "Send another wish" : "Leave a wish"}
      </button>
    </div>
  );
}
