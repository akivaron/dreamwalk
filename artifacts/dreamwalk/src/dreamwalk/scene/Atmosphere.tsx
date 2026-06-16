import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import type { World } from "../types";

export function Atmosphere({ world }: { world: World }) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (lightRef.current) {
      // Keep directional light position and target centered around the camera's X/Z coordinate
      // This distributes the 2048x2048 shadow map over a tight local area, giving extremely crisp shadows
      const tx = camera.position.x;
      const tz = camera.position.z;
      
      lightRef.current.position.set(
        tx + world.sunPosition[0],
        world.sunPosition[1],
        tz + world.sunPosition[2]
      );
      
      lightRef.current.target.position.set(tx, 0, tz);
      lightRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <fogExp2 attach="fog" args={[world.colors.fog, world.fogDensity]} />
      <hemisphereLight
        args={[world.colors.skyTop, world.colors.groundDeep, world.ambientIntensity * 0.65]}
      />
      <ambientLight intensity={world.ambientIntensity * 0.25} color={world.colors.ambient} />
      <directionalLight
        ref={lightRef}
        intensity={world.lightIntensity * 1.05}
        color={world.colors.light}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={1200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0003}
      />
    </>
  );
}
