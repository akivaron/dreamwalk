import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { audioLevels } from "../audio/audioStore";
import { makeGroundNoiseTexture, makeSoftTexture } from "./textures";
import type { World } from "../types";

export function Waterfall({ world }: { world: World }) {
  const outerMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const innerMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  const groundTex = useMemo(() => makeGroundNoiseTexture(), []);
  
  // Outer water column geometry: plane tilted forward
  const outerGeo = useMemo(() => {
    // Top of cliff: z = -208, y = 18.0
    // Bottom: z = -199, y = -1.2
    // Midpoint: z = -203.5, y = 8.15
    // Height of plane: Math.hypot(18.0 - (-1.2), -208 - (-199)) = Math.hypot(19.2, 9) = 21.2
    const g = new THREE.PlaneGeometry(16, 21.2, 16, 16);
    return g;
  }, []);
  
  // Inner water column geometry (slightly narrower and deeper)
  const innerGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(12, 21.0, 12, 12);
    return g;
  }, []);

  // Particle cloud for splashing mist at the base
  const PARTICLE_COUNT = 150;
  const particleTex = useMemo(() => makeSoftTexture(), []);
  
  const { particleGeo, particleData } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const data = [];
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Initialize particles at the splash point
      positions[i * 3] = 90 + (Math.random() - 0.5) * 12;
      positions[i * 3 + 1] = -1.2;
      positions[i * 3 + 2] = -199 + (Math.random() - 0.5) * 8;
      
      data.push({
        x: 90,
        y: -1.2,
        z: -199,
        vx: (Math.random() - 0.5) * 6,
        vy: 2.0 + Math.random() * 8, // shoots up
        vz: (Math.random() - 0.5) * 6 + 2, // shoots slightly forward (positive Z)
        life: Math.random(),
        maxLife: 0.6 + Math.random() * 0.8,
      });
    }
    
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return { particleGeo: geo, particleData: data };
  }, []);

  const particlePointsRef = useRef<THREE.Points>(null);
  const particleMatRef = useRef<THREE.PointsMaterial>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = audioLevels.time;
    const vol = audioLevels.level;
    
    // 1. Animate water textures scrolling downwards
    if (outerMaterialRef.current && outerMaterialRef.current.map) {
      outerMaterialRef.current.map.offset.y = -t * 1.6;
      outerMaterialRef.current.bumpMap!.offset.y = -t * 1.6;
    }
    if (innerMaterialRef.current && innerMaterialRef.current.map) {
      innerMaterialRef.current.map.offset.y = -t * 2.8;
      innerMaterialRef.current.bumpMap!.offset.y = -t * 2.8;
    }

    // 2. Splash particle physics
    const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const gravity = 9.8;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = particleData[i];
      p.life += dt;
      
      if (p.life >= p.maxLife) {
        // Reset particle at base of waterfall
        p.life = 0;
        p.maxLife = 0.5 + Math.random() * 0.7;
        p.x = 90 + (Math.random() - 0.5) * 14 * (0.8 + vol * 0.4);
        p.y = -1.2;
        p.z = -199 + (Math.random() - 0.5) * 6;
        
        const speedMultiplier = 1.0 + vol * 1.2;
        p.vx = (Math.random() - 0.5) * 5 * speedMultiplier;
        p.vy = (3.0 + Math.random() * 9) * speedMultiplier;
        p.vz = ((Math.random() - 0.5) * 4 + 4) * speedMultiplier;
      } else {
        // Update physics
        p.vy -= gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
      
      posArr[i * 3] = p.x;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = p.z;
    }
    posAttr.needsUpdate = true;

    // Pulse particle size based on music volume
    if (particleMatRef.current) {
      particleMatRef.current.size = 2.4 * (0.7 + vol * 1.2);
    }
  });

  return (
    <group>
      {/* Outer Volumetric Water Plane */}
      <mesh
        geometry={outerGeo}
        position={[90, 8.15, -203.5]}
        rotation={[-0.435, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          ref={outerMaterialRef}
          color="#a1ebfa"
          roughness={0.08}
          metalness={0.85}
          transparent={true}
          opacity={0.68}
          emissive="#1a5c6b"
          emissiveIntensity={0.7}
          bumpMap={groundTex}
          bumpScale={0.06}
          map={groundTex}
        />
      </mesh>

      {/* Inner Turbulent Water Plane */}
      <mesh
        geometry={innerGeo}
        position={[90, 8.25, -203.7]}
        rotation={[-0.435, 0, 0]}
      >
        <meshStandardMaterial
          ref={innerMaterialRef}
          color="#d2f7fe"
          roughness={0.04}
          metalness={0.9}
          transparent={true}
          opacity={0.82}
          emissive="#2b8c9e"
          emissiveIntensity={0.85}
          bumpMap={groundTex}
          bumpScale={0.08}
          map={groundTex}
        />
      </mesh>

      {/* Waterfall Splashing Mist Particle Cloud */}
      <points ref={particlePointsRef} geometry={particleGeo}>
        <pointsMaterial
          ref={particleMatRef}
          map={particleTex}
          size={2.5}
          sizeAttenuation
          color="#d9f7ff"
          transparent
          depthWrite={false}
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
