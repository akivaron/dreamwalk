import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { World } from "../types";
import type { DreamContext } from "../dream/types";
import { dreamEvents } from "../audio/audioStore";

interface HudProps {
  title: string;
  artist: string;
  artworkUrl?: string;
  world: World;
  isPlaying: boolean;
  dreamContext: DreamContext;
  onToggle: () => void;
  onScreenshot: () => void;
  onExit: () => void;
  onToggleNarration: () => void;
  onToggleConcertMode: () => void;
}

export function Hud({
  title,
  artist,
  artworkUrl,
  world,
  isPlaying,
  dreamContext,
  onToggle,
  onScreenshot,
  onExit,
  onToggleNarration,
  onToggleConcertMode,
}: HudProps) {
  const [visible, setVisible] = useState(true);
  const [showHint, setShowHint] = useState(true);
  const [currentLine, setCurrentLine] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = useCallback(() => {
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 3500);
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

  useEffect(() => {
    let frame: number;
    const tick = () => {
      if (dreamEvents.currentLine !== currentLine) {
        setCurrentLine(dreamEvents.currentLine);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [currentLine]);

  void world;

  const hasConcert = !!dreamContext.concert;
  const narrationOn = dreamContext.narrationEnabled;

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <AnimatePresence>
        {visible && (
          <motion.div
            key="topbar"
            className="absolute left-0 right-0 top-0 flex items-start justify-between gap-3 p-5"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.8 }}
          >
            <div className="flex items-center gap-3 rounded-xl bg-black/30 px-4 py-2.5 backdrop-blur-md">
              {artworkUrl && (
                <img
                  src={artworkUrl}
                  alt={title}
                  className="h-10 w-10 shrink-0 rounded-lg object-cover opacity-90"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              )}
              <div>
                <span className="block font-display text-sm tracking-[0.3em] text-white/90">
                  {title.toUpperCase()}
                </span>
                <span className="block text-xs tracking-[0.2em] text-white/50">{artist}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {dreamContext.mood.primary !== "hopeful" && (
                <span className="rounded-full bg-black/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] text-white/50 backdrop-blur-md">
                  {dreamContext.mood.primary}
                </span>
              )}
              {hasConcert && (
                <button
                  onClick={onToggleConcertMode}
                  className={`pointer-events-auto rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.3em] backdrop-blur-md transition-all ${
                    dreamContext.concertModeActive
                      ? "bg-white/25 text-white border border-white/50"
                      : "bg-black/30 text-white/60 border border-white/20 hover:border-white/40"
                  }`}
                >
                  Concert
                </button>
              )}
              <button
                onClick={onExit}
                className="pointer-events-auto rounded-full border border-white/25 bg-black/30 px-5 py-2 text-xs uppercase tracking-[0.3em] text-white/80 backdrop-blur-md transition-colors hover:border-white/60 hover:text-white"
              >
                Exit
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {currentLine && (
          <motion.div
            key={currentLine}
            className="absolute left-0 right-0 bottom-32 flex justify-center px-8"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <p className="max-w-lg text-center text-sm font-light tracking-[0.15em] text-white/55 drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]">
              {currentLine}
            </p>
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

            {dreamContext.narrationText && (
              <button
                onClick={onToggleNarration}
                className={`pointer-events-auto rounded-full border px-4 py-3 text-xs uppercase tracking-[0.3em] backdrop-blur-md transition-colors ${
                  narrationOn
                    ? "border-white/40 bg-black/30 text-white/80 hover:border-white/60"
                    : "border-white/15 bg-black/20 text-white/35 hover:border-white/30"
                }`}
                title={narrationOn ? "Narration on" : "Narration off"}
              >
                Narrate
              </button>
            )}

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
            <span className="text-xs tracking-[0.3em] text-white/40">
              Drag to look &middot; W A S D to walk
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
