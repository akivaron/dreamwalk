import { useMemo } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";

function createOrganicMountainGeometry(radius: number, height: number, seed: number) {
  const geom = new THREE.ConeGeometry(radius, height, 32, 16);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const rand = mulberry32(seed);
  
  const ridgesCount = 3 + Math.floor(rand() * 3); // 3 to 5 ridges
  const ridgeOffset = rand() * Math.PI * 2;
  const ruggedness = 0.12 + rand() * 0.08;
  
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    
    if (py === height / 2) continue; // Keep tip sharp
    
    const yRatio = (height / 2 - py) / height; // 0 at top, 1 at bottom
    const angle = Math.atan2(pz, px);
    
    // Add natural ridges running down
    const ridge = Math.sin(angle * ridgesCount + ridgeOffset) * ruggedness * radius * yRatio;
    
    // Add horizontal erosion/sedimentary rings
    const erosion = Math.cos(py * 0.4 + angle * 2) * 0.04 * radius * yRatio;
    
    const dist = Math.hypot(px, pz);
    if (dist > 0.01) {
      const scale = 1 + (ridge + erosion) / dist;
      pos.setX(i, px * scale);
      pos.setZ(i, pz * scale);
    }
  }
  geom.computeVertexNormals();
  return geom;
}

interface MountainItem {
  x: number;
  z: number;
  h: number;
  r: number;
  rot: number;
  baseGeom: THREE.ConeGeometry;
  peakGeom: THREE.ConeGeometry;
  shoulderGeom: THREE.ConeGeometry;
  shoulderPeakGeom: THREE.ConeGeometry;
}

