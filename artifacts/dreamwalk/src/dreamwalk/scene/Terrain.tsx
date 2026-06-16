import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { audioLevels } from "../audio/audioStore";
import { terrainHeight, TERRAIN_SIZE } from "./terrainField";

export function Terrain({ world }: { world: World }) {
  const isWater = world.terrain === "water";

  const geo = useMemo(() => {
    const seg = isWater ? 120 : 180;
    const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, seg, seg);
    g.rotateX(-Math.PI / 2);
    if (!isWater) {
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, terrainHeight(world.terrain, x, z));
      }
      g.computeVertexNormals();
    }
    return g;
  }, [world, isWater]);

  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!isWater || !meshRef.current) return;
    const t = audioLevels.time;
    const g = meshRef.current.geometry as THREE.PlaneGeometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const amp = 0.5 + audioLevels.level * 0.8;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y =
        Math.sin(x * 0.03 + t * 0.6) * 0.6 +
        Math.cos(z * 0.035 + t * 0.5) * 0.6 +
        Math.sin((x + z) * 0.02 + t) * 0.5 * amp;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
  });

  if (isWater) {
    return (
      <mesh ref={meshRef} geometry={geo} receiveShadow>
        <meshStandardMaterial
          color={world.colors.ground}
          roughness={0.28}
          metalness={0.55}
          flatShading
          emissive={world.colors.groundDeep}
          emissiveIntensity={0.18}
        />
      </mesh>
    );
  }

  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={world.colors.ground} roughness={0.95} metalness={0} flatShading />
    </mesh>
  );
}
