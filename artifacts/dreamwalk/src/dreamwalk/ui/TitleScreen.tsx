import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { TrackDef, World } from "../types";

interface TitleScreenProps {
  tracks: TrackDef[];
  worlds: World[];
  trackId: string;
  worldId: string;
  onSelectTrack: (id: string) => void;
  onSelectWorld: (id: string) => void;
  onEnter: () => void;
}

export function TitleScreen({
  tracks,
  worlds,
  trackId,
  worldId,
  onSelectTrack,
  onSelectWorld,
  onEnter,
}: TitleScreenProps) {
  const world = worlds.find((w) => w.id === worldId) ?? worlds[0];
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      previewRef.current?.pause();
    };
  }, []);

  const togglePreview = (track: TrackDef) => {
    if (!previewRef.current) {
      previewRef.current = new Audio();
      previewRef.current.loop = true;
      previewRef.current.volume = 0.7;
    }
    const el = previewRef.current;
    if (previewing === track.id) {
      el.pause();
      setPreviewing(null);
      return;
    }
    el.src = track.file;
    void el.play().catch(() => undefined);
    setPreviewing(track.id);
  };

  const stopPreview = () => {
    previewRef.current?.pause();
    setPreviewing(null);
  };

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.4, ease: "easeInOut" }}
      style={{
        background: `linear-gradient(160deg, ${world.colors.skyTop} 0%, ${world.colors.skyBottom} 100%)`,
      }}
    >
      <div className="absolute inset-0 bg-black/35" />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-16">
        <motion.h1
          className="font-display text-center text-5xl font-medium tracking-[0.4em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)] sm:text-7xl"
          initial={{ opacity: 0, y: 18, letterSpacing: "0.6em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "0.4em" }}
          transition={{ duration: 1.8, ease: "easeOut" }}
        >
          DREAMWALK
        </motion.h1>
        <motion.p
          className="mt-5 text-center text-xl font-light tracking-[0.3em] text-white/80 sm:text-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1.6 }}
        >
          Walk inside your music
        </motion.p>

        <div className={`mt-14 w-full ${worlds.length > 1 ? "grid grid-cols-1 gap-8 md:grid-cols-2" : "flex justify-center"}`}>
          <section className={worlds.length > 1 ? "" : "w-full max-w-md"}>
            <h2 className={`mb-4 text-xs font-medium uppercase tracking-[0.4em] text-white/60 ${worlds.length > 1 ? "" : "text-center"}`}>
              Choose a song
            </h2>
            <div className="flex flex-col gap-2">
              {tracks.map((track) => {
                const active = track.id === trackId;
                return (
                  <button
                    key={track.id}
                    onClick={() => onSelectTrack(track.id)}
                    className={`group flex items-center justify-between rounded-xl border px-4 py-3 text-left backdrop-blur-md transition-all duration-300 ${
                      active
                        ? "border-white/60 bg-white/15"
                        : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-lg font-light tracking-wide text-white">
                        {track.title}
                      </span>
                      <span className="block truncate text-sm tracking-wide text-white/55">
                        {track.artist}
                      </span>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePreview(track);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          togglePreview(track);
                        }
                      }}
                      className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-white/60 hover:text-white"
                      aria-label={previewing === track.id ? "Stop preview" : "Preview"}
                    >
                      {previewing === track.id ? (
                        <span className="block h-3 w-3 bg-current" />
                      ) : (
                        <span className="ml-0.5 block h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-current" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {worlds.length > 1 && (
            <section>
              <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.4em] text-white/60">
                Choose a world
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {worlds.map((w) => {
                  const active = w.id === worldId;
                  return (
                    <button
                      key={w.id}
                      onClick={() => onSelectWorld(w.id)}
                      className={`overflow-hidden rounded-xl border text-left backdrop-blur-md transition-all duration-300 ${
                        active
                          ? "border-white/70 ring-1 ring-white/40"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <div
                        className="relative h-16 w-full"
                        style={{
                          background: `linear-gradient(155deg, ${w.colors.skyTop} 0%, ${w.colors.skyBottom} 60%, ${w.colors.ground} 100%)`,
                        }}
                      >
                        <span
                          className="absolute right-3 top-3 h-4 w-4 rounded-full"
                          style={{
                            background: w.colors.sun,
                            boxShadow: `0 0 14px 3px ${w.colors.sunGlow}`,
                          }}
                        />
                      </div>
                      <div className="bg-black/40 px-3 py-2">
                        <span className="block text-sm font-light tracking-wide text-white">
                          {w.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <motion.button
          onClick={() => {
            stopPreview();
            onEnter();
          }}
          className="mt-14 rounded-full border border-white/40 bg-white/10 px-12 py-4 text-sm uppercase tracking-[0.4em] text-white backdrop-blur-md transition-all duration-500 hover:border-white/80 hover:bg-white/20"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
        >
          Enter the dream
        </motion.button>

        <p className="mt-8 text-center text-xs tracking-[0.25em] text-white/40">
          Drag to look &middot; W A S D to walk &middot; Headphones recommended
        </p>
      </div>
    </motion.div>
  );
}
