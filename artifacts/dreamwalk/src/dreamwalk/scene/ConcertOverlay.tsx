import { useRef, useMemo } from "react";
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

function initRocket(i: number): RocketState {
  const spread = 20;
  return {
    pos: new THREE.Vector3((Math.random() - 0.5) * spread, 1, (Math.random() - 0.5) * 8 - 5),
    vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 14 + Math.random() * 10, (Math.random() - 0.5) * 1.5),
    color: new THREE.Color(COLORS[i % COLORS.length]),
    phase: "rising",
    timer: i * 1.1,
    sparkStart: (i * SPARK_SLOTS) / ROCKETS_MAX,
    sparkCount: SPARK_SLOTS / ROCKETS_MAX,
  };
}

const sparkPos = new Float32Array(SPARK_SLOTS * 3);
const sparkAlpha = new Float32Array(SPARK_SLOTS);
const sparkVels: THREE.Vector3[] = Array.from({ length: SPARK_SLOTS }, () => new THREE.Vector3());
const sparkLife: Float32Array = new Float32Array(SPARK_SLOTS);

export function ConcertOverlay({ active }: { active: boolean }) {
  const rocketsRef = useRef<RocketState[]>(
    Array.from({ length: ROCKETS_MAX }, (_, i) => initRocket(i)),
  );
  const launchTimerRef = useRef(0);

  const positions = useRef(sparkPos);
  const alphas = useRef(sparkAlpha);
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  const beamRefs = [
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
    useRef<THREE.Mesh>(null),
  ];

  const beamPositions = useMemo(
    () => [
      [-12, 0, -8],
      [12, 0, -8],
      [-12, 0, 2],
      [12, 0, 2],
    ] as [number, number, number][],
    [],
  );

  const beamColors = useMemo(
    () => [
      new THREE.Color(0x4499ff),
      new THREE.Color(0xff4488),
      new THREE.Color(0x44ffcc),
      new THREE.Color(0xffaa33),
    ],
    [],
  );

  useFrame(({ clock }, delta) => {
    if (!active) return;

    const dt = Math.min(delta, 0.05);
    launchTimerRef.current += dt;

    const rockets = rocketsRef.current;

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
            positions.current[idx * 3] = cx;
            positions.current[idx * 3 + 1] = cy;
            positions.current[idx * 3 + 2] = cz;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = 3 + Math.random() * 8;
            sparkVels[idx].set(
              Math.sin(phi) * Math.cos(theta) * speed,
              Math.abs(Math.sin(phi) * Math.sin(theta)) * speed * 0.6 + 1,
              Math.sin(phi) * Math.sin(theta) * speed,
            );
            sparkLife[idx] = 1;
            alphas.current[idx] = 1;
          }
        }
      } else {
        let anyAlive = false;
        for (let s = 0; s < rk.sparkCount; s++) {
          const idx = rk.sparkStart + s;
          if (sparkLife[idx] <= 0) continue;
          anyAlive = true;
          sparkVels[idx].y -= 5 * dt;
          positions.current[idx * 3] += sparkVels[idx].x * dt;
          positions.current[idx * 3 + 1] += sparkVels[idx].y * dt;
          positions.current[idx * 3 + 2] += sparkVels[idx].z * dt;
          sparkLife[idx] -= dt * 0.7;
          alphas.current[idx] = Math.max(0, sparkLife[idx]);
        }

        if (!anyAlive) {
          const next = initRocket(r);
          next.timer = 1.5 + Math.random() * 2;
          rockets[r] = next;
          for (let s = 0; s < rk.sparkCount; s++) {
            const idx = rk.sparkStart + s;
            alphas.current[idx] = 0;
          }
        }
      }
    }

    if (pointsRef.current) {
      (pointsRef.current.geometry.attributes["position"] as THREE.BufferAttribute).needsUpdate = true;
    }

    const t = clock.getElapsedTime();
    for (let b = 0; b < 4; b++) {
      const beam = beamRefs[b].current;
      if (beam) {
        const pulse = 0.85 + Math.sin(t * 1.4 + b * 1.2) * 0.15;
        beam.scale.setScalar(pulse);
        (beam.material as THREE.MeshBasicMaterial).opacity = 0.12 + pulse * 0.06;
      }
    }
  });

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SPARK_SLOTS * 3), 3));
    return g;
  }, []);

  if (!active) return null;

  return (
    <group>
      <mesh position={[0, -0.3, -5]} receiveShadow>
        <boxGeometry args={[28, 0.4, 14]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} metalness={0.1} />
      </mesh>

      <mesh position={[0, -0.09, -5]}>
        <boxGeometry args={[27.8, 0.01, 13.8]} />
        <meshStandardMaterial color="#2a1a4a" roughness={0.4} metalness={0.3} emissive="#1a0a2a" emissiveIntensity={0.4} />
      </mesh>

      {beamPositions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh ref={beamRefs[i]} rotation={[0, 0, 0]}>
            <coneGeometry args={[1.2, 30, 8, 1, true]} />
            <meshBasicMaterial
              color={beamColors[i]}
              transparent
              opacity={0.14}
              side={THREE.BackSide}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.25, 8, 8]} />
            <meshBasicMaterial color={beamColors[i]} />
          </mesh>
          <pointLight color={beamColors[i]} intensity={4} distance={20} />
        </group>
      ))}

      <points ref={pointsRef} geometry={geo}>
        <pointsMaterial
          ref={matRef}
          size={0.18}
          vertexColors={false}
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
