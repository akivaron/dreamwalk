import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { audioLevels } from "../audio/audioStore";
import { makeGlowTexture } from "./textures";
import { mulberry32 } from "../rng";

function SkyDome({ world }: { world: World }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(world.colors.skyTop) },
          bottom: { value: new THREE.Color(world.colors.skyBottom) },
          offset: { value: 0.12 },
          expo: { value: 1.15 },
        },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform float offset; uniform float expo; varying vec3 vP;
          void main(){ float h = normalize(vP).y; float t = clamp((h + offset)/(1.0 + offset), 0.0, 1.0); t = pow(t, expo); gl_FragColor = vec4(mix(bottom, top, t), 1.0); }`,
      }),
    [world],
  );
  return (
    <mesh material={mat}>
      <sphereGeometry args={[1500, 32, 16]} />
    </mesh>
  );
}

function Sun({ world }: { world: World }) {
  const dir = useMemo(
    () => new THREE.Vector3(...world.sunPosition).normalize().multiplyScalar(1050),
    [world],
  );
  const tex = useMemo(() => makeGlowTexture(), []);
  const glowRef = useRef<THREE.Sprite>(null);
  useFrame(() => {
    if (glowRef.current) {
      const s = world.sunSize * (3.0 + audioLevels.intensity * 2.4 + audioLevels.peak * 1.6);
      glowRef.current.scale.set(s, s, 1);
      const m = glowRef.current.material as THREE.SpriteMaterial;
      m.opacity = 0.5 + audioLevels.intensity * 0.42;
    }
  });
  return (
    <group position={dir}>
      <mesh>
        <sphereGeometry args={[world.sunSize, 32, 32]} />
        <meshBasicMaterial color={world.colors.sun} toneMapped={false} fog={false} />
      </mesh>
      <sprite ref={glowRef} scale={[world.sunSize * 3, world.sunSize * 3, 1]}>
        <spriteMaterial
          map={tex}
          color={world.colors.sunGlow}
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
        />
      </sprite>
    </group>
  );
}

function Stars({ world }: { world: World }) {
  const geo = useMemo(() => {
    const rand = mulberry32(7);
    const N = 900;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = 1250;
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.92 + 40;
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  const tex = useMemo(() => makeGlowTexture(), []);
  const matRef = useRef<THREE.PointsMaterial>(null);
  useFrame(() => {
    if (matRef.current) {
      matRef.current.opacity =
        0.55 + Math.sin(audioLevels.time * 0.7) * 0.12 + audioLevels.treble * 0.35;
    }
  });
  return (
    <points geometry={geo}>
      <pointsMaterial
        ref={matRef}
        map={tex}
        size={8}
        sizeAttenuation
        color={world.colors.particle}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </points>
  );
}

function Aurora({ world }: { world: World }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uA: { value: new THREE.Color(world.colors.auroraA) },
          uB: { value: new THREE.Color(world.colors.auroraB) },
        },
        vertexShader: `varying vec2 vUv; uniform float uTime; void main(){ vUv = uv; vec3 p = position; p.z += sin(uv.x * 6.2831 + uTime * 0.4) * 22.0 * uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }`,
        fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uIntensity; uniform vec3 uA; uniform vec3 uB;
          void main(){ float band = sin(vUv.x * 9.0 + uTime * 0.5) * 0.5 + 0.5; band *= sin(vUv.x * 3.0 - uTime * 0.3) * 0.5 + 0.5; float vert = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.5, vUv.y); float a = band * vert * (0.16 + uIntensity * 0.6); vec3 c = mix(uA, uB, vUv.y); gl_FragColor = vec4(c, a); }`,
      }),
    [world],
  );
  useFrame(() => {
    mat.uniforms.uTime.value = audioLevels.time;
    mat.uniforms.uIntensity.value = audioLevels.intensity;
  });
  return (
    <group position={[0, 240, -460]} rotation={[-0.5, 0, 0]}>
      <mesh material={mat}>
        <planeGeometry args={[1500, 360, 48, 12]} />
      </mesh>
      <mesh material={mat} position={[-260, 60, 220]} rotation={[0, 0.3, 0.1]}>
        <planeGeometry args={[1200, 300, 48, 12]} />
      </mesh>
      <mesh material={mat} position={[320, -10, 180]} rotation={[0, -0.22, -0.08]}>
        <planeGeometry args={[1050, 260, 48, 12]} />
      </mesh>
    </group>
  );
}

export function Firmament({ world }: { world: World }) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame(() => {
    if (ref.current) ref.current.position.copy(camera.position);
  });
  return (
    <group ref={ref}>
      <SkyDome world={world} />
      <Sun world={world} />
      {world.features.stars && <Stars world={world} />}
      {world.features.aurora && <Aurora world={world} />}
    </group>
  );
}
