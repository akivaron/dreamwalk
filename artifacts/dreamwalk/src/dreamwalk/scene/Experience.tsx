import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import type { World } from "../types";
import type { SyncedLyricLine } from "../dream/types";
import { AudioAnalyzer } from "./AudioAnalyzer";
import { CameraRig } from "./CameraRig";
import { Atmosphere } from "./Atmosphere";
import { Firmament } from "./Firmament";
import { Mountains } from "./Mountains";
import { Terrain } from "./Terrain";
import { Structures } from "./Structures";
import { Banners } from "./Banners";
import { FloatingIslands } from "./FloatingIslands";
import { Clouds } from "./Clouds";
import { Particles } from "./Particles";
import { PostFX } from "./PostFX";
import { ScreenshotHelper } from "./ScreenshotHelper";
import { Grass } from "./Grass";
import { Birds } from "./Birds";
import { Fireflies } from "./Fireflies";
import { Waterfall } from "./Waterfall";

interface ExperienceProps {
  world: World;
  analyser: AnalyserNode | null;
  syncedLyrics?: SyncedLyricLine[];
  getAudioTime?: () => number;
  onScreenshotReady: (fn: () => string) => void;
}

export function Experience({ world, analyser, syncedLyrics, getAudioTime, onScreenshotReady }: ExperienceProps) {
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
        toneMapping: THREE.NoToneMapping,
      }}
      camera={{ fov: 62, near: 0.1, far: 2400, position: [0, 3.2, 14] }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color(world.colors.skyBottom));
      }}
    >
      <Suspense fallback={null}>
        <AudioAnalyzer analyser={analyser} syncedLyrics={syncedLyrics} getAudioTime={getAudioTime} />
        <CameraRig world={world} />
        <Atmosphere world={world} />
        <Firmament world={world} />
        <Mountains world={world} />
        <Terrain world={world} />
        <Waterfall world={world} />
        <Grass world={world} />
        <Structures world={world} />
        <Banners world={world} />
        {world.features.islands && <FloatingIslands world={world} />}
        {world.features.clouds && <Clouds world={world} />}
        <Birds />
        <Fireflies world={world} />
        <Particles world={world} />
        <PostFX world={world} />
        <ScreenshotHelper onReady={onScreenshotReady} />
      </Suspense>
    </Canvas>
  );
}
