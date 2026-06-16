import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { audioLevels } from "../audio/audioStore";
import { mulberry32 } from "../rng";
import { terrainHeight } from "./terrainField";
import type { World } from "../types";

interface ButterflyData {
  bx: number;
  by: number;
  bz: number;
  phase: number;
  orbitRadius: number;
  speed: number;
  color: string;
  heightOffset: number;
}

export function Butterflies({ world }: { world: World }) {
  const count = 32;
  
  const butterflies = useMemo(() => {
    const rand = mulberry32(7777);
    const colors = ["#ff7b00", "#00d2ff", "#ffd200", "#ff4da6", "#a6ff00"];
    const list: ButterflyData[] = [];
    
    for (let i = 0; i < count; i++) {
      let x = 0, z = 0, y = 0;
      let found = false;
      // Search for a dry land position (grass)
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
      
      list.push({
        bx: x,
        by: y,
        bz: z,
        phase: rand() * Math.PI * 2,
        orbitRadius: 2.2 + rand() * 3.8, // local flight radius
        speed: 0.5 + rand() * 0.8,
        color: colors[Math.floor(rand() * colors.length)],
        heightOffset: 0.8 + rand() * 1.5, // height above grass
      });
    }
    return list;
  }, [world, count]);

  const groupRefs = useRef<Array<THREE.Group | null>>([]);
  const wingLRefs = useRef<Array<THREE.Group | null>>([]);
  const wingRRefs = useRef<Array<THREE.Group | null>>([]);

  useFrame((state) => {
    const t = audioLevels.time;
    const vol = audioLevels.level;
    const flapSpeed = 22 + vol * 18;
    
    butterflies.forEach((b, idx) => {
      const group = groupRefs.current[idx];
      const wingL = wingLRefs.current[idx];
      const wingR = wingRRefs.current[idx];
      
      if (!group || !wingL || !wingR) return;
      
      // Flutter around local spawn center (bx, by, bz)
      const angle = t * b.speed + b.phase;
      
      const jitterX = Math.sin(t * 11 + idx * 3) * 0.18;
      const jitterY = Math.sin(t * 14 + idx * 7) * 0.24;
      const jitterZ = Math.cos(t * 9 + idx * 5) * 0.18;
      
      const lx = b.bx + Math.cos(angle) * b.orbitRadius + jitterX;
      const ly = b.by + b.heightOffset + Math.sin(t * 1.6 + b.phase) * 0.4 + jitterY;
      const lz = b.bz + Math.sin(angle) * b.orbitRadius + jitterZ;
      
      group.position.set(lx, ly, lz);
      
      // Facing flight direction
      const nextAngle = (t + 0.05) * b.speed + b.phase;
      const nlx = b.bx + Math.cos(nextAngle) * b.orbitRadius + Math.sin((t + 0.05) * 11 + idx * 3) * 0.18;
      const nlz = b.bz + Math.sin(nextAngle) * b.orbitRadius + Math.cos((t + 0.05) * 9 + idx * 5) * 0.18;
      
      const dx = nlx - lx;
      const dz = nlz - lz;
      group.rotation.y = Math.atan2(dx, dz) + Math.PI / 2;
      
      // Hinge connection wing flaps
      const flap = Math.sin(t * flapSpeed + b.phase * 2) * 1.0;
      wingL.rotation.z = flap;
      wingR.rotation.z = -flap;
    });
  });

  return (
    <group>
      {butterflies.map((b, i) => (
        <group key={i} ref={(el) => { if (el) groupRefs.current[i] = el; }}>
          {/* Butterfly Body */}
          <mesh castShadow>
            <cylinderGeometry args={[0.01, 0.01, 0.12, 6]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          
          {/* Left Wing Group (pivoted) */}
          <group ref={(el) => { if (el) wingLRefs.current[i] = el; }} position={[-0.01, 0, 0]}>
            <mesh position={[-0.055, 0, 0]} castShadow>
              <planeGeometry args={[0.11, 0.11]} />
              <meshStandardMaterial
                color={b.color}
                side={THREE.DoubleSide}
                roughness={0.4}
                metalness={0.1}
                transparent
                opacity={0.9}
              />
            </mesh>
          </group>

          {/* Right Wing Group (pivoted) */}
          <group ref={(el) => { if (el) wingRRefs.current[i] = el; }} position={[0.01, 0, 0]}>
            <mesh position={[0.055, 0, 0]} castShadow>
              <planeGeometry args={[0.11, 0.11]} />
              <meshStandardMaterial
                color={b.color}
                side={THREE.DoubleSide}
                roughness={0.4}
                metalness={0.1}
                transparent
                opacity={0.9}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
