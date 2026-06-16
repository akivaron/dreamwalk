import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";
import { terrainHeight } from "./terrainField";
import { audioLevels } from "../audio/audioStore";

export function Grass({ world }: { world: World }) {
  const hasGrass = true;

  const count = 2200;

  const grassData = useMemo(() => {
    const rand = mulberry32(12345);
    const arr = [];
    
    // Multi-tonal color palettes matching Journey/Sky aesthetics
    const palettes = {
      "savana-valley": [
        "#4fa36d", // Fresh green
        "#cca14b", // Golden ochre
        "#dbba60", // Bright gold
        "#ab7e57", // Dried straw brown
        "#6fa37e", // Soft sage
        "#8eb87f", // Highlight green
      ],
      "emerald-valley": [
        "#3a7d52", // Deep green
        "#4fa36d", // Fresh green
        "#6fa37e", // Soft sage
        "#8c734b", // Earthy dry brown
        "#99cc95", // Highlight light green
      ],
      "ancient-kingdom": [
        "#cca14b", // Golden ochre
        "#dbba60", // Bright gold
        "#ebd89a", // Sandy cream
        "#9e7436", // Terracotta brown
        "#ffeaab", // Sunlit gold highlight
      ],
      "golden-desert": [
        "#d48246", // Terracotta orange
        "#d9ad7c", // Sandy beige
        "#ab7e57", // Dried straw brown
        "#bd5c46", // Crimson dune tint
        "#ebd2ad", // Glistening sand highlight
      ],
      "dream-night": [
        "#3a286e", // Deep indigo
        "#5f3ba8", // Violet purple
        "#8f3d8f", // Magenta pink
        "#4f5fa8", // Slate blue
        "#a887ff", // Glowing neon lavender
      ],
    };

    const activePalette = palettes[world.id as keyof typeof palettes] || palettes["savana-valley"];

    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      
      // Search for a dry land position, prioritizing areas near center player area
      let x = 0, z = 0, y = 0;
      let found = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const rad = Math.pow(rand(), 1.4) * 260;
        x = Math.cos(a) * rad;
        z = Math.sin(a) * rad;
        y = terrainHeight(world.terrain, x, z);
        if (y > -0.8) {
          found = true;
          break;
        }
      }
      if (!found) {
        const rad = rand() * 20;
        x = Math.cos(a) * rad;
        z = Math.sin(a) * rad;
        y = terrainHeight(world.terrain, x, z);
      }
      
      // Select a randomized color from the active theme palette
      const colorHex = activePalette[Math.floor(rand() * activePalette.length)];
      const colorObj = new THREE.Color(colorHex);

      arr.push({
        x,
        y,
        z,
        scaleX: 0.8 + rand() * 0.5,
        scaleY: 1.0 + rand() * 1.1,
        scaleZ: 0.8 + rand() * 0.5,
        rotX: (rand() - 0.5) * 0.2,
        rotY: rand() * Math.PI * 2,
        rotZ: (rand() - 0.5) * 0.2,
        phase: rand() * Math.PI * 2,
        swayScale: 0.5 + rand() * 0.7,
        colorObj,
      });
    }
    return arr;
  }, [world, count]);

  const meshRef = useRef<THREE.InstancedMesh>(null);
  
  // Custom geometry with bottom-to-top vertex color gradient and 3D crossed-plane layout
  const geom = useMemo(() => {
    const g1 = new THREE.PlaneGeometry(0.12, 0.75, 1, 3);
    g1.translate(0, 0.375, 0);
    const posAttr1 = g1.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr1.count; i++) {
      const y = posAttr1.getY(i);
      const ratio = y / 0.75;
      const taper = 1 - ratio * 0.85;
      posAttr1.setX(i, posAttr1.getX(i) * taper);
    }
    
    const g2 = new THREE.PlaneGeometry(0.12, 0.75, 1, 3);
    g2.rotateY(Math.PI / 2);
    g2.translate(0, 0.375, 0);
    const posAttr2 = g2.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < posAttr2.count; i++) {
      const y = posAttr2.getY(i);
      const ratio = y / 0.75;
      const taper = 1 - ratio * 0.85;
      posAttr2.setZ(i, posAttr2.getZ(i) * taper);
    }
    
    // Concatenate attributes manually to avoid loading extra libs
    const pos1 = g1.attributes.position.array as Float32Array;
    const pos2 = g2.attributes.position.array as Float32Array;
    const norm1 = g1.attributes.normal.array as Float32Array;
    const norm2 = g2.attributes.normal.array as Float32Array;
    const uv1 = g1.attributes.uv.array as Float32Array;
    const uv2 = g2.attributes.uv.array as Float32Array;
    const index1 = Array.from(g1.index!.array);
    const index2 = Array.from(g2.index!.array);
    
    const combinedPos = new Float32Array(pos1.length + pos2.length);
    combinedPos.set(pos1);
    combinedPos.set(pos2, pos1.length);
    
    const combinedNorm = new Float32Array(norm1.length + norm2.length);
    combinedNorm.set(norm1);
    combinedNorm.set(norm2, norm1.length);
    
    const combinedUv = new Float32Array(uv1.length + uv2.length);
    combinedUv.set(uv1);
    combinedUv.set(uv2, uv1.length);
    
    const combinedIndex = [...index1];
    const offset = pos1.length / 3;
    for (let i = 0; i < index2.length; i++) {
      combinedIndex.push(index2[i] + offset);
    }
    
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(combinedPos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(combinedNorm, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(combinedUv, 2));
    g.setIndex(combinedIndex);
    
    // Create gradient attributes (base is darker, tips are brighter/highlighted)
    const pos = g.attributes.position;
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const ratio = y / 0.75; // 0 to 1 scale
      const grad = 0.35 + ratio * 0.9;
      colors.push(grad, grad, grad);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    
    return g;
  }, []);

  // Update instance colors once on initialization
  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      const data = grassData[i];
      if (!data) continue;
      meshRef.current.setColorAt(i, data.colorObj);
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [grassData, count]);

  const emissive = useMemo(() => {
    if (world.id === "savana-valley") return new THREE.Color("#dbba60");
    if (world.id === "dream-night") return new THREE.Color("#a184ff");
    if (world.id === "ancient-kingdom") return new THREE.Color("#ffe080");
    if (world.id === "emerald-valley") return new THREE.Color("#82ffab");
    return new THREE.Color("#000000");
  }, [world]);

  const emissiveIntensity = useMemo(() => {
    if (world.id === "savana-valley") return 0.14;
    if (world.id === "dream-night") return 0.32;
    if (world.id === "ancient-kingdom") return 0.15;
    if (world.id === "emerald-valley") return 0.08;
    return 0;
  }, [world]);

  const tempObject = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const t = audioLevels.time;
    const windSpeed = 2.4 + audioLevels.intensity * 2.0;
    const windForce = 0.12 + audioLevels.intensity * 0.36 + audioLevels.peak * 0.12;

    for (let i = 0; i < count; i++) {
      const data = grassData[i];
      if (!data) continue;

      tempObject.position.set(data.x, data.y, data.z);
      
      const swayX = Math.sin(t * windSpeed + data.phase) * windForce * data.swayScale;
      const swayZ = Math.cos(t * (windSpeed - 0.4) + data.phase) * windForce * 0.6 * data.swayScale;

      tempObject.rotation.set(data.rotX + swayX, data.rotY, data.rotZ + swayZ);
      
      const musicPulse = 1.0 + audioLevels.level * 0.22;
      tempObject.scale.set(
        data.scaleX,
        data.scaleY * musicPulse,
        data.scaleZ
      );
      
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i, tempObject.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[geom, null as any, count]} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={1.0}
        metalness={0.0}
        side={THREE.DoubleSide}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </instancedMesh>
  );
}
