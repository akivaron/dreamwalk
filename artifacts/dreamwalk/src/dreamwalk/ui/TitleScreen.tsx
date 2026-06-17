import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { TrackDef } from "../types";
import type { DreamSong, TrendingTrack } from "../dream/types";
import { SongSearch } from "./SongSearch";
import { TrendingDreams } from "./TrendingDreams";
import { WORLDS } from "../worlds";
import { SpiritBackground } from "./SpiritBackground";

interface TitleScreenProps {
  tracks: TrackDef[];
  trackId: string;
  worldId: string;
  onSelectTrack: (id: string) => void;
  onSelectDreamSong: (song: DreamSong) => void;
  onEnter: () => void;
  onViewDetail?: (song: DreamSong) => void;
  trends: TrendingTrack[];
  isLoadingContext: boolean;
}

export function TitleScreen({
  tracks,
  trackId,
  worldId,
  onSelectTrack,
  onSelectDreamSong,
  onEnter,
  onViewDetail,
  trends,
  isLoadingContext,
}: TitleScreenProps) {
  const world = WORLDS.find((w) => w.id === worldId) ?? WORLDS[0];
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [selectedDreamSong, setSelectedDreamSong] = useState<DreamSong | null>(null);

  useEffect(() => {
    return () => {
      previewRef.current?.pause();
    };
  }, []);

  const togglePreview = (track: TrackDef) => {
    if (!track.file) return;
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

  const handleDreamSongSelect = (song: DreamSong) => {
    stopPreview();
    setSelectedDreamSong(song);
    onSelectDreamSong(song);
  };

  const handleClearDreamSong = () => {
    setSelectedDreamSong(null);
  };

  const handleTrendingExplore = (track: TrendingTrack) => {
    const song: DreamSong = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: "",
      artworkUrl: track.artworkUrl,
      previewUrl: null,
      genre: "Pop",
      source: "itunes",
    };
    handleDreamSongSelect(song);
  };

  // Can enter: always true for curated; for a searched song, wait until context is built
  const canEnter = selectedDreamSong ? !isLoadingContext : true;

  return (
    <motion.div
      className="absolute inset-0 z-20 flex flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.4, ease: "easeInOut" }}
      style={{
        background: `linear-gradient(160deg, ${world.colors.skyTop} 0%, ${world.colors.skyBottom} 100%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/38" />
      <SpiritBackground />

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="relative shrink-0 px-6 pt-10 pb-2 text-center">
        <motion.h1
          className="font-display text-5xl font-medium tracking-[0.4em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.5)] sm:text-7xl"
          initial={{ opacity: 0, y: 18, letterSpacing: "0.6em" }}
          animate={{ opacity: 1, y: 0, letterSpacing: "0.4em" }}
          transition={{ duration: 1.8, ease: "easeOut" }}
        >
          DREAMWALK
        </motion.h1>
        <motion.p
          className="mt-3 text-lg font-light tracking-[0.3em] text-white/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1.6 }}
        >
          Walk inside your music
        </motion.p>
      </div>

      {/* ── Scrollable middle ────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-6 py-6">
          <motion.div
            className="flex flex-col gap-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 1 }}
          >
            {/* ── Search field ──────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <SongSearch onSelect={handleDreamSongSelect} />

              {/* Selected search result card */}
              {selectedDreamSong && (
                <motion.div
                  className="flex items-center gap-3 rounded-xl border border-white/30 bg-white/10 px-4 py-3 backdrop-blur-md"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {selectedDreamSong.artworkUrl && (
                    <img
                      src={selectedDreamSong.artworkUrl}
                      alt={selectedDreamSong.title}
                      className="h-11 w-11 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-light tracking-wide text-white">
                      {selectedDreamSong.title}
                    </p>
                    <p className="truncate text-xs tracking-wide text-white/55">
                      {selectedDreamSong.artist}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isLoadingContext ? (
                      <motion.span
                        className="block h-4 w-4 rounded-full border border-white/30 border-t-white/80"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                      />
                    ) : (
                      <span className="text-[10px] tracking-[0.2em] text-white/40">
                        Selected
                      </span>
                    )}
                    <button
                      onClick={handleClearDreamSong}
                      className="ml-1 text-white/35 transition-colors hover:text-white/70"
                      aria-label="Clear selection"
                    >
                      <span className="text-lg leading-none">&times;</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── Divider ───────────────────────────────────────── */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] tracking-[0.3em] text-white/35 uppercase">
                or choose below
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* ── Curated list ──────────────────────────────────── */}
            <div className="flex flex-col gap-2">
              {tracks.map((track) => {
                const active = track.id === trackId && !selectedDreamSong;
                return (
                  <div key={track.id}>
                    <button
                      onClick={() => { stopPreview(); handleClearDreamSong(); onSelectTrack(track.id); }}
                      className={`group flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left backdrop-blur-md transition-all duration-300 ${
                        active
                          ? "border-white/60 bg-white/15"
                          : "border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {track.artworkUrl ? (
                          <img
                            src={track.artworkUrl}
                            alt={track.title}
                            className="h-10 w-10 shrink-0 rounded-lg object-cover opacity-90"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/8 text-white/20">
                            <span className="block h-4 w-4 rounded-full border border-current" />
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-base font-light tracking-wide text-white">
                            {track.title}
                          </span>
                          <span className="block truncate text-sm tracking-wide text-white/55">
                            {track.artist}
                          </span>
                        </span>
                      </span>
                      <span className="ml-3 flex shrink-0 items-center gap-2">
                        {onViewDetail && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewDetail({
                                id: track.id,
                                title: track.title,
                                artist: track.artist,
                                album: "",
                                artworkUrl: track.artworkUrl ?? "",
                                previewUrl: track.file,
                                genre: "Pop",
                                source: "itunes",
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                onViewDetail({
                                  id: track.id,
                                  title: track.title,
                                  artist: track.artist,
                                  album: "",
                                  artworkUrl: track.artworkUrl ?? "",
                                  previewUrl: track.file,
                                  genre: "Pop",
                                  source: "itunes",
                                });
                              }
                            }}
                            className="rounded-full border border-white/20 bg-white/8 px-3 py-1 text-[10px] tracking-widest text-white/55 transition-all hover:bg-white/15 hover:text-white whitespace-nowrap"
                            aria-label="View song details"
                          >
                            Details →
                          </span>
                        )}
                        {track.file && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); togglePreview(track); }}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); togglePreview(track); } }}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-white/60 hover:text-white"
                            aria-label={previewing === track.id ? "Stop preview" : "Preview"}
                          >
                            {previewing === track.id ? (
                              <span className="block h-3 w-3 bg-current" />
                            ) : (
                              <span className="ml-0.5 block h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-current" />
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {trends.length > 0 && (
            <motion.div
              className="mt-8 w-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 1 }}
            >
              <TrendingDreams tracks={trends} onExplore={handleTrendingExplore} />
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div className="relative shrink-0 flex flex-col items-center gap-5 px-6 pb-10 pt-5">
        <motion.button
          onClick={() => { stopPreview(); onEnter(); }}
          disabled={!canEnter}
          className={`rounded-full border px-12 py-4 text-sm uppercase tracking-[0.4em] text-white backdrop-blur-md transition-all duration-500 ${
            canEnter
              ? "border-white/40 bg-white/10 hover:border-white/80 hover:bg-white/20"
              : "cursor-not-allowed border-white/15 bg-white/5 text-white/40"
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          whileHover={canEnter ? { scale: 1.03 } : {}}
          whileTap={canEnter ? { scale: 0.98 } : {}}
        >
          Enter the dream
        </motion.button>
        <p className="text-center text-xs tracking-[0.25em] text-white/40">
          Drag to look &middot; W A S D to walk &middot; Headphones recommended
        </p>
      </div>
    </motion.div>
  );
}
