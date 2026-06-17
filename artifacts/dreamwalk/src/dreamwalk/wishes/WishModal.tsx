import { useEffect, useRef, useState } from "react";

interface WishModalProps {
  worldId: string;
  songTitle: string;
  onClose: () => void;
  onSubmit: (text: string) => void;
  submitting: boolean;
}

const WORLD_PROMPTS: Record<string, string> = {
  "midnight-ocean": "Set your wish adrift on the water…",
  "eternal-winter": "Let your wish rise with the frost…",
  "mystic-valley": "Whisper your wish to the fireflies…",
  "savana-valley": "Send your wish into the wind…",
  "golden-sunrise": "Release your wish at first light…",
  "crimson-dusk": "Cast your wish to the stars…",
};

const MAX = 200;

export function WishModal({
  worldId,
  songTitle,
  onClose,
  onSubmit,
  submitting,
}: WishModalProps) {
  const [text, setText] = useState("");
  const [entered, setEntered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      setEntered(true);
      setTimeout(() => textareaRef.current?.focus(), 200);
    });
  }, []);

  const placeholder =
    WORLD_PROMPTS[worldId] ?? "Speak your wish into the dream…";
  const remaining = MAX - text.length;
  const canSubmit = text.trim().length > 0 && remaining >= 0 && !submitting;

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) {
      onSubmit(text.trim());
    }
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
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        transition: "opacity 0.3s",
        opacity: entered ? 1 : 0,
      }}
    >
      <style>{`
        @keyframes wishModalUp {
          from { opacity:0; transform: translateY(20px) scale(0.97); }
          to   { opacity:1; transform: translateY(0)    scale(1); }
        }
        @keyframes wishParticle {
          0%   { transform: translate(-50%,-50%) scale(0); opacity:0.8; }
          100% { transform: translate(calc(-50% + var(--px)), calc(-50% + var(--py))) scale(1); opacity:0; }
        }
        .wish-modal-inner:focus-within .wish-char-count { opacity:1; }
      `}</style>

      <div
        className="wish-modal-inner"
        style={{
          position: "relative",
          width: "min(90vw, 460px)",
          borderRadius: "1.5rem",
          padding: "2rem",
          background: "rgba(10,8,24,0.72)",
          border: "1px solid rgba(255,255,255,0.13)",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          boxShadow:
            "0 0 60px rgba(180,140,255,0.14), 0 8px 40px rgba(0,0,0,0.5)",
          animation: "wishModalUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      >
        <div
          style={{
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "rgba(255,255,255,0.38)",
            marginBottom: "0.35rem",
          }}
        >
          Dreaming with · {songTitle}
        </div>

        <div
          style={{
            fontSize: "1.05rem",
            fontWeight: 600,
            color: "rgba(255,255,255,0.9)",
            marginBottom: "1.25rem",
          }}
        >
          Leave a wish in this dream
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={4}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "0.85rem",
            color: "rgba(255,255,255,0.88)",
            fontSize: "0.93rem",
            lineHeight: 1.6,
            padding: "0.9rem 1rem",
            resize: "none",
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "rgba(200,160,255,0.45)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")
          }
        />

        <div
          className="wish-char-count"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "0.75rem",
            opacity: 0,
            transition: "opacity 0.3s",
          }}
        >
          <span
            style={{
              fontSize: "0.72rem",
              color: "rgba(255,255,255,0.32)",
            }}
          >
            ⌘↵ to send
          </span>
          <span
            style={{
              fontSize: "0.72rem",
              color:
                remaining < 20
                  ? "rgba(255,160,120,0.8)"
                  : "rgba(255,255,255,0.32)",
            }}
          >
            {remaining}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            marginTop: "1.25rem",
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "0.65rem",
              borderRadius: "0.75rem",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.55)",
              fontSize: "0.85rem",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.06)")
            }
          >
            Cancel
          </button>

          <button
            onClick={() => canSubmit && onSubmit(text.trim())}
            disabled={!canSubmit}
            style={{
              flex: 2,
              padding: "0.65rem",
              borderRadius: "0.75rem",
              background: canSubmit
                ? "rgba(180,140,255,0.22)"
                : "rgba(255,255,255,0.04)",
              border: `1px solid ${canSubmit ? "rgba(200,160,255,0.45)" : "rgba(255,255,255,0.08)"}`,
              color: canSubmit
                ? "rgba(255,255,255,0.9)"
                : "rgba(255,255,255,0.3)",
              fontSize: "0.85rem",
              cursor: canSubmit ? "pointer" : "default",
              fontFamily: "inherit",
              fontWeight: 500,
              transition: "background 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              if (canSubmit)
                e.currentTarget.style.background = "rgba(180,140,255,0.32)";
            }}
            onMouseLeave={(e) => {
              if (canSubmit)
                e.currentTarget.style.background = "rgba(180,140,255,0.22)";
            }}
          >
            {submitting ? "Sending…" : "✨ Send wish"}
          </button>
        </div>

        <div
          style={{
            marginTop: "1rem",
            fontSize: "0.7rem",
            color: "rgba(255,255,255,0.2)",
            textAlign: "center",
          }}
        >
          Your wish floats through this dream, anonymous and forever.
        </div>
      </div>
    </div>
  );
}
