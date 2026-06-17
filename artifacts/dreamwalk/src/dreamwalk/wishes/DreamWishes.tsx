import { useCallback, useEffect, useRef, useState } from "react";
import { WishButton } from "./WishButton";
import { WishModal } from "./WishModal";
import { wishStore } from "./wishStore";
import { fetchWishes, submitWish } from "./api";
import type { WishSample } from "./types";

const WORLD_ICON: Record<string, string> = {
  "midnight-ocean": "💫",
  "eternal-winter": "❄️",
  "mystic-valley": "✨",
  "savana-valley": "🏮",
  "golden-sunrise": "🏮",
  "crimson-dusk": "⭐",
};

function AmbientWishEvent({
  wish,
  worldId,
  onDone,
}: {
  wish: WishSample;
  worldId: string;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 9500);
    return () => clearTimeout(t);
  }, [onDone]);

  const icon = WORLD_ICON[worldId] ?? "✨";

  return (
    <div
      style={{
        position: "fixed",
        top: "20%",
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.8rem",
        animation: "ambientWishFade 9.5s ease forwards",
      }}
    >
      <span
        style={{
          fontSize: "1.8rem",
          display: "block",
          animation: "ambientFloat 4s ease-in-out infinite, ambientGlow 3s ease-in-out infinite",
        }}
      >
        {icon}
      </span>

      <div
        style={{
          background: "rgba(4,2,18,0.58)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: "1.1rem",
          padding: "0.85rem 1.5rem",
          maxWidth: "min(76vw, 310px)",
        }}
      >
        <p
          style={{
            fontSize: "0.88rem",
            color: "rgba(255,255,255,0.72)",
            fontStyle: "italic",
            textAlign: "center",
            lineHeight: 1.68,
            margin: 0,
          }}
        >
          &ldquo;{wish.wishText}&rdquo;
        </p>
        <p
          style={{
            fontSize: "0.63rem",
            color: "rgba(255,255,255,0.22)",
            textAlign: "center",
            marginTop: "0.45rem",
            letterSpacing: "0.09em",
          }}
        >
          a traveler&rsquo;s wish
        </p>
      </div>
    </div>
  );
}

interface DreamWishesProps {
  songId: string;
  songTitle: string;
  worldId: string;
}

export function DreamWishes({ songId, songTitle, worldId }: DreamWishesProps) {
  const [modal, setModal] = useState<"none" | "compose">("none");
  const [submitting, setSubmitting] = useState(false);
  const [hasWished, setHasWished] = useState(false);
  const [flashVisible, setFlashVisible] = useState(false);
  const [releaseKey, setReleaseKey] = useState(0);
  const [releaseVisible, setReleaseVisible] = useState(false);
  const [ambientEvent, setAmbientEvent] = useState<{ wish: WishSample; id: number } | null>(null);
  const ambientActiveRef = useRef(false);
  const fetchedRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (fetchedRef.current === songId) return;
    fetchedRef.current = songId;
    fetchWishes(songId).then((data) => {
      wishStore.samples = data.samples;
      wishStore.count = data.count;
      wishStore.version++;
    });
  }, [songId]);

  const scheduleNext = useCallback(() => {
    const delay = 20000 + Math.random() * 10000;
    timerRef.current = setTimeout(() => {
      if (!ambientActiveRef.current && wishStore.samples.length > 0) {
        const idx = Math.floor(Math.random() * wishStore.samples.length);
        ambientActiveRef.current = true;
        setAmbientEvent({ wish: wishStore.samples[idx], id: Date.now() });
      }
      scheduleNext();
    }, delay);
  }, []);

  useEffect(() => {
    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleNext]);

  function handleAmbientDone() {
    ambientActiveRef.current = false;
    setAmbientEvent(null);
  }

  async function handleSubmit(text: string) {
    setSubmitting(true);
    const ok = await submitWish(text, songId, songTitle, worldId);
    setSubmitting(false);

    if (ok) {
      const newWish: WishSample = {
        id: Date.now(),
        wishText: text,
        worldId,
        createdAt: new Date().toISOString(),
      };
      wishStore.samples = [newWish, ...wishStore.samples].slice(0, 8);
      wishStore.count = wishStore.count + 1;
      wishStore.version++;
      setHasWished(true);
      setModal("none");
      wishStore.tiltCamera = true;
      wishStore.tiltTimer = 0;
      setFlashVisible(true);
      setReleaseVisible(true);
      setReleaseKey((k) => k + 1);
      setTimeout(() => setFlashVisible(false), 900);
      setTimeout(() => setReleaseVisible(false), 3200);
    }
  }

  const releaseIcon = WORLD_ICON[worldId] ?? "✨";

  return (
    <>
      <style>{`
        @keyframes wishFlash {
          0%   { opacity: 0; }
          18%  { opacity: 0.35; }
          100% { opacity: 0; }
        }
        @keyframes ambientWishFade {
          0%   { opacity: 0; }
          15%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes ambientFloat {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-9px); }
        }
        @keyframes ambientGlow {
          0%, 100% { filter: drop-shadow(0 0 5px rgba(255,255,255,0.4)); }
          50%       { filter: drop-shadow(0 0 16px rgba(255,255,255,0.85)); }
        }
        @keyframes wishRelease {
          0%   { opacity: 0; transform: translateX(-50%) translateY(0)    scale(0.55); }
          10%  { opacity: 1; transform: translateX(-50%) translateY(-14px) scale(1.25); }
          88%  { opacity: 0.55; transform: translateX(-50%) translateY(-58vh) scale(1.0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-63vh) scale(0.85); }
        }
      `}</style>

      {flashVisible && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 90,
            background:
              "radial-gradient(ellipse at center, rgba(200,170,255,0.52) 0%, transparent 68%)",
            animation: "wishFlash 0.9s ease forwards",
          }}
        />
      )}

      {releaseVisible && (
        <div
          key={releaseKey}
          style={{
            position: "fixed",
            bottom: "4rem",
            left: "50%",
            pointerEvents: "none",
            zIndex: 92,
            fontSize: "2.6rem",
            lineHeight: 1,
            animation: "wishRelease 3.0s cubic-bezier(0.22,1,0.36,1) forwards",
          }}
        >
          {releaseIcon}
        </div>
      )}

      {ambientEvent && (
        <AmbientWishEvent
          key={ambientEvent.id}
          wish={ambientEvent.wish}
          worldId={worldId}
          onDone={handleAmbientDone}
        />
      )}

      <WishButton onOpen={() => setModal("compose")} hasWished={hasWished} />

      {modal === "compose" && (
        <div className="pointer-events-auto">
          <WishModal
            worldId={worldId}
            songTitle={songTitle}
            onClose={() => setModal("none")}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </div>
      )}
    </>
  );
}
