import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import type { BloomEffect } from "postprocessing";
import type { World } from "../types";
import { audioLevels } from "../audio/audioStore";

export function PostFX({ world }: { world: World }) {
  const bloomRef = useRef<BloomEffect>(null);

  useFrame(() => {
    if (bloomRef.current) {
      bloomRef.current.intensity =
        world.bloom + audioLevels.intensity * 0.9 + audioLevels.peak * 0.5;
    }
  });

  return (
    <EffectComposer>
      <Bloom
        ref={bloomRef}
        mipmapBlur
        luminanceThreshold={0.2}
        luminanceSmoothing={0.5}
        intensity={world.bloom}
      />
      <Vignette offset={0.22} darkness={0.72} eskil={false} />
    </EffectComposer>
  );
}
