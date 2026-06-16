import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";
import { terrainHeight } from "./terrainField";
import { audioLevels } from "../audio/audioStore";
import { makeStructureStoneTexture } from "./textures";

function createOrganicCylinderGeometry(rt: number, rb: number, h: number, seed: number) {
  const geom = new THREE.CylinderGeometry(rt, rb, h, 20, 10);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const rand = mulberry32(seed);
  
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    
    const angle = Math.atan2(pz, px);
    
    // Add weathered hand-carved details
    const noise = Math.sin(angle * 5 + py * 1.5 + rand() * 4) * 0.04 * (rt + rb) / 2;
    const chips = Math.cos(angle * 8 - py * 2.5 + rand() * 10) * 0.02 * (rt + rb) / 2;
    
    const dist = Math.hypot(px, pz);
    if (dist > 0.01) {
      const scale = 1 + (noise + chips) / dist;
      pos.setX(i, px * scale);
      pos.setZ(i, pz * scale);
    }
  }
  geom.computeVertexNormals();
  return geom;
}

interface Item {
  x: number;
  z: number;
  type: number;
  s: number;
  rot: number;
  tilt: number;
  h: number;
  ground: number;
  columnGeom?: THREE.CylinderGeometry | null;
  baseGeom?: THREE.CylinderGeometry | null;
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
      const s = 0.8 + rand() * 1.9;
      const h = 18 + rand() * 26;
      const type = Math.floor(rand() * 4);
      
      let columnGeom = null;
      let baseGeom = null;
      if (type === 2) {
        columnGeom = createOrganicCylinderGeometry(1.6 * s, 2.6 * s, h * 1.2 * s, i * 17);
        baseGeom = createOrganicCylinderGeometry(3.2 * s, 3.2 * s, 0.8 * s, i * 29);
      }
      