export function Mountains({ world }: { world: World }) {
  // Far towering mountain peaks
  const farPeaks = useMemo(() => {
    const rand = mulberry32(99);
    const count = 46;
    const arr: MountainItem[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.12;
      const rad = 620 + rand() * 280;
      const h = 130 + rand() * 200;
      const r = 80 + rand() * 80;
      
      const baseGeom = createOrganicMountainGeometry(r, h, i * 17);
      const peakGeom = createOrganicMountainGeometry(r * 0.24, h * 0.24, i * 31);
      const shoulderGeom = createOrganicMountainGeometry(r * 0.55, h * 0.6, i * 43);
      const shoulderPeakGeom = createOrganicMountainGeometry(r * 0.55 * 0.24, h * 0.6 * 0.24, i * 79);
      
      arr.push({
        x: Math.cos(a) * rad,
        z: Math.sin(a) * rad,
        h,
        r,
        rot: rand() * Math.PI,
        baseGeom,
        peakGeom,
        shoulderGeom,
        shoulderPeakGeom,
      });
    }
    return arr;
  }, []);

  // Mid-ground overlapping foothills flanking the valley
  const foothills = useMemo(() => {
    const rand = mulberry32(888);
    const count = 28;
    const arr: MountainItem[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.18;
      const rad = 250 + rand() * 180;
      const h = 34 + rand() * 46;
      const r = 50 + rand() * 50;
      
      const baseGeom = createOrganicMountainGeometry(r, h, i * 19);
      const peakGeom = createOrganicMountainGeometry(r * 0.24, h * 0.24, i * 29);
      const shoulderGeom = createOrganicMountainGeometry(r * 0.52, h * 0.55, i * 41);
      const shoulderPeakGeom = createOrganicMountainGeometry(r * 0.52 * 0.24, h * 0.55 * 0.24, i * 73);
      
      arr.push({
        x: Math.cos(a) * rad,
        z: Math.sin(a) * rad,
        h,
        r,
        rot: rand() * Math.PI,
        baseGeom,
        peakGeom,
        shoulderGeom,
        shoulderPeakGeom,
      });
    }
    return arr;
  }, []);

  const farColor = useMemo(
    () =>
      new THREE.Color(world.colors.fog).lerp(new THREE.Color(world.colors.structure), 0.32),
    [world],
  );

  const hillColor = useMemo(
    () =>
      new THREE.Color(world.colors.ground).lerp(new THREE.Color(world.colors.fog), 0.22),
    [world],
  );

  const peakColor = useMemo(() => {
    if (world.id === "savana-valley") return new THREE.Color(world.colors.structureGlow);
    if (world.id === "snow-sanctuary") return new THREE.Color("#ffffff");
    if (world.id === "emerald-valley") return new THREE.Color("#ffffff");
    if (world.id === "golden-desert") return new THREE.Color(world.colors.sunGlow);
    if (world.id === "ancient-kingdom") return new THREE.Color(world.colors.structureGlow);
    if (world.id === "dream-night") return new THREE.Color(world.colors.auroraA);
    return new THREE.Color(world.colors.light);
  }, [world]);

  const peakEmissiveIntensity = useMemo(() => {
    if (world.id === "savana-valley") return 0.22;
    if (world.id === "dream-night") return 0.45;
    if (world.id === "ancient-kingdom") return 0.25;
    if (world.id === "golden-desert") return 0.15;
    return 0.05;
  }, [world]);

  return (
    <group>
      {/* Outer Far Mountains (with glowing/snowy peaks & shoulder ridges) */}
      {farPeaks.map((m, i) => (
        <group key={`far-${i}`} position={[m.x, m.h / 2 - 26, m.z]} rotation={[0, m.rot, 0]}>
          {/* Mountain base body */}
          <mesh geometry={m.baseGeom} castShadow receiveShadow>
            <meshStandardMaterial color={farColor} roughness={0.9} metalness={0.02} />
          </mesh>
          {/* Mountain peak cap */}
          <mesh geometry={m.peakGeom} position={[0, m.h * 0.38, 0]} castShadow>
            <meshStandardMaterial
              color={peakColor}
              roughness={0.65}
              emissive={peakColor}
              emissiveIntensity={peakEmissiveIntensity}
            />
          </mesh>

          {/* Secondary shoulder peak */}
          <mesh geometry={m.shoulderGeom} position={[m.r * 0.32, -m.h * 0.15, m.r * 0.1]} rotation={[0.05, 0.4, -0.05]} castShadow receiveShadow>
            <meshStandardMaterial color={farColor} roughness={0.9} metalness={0.02} />
          </mesh>
          {/* Secondary peak cap */}
          <mesh geometry={m.shoulderPeakGeom} position={[m.r * 0.32, m.h * 0.08, m.r * 0.1]} rotation={[0.05, 0.4, -0.05]} castShadow>
            <meshStandardMaterial
              color={peakColor}
              roughness={0.7}
              emissive={peakColor}
              emissiveIntensity={peakEmissiveIntensity * 0.7}
            />
          </mesh>
        </group>
      ))}

      {/* Inner Mid Foothills (forming the Valley, with secondary ridges) */}
      {foothills.map((m, i) => (
        <group key={`hill-${i}`} position={[m.x, m.h / 2 - 8, m.z]} rotation={[0, m.rot, 0]}>
          {/* Foothill base body */}
          <mesh geometry={m.baseGeom} castShadow receiveShadow>
            <meshStandardMaterial color={hillColor} roughness={0.88} metalness={0.02} />
          </mesh>
          {/* Foothill crest cap */}
          <mesh geometry={m.peakGeom} position={[0, m.h * 0.38, 0]} castShadow>
            <meshStandardMaterial
              color={peakColor}
              roughness={0.7}
              emissive={peakColor}
              emissiveIntensity={peakEmissiveIntensity * 0.6}
            />
          </mesh>

          {/* Secondary shoulder peak */}
          <mesh geometry={m.shoulderGeom} position={[-m.r * 0.35, -m.h * 0.16, m.r * 0.12]} rotation={[-0.08, -0.3, 0.06]} castShadow receiveShadow>
            <meshStandardMaterial color={hillColor} roughness={0.88} metalness={0.02} />
          </mesh>
          {/* Secondary peak cap */}
          <mesh geometry={m.shoulderPeakGeom} position={[-m.r * 0.35, m.h * 0.05, m.r * 0.12]} rotation={[-0.08, -0.3, 0.06]} castShadow>
            <meshStandardMaterial
              color={peakColor}
              roughness={0.72}
              emissive={peakColor}
              emissiveIntensity={peakEmissiveIntensity * 0.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
