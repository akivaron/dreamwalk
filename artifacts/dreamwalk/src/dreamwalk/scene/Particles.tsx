import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";
import { makeGlowTexture } from "./textures";
import { audioLevels } from "../audio/audioStore";

const COUNT = 1400;
const SPREAD_XZ = 160;
const SPREAD_Y = 110;

export function Particles({ world }: { world: World }) {
  const { camera } = useThree();
  const embers = world.features.embers;
  const snow = world.features.snow;

  const { geo, velocities } = useMemo(() => {
    const rand = mulberry32(404);
    const arr = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (rand() - 0.5) * SPREAD_XZ * 2;
      arr[i * 3 + 1] = rand() * SPREAD_Y;
      arr[i * 3 + 2] = (rand() - 0.5) * SPREAD_XZ * 2;
      vel[i] = 0.4 + rand() * 0.9;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return { geo: g, velocities: vel };
  }, []);

  const tex = useMemo(() => makeGlowTexture(), []);
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  useFrame((_, delta) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const dir = snow ? -1 : 1;
    const baseSpeed = embers ? 6 : snow ? 4 : 2.4;
    const speed = baseSpeed * (1 + audioLevels.level * 1.6);
    const sway = 0.6 + audioLevels.mid * 1.5;
    const t = audioLevels.time;
    for (let i = 0; i < COUNT; i++) {
      const yi = i * 3 + 1;
      arr[yi] += dir * velocities[i] * speed * delta;
      arr[i * 3] += Math.sin(t * 0.5 + i) * sway * delta;
      if (dir > 0 && arr[yi] > SPREAD_Y) arr[yi] = 0;
      if (dir < 0 && arr[yi] < 0) arr[yi] = SPREAD_Y;
    }
    pos.needsUpdate = true;
    if (pointsRef.current) {
      pointsRef.current.position.set(
        camera.position.x - SPREAD_XZ,
        camera.position.y - SPREAD_Y * 0.5,
        camera.position.z - SPREAD_XZ,
      );
    }
    if (matRef.current) {
      matRef.current.size = (embers ? 2.4 : 1.8) * (0.7 + audioLevels.level * 1.4);
      matRef.current.opacity = 0.4 + audioLevels.level * 0.5;
    }
  });

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        ref={matRef}
        map={tex}
        size={2}
        sizeAttenuation
        color={world.colors.particle}
        transparent
        depthWrite={false}
        opacity={0.6}
        blending={snow ? THREE.NormalBlending : THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
