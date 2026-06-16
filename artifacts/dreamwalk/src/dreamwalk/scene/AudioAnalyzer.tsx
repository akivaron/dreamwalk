import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { audioLevels, lalalEnvelope, stemLevels } from "../audio/audioStore";
import { createLyricsClock, tickLyricsClock, type LyricsClockState } from "../dream/LyricsClock";
import type { SyncedLyricLine } from "../dream/types";

function lerp(prev: number, next: number, a: number): number {
  return prev + (next - prev) * a;
}

interface AudioAnalyzerProps {
  analyser: AnalyserNode | null;
  syncedLyrics?: SyncedLyricLine[];
  getAudioTime?: () => number;
}

export function AudioAnalyzer({ analyser, syncedLyrics, getAudioTime }: AudioAnalyzerProps) {
  const data = useMemo(
    () => (analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(0)),
    [analyser],
  );

  const clockRef = useRef<LyricsClockState | null>(null);

  if (!clockRef.current && syncedLyrics) {
    clockRef.current = createLyricsClock(syncedLyrics);
  }

  if (clockRef.current && syncedLyrics !== clockRef.current.synced) {
    clockRef.current = syncedLyrics ? createLyricsClock(syncedLyrics) : null;
  }

  useFrame((_, delta) => {
    audioLevels.time += delta;

    if (analyser) {
      analyser.getByteFrequencyData(data);
      const n = data.length;

      if (n > 0) {
        const bassEnd = Math.max(1, Math.floor(n * 0.08));
        const midEnd = Math.max(bassEnd + 1, Math.floor(n * 0.4));
        let bassSum = 0, midSum = 0, trebSum = 0;
        for (let i = 0; i < n; i++) {
          const v = data[i] / 255;
          if (i < bassEnd) bassSum += v;
          else if (i < midEnd) midSum += v;
          else trebSum += v;
        }
        const bass = bassSum / bassEnd;
        const mid = midSum / (midEnd - bassEnd);
        const treble = trebSum / (n - midEnd);
        const level = (bass * 1.2 + mid + treble * 0.8) / 3;

        const prevBass = audioLevels.bass;
        audioLevels.bass = lerp(audioLevels.bass, bass, 0.25);
        audioLevels.mid = lerp(audioLevels.mid, mid, 0.2);
        audioLevels.treble = lerp(audioLevels.treble, treble, 0.2);
        audioLevels.level = lerp(audioLevels.level, level, 0.15);

        const peakTarget = Math.min(1, Math.max(0, bass - prevBass * 0.92) * 4);
        audioLevels.peak = lerp(audioLevels.peak, peakTarget, peakTarget > audioLevels.peak ? 0.6 : 0.12);
        audioLevels.intensity = lerp(audioLevels.intensity, Math.min(1, level * 1.7), 0.018);
        audioLevels.beat = audioLevels.bass;

        if (lalalEnvelope.available && getAudioTime && lalalEnvelope.vocals.length > 0) {
          // Use pre-computed LALAL stem envelopes for accurate per-channel amplitudes
          const tMs = getAudioTime() * 1000;
          const idx = Math.max(0, Math.min(
            Math.floor(tMs / lalalEnvelope.windowMs),
            lalalEnvelope.vocals.length - 1,
          ));
          const instrIdx = Math.max(0, Math.min(idx, lalalEnvelope.instruments.length - 1));

          const vocalAmp = lalalEnvelope.vocals[idx] ?? 0;
          const instrAmp = lalalEnvelope.instruments.length > 0
            ? (lalalEnvelope.instruments[instrIdx] ?? 0)
            : bass;

          // LALAL-derived: vocals from separated vocal stem; drums/bass/instruments from back track
          stemLevels.vocals = lerp(stemLevels.vocals, vocalAmp, 0.25);
          stemLevels.instruments = lerp(stemLevels.instruments, instrAmp * 0.7, 0.2);
          stemLevels.bass = lerp(stemLevels.bass, instrAmp * 0.6 + bass * 0.4, 0.2);
          stemLevels.drums = lerp(stemLevels.drums, peakTarget * 0.7 + instrAmp * 0.3, 0.3);
        } else {
          // FFT-derived stem approximations (fallback)
          stemLevels.drums = lerp(stemLevels.drums, peakTarget * 0.85 + bass * 0.15, 0.3);
          stemLevels.bass = lerp(stemLevels.bass, bass * 0.9, 0.2);
          stemLevels.vocals = lerp(stemLevels.vocals, mid * 0.75 + treble * 0.25, 0.15);
          stemLevels.instruments = lerp(stemLevels.instruments, (mid + treble) * 0.5, 0.12);
        }
      }
    }

    if (clockRef.current && getAudioTime) {
      const t = getAudioTime();
      tickLyricsClock(clockRef.current, t, delta);
    }
  });

  return null;
}
