import { useMemo } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";

export function Mountains({ world }: { world: World }) {
  const items = useMemo(() => {
    const rand = mulberry32(99);
    const count = 46;
    const arr: { x: number; z: number; h: number; r: number; rot: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.12;
      const rad = 620 + rand() * 280;
      arr.push({
        x: Math.cos(a) * rad,
        z: Math.sin(a) * rad,
        h: 130 + rand() * 200,
        r: 80 + rand() * 80,
        rot: rand() * Math.PI,
      });
    }
    return arr;
  }, []);

  const color = useMemo(
    () =>
      new THREE.Color(world.colors.fog).lerp(new THREE.Color(world.colors.structure), 0.32),
    [world],
  );

  return (
    <group>
      {items.map((m, i) => (
        <mesh key={i} position={[m.x, m.h / 2 - 26, m.z]} rotation={[0, m.rot, 0]}>
          <coneGeometry args={[m.r, m.h, 5]} />
          <meshStandardMaterial color={color} roughness={1} metalness={0} flatShading />
        </mesh>
      ))}
    </group>
  );
}
