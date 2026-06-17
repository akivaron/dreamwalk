import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioEngine {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  loadAndPlay: (url: string) => Promise<void>;
  toggle: () => Promise<void>;
  stop: () => void;
  getProgress: () => { time: number; duration: number };
}

function makeAudioElement(): HTMLAudioElement {
  const el = new Audio();
  el.loop = true;
  el.crossOrigin = "anonymous";
  el.preload = "auto";
  el.addEventListener("error", () => {
    const e = el.error;
    console.error("[DreamWalk audio] element error", e?.code, e?.message, el.src.slice(0, 120));
  });
  el.addEventListener("stalled", () =>
    console.warn("[DreamWalk audio] stalled", el.src.slice(0, 80)),
  );
  return el;
}

export function useAudioEngine(): AudioEngine {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const ensureGraph = useCallback(() => {
    // Recover from a closed AudioContext — happens after HMR or component remount.
    // createMediaElementSource can only be called ONCE per audio element, so we must
    // also create a fresh Audio element when the context is rebuilt.
    if (ctxRef.current?.state === "closed") {
      console.warn("[DreamWalk audio] context was closed — rebuilding graph");
      ctxRef.current = null;
      srcRef.current = null;
      elRef.current = makeAudioElement();
    }

    if (!elRef.current) {
      elRef.current = makeAudioElement();
    }

    if (!ctxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      an.smoothingTimeConstant = 0.82;
      const src = ctx.createMediaElementSource(elRef.current);
      src.connect(an);
      an.connect(ctx.destination);
      ctxRef.current = ctx;
      srcRef.current = src;
      setAnalyser(an);
      console.warn("[DreamWalk audio] graph created, ctx state:", ctx.state);
    }
  }, []);

  const loadAndPlay = useCallback(
    async (url: string) => {
      console.warn("[DreamWalk audio] loadAndPlay →", url.slice(0, 120));
      ensureGraph();
      const ctx = ctxRef.current!;
      const el = elRef.current!;

      const absolute = new URL(url, window.location.href).href;
      if (el.src !== absolute) {
        el.src = url;
        console.warn("[DreamWalk audio] src →", url.slice(0, 100));
      } else {
        try { el.currentTime = 0; } catch { /* not seekable yet — ok */ }
      }

      // Kick off resume() and play() in the SAME synchronous tick so both
      // operations remain within the browser's user-gesture activation window.
      // Awaiting resume() first (as before) hands control back to the event
      // loop and can cause the gesture context to expire in iframe environments,
      // leaving the AudioContext suspended even after play() resolves.
      const resumeP = ctx.state !== "running" ? ctx.resume() : Promise.resolve();
      const playP = el.play();

      try {
        await Promise.all([resumeP, playP]);
        console.warn("[DreamWalk audio] playing ✓  ctx:", ctx.state);
        setIsPlaying(true);
      } catch (e) {
        console.error("[DreamWalk audio] play failed", e);
        // If play() was blocked, try an unconditional resume in case the
        // AudioContext itself is still suspended (e.g. first-load iframe policy).
        try { await ctx.resume(); } catch { /* ignore */ }
        setIsPlaying(false);
      }
    },
    [ensureGraph],
  );

  const toggle = useCallback(async () => {
    const el = elRef.current;
    const ctx = ctxRef.current;
    if (!el || !ctx) return;
    if (el.paused) {
      if (ctx.state === "suspended") await ctx.resume();
      await el.play();
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    const el = elRef.current;
    if (el) {
      el.pause();
      try { el.currentTime = 0; } catch { /* ignore */ }
    }
    setIsPlaying(false);
  }, []);

  const getProgress = useCallback(() => {
    const el = elRef.current;
    if (!el) return { time: 0, duration: 0 };
    return { time: el.currentTime, duration: el.duration || 0 };
  }, []);

  useEffect(() => {
    return () => {
      try { elRef.current?.pause(); } catch { /* ignore */ }
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== "closed") {
        ctx.close().catch(() => { /* already closed — ignore */ });
      }
    };
  }, []);

  return { analyser, isPlaying, loadAndPlay, toggle, stop, getProgress };
}
