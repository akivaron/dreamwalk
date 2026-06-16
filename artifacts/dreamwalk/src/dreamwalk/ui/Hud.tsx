import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TrackDef, World } from "../types";

interface HudProps {
  track: TrackDef;
  world: World;
  isPlaying: boolean;
  onToggle: () => void;
  onScreenshot: () => void;
  onExit: () => void;
}

export function Hud({ track, world, isPlaying, onToggle, onScreenshot, onExit }: HudProps) {
  const [visible, setVisible] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = useCallback(() => {
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 3200);
  }, []);

  useEffect(() => {
    poke();
    const hintTimer = setTimeout(() => setShowHint(false), 6000);
    window.addEventListener("pointermove", poke);
    window.addEventListener("pointerdown", poke);
    window.addEventListener("keydown", poke);
    return () => {
      window.removeEventListener("pointermove", poke);
      window.removeEventListener("pointerdown", poke);
      window.removeEventListener("keydown", poke);
      if (timer.current) clearTimeout(timer.current);
      clearTimeout(hintTimer);
    };
  }, [poke]);

  void world;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <AnimatePresence>
        {visible && (
          <motion.div
            key="topbar"
            className="absolute left-0 right-0 top-0 flex items-start justify-between p-6"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.8 }}
          >
            <div className="rounded-lg bg-black/30 px-4 py-2 backdrop-blur-md">
              <span className="block font-display text-sm tracking-[0.3em] text-white/90">
                {track.title.toUpperCase()}
              </span>
              <span className="block text-xs tracking-[0.2em] text-white/50">{track.artist}</span>
            </div>
            <button
              onClick={onExit}
              className="pointer-events-auto rounded-full border border-white/25 bg-black/30 px-5 py-2 text-xs uppercase tracking-[0.3em] text-white/80 backdrop-blur-md transition-colors hover:border-white/60 hover:text-white"
            >
              Exit
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible && (
          <motion.div
            key="bottombar"
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 p-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.8 }}
          >
            <button
              onClick={onToggle}
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white/85 backdrop-blur-md transition-colors hover:border-white/60 hover:text-white"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <span className="flex gap-1">
                  <span className="block h-4 w-1.5 bg-current" />
                  <span className="block h-4 w-1.5 bg-current" />
                </span>
              ) : (
                <span className="ml-0.5 block h-0 w-0 border-y-[8px] border-l-[13px] border-y-transparent border-l-current" />
              )}
            </button>
            <button
              onClick={onScreenshot}
              className="pointer-events-auto rounded-full border border-white/25 bg-black/30 px-5 py-3 text-xs uppercase tracking-[0.3em] text-white/80 backdrop-blur-md transition-colors hover:border-white/60 hover:text-white"
            >
              Capture
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHint && (
          <motion.div
            key="hint"
            className="absolute bottom-28 left-0 right-0 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
          >
            <span className="text-xs tracking-[0.3em] text-white/45">
              Drag to look &middot; W A S D to walk
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
