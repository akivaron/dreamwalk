import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { audioLevels } from "../audio/audioStore";
import { mulberry32 } from "../rng";
import { makeGlowTexture } from "./textures";
import { terrainHeight } from "./terrainField";
import type { World } from "../types";

export function Fireflies({ world }: { world: World }) {
  const count = 180;
  
  const { geo, basePositions, phases } = useMemo(() => {
    const rand = mulberry32(88888);
    const pos = new Float32Array(count * 3);
    const bases = new Float32Array(count * 3);
    const ph = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      let x = 0, z = 0, y = 0;
      let found = false;
      // Find a dry land position (grass)
      for (let attempt = 0; attempt < 10; attempt++) {
        const a = rand() * Math.PI * 2;
        const rad = Math.pow(rand(), 1.3) * 250;
        x = Math.cos(a) * rad;
        z = Math.sin(a) * rad;
        y = terrainHeight(world.terrain, x, z);
        if (y > -0.8) {
          found = true;
          break;
        }
      }
      if (!found) {
        x = (rand() - 0.5) * 40;
        z = (rand() - 0.5) * 40;
        y = terrainHeight(world.terrain, x, z);
      }
      
      bases[i * 3] = x;
      bases[i * 3 + 1] = y;
      bases[i * 3 + 2] = z;
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y + 0.6 + rand() * 1.5;
      pos[i * 3 + 2] = z;
      
      ph[i] = rand() * Math.PI * 2;
    }
    
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { geo: g, basePositions: bases, phases: ph };
  }, [world]);

  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);
  const tex = useMemo(() => makeGlowTexture(), []);

  useFrame((state, delta) => {
    const t = audioLevels.time;
    const vol = audioLevels.level;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const bx = basePositions[idx];
      const by = basePositions[idx + 1];
      const bz = basePositions[idx + 2];
      const phase = phases[i];
      
      // Erratic 3D floating movement
      const dx = Math.sin(t * 0.9 + phase) * 0.8;
      const dy = 0.8 + Math.sin(t * 1.4 + phase * 1.3) * 0.5 + Math.cos(t * 0.7 + phase * 0.7) * 0.25;
      const dz = Math.cos(t * 0.8 + phase) * 0.8;
      
      arr[idx] = bx + dx;
      arr[idx + 1] = by + dy;
      arr[idx + 2] = bz + dz;
    }
    posAttr.needsUpdate = true;

    // Pulse firefly brightness and size with audio levels
    if (matRef.current) {
      const pulse = 0.4 + Math.sin(t * 1.8) * 0.2 + vol * 0.5;
      matRef.current.opacity = Math.max(0.1, Math.min(1.0, pulse));
      matRef.current.size = 2.0 * (0.8 + vol * 0.6);
    }
  });

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        ref={matRef}
        map={tex}
        size={2.0}
        sizeAttenuation
        color={world.colors.structureGlow} // bioluminescent gold glow
        transparent
        depthWrite={false}
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
