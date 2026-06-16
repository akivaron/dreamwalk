import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { audioLevels } from "../audio/audioStore";

interface BirdData {
  id: number;
  radius: number;
  height: number;
  speed: number;
  phase: number;
  flapSpeed: number;
  scale: number;
}

export function Birds() {
  const count = 12;
  
  const birds = useMemo(() => {
    const arr: BirdData[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        id: i,
        radius: 65 + (i % 3) * 6 + Math.random() * 4,
        height: 24 + (i % 4) * 4 + Math.random() * 2,
        speed: 0.15 + (i % 2) * 0.05 + Math.random() * 0.03,
        phase: (i * Math.PI * 2) / count + Math.random() * 0.3,
        flapSpeed: 9 + (i % 3) * 2 + Math.random() * 1.5,
        scale: 0.7 + Math.random() * 0.5,
      });
    }
    return arr;
  }, []);

  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const wingLRefs = useRef<(THREE.Mesh | null)[]>([]);
  const wingRRefs = useRef<(THREE.Mesh | null)[]>([]);

  // Shift wing planes so their pivot sits exactly on the body edge
  const leftWingGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.32, 0.14);
    g.translate(-0.16, 0, 0);
    return g;
  }, []);

  const rightWingGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.32, 0.14);
    g.translate(0.16, 0, 0);
    return g;
  }, []);

  useFrame(() => {
    const t = audioLevels.time;
    const musicBeat = 1.0 + audioLevels.intensity * 0.8;
    
    birds.forEach((bird, idx) => {
      const group = groupRefs.current[idx];
      const wingL = wingLRefs.current[idx];
      const wingR = wingRRefs.current[idx];
      
      if (!group) return;
      
      // Calculate circular position
      const angle = t * bird.speed + bird.phase;
      const x = Math.cos(angle) * bird.radius;
      const z = Math.sin(angle) * bird.radius;
      
      // Gentle height bobbing
      const y = bird.height + Math.sin(t * 1.2 + bird.id) * 1.5;
      
      group.position.set(x, y, z);
      
      // Face forward along the circular tangent: tangent is angle + PI/2
      const tangentAngle = angle + Math.PI / 2;
      group.rotation.set(0, -tangentAngle, 0.18 * Math.sin(t * 1.2 + bird.id)); // roll when banking
      
      // Wing flap rotation loop
      const flap = Math.sin(t * bird.flapSpeed * musicBeat) * 0.65;
      if (wingL) wingL.rotation.z = flap;
      if (wingR) wingR.rotation.z = -flap;
    });
  });

  return (
    <group>
      {birds.map((b, i) => (
        <group
          key={b.id}
          ref={(el) => {
            groupRefs.current[i] = el;
          }}
          scale={b.scale}
        >
          {/* Bird Body */}
          <mesh castShadow>
            <boxGeometry args={[0.06, 0.06, 0.44]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={0.8}
              roughness={0.2}
            />
          </mesh>
          
          {/* Left Wing */}
          <mesh
            ref={(el) => {
              wingLRefs.current[i] = el;
            }}
            geometry={leftWingGeo}
            position={[-0.03, 0, 0]}
            castShadow
          >
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Right Wing */}
          <mesh
            ref={(el) => {
              wingRRefs.current[i] = el;
            }}
            geometry={rightWingGeo}
            position={[0.03, 0, 0]}
            castShadow
          >
            <meshStandardMaterial
              color="#ffffff"
              emissive="#ffffff"
              emissiveIntensity={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
