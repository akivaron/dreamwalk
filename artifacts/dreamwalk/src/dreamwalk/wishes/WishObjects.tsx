import { useFrame } from "@react-three/fiber";
import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { audioLevels } from "../audio/audioStore";
import { makeGlowTexture } from "../scene/textures";
import { mulberry32 } from "../rng";
import { terrainHeight } from "../scene/terrainField";
import { wishStore } from "./wishStore";
import type { World } from "../types";

interface WishObjectsProps {
  world: World;
}

const WATER_LEVEL = -1.2;

function getWishColor(worldId: string): string {
  switch (worldId) {
    case "midnight-ocean":
      return "#88ccff";
    case "eternal-winter":
      return "#cce8ff";
    case "mystic-valley":
      return "#88ffb8";
    case "crimson-dusk":
      return "#ffe088";
    default:
      return "#ffc060";
  }
}

interface WishPoint {
  x: number;
  y: number;
  z: number;
  phase: number;
  speed: number;
  sampleIdx: number;
}

export function WishObjects({ world }: WishObjectsProps) {
  const glowTex = useMemo(() => makeGlowTexture(), []);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const glowRefs = useRef<(THREE.Mesh | null)[]>([]);
  const [version, setVersion] = useState(0);
  const lastVersionRef = useRef(0);
  const hoveredRef = useRef<number | null>(null);

  const points = useMemo<WishPoint[]>(() => {
    const seed =
      world.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 7919;
    const rand = mulberry32(seed);

    const WATER_TERRAIN = world.terrain === "water";
    const SNOW_TERRAIN = world.terrain === "snow";
    const IS_DUNES = world.id === "crimson-dusk";

    return Array.from({ length: 8 }, (_, i) => {
      const angle = rand() * Math.PI * 2;
      const dist = 12 + rand() * 38;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      let y: number;
      if (WATER_TERRAIN) {
        y = WATER_LEVEL + 0.25 + rand() * 0.5;
      } else if (IS_DUNES) {
        y = 22 + rand() * 28;
      } else if (SNOW_TERRAIN) {
        y = terrainHeight(world.terrain, x, z) + 6 + rand() * 12;
      } else {
        y = terrainHeight(world.terrain, x, z) + 2.5 + rand() * 6;
      }

      return {
        x,
        y,
        z,
        phase: rand() * Math.PI * 2,
        speed: 0.55 + rand() * 0.65,
        sampleIdx: i,
      };
    });
  }, [world]);

  const wishColor = getWishColor(world.id);

  useFrame((_, dt) => {
    const t = audioLevels.time;

    if (wishStore.version !== lastVersionRef.current) {
      lastVersionRef.current = wishStore.version;
      setVersion((v) => v + 1);
    }

    points.forEach((pt, i) => {
      const mesh = meshRefs.current[i];
      const glow = glowRefs.current[i];
      if (!mesh) return;

      const bobY = Math.sin(t * pt.speed + pt.phase) * 0.45;
      mesh.position.y = pt.y + bobY;
      mesh.rotation.y += dt * 0.6;
      mesh.rotation.x += dt * 0.25;

      const isHovered = hoveredRef.current === i;
      const basePulse = 0.55 + Math.sin(t * 1.4 + pt.phase) * 0.25 + audioLevels.level * 0.35;
      const targetScale = isHovered ? 1.5 : basePulse;
      mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 6 * dt);

      if (glow) {
        glow.position.y = pt.y + bobY;
        const glowPulse = basePulse * 2.2;
        glow.scale.setScalar(glowPulse);
      }
    });
  });

  const hasSamples = wishStore.samples.length > 0;

  return (
    <group>
      {points.map((pt, i) => {
        const sampleIdx = i % Math.max(1, wishStore.samples.length);
        const wish = wishStore.samples[sampleIdx];

        return (
          <group key={i}>
            <mesh
              ref={(el) => {
                meshRefs.current[i] = el;
              }}
              position={[pt.x, pt.y, pt.z]}
              onPointerEnter={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
                hoveredRef.current = i;
              }}
              onPointerLeave={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "";
                if (hoveredRef.current === i) hoveredRef.current = null;
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (wish && hasSamples) {
                  wishStore.onWishSelected?.(wish);
                }
              }}
            >
              <octahedronGeometry args={[0.38, 0]} />
              <meshStandardMaterial
                color={wishColor}
                emissive={wishColor}
                emissiveIntensity={1.6}
                roughness={0.15}
                metalness={0.3}
                transparent
                opacity={0.88}
              />
            </mesh>

            <mesh
              ref={(el) => {
                glowRefs.current[i] = el;
              }}
              position={[pt.x, pt.y, pt.z]}
            >
              <planeGeometry args={[1.8, 1.8]} />
              <meshBasicMaterial
                map={glowTex}
                color={wishColor}
                transparent
                opacity={0.28}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
