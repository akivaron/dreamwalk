import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";
import { terrainHeight } from "./terrainField";
import { audioLevels } from "../audio/audioStore";

interface BannerItem {
  x: number;
  z: number;
  rot: number;
  s: number;
  ground: number;
  geo: THREE.PlaneGeometry;
  base: Float32Array;
  phase: number;
}

export function Banners({ world }: { world: World }) {
  const items = useMemo(() => {
    const rand = mulberry32(555);
    const n = 9;
    const arr: BannerItem[] = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const rad = 40 + rand() * 240;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const s = 0.9 + rand() * 1.3;
      const geo = new THREE.PlaneGeometry(6 * s, 13 * s, 10, 16);
      const base = (geo.attributes.position as THREE.BufferAttribute).array.slice() as Float32Array;
      arr.push({
        x,
        z,
        rot: rand() * Math.PI,
        s,
        ground: terrainHeight(world.terrain, x, z),
        geo,
        base,
        phase: rand() * Math.PI * 2,
      });
    }
    return arr;
  }, [world]);

  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const t = audioLevels.time;
    const amp = 0.5 + audioLevels.intensity * 1.6 + audioLevels.level * 0.8;
    for (let m = 0; m < items.length; m++) {
      const mesh = refs.current[m];
      if (!mesh) continue;
      const it = items[m];
      const pos = it.geo.attributes.position as THREE.BufferAttribute;
      const base = it.base;
      for (let i = 0; i < pos.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const top = (by + 6.5 * it.s) / (13 * it.s);
        const wave =
          Math.sin(bx * 0.8 + t * 2.0 + it.phase) * amp * top +
          Math.sin(by * 0.4 + t * 1.3 + it.phase) * amp * 0.4 * top;
        pos.setZ(i, wave);
      }
      pos.needsUpdate = true;
      it.geo.computeVertexNormals();
    }
  });

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(world.colors.banner),
        roughness: 0.7,
        metalness: 0.0,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(world.colors.banner),
        emissiveIntensity: 0.12,
      }),
    [world],
  );

  const poleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(world.colors.structure),
        roughness: 0.8,
      }),
    [world],
  );

  return (
    <group>
      {items.map((it, i) => {
        const h = 13 * it.s;
        const poleH = h + 4 * it.s;
        return (
          <group key={i} position={[it.x, it.ground, it.z]} rotation={[0, it.rot, 0]}>
            <mesh material={poleMat} position={[0, poleH / 2, 0]}>
              <cylinderGeometry args={[0.4 * it.s, 0.4 * it.s, poleH, 6]} />
            </mesh>
            <mesh
              ref={(el) => {
                refs.current[i] = el;
              }}
              geometry={it.geo}
              material={mat}
              position={[3 * it.s, poleH - h / 2 - 1.5 * it.s, 0]}
            />
          </group>
        );
      })}
    </group>
  );
}
