import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioEngine {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  loadAndPlay: (url: string) => Promise<void>;
  toggle: () => Promise<void>;
  stop: () => void;
  getProgress: () => { time: number; duration: number };
}

export function useAudioEngine(): AudioEngine {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const ensureGraph = useCallback(() => {
    if (!elRef.current) {
      const el = new Audio();
      el.loop = true;
      el.crossOrigin = "anonymous";
      el.preload = "auto";
      elRef.current = el;
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
    }
  }, []);

  const loadAndPlay = useCallback(
    async (url: string) => {
      ensureGraph();
      const ctx = ctxRef.current!;
      const el = elRef.current!;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const absolute = new URL(url, window.location.href).href;
      if (el.src !== absolute) {
        el.src = url;
      }
      el.currentTime = 0;
      try {
        await el.play();
        setIsPlaying(true);
      } catch (e) {
        console.error("DreamWalk audio play failed", e);
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
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
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
      try {
        elRef.current?.pause();
      } catch {
        /* ignore */
      }
      try {
        void ctxRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { analyser, isPlaying, loadAndPlay, toggle, stop, getProgress };
}
