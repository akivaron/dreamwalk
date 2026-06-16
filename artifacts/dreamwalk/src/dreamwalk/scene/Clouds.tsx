import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";
import { makeSoftTexture } from "./textures";

interface Cloud {
  x: number;
  y: number;
  z: number;
  s: number;
  speed: number;
}

export function Clouds({ world }: { world: World }) {
  const items = useMemo(() => {
    const rand = mulberry32(808);
    const n = 26;
    const arr: Cloud[] = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const rad = 120 + rand() * 380;
      arr.push({
        x: Math.cos(a) * rad,
        y: 40 + rand() * 120,
        z: Math.sin(a) * rad,
        s: 60 + rand() * 130,
        speed: 0.6 + rand() * 1.4,
      });
    }
    return arr;
  }, []);

  const tex = useMemo(() => makeSoftTexture(), []);
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      const it = items[i];
      if (!it) return;
      child.position.x += it.speed * delta * 1.4;
      if (child.position.x > 500) child.position.x = -500;
    });
  });

  return (
    <group ref={group}>
      {items.map((it, i) => (
        <group key={i} position={[it.x, it.y, it.z]}>
          {/* Bottom Layer - Shadow (darker, slightly offset down/back) */}
          <sprite position={[-it.s * 0.08, -it.s * 0.05, -3]} scale={[it.s * 1.1, it.s * 0.6, 1]}>
            <spriteMaterial
              map={tex}
              color={world.colors.skyBottom}
              transparent
              opacity={0.42}
              depthWrite={false}
            />
          </sprite>

          {/* Middle Layer - Main Body (fog color) */}
          <sprite position={[0, 0, 0]} scale={[it.s, it.s * 0.55, 1]}>
            <spriteMaterial
              map={tex}
              color={world.colors.fog}
              transparent
              opacity={0.48}
              depthWrite={false}
            />
          </sprite>

          {/* Top Layer - Highlight (bright light color, offset up/front) */}
          <sprite position={[it.s * 0.08, it.s * 0.05, 3]} scale={[it.s * 0.85, it.s * 0.48, 1]}>
            <spriteMaterial
              map={tex}
              color={world.colors.light}
              transparent
              opacity={0.56}
              depthWrite={false}
            />
          </sprite>
        </group>
      ))}
    </group>
  );
}
