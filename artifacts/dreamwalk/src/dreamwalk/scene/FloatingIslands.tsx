import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";
import { audioLevels } from "../audio/audioStore";

interface Island {
  x: number;
  y: number;
  z: number;
  s: number;
  phase: number;
}

export function FloatingIslands({ world }: { world: World }) {
  const items = useMemo(() => {
    const rand = mulberry32(321);
    const n = 14;
    const arr: Island[] = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const rad = 120 + rand() * 320;
      arr.push({
        x: Math.cos(a) * rad,
        y: 50 + rand() * 110,
        z: Math.sin(a) * rad,
        s: 6 + rand() * 16,
        phase: rand() * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!group.current) return;
    const t = audioLevels.time;
    const rise = audioLevels.intensity * 8;
    group.current.children.forEach((child, i) => {
      const it = items[i];
      if (!it) return;
      child.position.y = it.y + Math.sin(t * 0.4 + it.phase) * 3 + rise;
      child.rotation.y = t * 0.03 + it.phase;
    });
  });

  const rockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(world.colors.groundDeep),
        roughness: 0.95,
        flatShading: true,
      }),
    [world],
  );
  const topMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(world.colors.structure),
        roughness: 0.85,
        flatShading: true,
        emissive: new THREE.Color(world.colors.structureGlow),
        emissiveIntensity: 0.1,
      }),
    [world],
  );

  return (
    <group ref={group}>
      {items.map((it, i) => (
        <group key={i} position={[it.x, it.y, it.z]}>
          <mesh material={rockMat} position={[0, -it.s * 0.8, 0]}>
            <coneGeometry args={[it.s, it.s * 2.2, 6]} />
          </mesh>
          <mesh material={topMat} position={[0, it.s * 0.1, 0]}>
            <cylinderGeometry args={[it.s, it.s * 0.92, it.s * 0.4, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
