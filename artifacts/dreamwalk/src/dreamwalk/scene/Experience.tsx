import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import type { World } from "../types";
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

interface ExperienceProps {
  world: World;
  analyser: AnalyserNode | null;
  onScreenshotReady: (fn: () => string) => void;
}

export function Experience({ world, analyser, onScreenshotReady }: ExperienceProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      camera={{ fov: 62, near: 0.1, far: 2400, position: [0, 3.2, 14] }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color(world.colors.skyBottom));
      }}
    >
      <Suspense fallback={null}>
        <AudioAnalyzer analyser={analyser} />
        <CameraRig />
        <Atmosphere world={world} />
        <Firmament world={world} />
        <Mountains world={world} />
        <Terrain world={world} />
        <Structures world={world} />
        <Banners world={world} />
        {world.features.islands && <FloatingIslands world={world} />}
        {world.features.clouds && <Clouds world={world} />}
        <Particles world={world} />
        <PostFX world={world} />
        <ScreenshotHelper onReady={onScreenshotReady} />
      </Suspense>
    </Canvas>
  );
}
