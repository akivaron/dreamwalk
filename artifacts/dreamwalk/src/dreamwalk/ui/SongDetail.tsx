import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DreamSong, LyricsData, MoodData, TrendingTrack } from "../dream/types";
import { fetchLyrics } from "../dream/api/lyrics";
import { extractKeywords, inferMood } from "../dream/keywordAnalysis";

// ─── Constants ───────────────────────────────────────────────────────────────

const MOOD_EMOJI: Record<string, string> = {
  hopeful: "😊", melancholic: "😔", epic: "⚡", calm: "🌊",
  energetic: "🔥", dark: "🌑", romantic: "💗", nostalgic: "🌅",
};
const MOOD_LABEL: Record<string, string> = {
  hopeful: "Hopeful", melancholic: "Melancholic", epic: "Epic", calm: "Calm",
  energetic: "Energetic", dark: "Dark", romantic: "Romantic", nostalgic: "Nostalgic",
};
const THEME_EMOJI: Record<string, string> = {
  ocean: "🌊", stars: "✨", night: "🌙", rain: "🌧️", fire: "🔥",
  snow: "❄️", mountain: "⛰️", home: "🏠", city: "🌆", heaven: "☁️",
  love: "💗", loneliness: "🌌", hope: "🌅", sadness: "💧", joy: "☀️",
  journey: "🛤️", aurora: "🌌", forest: "🌲", desert: "🏜️",
};

function energyLabel(e: number) {
  if (e > 0.7) return "High";
  if (e > 0.4) return "Medium";
  return "Low";
}

function getLargeArtwork(url: string): string {
  if (!url) return url;
  return url.replace(/\d+x\d+bb/, "600x600bb");
}

