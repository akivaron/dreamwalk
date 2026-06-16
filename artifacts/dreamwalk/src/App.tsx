import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Experience } from "./dreamwalk/scene/Experience";
import { TitleScreen } from "./dreamwalk/ui/TitleScreen";
import { SongDetail } from "./dreamwalk/ui/SongDetail";
import { Hud } from "./dreamwalk/ui/Hud";
import { WebGLBoundary } from "./dreamwalk/ui/WebGLBoundary";
import { DreamLoadingScreen } from "./dreamwalk/ui/DreamLoadingScreen";
import { TRACKS } from "./dreamwalk/tracks";
import { useCuratedSongs } from "./dreamwalk/dream/useCuratedSongs";
import { WORLDS } from "./dreamwalk/worlds";
import { useAudioEngine } from "./dreamwalk/audio/useAudioEngine";
import { resetAudioLevels, dreamEvents } from "./dreamwalk/audio/audioStore";
import { useDreamContext } from "./dreamwalk/dream/useDreamContext";
import { buildWorldFromContext } from "./dreamwalk/dream/worldBuilder";
import { generateNarration } from "./dreamwalk/dream/api/narration";
import type { DreamSong, TrendingTrack } from "./dreamwalk/dream/types";
import { songDetailStore } from "./dreamwalk/songDetailStore";

type Phase = "title" | "entering" | "experience" | "exiting";

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

function toProxiedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const itunes = ["audio-ssl.itunes.apple.com", "audio.itunes.apple.com", "a1.mzstatic.com"];
    if (itunes.some((h) => u.hostname === h || u.hostname.endsWith("." + h))) {
      return `${API_BASE}/audio-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch { /* not an absolute URL, leave as-is */ }
  return url;
}

export default function App() {
  const [matchDetail] = useRoute("/song/:id");
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<Phase>("title");
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [songMode, setSongMode] = useState<"curated" | "dream">("curated");
  const [narrationPlayed, setNarrationPlayed] = useState(false);

  const engine = useAudioEngine();
  const screenshotFn = useRef<(() => string) | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const climaxFiredRef = useRef(false);
  const climaxRafRef = useRef<number | null>(null);
  const autoEnterRef = useRef(false);

  const dream = useDreamContext();
  const curatedSongs = useCuratedSongs();

  const curatedTrack = curatedSongs.find((t) => t.id === trackId) ?? curatedSongs[0] ?? TRACKS[0];

  const activeWorld =
    songMode === "dream" && dream.ready
      ? buildWorldFromContext(dream.context)
      : WORLDS.find((w) => w.id === (WORLDS.find((x) => x.id === curatedTrack.suggestedWorld) ? curatedTrack.suggestedWorld : "savana-valley")) ?? WORLDS[0];

  const activeTitle =
    songMode === "dream" && dream.context.song
      ? dream.context.song.title
      : curatedTrack.title;
  const activeArtist =
    songMode === "dream" && dream.context.song
      ? dream.context.song.artist
      : curatedTrack.artist;
  const activeArtwork =
    songMode === "dream" && dream.context.song?.artworkUrl
      ? dream.context.song.artworkUrl
      : undefined;
  const activeAudioFile: string | null =
    songMode === "dream"
      ? toProxiedUrl(dream.context.song?.previewUrl)
      : curatedTrack.file;

  const clearTransition = useCallback(() => {
    if (transitionTimer.current !== null) {
      clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
  }, []);

  useEffect(() => clearTransition, [clearTransition]);

  const handleSelectTrack = useCallback(
    (id: string) => {
      setSongMode("curated");
      setTrackId(id);
      const t = curatedSongs.find((x) => x.id === id);
      if (t) {
        dream.buildForCuratedTrack(id, t.title, t.artist, t.suggestedWorld);
      }
    },
    [dream, curatedSongs],
  );

  const handleSelectDreamSong = useCallback(
    (song: DreamSong) => {
      setSongMode("dream");
      void dream.buildForSong(song);
    },
    [dream],
  );

  // Navigate to detail page without starting dream build yet
  const handleViewDetail = useCallback(
    (song: DreamSong) => {
      songDetailStore.set(song);
      navigate(`/song/${encodeURIComponent(song.id)}`);
    },
    [navigate],
  );

  // From SongDetail: start dream build, auto-enter when ready
  const handleEnterDreamFromDetail = useCallback(
    (song: DreamSong) => {
      autoEnterRef.current = true;
      setSongMode("dream");
      void dream.buildForSong(song);
      navigate("/");
    },
    [dream, navigate],
  );

  // From SongDetail discovery: navigate to another song's detail page
  const handleExploreSongFromDetail = useCallback(
    (track: TrendingTrack) => {
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
      songDetailStore.set(song);
      navigate(`/song/${encodeURIComponent(song.id)}`);
    },
    [navigate],
  );

  const playNarrationAudio = useCallback((url: string, volume = 0.75) => {
    if (!narrationAudioRef.current) {
      narrationAudioRef.current = new Audio();
    }
    const el = narrationAudioRef.current;
    el.src = url;
    el.volume = volume;
    void el.play().catch(() => undefined);
  }, []);

  const playNarration = useCallback(() => {
    const { context } = dream;
    if (!context.narrationEnabled || !context.narrationAudioUrl || narrationPlayed) return;
    playNarrationAudio(context.narrationAudioUrl, 0.75);
    setNarrationPlayed(true);
  }, [dream, narrationPlayed, playNarrationAudio]);

  const startClimaxWatcher = useCallback(() => {
    climaxFiredRef.current = false;
    let wasEmotional = false;

    const tick = () => {
      if (climaxFiredRef.current) return;
      const isNow = dreamEvents.isEmotionalLine;
      if (isNow && !wasEmotional) {
        climaxFiredRef.current = true;
        const { context } = dream;
        if (context.narrationEnabled && context.song && context.mood) {
          const climaxLine = dreamEvents.currentLine;
          const text = climaxLine
            ? `"${climaxLine}" — feel this moment.`
            : `This is the heart of the dream. Let it wash over you.`;
          void generateNarration(text).then((result) => {
            if (result.audioUrl) {
              playNarrationAudio(result.audioUrl, 0.6);
            }
          });
        }
        return;
      }
      wasEmotional = isNow;
      climaxRafRef.current = requestAnimationFrame(tick);
    };
    climaxRafRef.current = requestAnimationFrame(tick);
  }, [dream, playNarrationAudio]);

  const stopClimaxWatcher = useCallback(() => {
    if (climaxRafRef.current !== null) {
      cancelAnimationFrame(climaxRafRef.current);
      climaxRafRef.current = null;
    }
  }, []);

  const enter = useCallback(() => {
    clearTransition();
    setPhase("entering");
    setNarrationPlayed(false);
    climaxFiredRef.current = false;

    if (songMode === "dream" && dream.context.narrationEnabled && dream.context.narrationAudioUrl) {
      playNarration();
    }

    if (activeAudioFile) void engine.loadAndPlay(activeAudioFile);
    transitionTimer.current = setTimeout(() => {
      transitionTimer.current = null;
      setPhase((p) => (p === "entering" ? "experience" : p));
      if (songMode === "dream") {
        startClimaxWatcher();
      }
    }, 2600);
  }, [engine, activeAudioFile, clearTransition, songMode, dream, playNarration, startClimaxWatcher]);

  const exit = useCallback(() => {
    clearTransition();
    stopClimaxWatcher();
    setPhase("exiting");
    narrationAudioRef.current?.pause();
    transitionTimer.current = setTimeout(() => {
      transitionTimer.current = null;
      try {
        engine.stop();
        resetAudioLevels();
      } catch {
        /* ignore */
      }
      setPhase("title");
    }, 1800);
  }, [engine, clearTransition, stopClimaxWatcher]);

  useEffect(() => {
    return () => stopClimaxWatcher();
  }, [stopClimaxWatcher]);

  // Auto-enter after navigating from SongDetail once dream finishes building
  useEffect(() => {
    if (autoEnterRef.current && dream.ready && phase === "title") {
      autoEnterRef.current = false;
      enter();
    }
  }, [dream.ready, phase, enter]);

  // Redirect to home if /song/:id is visited without a song in store
  const detailSong = matchDetail ? songDetailStore.get() : null;
  useEffect(() => {
    if (matchDetail && !detailSong) navigate("/");
  }, [matchDetail, detailSong, navigate]);

  const captureScreenshot = useCallback(() => {
    const data = screenshotFn.current?.();
    if (!data) return;
    const a = document.createElement("a");
    a.href = data;
    a.download = `dreamwalk-${activeWorld.id}.png`;
    a.click();
  }, [activeWorld.id]);

  const overlayTarget = phase === "entering" || phase === "experience" ? 0 : 1;
  const overlayDuration = phase === "entering" ? 2.6 : phase === "exiting" ? 1.7 : 0.8;
  const sceneMounted = phase !== "title";

  const experienceKey = `${activeWorld.id}-${songMode === "dream" ? (dream.context.song?.id ?? "none") : trackId}`;

  const showLoading = dream.loading && !!dream.context.song;

  // ── Song Detail route ──────────────────────────────────────────────────────
  if (matchDetail && detailSong) {
    return (
      <SongDetail
        song={detailSong}
        trends={dream.context.trends}
        onEnterDream={handleEnterDreamFromDetail}
        onBack={() => navigate("/")}
        onExploreSong={handleExploreSongFromDetail}
      />
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {showLoading && (
        <DreamLoadingScreen
          title={dream.context.song!.title}
          artist={dream.context.song!.artist}
          artworkUrl={dream.context.song!.artworkUrl}
          step={dream.loadingStep}
          visible={dream.loading}
        />
      )}

      {sceneMounted && (
        <WebGLBoundary onExit={exit}>
          <Experience
            key={experienceKey}
            world={activeWorld}
            analyser={engine.analyser}
            syncedLyrics={
              songMode === "dream" ? (dream.context.lyrics?.synced ?? undefined) : undefined
            }
            getAudioTime={engine.getProgress ? () => engine.getProgress().time : undefined}
            onScreenshotReady={(fn) => {
              screenshotFn.current = fn;
            }}
          />
        </WebGLBoundary>
      )}

      <motion.div
        className="pointer-events-none absolute inset-0 z-10"
        initial={{ opacity: 1 }}
        animate={{ opacity: overlayTarget }}
        transition={{ duration: overlayDuration, ease: "easeInOut" }}
        style={{
          background: `radial-gradient(circle at 50% 45%, ${activeWorld.colors.fog} 0%, ${activeWorld.colors.skyBottom} 70%, #000 130%)`,
        }}
      />

      {phase === "experience" && (
        <Hud
          title={activeTitle}
          artist={activeArtist}
          artworkUrl={activeArtwork}
          world={activeWorld}
          isPlaying={engine.isPlaying}
          dreamContext={dream.context}
          onToggle={() => void engine.toggle()}
          onScreenshot={captureScreenshot}
          onExit={exit}
          onToggleNarration={dream.toggleNarration}
        />
      )}

      <AnimatePresence>
        {phase === "title" && (
          <TitleScreen
            tracks={curatedSongs}
            trackId={trackId}
            worldId={activeWorld.id}
            onSelectTrack={handleSelectTrack}
            onSelectDreamSong={handleSelectDreamSong}
            onEnter={enter}
            onViewDetail={handleViewDetail}
            trends={dream.context.trends}
            isLoadingContext={dream.loading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
