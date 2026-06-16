import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COLORS = [0xff3366, 0x33aaff, 0xffdd22, 0x33ffaa, 0xff8833, 0xcc33ff];
const SPARK_SLOTS = 480;
const ROCKETS_MAX = 5;

interface RocketState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  phase: "rising" | "sparking";
  timer: number;
  sparkStart: number;
  sparkCount: number;
}

function makeRocket(i: number): RocketState {
  const spread = 20;
  return {
    pos: new THREE.Vector3((Math.random() - 0.5) * spread, 1, (Math.random() - 0.5) * 8 - 5),
    vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 14 + Math.random() * 10, (Math.random() - 0.5) * 1.5),
    color: new THREE.Color(COLORS[i % COLORS.length]),
    phase: "rising",
    timer: i * 1.1,
    sparkStart: Math.floor((i * SPARK_SLOTS) / ROCKETS_MAX),
    sparkCount: Math.floor(SPARK_SLOTS / ROCKETS_MAX),
  };
}

const beamBaseColors = [
  new THREE.Color(0x4499ff),
  new THREE.Color(0xff4488),
  new THREE.Color(0x44ffcc),
  new THREE.Color(0xffaa33),
];

const beamBasePositions: [number, number, number][] = [
  [-12, 0, -8],
  [12, 0, -8],
  [-12, 0, 2],
  [12, 0, 2],
];

export function ConcertOverlay({ active }: { active: boolean }) {
  const rocketsRef = useRef<RocketState[]>(
    Array.from({ length: ROCKETS_MAX }, (_, i) => makeRocket(i)),
  );

  const beamRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];

  const sparkVelsRef = useRef<THREE.Vector3[]>(
    Array.from({ length: SPARK_SLOTS }, () => new THREE.Vector3()),
  );
  const sparkLifeRef = useRef<Float32Array>(new Float32Array(SPARK_SLOTS));

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(SPARK_SLOTS * 3);
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);

  const posArrayRef = useRef<Float32Array | null>(null);
  useEffect(() => {
    posArrayRef.current = geo.attributes["position"].array as Float32Array;
    return () => {
      geo.dispose();
    };
  }, [geo]);

  useFrame(({ clock }, delta) => {
    if (!active) return;
    const posArr = posArrayRef.current;
    if (!posArr) return;

    const dt = Math.min(delta, 0.05);
    const rockets = rocketsRef.current;
    const sparkVels = sparkVelsRef.current;
    const sparkLife = sparkLifeRef.current;

    for (let r = 0; r < ROCKETS_MAX; r++) {
      const rk = rockets[r];
      rk.timer -= dt;
      if (rk.timer > 0) continue;

      if (rk.phase === "rising") {
        rk.vel.y -= 18 * dt;
        rk.pos.addScaledVector(rk.vel, dt);

        if (rk.vel.y <= 0) {
          rk.phase = "sparking";
          const cx = rk.pos.x;
          const cy = rk.pos.y;
          const cz = rk.pos.z;
          for (let s = 0; s < rk.sparkCount; s++) {
            const idx = rk.sparkStart + s;
            posArr[idx * 3] = cx;
            posArr[idx * 3 + 1] = cy;
            posArr[idx * 3 + 2] = cz;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 3 + Math.random() * 8;
            sparkVels[idx].set(
              Math.sin(phi) * Math.cos(theta) * speed,
              Math.abs(Math.sin(phi) * Math.sin(theta)) * speed * 0.6 + 1,
              Math.sin(phi) * Math.sin(theta) * speed,
            );
            sparkLife[idx] = 1;
          }
        }
      } else {
        let anyAlive = false;
        for (let s = 0; s < rk.sparkCount; s++) {
          const idx = rk.sparkStart + s;
          if (sparkLife[idx] <= 0) continue;
          anyAlive = true;
          sparkVels[idx].y -= 5 * dt;
          posArr[idx * 3] += sparkVels[idx].x * dt;
          posArr[idx * 3 + 1] += sparkVels[idx].y * dt;
          posArr[idx * 3 + 2] += sparkVels[idx].z * dt;
          sparkLife[idx] -= dt * 0.7;
        }

        if (!anyAlive) {
          const next = makeRocket(r);
          next.timer = 1.5 + Math.random() * 2;
          rockets[r] = next;
          for (let s = 0; s < rk.sparkCount; s++) {
            const idx = rk.sparkStart + s;
            sparkLife[idx] = 0;
            posArr[idx * 3 + 1] = -9999;
          }
        }
      }
    }

    const attr = geo.attributes["position"] as THREE.BufferAttribute;
    attr.needsUpdate = true;

    const t = clock.getElapsedTime();
    for (let b = 0; b < 4; b++) {
      const beam = beamRefs[b].current;
      if (beam) {
        const pulse = 0.85 + Math.sin(t * 1.4 + b * 1.2) * 0.15;
        beam.scale.setScalar(pulse);
        const mat = beam.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.12 + pulse * 0.06;
      }
    }
  });

  if (!active) return null;

  return (
    <group>
      <mesh position={[0, -0.3, -5]} receiveShadow>
        <boxGeometry args={[28, 0.4, 14]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} metalness={0.1} />
      </mesh>

      <mesh position={[0, -0.09, -5]}>
        <boxGeometry args={[27.8, 0.01, 13.8]} />
        <meshStandardMaterial
          color="#2a1a4a"
          roughness={0.4}
          metalness={0.3}
          emissive="#1a0a2a"
          emissiveIntensity={0.4}
        />
      </mesh>

      {beamBasePositions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh ref={beamRefs[i]}>
            <coneGeometry args={[1.2, 30, 8, 1, true]} />
            <meshBasicMaterial
              color={beamBaseColors[i]}
              transparent
              opacity={0.14}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.25, 8, 8]} />
            <meshBasicMaterial color={beamBaseColors[i]} />
          </mesh>
          <pointLight color={beamBaseColors[i]} intensity={4} distance={20} />
        </group>
      ))}

      <points geometry={geo}>
        <pointsMaterial
          size={0.18}
          color="#ffffff"
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      <rectAreaLight
        color="#6633ff"
        intensity={3}
        width={28}
        height={0.5}
        position={[0, 0.1, -5]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
    </group>
  );
}
