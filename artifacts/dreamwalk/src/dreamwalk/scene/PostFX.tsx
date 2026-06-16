import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Bloom, EffectComposer, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { BloomEffect } from "postprocessing";
import type { World } from "../types";
import { audioLevels } from "../audio/audioStore";

export function PostFX({
  world,
  concertModeActive,
}: {
  world: World;
  concertModeActive?: boolean;
}) {
  const bloomRef = useRef<BloomEffect>(null);

  useFrame(() => {
    if (bloomRef.current) {
      const base = concertModeActive ? world.bloom * 1.4 : world.bloom * 0.5;
      const reactive = concertModeActive
        ? audioLevels.intensity * 0.4 + audioLevels.peak * 0.25
        : audioLevels.intensity * 0.15 + audioLevels.peak * 0.08;
      bloomRef.current.intensity = base + reactive;
    }
  });

  return (
    <EffectComposer>
      <Bloom
        ref={bloomRef}
        mipmapBlur
        luminanceThreshold={concertModeActive ? 0.55 : 0.78}
        luminanceSmoothing={0.5}
        intensity={concertModeActive ? world.bloom * 1.4 : world.bloom * 0.5}
      />
      <Vignette offset={concertModeActive ? 0.15 : 0.22} darkness={concertModeActive ? 0.88 : 0.72} eskil={false} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
