import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";
import { audioLevels } from "../audio/audioStore";
import { terrainHeight } from "./terrainField";

function createOrganicIslandBase(radius: number, height: number, seed: number) {
  const geom = new THREE.ConeGeometry(radius, height, 24, 12);
  geom.rotateX(Math.PI); // point downwards
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const rand = mulberry32(seed);
  
  const cragCount = 4 + Math.floor(rand() * 3);
  const cragOffset = rand() * Math.PI * 2;
  
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    
    const yRatio = (height / 2 - py) / height; // 0 at flat top, 1 at bottom tip
    const angle = Math.atan2(pz, px);
    
    const rockNoise = Math.sin(angle * cragCount + cragOffset) * 0.16 * radius * yRatio;
    const verticalCrag = Math.cos(py * 0.8 + angle) * 0.08 * radius * yRatio;
    
    const dist = Math.hypot(px, pz);
    if (dist > 0.01) {
      const scale = 1 + (rockNoise + verticalCrag) / dist;
      pos.setX(i, px * scale);
      pos.setZ(i, pz * scale);
    }
  }
  geom.computeVertexNormals();
  return geom;
}

function createOrganicCylinderGeometry(rt: number, rb: number, h: number, seed: number) {
  const geom = new THREE.CylinderGeometry(rt, rb, h, 24, 8);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const rand = mulberry32(seed);
  
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    
    const angle = Math.atan2(pz, px);
    const noise = Math.sin(angle * 6 + py * 1.5 + rand() * 4) * 0.04 * (rt + rb) / 2;
    
    const dist = Math.hypot(px, pz);
    if (dist > 0.01) {
      const scale = 1 + noise / dist;
      pos.setX(i, px * scale);
      pos.setZ(i, pz * scale);
    }
  }
  geom.computeVertexNormals();
  return geom;
}

interface Island {
  x: number;
  y: number;
  z: number;
  s: number;
  phase: number;
  rockGeom: THREE.ConeGeometry;
  topGeom: THREE.CylinderGeometry;
  leftPillarGeom: THREE.CylinderGeometry;
  rightPillarGeom: THREE.CylinderGeometry;
  lintelGeom: THREE.BoxGeometry;
}

export function FloatingIslands({ world }: { world: World }) {
  const items = useMemo(() => {
    const rand = mulberry32(321);
    const n = 14;
    const arr: Island[] = [];
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const rad = 140 + rand() * 320;
      const s = 6 + rand() * 14;
      
      const rockGeom = createOrganicIslandBase(s, s * 2.2, i * 13);
      const topGeom = createOrganicCylinderGeometry(s, s * 0.92, s * 0.4, i * 29);
      const leftPillarGeom = createOrganicCylinderGeometry(s * 0.08, s * 0.08, s * 0.7, i * 41);
      const rightPillarGeom = createOrganicCylinderGeometry(s * 0.08, s * 0.08, s * 0.7, i * 53);
      const lintelGeom = new THREE.BoxGeometry(s * 1.05, s * 0.12, s * 0.2);
      
      arr.push({
        x: Math.cos(a) * rad,
        y: 54 + rand() * 96,
        z: Math.sin(a) * rad,
        s,
        phase: rand() * Math.PI * 2,
        rockGeom,
        topGeom,
        leftPillarGeom,
        rightPillarGeom,
        lintelGeom,
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
      
      const currentY = it.y + Math.sin(t * 0.4 + it.phase) * 3 + rise;
      child.position.set(it.x, currentY, it.z);
      child.rotation.y = t * 0.03 + it.phase;

      // Update light waterfall height and position (to touch the ground dynamically)
      const groundY = terrainHeight(world.terrain, it.x, it.z);
      const height = Math.max(0.1, currentY - groundY - 0.2);

      const waterfall = child.getObjectByName("waterfall") as THREE.Group;
      if (waterfall) {
        waterfall.position.y = -height / 2 - it.s * 0.8;
        waterfall.scale.set(1, height, 1);
      }

      // Rotate orbiting debris and floating crystals
      const debris = child.getObjectByName("orbitingDebris") as THREE.Group;
      if (debris) {
        debris.rotation.y = t * 0.6;
      }

      const crystal = child.getObjectByName("crystalCore") as THREE.Mesh;
      if (crystal) {
        crystal.rotation.y = t * 1.5;
        crystal.rotation.x = t * 0.8;
      }
    });
  });

  const rockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(world.colors.groundDeep),
        roughness: 0.95,
      }),
    [world],
  );

  const topMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(world.colors.structure),
        roughness: 0.85,
        emissive: new THREE.Color(world.colors.structureGlow),
        emissiveIntensity: 0.1,
      }),
    [world],
  );

  const glowMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(world.colors.structureGlow),
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [world],
  );

  const glowMatInner = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(world.colors.light),
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [world],
  );

  const glowCoreMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(world.colors.structureGlow),
        toneMapped: false,
      }),
    [world],
  );

  return (
    <group ref={group}>
      {items.map((it, i) => (
        <group key={i} position={[it.x, it.y, it.z]}>
          {/* Bottom Rock Cone */}
          <mesh material={rockMat} geometry={it.rockGeom} position={[0, -it.s * 0.8, 0]} castShadow receiveShadow />
          
          {/* Top Grassy Cylinder */}
          <mesh material={topMat} geometry={it.topGeom} position={[0, it.s * 0.1, 0]} castShadow receiveShadow />
          
          {/* Waterfall Cascade of Light (Layered volumetric cylinder group) */}
          <group name="waterfall">
            {/* Outer soft column */}
            <mesh material={glowMat}>
              <cylinderGeometry args={[it.s * 0.14, it.s * 0.28, 1, 16, 1, true]} />
            </mesh>
            {/* Inner intense column */}
            <mesh material={glowMatInner} scale={[0.55, 1, 0.55]}>
              <cylinderGeometry args={[it.s * 0.14, it.s * 0.28, 1, 16, 1, true]} />
            </mesh>
          </group>

          {/* Orbiting Debris (Small floating rocks) */}
          <group name="orbitingDebris">
            {[0, 1, 2, 3].map((idx) => {
              const angle = (idx / 4) * Math.PI * 2;
              const radius = it.s * 1.5;
              const ox = Math.cos(angle) * radius;
              const oz = Math.sin(angle) * radius;
              const oy = (idx % 2 === 0 ? 0.35 : -0.35) * it.s;
              return (
                <mesh key={idx} material={rockMat} position={[ox, oy, oz]} castShadow>
                  <icosahedronGeometry args={[it.s * 0.08, 1]} />
                </mesh>
              );
            })}
          </group>

          {/* Ancient Ruins Archway on top */}
          <group position={[0, it.s * 0.3, 0]}>
            {/* Left Pillar */}
            <mesh material={rockMat} geometry={it.leftPillarGeom} position={[-it.s * 0.44, it.s * 0.35, 0]} castShadow receiveShadow />
            {/* Right Pillar */}
            <mesh material={rockMat} geometry={it.rightPillarGeom} position={[it.s * 0.44, it.s * 0.35, 0]} castShadow receiveShadow />
            {/* Linted Top Beam */}
            <mesh material={rockMat} geometry={it.lintelGeom} position={[0, it.s * 0.72, 0]} castShadow receiveShadow />
            {/* Floating Glowing Crystal Core in Center of Arch */}
            <mesh material={glowCoreMat} name="crystalCore" position={[0, it.s * 0.35, 0]}>
              <dodecahedronGeometry args={[it.s * 0.09, 0]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
