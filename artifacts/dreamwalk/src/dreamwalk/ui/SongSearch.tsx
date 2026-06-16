import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DreamSong } from "../dream/types";

const API_BASE = import.meta.env.BASE_URL;

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  artworkUrl: string | null;
  previewUrl: string | null;
  source: string;
}

async function searchSongsViaBackend(q: string): Promise<DreamSong[]> {
  const res = await fetch(`${API_BASE}api/search?${new URLSearchParams({ q })}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: SearchResult[] };
  return (data.results ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    album: r.album,
    artworkUrl: r.artworkUrl ?? "",
    previewUrl: r.previewUrl,
    genre: r.genre,
    source: r.source === "musixmatch" ? ("musixmatch" as const) : ("itunes" as const),
  }));
}

interface SongSearchProps {
  onSelect: (song: DreamSong) => void;
  accentColor?: string;
}

export function SongSearch({ onSelect, accentColor = "rgba(255,255,255,0.15)" }: SongSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DreamSong[]>([]);
  const [searching, setSearching] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const songs = await searchSongsViaBackend(q);
      setResults(songs.slice(0, 8));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void doSearch(query), 420);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePreview = (song: DreamSong) => {
    if (!song.previewUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 0.7;
    }
    const el = audioRef.current;
    if (previewing === song.id) {
      el.pause();
      setPreviewing(null);
      return;
    }
    el.src = song.previewUrl;
    void el.play().catch(() => undefined);
    setPreviewing(song.id);
    el.onended = () => setPreviewing(null);
  };

  const handleSelect = (song: DreamSong) => {
    audioRef.current?.pause();
    setPreviewing(null);
    onSelect(song);
    setQuery("");
    setResults([]);
  };

  void accentColor;

  return (
    <div className="w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any song or artist..."
          className="w-full rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm tracking-wide text-white placeholder-white/35 backdrop-blur-md outline-none transition-all focus:border-white/40 focus:bg-white/12"
          style={{ caretColor: "white" }}
        />
        {searching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <motion.span
              className="block h-4 w-4 rounded-full border border-white/30 border-t-white/80"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
          </span>
        )}
        {query && !searching && (
          <button
            onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
            aria-label="Clear"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        )}
      </div>

      <AnimatePresence>
        {results.length > 0 && (
          <motion.div
            className="mt-2 flex flex-col gap-1 overflow-hidden rounded-xl border border-white/10 bg-black/50 backdrop-blur-xl"
            initial={{ opacity: 0, y: -6, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.97 }}
            transition={{ duration: 0.22 }}
            style={{ transformOrigin: "top" }}
          >
            {results.map((song) => (
              <motion.button
                key={song.id}
                onClick={() => handleSelect(song)}
                className="group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/8"
                whileHover={{ x: 2 }}
              >
                {song.artworkUrl ? (
                  <img
                    src={song.artworkUrl}
                    alt={song.album}
                    className="h-10 w-10 shrink-0 rounded-lg object-cover opacity-90"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/40 text-xs">♪</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-light tracking-wide text-white">
                    {song.title}
                  </span>
                  <span className="block truncate text-xs tracking-wide text-white/50">
                    {song.artist}
                  </span>
                </span>
                {song.previewUrl && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); togglePreview(song); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); togglePreview(song); } }}
                    className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/60 transition-colors hover:border-white/50 hover:text-white"
                    aria-label={previewing === song.id ? "Stop" : "Preview"}
                  >
                    {previewing === song.id ? (
                      <span className="block h-2.5 w-2.5 bg-current" />
                    ) : (
                      <span className="ml-0.5 block h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent border-l-current" />
                    )}
                  </span>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
