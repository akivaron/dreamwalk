import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { audioLevels } from "../audio/audioStore";

function lerp(prev: number, next: number, a: number): number {
  return prev + (next - prev) * a;
}

export function AudioAnalyzer({ analyser }: { analyser: AnalyserNode | null }) {
  const data = useMemo(
    () => (analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(0)),
    [analyser],
  );

  useFrame((_, delta) => {
    audioLevels.time += delta;
    if (!analyser) return;
    analyser.getByteFrequencyData(data);
    const n = data.length;
    if (n === 0) return;

    const bassEnd = Math.max(1, Math.floor(n * 0.08));
    const midEnd = Math.max(bassEnd + 1, Math.floor(n * 0.4));
    let bassSum = 0;
    let midSum = 0;
    let trebSum = 0;
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
  });

  return null;
}
