import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import type { World } from "../types";
import { mulberry32 } from "../rng";
import { audioLevels, stemLevels } from "../audio/audioStore";
import { terrainHeight, TERRAIN_SIZE } from "./terrainField";
import { makeGroundNoiseTexture, makeFoamTexture, makeWaterNoiseTexture } from "./textures";

function organicColorNoise(x: number, z: number): number {
  return (
    Math.sin(x * 0.035 + Math.cos(z * 0.03) * 1.5) * 0.35 +
    Math.sin(z * 0.04 + Math.sin(x * 0.04) * 1.2) * 0.35 +
    Math.sin((x + z) * 0.12) * 0.2
  );
}

export function Terrain({ world }: { world: World }) {
  const groundTex = useMemo(() => makeGroundNoiseTexture(), []);

  // Land Geometry
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 180, 180);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = [];
    const baseColor = new THREE.Color(world.colors.ground);
    const blendColor = new THREE.Color(world.colors.groundDeep);
    
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = terrainHeight(world.terrain, x, z);
      pos.setY(i, y);
      
      // Height-based blending: valleys are deeper, hills are lighter
      const factor = THREE.MathUtils.clamp((y + 16) / 48, 0, 1);
      const vertexColor = blendColor.clone().lerp(baseColor, 0.25 + factor * 0.75);
      
      // Add organic sand/grass color variety
      const noiseVal = organicColorNoise(x, z) * 0.065;
      vertexColor.r = THREE.MathUtils.clamp(vertexColor.r + noiseVal, 0, 1);
      vertexColor.g = THREE.MathUtils.clamp(vertexColor.g + noiseVal, 0, 1);
      vertexColor.b = THREE.MathUtils.clamp(vertexColor.b + noiseVal, 0, 1);
      
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [world]);

  // Water Geometry & Mesh
  const waterGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 80, 80);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const foamMeshRef = useRef<THREE.Mesh>(null);

  const waterNoiseTex = useMemo(() => makeWaterNoiseTexture(), []);
  const foamTex = useMemo(() => makeFoamTexture(), []);

  // Scatter small rocks/pebbles for ground detail
  const rockCount: number = 160;
  const rockData = useMemo(() => {
    const rand = mulberry32(777);
    const arr = [];
    for (let i = 0; i < rockCount; i++) {
      const a = rand() * Math.PI * 2;
      const rad = 22 + rand() * 230;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const y = terrainHeight(world.terrain, x, z);
      
      arr.push({
        x,
        y: y - 0.08, // sink slightly into ground
        z,
        scaleX: 0.35 + rand() * 1.1,
        scaleY: 0.25 + rand() * 0.8,
        scaleZ: 0.35 + rand() * 1.1,
        rotX: rand() * Math.PI,
        rotY: rand() * Math.PI,
        rotZ: rand() * Math.PI,
      });
    }
    return arr;
  }, [world.terrain, rockCount]);

  const rockMeshRef = useRef<THREE.InstancedMesh>(null);
  const columnDebrisMeshRef = useRef<THREE.InstancedMesh>(null);
  const slabDebrisMeshRef = useRef<THREE.InstancedMesh>(null);
  const tempObject = useMemo(() => new THREE.Object3D(), []);

  // Scatter ancient ruin column fragments
  const columnDebrisCount: number = 25;
  const columnDebrisData = useMemo(() => {
    const rand = mulberry32(111);
    const arr = [];
    for (let i = 0; i < columnDebrisCount; i++) {
      const a = rand() * Math.PI * 2;
      const rad = 30 + rand() * 260;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const y = terrainHeight(world.terrain, x, z);
      arr.push({
        x,
        y: y - 0.16,
        z,
        scale: 0.6 + rand() * 0.7,
        rotX: (rand() - 0.5) * 0.9 + Math.PI / 2, // lay down on side
        rotY: rand() * Math.PI,
        rotZ: (rand() - 0.5) * 0.9,
      });
    }
    return arr;
  }, [world.terrain, columnDebrisCount]);

  // Scatter ancient ruin slab blocks
  const slabDebrisCount: number = 25;
  const slabDebrisData = useMemo(() => {
    const rand = mulberry32(222);
    const arr = [];
    for (let i = 0; i < slabDebrisCount; i++) {
      const a = rand() * Math.PI * 2;
      const rad = 30 + rand() * 260;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const y = terrainHeight(world.terrain, x, z);
      arr.push({
        x,
        y: y - 0.14,
        z,
        scaleX: 0.7 + rand() * 1.0,
        scaleY: 0.4 + rand() * 0.7,
        scaleZ: 0.7 + rand() * 1.0,
        rotX: (rand() - 0.5) * 0.6,
        rotY: rand() * Math.PI,
        rotZ: (rand() - 0.5) * 0.6,
      });
    }
    return arr;
  }, [world.terrain, slabDebrisCount]);

  // Generate savanna acacia tree data
  const treeCount = 100;
  const treeData = useMemo(() => {
    const rand = mulberry32(8888);
    const arr = [];
    for (let i = 0; i < treeCount; i++) {
      const a = rand() * Math.PI * 2;
      const rad = 25 + rand() * 250;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      const y = terrainHeight(world.terrain, x, z);
      
      // Grow trees on dry land (above water level of -1.2)
      if (y > -0.6) {
        arr.push({
          x,
          y: y - 0.05,
          z,
          scale: 0.75 + rand() * 0.6,
          rotY: rand() * Math.PI * 2,
        });
      }
    }
    return arr;
  }, [world.terrain, treeCount]);

  const trunkMeshRef = useRef<THREE.InstancedMesh>(null);
  const canopyMeshRef = useRef<THREE.InstancedMesh>(null);

  const trunkGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.07, 0.16, 2.5, 8);
    g.translate(0, 1.25, 0); // pivot at base
    return g;
  }, []);

  const canopyGeo = useMemo(() => {
    const g = new THREE.DodecahedronGeometry(1.3, 1);
    g.scale(1.3, 0.68, 1.3); // acacia-like flattened canopy
    g.translate(0, 2.4, 0);
    return g;
  }, []);

  useEffect(() => {
    if (!rockMeshRef.current || rockCount === 0) return;
    for (let i = 0; i < rockCount; i++) {
      const data = rockData[i];
      if (!data) continue;
      tempObject.position.set(data.x, data.y, data.z);
      tempObject.rotation.set(data.rotX, data.rotY, data.rotZ);
      tempObject.scale.set(data.scaleX, data.scaleY, data.scaleZ);
      tempObject.updateMatrix();
      rockMeshRef.current.setMatrixAt(i, tempObject.matrix);
    }
    rockMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [rockData, rockCount, tempObject]);

  useEffect(() => {
    if (!columnDebrisMeshRef.current || columnDebrisCount === 0) return;
    for (let i = 0; i < columnDebrisCount; i++) {
      const data = columnDebrisData[i];
      if (!data) continue;
      tempObject.position.set(data.x, data.y, data.z);
      tempObject.rotation.set(data.rotX, data.rotY, data.rotZ);
      tempObject.scale.setScalar(data.scale);
      tempObject.updateMatrix();
      columnDebrisMeshRef.current.setMatrixAt(i, tempObject.matrix);
    }
    columnDebrisMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [columnDebrisData, columnDebrisCount, tempObject]);

  useEffect(() => {
    if (!slabDebrisMeshRef.current || slabDebrisCount === 0) return;
    for (let i = 0; i < slabDebrisCount; i++) {
      const data = slabDebrisData[i];
      if (!data) continue;
      tempObject.position.set(data.x, data.y, data.z);
      tempObject.rotation.set(data.rotX, data.rotY, data.rotZ);
      tempObject.scale.set(data.scaleX, data.scaleY, data.scaleZ);
      tempObject.updateMatrix();
      slabDebrisMeshRef.current.setMatrixAt(i, tempObject.matrix);
    }
    slabDebrisMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [slabDebrisData, slabDebrisCount, tempObject]);

  useEffect(() => {
    if (!trunkMeshRef.current || !canopyMeshRef.current || treeData.length === 0) return;
    for (let i = 0; i < treeData.length; i++) {
      const data = treeData[i];
      if (!data) continue;
      tempObject.position.set(data.x, data.y, data.z);
      tempObject.rotation.set(0, data.rotY, 0);
      tempObject.scale.setScalar(data.scale);
      tempObject.updateMatrix();
      
      trunkMeshRef.current.setMatrixAt(i, tempObject.matrix);
      canopyMeshRef.current.setMatrixAt(i, tempObject.matrix);
    }
    trunkMeshRef.current.instanceMatrix.needsUpdate = true;
    canopyMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [treeData, tempObject]);

  const rockColor = useMemo(() => {
    return new THREE.Color(world.colors.structure).lerp(new THREE.Color(world.colors.ground), 0.28);
  }, [world]);

  useFrame(() => {
    if (!waterMeshRef.current) return;
    const t = audioLevels.time;
    const g = waterMeshRef.current.geometry as THREE.PlaneGeometry;
    const pos = g.attributes.position as THREE.BufferAttribute;
    // bass stem → water wave amplitude (deeper bass = bigger waves)
    const amp = 0.4 + audioLevels.level * 0.35 + stemLevels.bass * 0.5;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      
      // Multi-frequency realistic waves superposition
      const wave1 = Math.sin(x * 0.035 + t * 0.8) * 0.24;
      const wave2 = Math.cos(z * 0.042 + t * 0.7) * 0.22;
      const wave3 = Math.sin((x + z) * 0.025 - t * 1.1) * 0.16;
      const wave4 = Math.sin((x - z) * 0.06 + t * 1.5) * 0.08 * amp;
      const wave = wave1 + wave2 + wave3 + wave4;
      
      const distToLake = Math.hypot(x - 90, z - (-80));
      const rippleAmp = 0.18 * Math.max(0, 1 - distToLake / 150) * (0.5 + audioLevels.level * 0.5);
      const ripple = Math.sin(distToLake * 0.35 - t * 3.5) * rippleAmp;

      const distToSplash = Math.hypot(x - 90, z - (-199));
      const splashAmp = 0.12 * Math.max(0, 1 - distToSplash / 60) * (0.6 + audioLevels.level * 0.4);
      const splashRipple = Math.sin(distToSplash * 0.52 - t * 4.6) * splashAmp;
      
      pos.setY(i, -1.2 + wave + ripple + splashRipple);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();

    // Scroll water bump map and foam texture offsets
    if (waterNoiseTex) {
      waterNoiseTex.offset.x = t * 0.012;
      waterNoiseTex.offset.y = t * 0.015;
    }
    if (foamTex) {
      foamTex.offset.x = -t * 0.008;
      foamTex.offset.y = t * 0.011;
    }
  });

  return (
    <group>
      {/* Terrain Surface */}
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial
          vertexColors
          roughness={1.0}
          metalness={0.0}
          bumpMap={groundTex}
          bumpScale={0.06}
          roughnessMap={groundTex}
        />
      </mesh>

      {/* Water Plane in the Valley */}
      <mesh ref={waterMeshRef} geometry={waterGeo} receiveShadow>
        <meshStandardMaterial
          color="#4fb9cc"
          roughness={0.08}
          metalness={0.85}
          transparent={true}
          opacity={0.78}
          emissive="#10404a"
          emissiveIntensity={0.45}
          bumpMap={waterNoiseTex}
          bumpScale={0.045}
        />
      </mesh>

      {/* Foam Overlay Plane */}
      <mesh ref={foamMeshRef} geometry={waterGeo} position={[0, 0.015, 0]}>
        <meshStandardMaterial
          map={foamTex}
          transparent={true}
          opacity={0.48}
          blending={THREE.NormalBlending}
          depthWrite={false}
          color="#ffffff"
          roughness={0.9}
        />
      </mesh>
      
      {/* Scattered Pebbles & Rocks */}
      {rockCount > 0 && (
        <instancedMesh ref={rockMeshRef} args={[null as any, null as any, rockCount]} castShadow receiveShadow>
          <icosahedronGeometry args={[0.34, 2]} />
          <meshStandardMaterial
            color={rockColor}
            roughness={0.9}
            metalness={0.04}
          />
        </instancedMesh>
      )}

      {/* Scattered Columns Fragments */}
      {columnDebrisCount > 0 && (
        <instancedMesh ref={columnDebrisMeshRef} args={[null as any, null as any, columnDebrisCount]} castShadow receiveShadow>
          <cylinderGeometry args={[0.7, 0.7, 1.8, 16]} />
          <meshStandardMaterial
            color={world.colors.structure}
            roughness={0.85}
            metalness={0.05}
          />
        </instancedMesh>
      )}

      {/* Scattered Slab Blocks */}
      {slabDebrisCount > 0 && (
        <instancedMesh ref={slabDebrisMeshRef} args={[null as any, null as any, slabDebrisCount]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.4, 2.0]} />
          <meshStandardMaterial
            color={world.colors.structure}
            roughness={0.85}
            metalness={0.05}
          />
        </instancedMesh>
      )}

      {/* Scattered Trunks */}
      {treeData.length > 0 && (
        <instancedMesh ref={trunkMeshRef} args={[trunkGeo, null as any, treeData.length]} castShadow receiveShadow>
          <meshStandardMaterial
            color={world.colors.structure}
            roughness={0.9}
            metalness={0.02}
          />
        </instancedMesh>
      )}

      {/* Scattered Canopies */}
      {treeData.length > 0 && (
        <instancedMesh ref={canopyMeshRef} args={[canopyGeo, null as any, treeData.length]} castShadow receiveShadow>
          <meshStandardMaterial
            color={world.colors.ground}
            roughness={0.85}
            metalness={0.02}
          />
        </instancedMesh>
      )}
    </group>
  );
}