function formatTime(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

function WaveformBars({ isPlaying }: { isPlaying: boolean }) {
  const bars = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        peak: 20 + Math.abs(Math.sin(i * 0.7 + 1.2) * 28 + Math.cos(i * 0.4) * 18),
        dur: 0.22 + (i % 7) * 0.038,
        delay: i * 0.012,
      })),
    [],
  );
  return (
    <div className="flex items-end gap-[2px] h-10">
      {bars.map((b, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-full bg-white/50"
          animate={
            isPlaying
              ? { height: ["12%", `${b.peak}%`, "12%"] }
              : { height: "12%" }
          }
          transition={{
            duration: b.dur,
            repeat: isPlaying ? Infinity : 0,
            repeatType: "reverse",
            delay: b.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ─── useSongInsights hook ─────────────────────────────────────────────────────

const DEFAULT_MOOD: MoodData = { primary: "hopeful", secondary: null, energy: 0.5, valence: 0.6 };

interface SongInsights {
  lyrics: LyricsData | null;
  keywords: string[];
  themes: string[];
  mood: MoodData;
  loading: boolean;
}

function useSongInsights(song: DreamSong): SongInsights {
  const [ins, setIns] = useState<SongInsights>({
    lyrics: null, keywords: [], themes: [], mood: DEFAULT_MOOD, loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const lyrics = await fetchLyrics(song.artist, song.title);
      if (cancelled) return;
      const text = lyrics?.raw ?? `${song.title} ${song.artist} ${song.album}`;
      const keywords = extractKeywords(text);
      const mood = inferMood(keywords, song.title, song.artist);
      setIns({ lyrics, keywords, themes: keywords.slice(0, 6), mood, loading: false });
    })();
    return () => { cancelled = true; };
  }, [song.id, song.artist, song.title, song.album]);

  return ins;
}

// ─── Glass Card ───────────────────────────────────────────────────────────────

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

// ─── End-of-preview modal ─────────────────────────────────────────────────────

function EndModal({
  onEnterDream,
  onClose,
  onExplore,
}: {
  onEnterDream: () => void;
  onClose: () => void;
  onExplore: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        className="relative rounded-3xl border border-white/20 bg-gradient-to-b from-white/10 to-white/5 px-10 py-10 text-center shadow-2xl backdrop-blur-2xl max-w-sm w-full mx-6"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 22, stiffness: 260 }}
      >
        <div className="mb-2 text-4xl">🎵</div>
        <h3 className="text-xl font-light tracking-widest text-white">
          Continue the journey.
        </h3>
        <p className="mt-2 text-sm tracking-wide text-white/50">
          The preview has ended. Step deeper into the music.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={onEnterDream}
            className="flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/15 px-6 py-3 text-sm tracking-widest text-white backdrop-blur-md transition-all hover:bg-white/25 hover:border-white/50"
          >
            <span>✨</span> Enter Dream
          </button>
          <button
            onClick={onExplore}
            className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-transparent px-6 py-3 text-sm tracking-widest text-white/70 transition-all hover:text-white hover:border-white/30"
          >
            <span>🔍</span> Explore Another Song
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Trending discovery cards ─────────────────────────────────────────────────

function DiscoveryCard({
  track,
  onExplore,
}: {
  track: TrendingTrack;
  onExplore: () => void;
}) {
  return (
    <motion.button
      onClick={onExplore}
      className="group flex shrink-0 flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-left backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/10"
      style={{ width: 140 }}
      whileHover={{ scale: 1.03, y: -3 }}
      whileTap={{ scale: 0.97 }}
    >
      {track.artworkUrl ? (
        <img
          src={track.artworkUrl}
          alt={track.title}
          className="h-28 w-full rounded-xl object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      ) : (
        <div className="flex h-28 w-full items-center justify-center rounded-xl bg-white/10 text-3xl">
          ♪
        </div>
      )}
      <span className="line-clamp-1 text-xs font-light text-white/80">{track.title}</span>
      <span className="line-clamp-1 text-[10px] text-white/45">{track.artist}</span>
    </motion.button>
  );
}

// ─── Main SongDetail component ────────────────────────────────────────────────

interface SongDetailProps {
  song: DreamSong;
  trends: TrendingTrack[];
  onEnterDream: (song: DreamSong) => void;
  onBack: () => void;
  onExploreSong?: (track: TrendingTrack) => void;
}

export function SongDetail({
  song,
  trends,
  onEnterDream,
  onBack,
  onExploreSong,
}: SongDetailProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [showEndModal, setShowEndModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const insights = useSongInsights(song);
  const largeArt = getLargeArtwork(song.artworkUrl);

  // ── Audio controls ──
  const togglePreview = () => {
    if (!song.previewUrl) return;
    if (!audioRef.current) {
      const el = new Audio(song.previewUrl);
      el.addEventListener("timeupdate", () => setProgress(el.currentTime));
      el.addEventListener("loadedmetadata", () => setAudioDuration(el.duration));
      el.addEventListener("ended", () => { setIsPlaying(false); setShowEndModal(true); });
      audioRef.current = el;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      void audioRef.current.play().catch(() => undefined);
      setIsPlaying(true);
    }
  };

  const seekTo = (ratio: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = ratio * audioRef.current.duration;
    setProgress(audioRef.current.currentTime);
  };

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  // ── Share ──
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const progressRatio = audioDuration > 0 ? progress / audioDuration : 0;
  const moodEmoji = MOOD_EMOJI[insights.mood.primary] ?? "✨";
  const moodLbl = MOOD_LABEL[insights.mood.primary] ?? insights.mood.primary;
  const energyPct = Math.round(insights.mood.energy * 100);
  const lyricsPreview = insights.lyrics?.synced.slice(0, 6) ?? [];

  return (
    <div className="relative min-h-screen bg-[#080c18] text-white overflow-y-auto">
      {/* ── Blurred artwork background ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {song.artworkUrl && (
          <img
            src={largeArt}
            alt=""
            className="absolute inset-0 h-full w-full object-cover scale-110 opacity-20"
            style={{ filter: "blur(60px)", transform: "scale(1.15)" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080c18]/60 via-[#080c18]/80 to-[#080c18]" />

        {/* Pulse ring when playing */}
        <AnimatePresence>
          {isPlaying && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[1, 2, 3].map((n) => (
                <motion.div
                  key={n}
                  className="absolute rounded-full border border-white/8"
                  style={{ width: `${20 + n * 22}vw`, height: `${20 + n * 22}vw` }}
                  animate={{ scale: [1, 1.08, 1], opacity: [0.18, 0.05, 0.18] }}
                  transition={{ duration: 2.4, delay: n * 0.6, repeat: Infinity, ease: "easeInOut" }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-xl border-b border-white/5 bg-[#080c18]/60">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm tracking-widest text-white/60 transition-colors hover:text-white"
        >
          <span className="text-lg leading-none">←</span>
          <span>Back</span>
        </button>
        <span className="text-xs tracking-[0.5em] text-white/30 font-light uppercase">
          DreamWalk
        </span>
        <div style={{ width: 80 }} />
      </header>

      {/* ── Main content ── */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8">
        {/* ── 3-column grid ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_280px]">

          {/* ════ LEFT: Metadata ════ */}
          <motion.aside
            className="flex flex-col gap-4"
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            {/* Album art */}
            <div className="aspect-square w-full overflow-hidden rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
              {song.artworkUrl ? (
                <img
                  src={largeArt}
                  alt={`${song.title} artwork`}
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/5 text-6xl">
                  ♪
                </div>
              )}
            </div>

            {/* Track identity */}
            <GlassCard className="p-5">
              <p className="text-xl font-light leading-snug tracking-wide text-white">
                {song.title}
              </p>
              <p className="mt-1 text-sm text-white/55 tracking-wider">{song.artist}</p>
              {song.album && (
                <p className="mt-0.5 text-xs text-white/35 tracking-wide">{song.album}</p>
              )}
            </GlassCard>

            {/* Metadata pills */}
            <GlassCard className="p-5 flex flex-col gap-3">
              <h4 className="text-[10px] uppercase tracking-[0.4em] text-white/40">Details</h4>
              {song.genre && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45 tracking-wide">Genre</span>
                  <span className="rounded-full border border-white/15 bg-white/8 px-3 py-0.5 text-[11px] text-white/70 tracking-wide">
                    {song.genre}
                  </span>
                </div>
              )}
              {song.source && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45 tracking-wide">Source</span>
                  <span className="text-[11px] text-white/50 capitalize tracking-wide">
                    {song.source === "musixmatch" ? "Musixmatch" : song.source === "itunes" ? "Apple Music" : "Curated"}
                  </span>
                </div>
              )}
              {audioDuration > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45 tracking-wide">Preview</span>
                  <span className="text-[11px] text-white/50 tracking-wide">{formatTime(audioDuration)}</span>
                </div>
              )}
              {insights.mood.source && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/45 tracking-wide">Analysis</span>
                  <span className="text-[11px] text-white/50 capitalize tracking-wide">
                    {insights.mood.source === "cyanite" ? "Cyanite AI" : "Heuristic"}
                  </span>
                </div>
              )}
            </GlassCard>

            {/* Spotify / Apple links */}
            <GlassCard className="p-5 flex flex-col gap-2">
              <h4 className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-1">Listen On</h4>
              {song.spotifyTrackId && (
                <a
                  href={`https://open.spotify.com/track/${song.spotifyTrackId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs tracking-widest text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  <span className="text-[#1DB954] text-base">●</span>
                  Open in Spotify
                </a>
              )}
              <a
                href={`https://music.apple.com/search?term=${encodeURIComponent(`${song.title} ${song.artist}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs tracking-widest text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                <span className="text-[#FC3C44] text-base">●</span>
                Apple Music
              </a>
            </GlassCard>
          </motion.aside>

          {/* ════ CENTER: Hero + Player ════ */}
          <motion.main
            className="flex flex-col gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
          >
            {/* Hero art banner */}
            <div className="relative overflow-hidden rounded-3xl" style={{ minHeight: 260 }}>
              {song.artworkUrl && (
                <>
                  <img
                    src={largeArt}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover scale-110"
                    style={{ filter: "blur(24px)", opacity: 0.55 }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080c18] via-[#080c18]/40 to-transparent" />
                </>
              )}
              <div className="relative z-10 flex h-full flex-col justify-end p-8">
                {/* Animated artwork */}
                <motion.div
                  className="mb-6 flex justify-center"
                  animate={isPlaying ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                  transition={{ duration: 2.8, repeat: isPlaying ? Infinity : 0, ease: "easeInOut" }}
                >
                  {song.artworkUrl ? (
                    <img
                      src={largeArt}
                      alt={song.title}
                      className="h-32 w-32 rounded-2xl object-cover shadow-[0_16px_60px_rgba(0,0,0,0.8)]"
                    />
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-white/10 text-5xl">
                      ♪
                    </div>
                  )}
                </motion.div>

                <h1 className="text-3xl font-light tracking-[0.06em] text-white drop-shadow-lg">
                  {song.title}
                </h1>
                <p className="mt-1 text-base tracking-[0.15em] text-white/60">{song.artist}</p>
              </div>
            </div>

            {/* Action buttons */}
            <GlassCard className="p-6">
              <div className="flex flex-wrap gap-3">
                {/* Preview */}
                {song.previewUrl ? (
                  <motion.button
                    onClick={togglePreview}
                    className="flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-5 py-2.5 text-sm tracking-widest text-white backdrop-blur-md transition-all hover:bg-white/25"
                    whileTap={{ scale: 0.96 }}
                  >
                    <span>{isPlaying ? "⏸" : "▶"}</span>
                    <span>{isPlaying ? "Pause" : "Preview"}</span>
                  </motion.button>
                ) : (
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm tracking-widest text-white/35 cursor-not-allowed">
                    <span>▶</span>
                    <span>No Preview</span>
                  </div>
                )}

                {/* Enter Dream */}
                <motion.button
                  onClick={() => onEnterDream(song)}
                  className="flex items-center gap-2 rounded-full border border-white/40 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 px-5 py-2.5 text-sm tracking-widest text-white backdrop-blur-md transition-all hover:from-indigo-500/50 hover:to-purple-500/50 hover:border-white/60"
                  whileTap={{ scale: 0.96 }}
                >
                  <span>✨</span>
                  <span>Enter Dream</span>
                </motion.button>

                {/* Save */}
                <motion.button
                  onClick={() => setIsSaved((s) => !s)}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm tracking-widest text-white/70 transition-all hover:bg-white/10 hover:text-white"
                  whileTap={{ scale: 0.96 }}
                >
                  <span>{isSaved ? "♥" : "♡"}</span>
                  <span>{isSaved ? "Saved" : "Save"}</span>
                </motion.button>

                {/* Share */}
                <motion.button
                  onClick={() => void handleShare()}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm tracking-widest text-white/70 transition-all hover:bg-white/10 hover:text-white"
                  whileTap={{ scale: 0.96 }}
                >
                  <span>{copied ? "✓" : "↗"}</span>
                  <span>{copied ? "Copied!" : "Share"}</span>
                </motion.button>
              </div>

              {/* Preview player */}
              <div className="mt-5 space-y-3">
                <WaveformBars isPlaying={isPlaying} />

                {/* Progress bar */}
                {song.previewUrl && (
                  <div className="space-y-1.5">
                    <div
                      className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/10 overflow-hidden"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        seekTo((e.clientX - rect.left) / rect.width);
                      }}
                    >
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-white/70"
                        style={{ width: `${progressRatio * 100}%` }}
                        transition={{ ease: "linear" }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] tracking-widest text-white/40">
                      <span>{formatTime(progress)}</span>
                      <span>{audioDuration > 0 ? formatTime(audioDuration) : "0:30"}</span>
                    </div>
                  </div>
                )}

                {!song.previewUrl && (
                  <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-center">
                    <p className="text-sm text-white/50 tracking-wide">No official preview available.</p>
                    <div className="mt-3 flex justify-center gap-3">
                      <button
                        onClick={() => onEnterDream(song)}
                        className="rounded-full border border-white/20 bg-white/8 px-4 py-1.5 text-xs tracking-widest text-white/70 transition-all hover:bg-white/15 hover:text-white"
                      >
                        ✨ Enter Dream anyway
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>

            {/* Lyrics preview */}
            <GlassCard className="p-6">
              <h3 className="mb-4 text-[10px] uppercase tracking-[0.4em] text-white/40">
                Lyrics Preview
              </h3>
              {insights.loading ? (
                <div className="flex items-center gap-2 text-sm text-white/30">
                  <motion.span
                    className="block h-3 w-3 rounded-full border border-white/30 border-t-white/70"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  />
                  Loading lyrics...
                </div>
              ) : lyricsPreview.length > 0 ? (
                <div className="space-y-2">
                  {lyricsPreview.map((line, i) => (
                    <motion.p
                      key={i}
                      className="flex items-start gap-2 text-sm font-light leading-relaxed text-white/70 tracking-wide"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <span className="mt-0.5 text-white/25 shrink-0">♪</span>
                      <span>{line.text}</span>
                    </motion.p>
                  ))}
                  <p className="mt-3 text-xs tracking-widest text-white/25 italic">
                    Enter Dream to experience the full song visually.
                  </p>
                </div>
              ) : (
                <p className="text-sm tracking-wide text-white/40 italic">
                  Enter Dream to experience the song visually.
                </p>
              )}
            </GlassCard>
          </motion.main>

          {/* ════ RIGHT: Song Insights ════ */}
          <motion.aside
            className="flex flex-col gap-4"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          >
            <GlassCard className="p-5">
              <h3 className="mb-4 text-[10px] uppercase tracking-[0.4em] text-white/40">
                Song Insights
              </h3>

              {insights.loading ? (
                <div className="flex items-center gap-2 text-sm text-white/30">
                  <motion.span
                    className="block h-3 w-3 rounded-full border border-white/30 border-t-white/70"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  />
                  Analysing...
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Mood */}
                  <div>
                    <p className="mb-1.5 text-[10px] uppercase tracking-[0.3em] text-white/35">Mood</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{moodEmoji}</span>
                      <span className="text-sm tracking-wide text-white/80">{moodLbl}</span>
                    </div>
                  </div>

                  {/* Energy */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-white/35">Energy</p>
                      <span className="text-xs text-white/50 tracking-wider">
                        {energyLabel(insights.mood.energy)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400/60 to-purple-400/80"
                        initial={{ width: 0 }}
                        animate={{ width: `${energyPct}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] tracking-widest text-white/25">
                      <span>Low</span><span>High</span>
                    </div>
                  </div>

                  {/* Themes */}
                  {insights.themes.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">Themes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {insights.themes.map((t) => (
                          <span
                            key={t}
                            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] tracking-wide text-white/65"
                          >
                            {THEME_EMOJI[t] ?? "🎵"} {t.charAt(0).toUpperCase() + t.slice(1)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Keywords */}
                  {insights.keywords.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/35">Keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {insights.keywords.slice(0, 8).map((k) => (
                          <span
                            key={k}
                            className="rounded-full border border-white/8 bg-white/3 px-2.5 py-1 text-[10px] tracking-widest text-white/45 lowercase"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meta stats */}
                  <div className="space-y-2 border-t border-white/8 pt-4">
                    <div className="flex justify-between">
                      <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Language</span>
                      <span className="text-[11px] text-white/55 tracking-wider">English</span>
                    </div>
                    {song.genre && (
                      <div className="flex justify-between">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Genre</span>
                        <span className="text-[11px] text-white/55 tracking-wider">{song.genre}</span>
                      </div>
                    )}
                    {audioDuration > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Preview</span>
                        <span className="text-[11px] text-white/55 tracking-wider">{formatTime(audioDuration)}</span>
                      </div>
                    )}
                  </div>

                  {/* Enter Dream CTA */}
                  <motion.button
                    onClick={() => onEnterDream(song)}
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-gradient-to-br from-indigo-500/25 to-purple-600/25 py-4 text-sm tracking-[0.3em] text-white/90 backdrop-blur-md transition-all hover:from-indigo-500/40 hover:to-purple-600/40 hover:border-white/40"
                    whileTap={{ scale: 0.97 }}
                  >
                    ✨ Enter Dream
                  </motion.button>
                </div>
              )}
            </GlassCard>

            {/* Valence card */}
            {!insights.loading && (
              <GlassCard className="p-5">
                <h4 className="mb-3 text-[10px] uppercase tracking-[0.4em] text-white/40">Emotional Tone</h4>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-[10px] tracking-widest text-white/35">
                      <span>Sad</span><span>Joyful</span>
                    </div>
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className="absolute inset-y-0 rounded-full bg-gradient-to-r from-blue-400/50 to-yellow-300/70"
                        initial={{ width: 0 }}
                        animate={{ width: `${insights.mood.valence * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.7 }}
                      />
                    </div>
                  </div>
                  {insights.mood.secondary && (
                    <p className="text-[11px] tracking-wide text-white/40">
                      Secondary: {MOOD_LABEL[insights.mood.secondary] ?? insights.mood.secondary}
                    </p>
                  )}
                </div>
              </GlassCard>
            )}
          </motion.aside>
        </div>

        {/* ── Discovery section ── */}
        {trends.length > 0 && (
          <motion.section
            className="mt-10"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <h2 className="mb-4 text-[10px] uppercase tracking-[0.4em] text-white/40">
              Trending Dreams
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none">
              {trends.map((track) => (
                <DiscoveryCard
                  key={track.id}
                  track={track}
                  onExplore={() => onExploreSong?.(track)}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* Bottom padding */}
        <div className="h-16" />
      </div>

      {/* ── End-of-preview modal ── */}
      <AnimatePresence>
        {showEndModal && (
          <EndModal
            onEnterDream={() => { setShowEndModal(false); onEnterDream(song); }}
            onClose={() => setShowEndModal(false)}
            onExplore={() => { setShowEndModal(false); onBack(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
