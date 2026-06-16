import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";
import { terrainHeight } from "./terrainField";
import { audioLevels } from "../audio/audioStore";

interface Item {
  x: number;
  z: number;
  type: number;
  s: number;
  rot: number;
  tilt: number;
  h: number;
  ground: number;
}

export function Structures({ world }: { world: World }) {
  const items = useMemo(() => {
    const rand = mulberry32(2024);
    const n = 40;
    const arr: Item[] = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const rad = 64 + rand() * 320;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      arr.push({
        x,
        z,
        type: Math.floor(rand() * 4),
        s: 0.8 + rand() * 1.9,
        rot: rand() * Math.PI,
        tilt: (rand() - 0.5) * 0.14,
        h: 18 + rand() * 26,
        ground: terrainHeight(world.terrain, x, z),
      });
    }
    return arr;
  }, [world]);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(world.colors.structure),
        roughness: 0.82,
        metalness: 0.05,
        flatShading: true,
        emissive: new THREE.Color(world.colors.structureGlow),
        emissiveIntensity: 0.08,
      }),
    [world],
  );

  useFrame(() => {
    mat.emissiveIntensity = 0.06 + audioLevels.intensity * 0.32 + audioLevels.peak * 0.22;
  });

  return (
    <group>
      {items.map((it, i) => {
        const common = {
          position: [it.x, it.ground, it.z] as [number, number, number],
          rotation: [it.tilt, it.rot, it.tilt * 0.6] as [number, number, number],
        };
        if (it.type === 0) {
          const h = it.h * 1.4 * it.s;
          return (
            <mesh key={i} material={mat} position={[it.x, it.ground + h / 2, it.z]} rotation={common.rotation}>
              <boxGeometry args={[3 * it.s, h, 3 * it.s]} />
            </mesh>
          );
        }
        if (it.type === 1) {
          const h = it.h * it.s;
          const w = 9 * it.s;
          return (
            <group key={i} position={common.position} rotation={common.rotation}>
              <mesh material={mat} position={[-w / 2, h / 2, 0]}>
                <boxGeometry args={[2.4 * it.s, h, 2.4 * it.s]} />
              </mesh>
              <mesh material={mat} position={[w / 2, h / 2, 0]}>
                <boxGeometry args={[2.4 * it.s, h, 2.4 * it.s]} />
              </mesh>
              <mesh material={mat} position={[0, h + 1.2 * it.s, 0]}>
                <boxGeometry args={[w + 3 * it.s, 2.6 * it.s, 3 * it.s]} />
              </mesh>
            </group>
          );
        }
        if (it.type === 2) {
          const h = it.h * 1.2 * it.s;
          return (
            <group key={i} position={common.position} rotation={common.rotation}>
              <mesh material={mat} position={[0, h / 2, 0]}>
                <cylinderGeometry args={[1.6 * it.s, 2.6 * it.s, h, 7]} />
              </mesh>
              <mesh material={mat} position={[0, h + 1 * it.s, 0]}>
                <boxGeometry args={[5 * it.s, 2 * it.s, 5 * it.s]} />
              </mesh>
            </group>
          );
        }
        const h = it.h * 0.7 * it.s;
        return (
          <group key={i} position={common.position} rotation={common.rotation}>
            <mesh material={mat} position={[0, h / 2, 0]}>
              <boxGeometry args={[5 * it.s, h, 4 * it.s]} />
            </mesh>
            <mesh material={mat} position={[3 * it.s, h * 0.35, 1.5 * it.s]} rotation={[0.2, 0.4, 0.3]}>
              <boxGeometry args={[3 * it.s, h * 0.7, 3 * it.s]} />
            </mesh>
            <mesh material={mat} position={[-2.5 * it.s, h * 0.2, -1.5 * it.s]} rotation={[-0.3, 0.2, -0.2]}>
              <boxGeometry args={[2.5 * it.s, h * 0.5, 2.5 * it.s]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
