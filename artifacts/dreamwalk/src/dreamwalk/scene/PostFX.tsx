import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Bloom, EffectComposer, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { BloomEffect } from "postprocessing";
import type { World } from "../types";
import { audioLevels } from "../audio/audioStore";

export function PostFX({ world }: { world: World }) {
  const bloomRef = useRef<BloomEffect>(null);

  useFrame(() => {
    if (bloomRef.current) {
      bloomRef.current.intensity =
        world.bloom * 0.5 + audioLevels.intensity * 0.15 + audioLevels.peak * 0.08;
    }
  });

  return (
    <EffectComposer>
      <Bloom
        ref={bloomRef}
        mipmapBlur
        luminanceThreshold={0.78}
        luminanceSmoothing={0.5}
        intensity={world.bloom * 0.5}
      />
      <Vignette offset={0.22} darkness={0.72} eskil={false} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
