import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { dreamEvents, stemLevels, audioLevels } from "../audio/audioStore";
import { makeGlowTexture } from "./textures";
import type { SyncedLyricLine } from "../dream/types";

const MAX_STARS = 64;
const SKY_Y_MIN = 28;
const SKY_Y_MAX = 55;
const SKY_Z_OFFSET = -38;

function buildWordPositions(
  words: string[],
  camX: number,
  camY: number,
  camZ: number,
  seed: number,
): THREE.Vector3[] {
  const n = words.length;
  if (n === 0) return [];

  const rand = (s: number) => {
    const x = Math.sin(s * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  return words.map((_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const xSpread = Math.min(2.5 * n, 22);
    const x = camX + (t - 0.5) * xSpread + (rand(i * 3) - 0.5) * 3.5;
    const y = camY + SKY_Y_MIN + (rand(i * 3 + 1)) * (SKY_Y_MAX - SKY_Y_MIN);
    const z = camZ + SKY_Z_OFFSET + (rand(i * 3 + 2) - 0.5) * 8;
    return new THREE.Vector3(x, y, z);
  });
}

interface ConstellationState {
  words: string[];
  positions: THREE.Vector3[];
  opacity: number;
  type: string;
  isEmotional: boolean;
  seed: number;
}

interface LyricConstellationProps {
  syncedLyrics?: SyncedLyricLine[];
}

export function LyricConstellation({ syncedLyrics }: LyricConstellationProps) {
  const { camera } = useThree();

  const tex = useMemo(() => makeGlowTexture(), []);

  const starsGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_STARS * 3);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const linesGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_STARS * 2 * 3);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const starsMatRef = useRef<THREE.PointsMaterial>(null);
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null);
  const starsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const state = useRef<ConstellationState>({
    words: [],
    positions: [],
    opacity: 0,
    type: "unknown",
    isEmotional: false,
    seed: 0,
  });
  const prevLine = useRef<string>("");

  useFrame((_, delta) => {
    const currentLine = dreamEvents.currentLine;
    const isEmotional = dreamEvents.isEmotionalLine;
    const chorusInt = dreamEvents.chorusIntensity;

    if (!syncedLyrics || syncedLyrics.length === 0) {
      state.current.opacity = Math.max(0, state.current.opacity - delta * 0.8);
    } else if (currentLine !== prevLine.current) {
      prevLine.current = currentLine;
      const words = currentLine
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, MAX_STARS);
      const newSeed = Date.now() % 9999;
      const positions = buildWordPositions(
        words,
        camera.position.x,
        camera.position.y,
        camera.position.z,
        newSeed,
      );
      state.current = {
        words,
        positions,
        opacity: words.length > 0 ? 1 : 0,
        type: "unknown",
        isEmotional,
        seed: newSeed,
      };
    }

    const st = state.current;

    if (currentLine && syncedLyrics?.length) {
      const targetOp = st.words.length > 0 ? 1 : 0;
      const lerpRate = st.opacity < targetOp ? 2.5 : 0.6;
      st.opacity = THREE.MathUtils.lerp(st.opacity, targetOp, delta * lerpRate);
    } else {
      st.opacity = Math.max(0, st.opacity - delta * 0.9);
    }

    const n = Math.min(st.words.length, MAX_STARS);
    const starPos = starsGeo.attributes.position as THREE.BufferAttribute;
    const starArr = starPos.array as Float32Array;
    const linePos = linesGeo.attributes.position as THREE.BufferAttribute;
    const lineArr = linePos.array as Float32Array;

    for (let i = 0; i < MAX_STARS; i++) {
      if (i < n) {
        const p = st.positions[i];
        starArr[i * 3] = p.x;
        starArr[i * 3 + 1] = p.y;
        starArr[i * 3 + 2] = p.z;
      } else {
        starArr[i * 3] = 0;
        starArr[i * 3 + 1] = -9999;
        starArr[i * 3 + 2] = 0;
      }
    }
    starPos.needsUpdate = true;

    let lineCount = 0;
    for (let i = 0; i < n - 1; i++) {
      const a = st.positions[i];
      const b = st.positions[i + 1];
      lineArr[lineCount * 3] = a.x;
      lineArr[lineCount * 3 + 1] = a.y;
      lineArr[lineCount * 3 + 2] = a.z;
      lineCount++;
      lineArr[lineCount * 3] = b.x;
      lineArr[lineCount * 3 + 1] = b.y;
      lineArr[lineCount * 3 + 2] = b.z;
      lineCount++;
    }
    for (let i = lineCount; i < MAX_STARS * 2; i++) {
      lineArr[i * 3 + 1] = -9999;
    }
    linePos.needsUpdate = true;
    linesGeo.setDrawRange(0, Math.max(0, lineCount));

    const vocPulse = stemLevels.vocals * 0.6;
    const audioBoost = audioLevels.level * 0.3;
    const emotBoost = isEmotional ? dreamEvents.emotionalIntensity * 0.9 : 0;
    const chorusBoost = chorusInt * 0.4;

    if (starsMatRef.current) {
      const baseSize = st.isEmotional ? 5.5 : 3.8;
      starsMatRef.current.size = (baseSize + vocPulse * 4 + audioBoost * 2 + emotBoost * 3 + chorusBoost * 2);
      starsMatRef.current.opacity = st.opacity * Math.min(1, 0.55 + vocPulse + emotBoost * 0.4 + chorusBoost * 0.25);
      const emotColor = isEmotional
        ? new THREE.Color(1.0, 0.7, 1.0)
        : chorusInt > 0.5
          ? new THREE.Color(0.85, 0.95, 1.0)
          : new THREE.Color(1.0, 0.97, 0.88);
      starsMatRef.current.color.lerp(emotColor, delta * 3);
    }

    if (lineMatRef.current) {
      lineMatRef.current.opacity = st.opacity * 0.18 * (1 + chorusInt * 0.5);
    }
  });

  return (
    <group>
      <points ref={starsRef} geometry={starsGeo} renderOrder={10}>
        <pointsMaterial
          ref={starsMatRef}
          map={tex}
          size={4}
          sizeAttenuation
          color="#fff8e8"
          transparent
          depthWrite={false}
          opacity={0}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
      <lineSegments ref={linesRef} geometry={linesGeo} renderOrder={9}>
        <lineBasicMaterial
          ref={lineMatRef as RefObject<THREE.LineBasicMaterial>}
          color="#c8d8ff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}
