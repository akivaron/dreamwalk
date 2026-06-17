import { useEffect, useRef, useState } from "react";
import { WishButton } from "./WishButton";
import { WishModal } from "./WishModal";
import { WishViewer } from "./WishViewer";
import { wishStore } from "./wishStore";
import { fetchWishes, submitWish } from "./api";
import type { WishSample } from "./types";

interface DreamWishesProps {
  songId: string;
  songTitle: string;
  worldId: string;
}

export function DreamWishes({ songId, songTitle, worldId }: DreamWishesProps) {
  const [modal, setModal] = useState<"none" | "compose" | "viewer">("none");
  const [selectedWish, setSelectedWish] = useState<WishSample | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasWished, setHasWished] = useState(false);
  const [wishCount, setWishCount] = useState(0);
  const [countVisible, setCountVisible] = useState(false);
  const [flashVisible, setFlashVisible] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    wishStore.onWishSelected = (wish) => {
      setSelectedWish(wish);
      setModal("viewer");
    };
    return () => {
      wishStore.onWishSelected = null;
    };
  }, []);

  useEffect(() => {
    if (fetchedRef.current === songId) return;
    fetchedRef.current = songId;

    fetchWishes(songId).then((data) => {
      wishStore.samples = data.samples;
      wishStore.count = data.count;
      wishStore.version++;
      setWishCount(data.count);

      if (data.count > 0) {
        setTimeout(() => setCountVisible(true), 8000);
      }
    });
  }, [songId]);

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

      setWishCount((c) => c + 1);
      setHasWished(true);
      setModal("none");

      wishStore.tiltCamera = true;
      wishStore.tiltTimer = 0;

      setFlashVisible(true);
      setTimeout(() => setFlashVisible(false), 800);
    }
  }

  const closeModal = () => setModal("none");

  return (
    <>
      <style>{`
        @keyframes wishFlash {
          0%   { opacity: 0; }
          20%  { opacity: 0.38; }
          100% { opacity: 0; }
        }
        @keyframes wishCountIn {
          from { opacity:0; transform: translateY(6px); }
          to   { opacity:1; transform: translateY(0); }
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
              "radial-gradient(ellipse at center, rgba(200,170,255,0.6) 0%, transparent 70%)",
            animation: "wishFlash 0.8s ease forwards",
          }}
        />
      )}

      {wishCount > 0 && countVisible && modal === "none" && (
        <div
          style={{
            position: "fixed",
            bottom: "5.2rem",
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 55,
            fontSize: "0.72rem",
            color: "rgba(255,255,255,0.32)",
            letterSpacing: "0.05em",
            animation: "wishCountIn 1s ease forwards",
            whiteSpace: "nowrap",
          }}
        >
          🌠 {wishCount.toLocaleString()} wish{wishCount === 1 ? "" : "es"} in
          this dream
        </div>
      )}

      <WishButton
        onOpen={() => setModal("compose")}
        hasWished={hasWished}
      />

      {modal === "compose" && (
        <div className="pointer-events-auto">
          <WishModal
            worldId={worldId}
            songTitle={songTitle}
            onClose={closeModal}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        </div>
      )}

      {modal === "viewer" && selectedWish && (
        <div className="pointer-events-auto">
          <WishViewer
            wish={selectedWish}
            onClose={closeModal}
          />
        </div>
      )}
    </>
  );
}
