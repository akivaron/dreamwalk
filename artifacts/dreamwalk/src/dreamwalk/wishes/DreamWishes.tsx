import { useCallback, useEffect, useRef, useState } from "react";
import { WishModal } from "./WishModal";
import { wishStore } from "./wishStore";
import { fetchWishes, submitWish } from "./api";
import type { WishSample } from "./types";

const SPIRIT_COLORS: Record<string, [number, number, number]> = {
  "midnight-ocean":  [90,  185, 255],
  "eternal-winter":  [175, 225, 255],
  "mystic-valley":   [75,  255, 155],
  "savana-valley":   [255, 175,  55],
  "golden-sunrise":  [255, 205,  80],
  "crimson-dusk":    [255, 225, 110],
};

function SpiritParticles({
  worldId,
  size = 92,
}: {
  worldId: string;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const [r, g, b] = SPIRIT_COLORS[worldId] ?? [255, 220, 140];
    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;

    const particles = Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      orbitR: (W * 0.18) + Math.random() * (W * 0.10),
      speed: 0.012 + Math.random() * 0.010,
      size: (W * 0.028) + Math.random() * (W * 0.018),
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    let animId: number;

    function draw() {
      t++;
      ctx!.clearRect(0, 0, W, H);

      // Core glow
      const coreAlpha = 0.52 + Math.sin(t * 0.038) * 0.22;
      const coreR = W * 0.12 + Math.sin(t * 0.026) * W * 0.02;

      const outerGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3.5);
      outerGrad.addColorStop(0, `rgba(${r},${g},${b},${coreAlpha * 0.55})`);
      outerGrad.addColorStop(0.5, `rgba(${r},${g},${b},${coreAlpha * 0.18})`);
      outerGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreR * 3.5, 0, Math.PI * 2);
      ctx!.fillStyle = outerGrad;
      ctx!.fill();

      const coreGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      coreGrad.addColorStop(0, `rgba(255,255,255,${coreAlpha})`);
      coreGrad.addColorStop(0.35, `rgba(${r},${g},${b},${coreAlpha * 0.9})`);
      coreGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx!.beginPath();
      ctx!.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx!.fillStyle = coreGrad;
      ctx!.fill();

      // Orbiting sparks
      particles.forEach((p) => {
        p.angle += p.speed;
        const px = cx + Math.cos(p.angle) * p.orbitR;
        const py = cy + Math.sin(p.angle) * p.orbitR * 0.55;
        const pAlpha = 0.42 + Math.sin(t * 0.065 + p.phase) * 0.38;

        const pGrad = ctx!.createRadialGradient(px, py, 0, px, py, p.size * 2.8);
        pGrad.addColorStop(0, `rgba(255,255,255,${pAlpha})`);
        pGrad.addColorStop(0.38, `rgba(${r},${g},${b},${pAlpha * 0.75})`);
        pGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx!.beginPath();
        ctx!.arc(px, py, p.size * 2.8, 0, Math.PI * 2);
        ctx!.fillStyle = pGrad;
        ctx!.fill();

        ctx!.beginPath();
        ctx!.arc(px, py, p.size * 0.45, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,255,255,${pAlpha})`;
        ctx!.fill();
      });

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animId);
  }, [worldId]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block" }}
    />
  );
}

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

  return (
    <div
      style={{
        position: "fixed",
        top: "18%",
        left: "50%",
        transform: "translateX(-50%)",
        pointerEvents: "none",
        zIndex: 70,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.7rem",
        animation: "ambientWishFade 9.5s ease forwards",
      }}
    >
      <div style={{ animation: "ambientFloat 4s ease-in-out infinite" }}>
        <SpiritParticles worldId={worldId} size={92} />
      </div>

      <div
        style={{
          background: "rgba(4,2,18,0.55)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.09)",
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
  isModalOpen: boolean;
  onModalClose: () => void;
  onHasWished: () => void;
}

export function DreamWishes({
  songId,
  songTitle,
  worldId,
  isModalOpen,
  onModalClose,
  onHasWished,
}: DreamWishesProps) {
  const [submitting, setSubmitting] = useState(false);
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
      onHasWished();
      onModalClose();
      wishStore.tiltCamera = true;
      wishStore.tiltTimer = 0;
      setFlashVisible(true);
      setReleaseVisible(true);
      setReleaseKey((k) => k + 1);
      setTimeout(() => setFlashVisible(false), 900);
      setTimeout(() => setReleaseVisible(false), 3400);
    }
  }

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
          50%       { transform: translateY(-10px); }
        }
        @keyframes wishRelease {
          0%   { opacity: 0; transform: translateX(-50%) translateY(0)    scale(0.5); }
          10%  { opacity: 1; transform: translateX(-50%) translateY(-12px) scale(1.2); }
          88%  { opacity: 0.5; transform: translateX(-50%) translateY(-56vh) scale(0.9); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-62vh) scale(0.7); }
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
              "radial-gradient(ellipse at center, rgba(200,170,255,0.50) 0%, transparent 68%)",
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
            animation: "wishRelease 3.2s cubic-bezier(0.22,1,0.36,1) forwards",
          }}
        >
          <SpiritParticles worldId={worldId} size={80} />
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

      {isModalOpen && (
        <div className="pointer-events-auto">
          <WishModal
            worldId={worldId}
            songTitle={songTitle}
            onClose={onModalClose}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </div>
      )}
    </>
  );
}
