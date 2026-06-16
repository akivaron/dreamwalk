import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Experience } from "./dreamwalk/scene/Experience";
import { TitleScreen } from "./dreamwalk/ui/TitleScreen";
import { Hud } from "./dreamwalk/ui/Hud";
import { WebGLBoundary } from "./dreamwalk/ui/WebGLBoundary";
import { DreamLoadingScreen } from "./dreamwalk/ui/DreamLoadingScreen";
import { TRACKS } from "./dreamwalk/tracks";
import { WORLDS } from "./dreamwalk/worlds";
import { useAudioEngine } from "./dreamwalk/audio/useAudioEngine";
import { resetAudioLevels } from "./dreamwalk/audio/audioStore";
import { useDreamContext } from "./dreamwalk/dream/useDreamContext";
import { buildWorldFromContext } from "./dreamwalk/dream/worldBuilder";
import type { DreamSong } from "./dreamwalk/dream/types";

type Phase = "title" | "entering" | "experience" | "exiting";

export default function App() {
  const [phase, setPhase] = useState<Phase>("title");
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [songMode, setSongMode] = useState<"curated" | "dream">("curated");
  const [narrationPlayed, setNarrationPlayed] = useState(false);

  const engine = useAudioEngine();
  const screenshotFn = useRef<(() => string) | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);

  const dream = useDreamContext();

  const curatedTrack = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];

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
  const activeAudioFile =
    songMode === "dream" && dream.context.song?.previewUrl
      ? dream.context.song.previewUrl
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
      const t = TRACKS.find((x) => x.id === id);
      if (t) {
        dream.buildForCuratedTrack(id, t.title, t.artist, t.suggestedWorld);
      }
    },
    [dream],
  );

  const handleSelectDreamSong = useCallback(
    (song: DreamSong) => {
      setSongMode("dream");
      void dream.buildForSong(song);
    },
    [dream],
  );

  const playNarration = useCallback(() => {
    const { context } = dream;
    if (!context.narrationEnabled || !context.narrationAudioUrl || narrationPlayed) return;
    if (!narrationAudioRef.current) {
      narrationAudioRef.current = new Audio();
    }
    const el = narrationAudioRef.current;
    el.src = context.narrationAudioUrl;
    el.volume = 0.75;
    void el.play().catch(() => undefined);
    setNarrationPlayed(true);
  }, [dream, narrationPlayed]);

  const enter = useCallback(() => {
    clearTransition();
    setPhase("entering");
    setNarrationPlayed(false);

    if (songMode === "dream" && dream.context.narrationEnabled && dream.context.narrationAudioUrl) {
      playNarration();
    }

    void engine.loadAndPlay(activeAudioFile);
    transitionTimer.current = setTimeout(() => {
      transitionTimer.current = null;
      setPhase((p) => (p === "entering" ? "experience" : p));
    }, 2600);
  }, [engine, activeAudioFile, clearTransition, songMode, dream, playNarration]);

  const exit = useCallback(() => {
    clearTransition();
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
  }, [engine, clearTransition]);

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

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {dream.loading && dream.context.song && (
        <DreamLoadingScreen
          title={dream.context.song.title}
          artist={dream.context.song.artist}
          artworkUrl={dream.context.song.artworkUrl}
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
          onToggleConcertMode={dream.toggleConcertMode}
        />
      )}

      <AnimatePresence>
        {phase === "title" && (
          <TitleScreen
            tracks={TRACKS}
            trackId={trackId}
            worldId={activeWorld.id}
            onSelectTrack={handleSelectTrack}
            onSelectDreamSong={handleSelectDreamSong}
            onEnter={enter}
            trends={dream.context.trends}
            isLoadingContext={dream.loading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