      arr.push({
        x,
        z,
        type,
        s,
        rot: rand() * Math.PI,
        tilt: (rand() - 0.5) * 0.14,
        h,
        ground: terrainHeight(world.terrain, x, z),
        columnGeom,
        baseGeom,
      });
    }
    return arr;
  }, [world]);

  const stoneTex = useMemo(() => makeStructureStoneTexture(), []);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(world.colors.structure),
        roughness: 0.85,
        metalness: 0.05,
        emissive: new THREE.Color(world.colors.structureGlow),
        emissiveIntensity: 0.08,
        bumpMap: stoneTex,
        bumpScale: 0.04,
        roughnessMap: stoneTex,
      }),
    [world, stoneTex],
  );

  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(world.colors.structureGlow),
        toneMapped: false,
      }),
    [world],
  );

  const crystalRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    mat.emissiveIntensity = 0.06 + audioLevels.intensity * 0.32 + audioLevels.peak * 0.22;
    if (crystalRef.current) {
      const t = clock.getElapsedTime();
      const scale = 1.0 + audioLevels.level * 0.35;
      crystalRef.current.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const baseY = mesh.userData.baseY || 0;
        const phase = mesh.userData.phase || 0;
        mesh.position.y = baseY + Math.sin(t * 1.8 + phase) * 0.25;
        mesh.rotation.y = t * 1.2 + phase;
        mesh.scale.setScalar(scale);
      });
    }
  });

  return (
    <group>
      {/* Ancient Ruins Structures */}
      {items.map((it, i) => {
        const common = {
          position: [it.x, it.ground, it.z] as [number, number, number],
          rotation: [it.tilt, it.rot, it.tilt * 0.6] as [number, number, number],
        };
        if (it.type === 0) {
          const h = it.h * 1.4 * it.s;
          return (
            <group key={i} position={common.position} rotation={common.rotation}>
              {/* Column shaft */}
              <mesh material={mat} position={[0, h / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[3 * it.s, h, 3 * it.s]} />
              </mesh>
              {/* Base pedestal */}
              <mesh material={mat} position={[0, 0.4 * it.s, 0]} castShadow receiveShadow>
                <boxGeometry args={[4.2 * it.s, 0.8 * it.s, 4.2 * it.s]} />
              </mesh>
              {/* Top capital cap */}
              <mesh material={mat} position={[0, h - 0.4 * it.s, 0]} castShadow receiveShadow>
                <boxGeometry args={[4.0 * it.s, 0.8 * it.s, 4.0 * it.s]} />
              </mesh>
            </group>
          );
        }
        if (it.type === 1) {
          const h = it.h * it.s;
          const w = 9 * it.s;
          return (
            <group key={i} position={common.position} rotation={common.rotation}>
              {/* Left Pillar */}
              <mesh material={mat} position={[-w / 2, h / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.4 * it.s, h, 2.4 * it.s]} />
              </mesh>
              {/* Left Base Pedestal */}
              <mesh material={mat} position={[-w / 2, 0.4 * it.s, 0]} castShadow receiveShadow>
                <boxGeometry args={[3.2 * it.s, 0.8 * it.s, 3.2 * it.s]} />
              </mesh>
              {/* Right Pillar */}
              <mesh material={mat} position={[w / 2, h / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[2.4 * it.s, h, 2.4 * it.s]} />
              </mesh>
              {/* Right Base Pedestal */}
              <mesh material={mat} position={[w / 2, 0.4 * it.s, 0]} castShadow receiveShadow>
                <boxGeometry args={[3.2 * it.s, 0.8 * it.s, 3.2 * it.s]} />
              </mesh>
              {/* Top Beam */}
              <mesh material={mat} position={[0, h + 1.2 * it.s, 0]} castShadow receiveShadow>
                <boxGeometry args={[w + 3 * it.s, 2.6 * it.s, 3 * it.s]} />
              </mesh>
            </group>
          );
        }
        if (it.type === 2) {
          const h = it.h * 1.2 * it.s;
          return (
            <group key={i} position={common.position} rotation={common.rotation}>
              {/* Column shaft */}
              <mesh material={mat} geometry={it.columnGeom || undefined} position={[0, h / 2, 0]} castShadow receiveShadow />
              {/* Base pedestal */}
              <mesh material={mat} geometry={it.baseGeom || undefined} position={[0, 0.4 * it.s, 0]} castShadow receiveShadow />
              {/* Top capital cap */}
              <mesh material={mat} position={[0, h - 0.2 * it.s, 0]} castShadow receiveShadow>
                <boxGeometry args={[3.2 * it.s, 0.8 * it.s, 3.2 * it.s]} />
              </mesh>
            </group>
          );
        }
        const h = it.h * 0.7 * it.s;
        return (
          <group key={i} position={common.position} rotation={common.rotation}>
            <mesh material={mat} position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[5 * it.s, h, 4 * it.s]} />
            </mesh>
            <mesh material={mat} position={[3 * it.s, h * 0.35, 1.5 * it.s]} rotation={[0.2, 0.4, 0.3]} castShadow receiveShadow>
              <boxGeometry args={[3 * it.s, h * 0.7, 3 * it.s]} />
            </mesh>
            <mesh material={mat} position={[-2.5 * it.s, h * 0.2, -1.5 * it.s]} rotation={[-0.3, 0.2, -0.2]} castShadow receiveShadow>
              <boxGeometry args={[2.5 * it.s, h * 0.5, 2.5 * it.s]} />
            </mesh>
          </group>
        );
      })}

      {/* Floating Glowing Crystals & Glyphs */}
      <group ref={crystalRef}>
        {items.map((it, i) => {
          if (it.type === 0) {
            const h = it.h * 1.4 * it.s;
            const baseY = it.ground + h + 1.8 * it.s;
            return (
              <mesh
                key={`crystal-${i}`}
                material={glowMat}
                position={[it.x, baseY, it.z]}
                userData={{ baseY, phase: i * 0.5 }}
              >
                <dodecahedronGeometry args={[it.s * 0.4, 0]} />
              </mesh>
            );
          }
          if (it.type === 2) {
            const h = it.h * 1.2 * it.s;
            const baseY = it.ground + h + 2.0 * it.s;
            return (
              <mesh
                key={`crystal-${i}`}
                material={glowMat}
                position={[it.x, baseY, it.z]}
                userData={{ baseY, phase: i * 0.5 }}
              >
                <dodecahedronGeometry args={[it.s * 0.4, 0]} />
              </mesh>
            );
          }
          if (it.type === 1) {
            const h = it.h * it.s;
            const baseY = it.ground + h - 1.2 * it.s;
            return (
              <mesh
                key={`crystal-${i}`}
                material={glowMat}
                position={[it.x, baseY, it.z]}
                rotation={[0, 0, Math.PI / 4]}
                userData={{ baseY, phase: i * 0.5 }}
              >
                <boxGeometry args={[it.s * 0.5, it.s * 0.5, it.s * 0.1]} />
              </mesh>
            );
          }
          return null;
        })}
      </group>
    </group>
  );
}
