import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Experience } from "./dreamwalk/scene/Experience";
import { TitleScreen } from "./dreamwalk/ui/TitleScreen";
import { Hud } from "./dreamwalk/ui/Hud";
import { WebGLBoundary } from "./dreamwalk/ui/WebGLBoundary";
import { TRACKS } from "./dreamwalk/tracks";
import { WORLDS, getWorld } from "./dreamwalk/worlds";
import { useAudioEngine } from "./dreamwalk/audio/useAudioEngine";
import { resetAudioLevels } from "./dreamwalk/audio/audioStore";

type Phase = "title" | "entering" | "experience" | "exiting";

export default function App() {
  const [phase, setPhase] = useState<Phase>("title");
  const [trackId, setTrackId] = useState(TRACKS[0].id);
  const [worldId, setWorldId] = useState(TRACKS[0].suggestedWorld);

  const engine = useAudioEngine();
  const screenshotFn = useRef<(() => string) | null>(null);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const world = getWorld(worldId);
  const track = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];

  const clearTransition = useCallback(() => {
    if (transitionTimer.current !== null) {
      clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
  }, []);

  useEffect(() => clearTransition, [clearTransition]);

  const handleSelectTrack = useCallback((id: string) => {
    setTrackId(id);
    const t = TRACKS.find((x) => x.id === id);
    if (t) setWorldId(t.suggestedWorld);
  }, []);

  const enter = useCallback(() => {
    clearTransition();
    setPhase("entering");
    void engine.loadAndPlay(track.file);
    transitionTimer.current = setTimeout(() => {
      transitionTimer.current = null;
      setPhase((p) => (p === "entering" ? "experience" : p));
    }, 2600);
  }, [engine, track.file, clearTransition]);

  const exit = useCallback(() => {
    clearTransition();
    setPhase("exiting");
    transitionTimer.current = setTimeout(() => {
      transitionTimer.current = null;
      try {
        engine.stop();
        resetAudioLevels();
      } catch {
        /* ignore cleanup failures so the phase always resets */
      }
      setPhase("title");
    }, 1800);
  }, [engine, clearTransition]);

  const captureScreenshot = useCallback(() => {
    const data = screenshotFn.current?.();
    if (!data) return;
    const a = document.createElement("a");
    a.href = data;
    a.download = `dreamwalk-${world.id}.png`;
    a.click();
  }, [world.id]);

  const overlayTarget = phase === "entering" || phase === "experience" ? 0 : 1;
  const overlayDuration = phase === "entering" ? 2.6 : phase === "exiting" ? 1.7 : 0.8;
  const sceneMounted = phase !== "title";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {sceneMounted && (
        <WebGLBoundary onExit={exit}>
          <Experience
            key={`${world.id}-${trackId}`}
            world={world}
            analyser={engine.analyser}
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
          background: `radial-gradient(circle at 50% 45%, ${world.colors.fog} 0%, ${world.colors.skyBottom} 70%, #000 130%)`,
        }}
      />

      {phase === "experience" && (
        <Hud
          track={track}
          world={world}
          isPlaying={engine.isPlaying}
          onToggle={() => void engine.toggle()}
          onScreenshot={captureScreenshot}
          onExit={exit}
        />
      )}

      <AnimatePresence>
        {phase === "title" && (
          <TitleScreen
            tracks={TRACKS}
            worlds={WORLDS}
            trackId={trackId}
            worldId={worldId}
            onSelectTrack={handleSelectTrack}
            onSelectWorld={setWorldId}
            onEnter={enter}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
