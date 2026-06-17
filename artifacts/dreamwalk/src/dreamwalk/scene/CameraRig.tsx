import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { audioLevels, dreamEvents, stemLevels } from "../audio/audioStore";
import { wishStore } from "../wishes/wishStore";
import { terrainHeight } from "./terrainField";
import type { World } from "../types";
import { mulberry32 } from "../rng";
import { Butterflies } from "./Butterflies";
import { joystickInput } from "./joystickStore";

const WATER_LEVEL = -1.2;

function createRobeGeometry() {
  const geom = new THREE.ConeGeometry(0.42, 1.3, 24, 8);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    
    if (py === 1.3 / 2) continue;
    
    const yRatio = (1.3 / 2 - py) / 1.3;
    const angle = Math.atan2(pz, px);
    
    // 5 soft vertical drapery ripples/folds
    const fold = Math.sin(angle * 5) * 0.04 * yRatio;
    
    const dist = Math.hypot(px, pz);
    if (dist > 0.01) {
      const scale = 1 + fold / dist;
      pos.setX(i, px * scale);
      pos.setZ(i, pz * scale);
    }
  }
  geom.computeVertexNormals();
  return geom;
}

function createHoodTipGeometry() {
  const geom = new THREE.ConeGeometry(0.11, 0.44, 18, 6);
  geom.rotateX(-Math.PI / 2); // orient along tip axis to curve
  const pos = geom.attributes.position as THREE.BufferAttribute;
  
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    
    const zRatio = (pz + 0.22) / 0.44;
    const droop = -Math.pow(zRatio, 2) * 0.08;
    
    pos.setY(i, py + droop);
  }
  geom.rotateX(Math.PI / 2); // restore vertical orientation
  geom.computeVertexNormals();
  return geom;
}

export function CameraRig({ world }: { world: World }) {
  const { camera, gl } = useThree();

  const colliders = useMemo(() => {
    const list: Array<{ x: number; z: number; radius: number }> = [];

    // 1. Ancient ruins from Structures.tsx (seed 2024)
    {
      const rand = mulberry32(2024);
      const n = 40;
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const rad = 64 + rand() * 320;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        const s = 0.8 + rand() * 1.9;
        const h = 18 + rand() * 26;
        const type = Math.floor(rand() * 4);
        
        const rot = rand() * Math.PI;
        const tilt = (rand() - 0.5) * 0.14;
        
        if (type === 0) {
          list.push({ x, z, radius: 2.2 * s });
        } else if (type === 1) {
          const w = 9 * s;
          const localOffset = w / 2;
          const euler = new THREE.Euler(tilt, rot, tilt * 0.6, 'XYZ');
          const vL = new THREE.Vector3(-localOffset, 0, 0).applyEuler(euler);
          const vR = new THREE.Vector3(localOffset, 0, 0).applyEuler(euler);
          list.push({ x: x + vL.x, z: z + vL.z, radius: 1.6 * s });
          list.push({ x: x + vR.x, z: z + vR.z, radius: 1.6 * s });
        } else if (type === 2) {
          list.push({ x, z, radius: 3.2 * s });
        } else {
          list.push({ x, z, radius: 4.2 * s });
        }
      }
    }

    // 2. Acacia trees from Terrain.tsx (seed 8888)
    {
      const rand = mulberry32(8888);
      const treeCount = 100;
      for (let i = 0; i < treeCount; i++) {
        const a = rand() * Math.PI * 2;
        const rad = 25 + rand() * 250;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        const y = terrainHeight(world.terrain, x, z);
        if (y > -0.6) {
          const scale = 0.75 + rand() * 0.6;
          rand(); // rotY
          list.push({ x, z, radius: 0.32 * scale });
        }
      }
    }

    // 3. Column debris from Terrain.tsx (seed 111)
    {
      const rand = mulberry32(111);
      const columnDebrisCount = 25;
      for (let i = 0; i < columnDebrisCount; i++) {
        const a = rand() * Math.PI * 2;
        const rad = 30 + rand() * 260;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        const y = terrainHeight(world.terrain, x, z);
        const scale = 0.6 + rand() * 0.7;
        rand(); // rotX
        rand(); // rotY
        rand(); // rotZ
        list.push({ x, z, radius: 0.8 * scale });
      }
    }

    // 4. Slab debris from Terrain.tsx (seed 222)
    {
      const rand = mulberry32(222);
      const slabDebrisCount = 25;
      for (let i = 0; i < slabDebrisCount; i++) {
        const a = rand() * Math.PI * 2;
        const rad = 30 + rand() * 260;
        const x = Math.cos(a) * rad;
        const z = Math.sin(a) * rad;
        const y = terrainHeight(world.terrain, x, z);
        const scaleX = 0.7 + rand() * 1.0;
        rand(); // scaleY
        const scaleZ = 0.7 + rand() * 1.0;
        rand(); // rotX
        rand(); // rotY
        rand(); // rotZ
        list.push({ x, z, radius: 0.9 * Math.max(scaleX, scaleZ) });
      }
    }

    return list;
  }, [world]);
  const yaw = useRef(0);
  const pitch = useRef(-0.03);
  const wishTiltRef = useRef(0);
  const keys = useRef<Record<string, boolean>>({});
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const pos = useRef(new THREE.Vector3(0, 3.2, 14));
  const currentGround = useRef(0);
  const hasInitializedGround = useRef(false);

  // Jump physics variables
  const jumpVelocity = useRef(0);
  const jumpY = useRef(0);
  const isOnGround = useRef(true);

  // Memoized draped geometries
  const robeRef = useRef<THREE.Mesh>(null);
  const robeBaseArray = useMemo(() => {
    const geom = createRobeGeometry();
    const posAttr = geom.attributes.position as THREE.BufferAttribute;
    const colors = [];
    const fabricColor = new THREE.Color(world.colors.banner);
    const goldColor = new THREE.Color(world.colors.structureGlow);
    
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      
      const ratio = (0.65 - y) / 1.3; // 0 at the top, 1 at the bottom
      
      // Bottom hem trim (ratio > 0.92) or spine vertical stripe (Z negative, centered in X)
      const isBottomTrim = ratio > 0.92;
      const isSpineRune = ratio > 0.15 && ratio < 0.85 && z < -0.15 && Math.abs(x) < 0.045;
      
      const isGold = isBottomTrim || isSpineRune;
      const vertexColor = isGold ? goldColor.clone() : fabricColor.clone();
      
      // Top-to-bottom soft gradient shading for fabric depth
      if (!isGold) {
        vertexColor.multiplyScalar(0.72 + (1 - ratio) * 0.28);
      }
      
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }
    
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    
    const arr = posAttr.array.slice() as Float32Array;
    return { geom, arr };
  }, [world]);
  const hoodTipGeom = useMemo(() => createHoodTipGeometry(), []);
  
  const capeRef = useRef<THREE.Mesh>(null);
  const capeGeom = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.52, 1.35, 8, 12);
    g.translate(0, -0.675, 0); // pivot at the top of the cape
    
    const posAttr = g.attributes.position as THREE.BufferAttribute;
    const colors = [];
    const fabricColor = new THREE.Color(world.colors.banner);
    const goldColor = new THREE.Color(world.colors.structureGlow);
    
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const ratio = -y / 1.35; // 0 at the top, 1 at the bottom
      
      // Gold trim at the bottom (ratio > 0.86) and spine vertical stripe (Math.abs(x) < 0.045)
      const isGoldTrim = ratio > 0.86 || (ratio > 0.16 && Math.abs(x) < 0.045);
      const vertexColor = isGoldTrim ? goldColor.clone() : fabricColor.clone();
      
      // Top-to-bottom soft gradient shading for fabric depth
      if (!isGoldTrim) {
        vertexColor.multiplyScalar(0.72 + ratio * 0.28);
      }
      
      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }
    
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [world]);

  // Traveler references
  const travelerRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);
  const legCalfLRef = useRef<THREE.Group>(null);
  const legCalfRRef = useRef<THREE.Group>(null);
  const sleeveLRef = useRef<THREE.Group>(null);
  const sleeveRRef = useRef<THREE.Group>(null);
  const armForeLRef = useRef<THREE.Group>(null);
  const armForeRRef = useRef<THREE.Group>(null);
  const eyeLRef = useRef<THREE.Mesh>(null);
  const eyeRRef = useRef<THREE.Mesh>(null);
  const sparkRefs = useRef<THREE.Mesh[]>([]);
  
  // Start facing away from camera (Math.PI)
  const travelerRotationY = useRef(Math.PI);

  useEffect(() => {
    const dom = gl.domElement;
    dom.style.cursor = "grab";
    
    const onDown = (e: PointerEvent) => {
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      dom.style.cursor = "grabbing";
    };
    const onUp = () => {
      dragging.current = false;
      dom.style.cursor = "grab";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      yaw.current -= dx * 0.0024;
      pitch.current = THREE.MathUtils.clamp(pitch.current - dy * 0.0018, -0.5, 0.38);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      
      // Trigger jump instantly on Space Down
      if (e.code === "Space" && isOnGround.current) {
        jumpVelocity.current = 9.0;
        isOnGround.current = false;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    
    dom.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gl]);

  const forward = useRef(new THREE.Vector3());
  const rightV = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3(0, 1, 0));
  const move = useRef(new THREE.Vector3());
  const targetQuat = useRef(new THREE.Quaternion());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = keys.current;
    
    // Check if running (holding Shift)
    const isMoving = move.current.lengthSq() > 0;
    const isRunning = isMoving && (k["ShiftLeft"] || k["ShiftRight"] || k["Shift"]);
    
    // Movement vectors aligned to view direction
    forward.current.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    rightV.current.crossVectors(forward.current, up.current).normalize();
    
    const baseSpeed = isRunning ? 10.0 : 5.0;
    const speed = baseSpeed * (1 + audioLevels.intensity * 0.35);
    
    move.current.set(0, 0, 0);
    if (k["KeyW"] || k["ArrowUp"]) move.current.add(forward.current);
    if (k["KeyS"] || k["ArrowDown"]) move.current.sub(forward.current);
    if (k["KeyA"] || k["ArrowLeft"]) move.current.sub(rightV.current);
    if (k["KeyD"] || k["ArrowRight"]) move.current.add(rightV.current);

    // Mobile virtual joystick input
    if (joystickInput.active) {
      const jx = joystickInput.dx;
      const jy = joystickInput.dy;
      move.current.add(forward.current.clone().multiplyScalar(-jy));
      move.current.add(rightV.current.clone().multiplyScalar(jx));
    }
    
    if (move.current.lengthSq() > 0) {
      move.current.normalize().multiplyScalar(speed * dt);
      
      let resolvedX = pos.current.x + move.current.x;
      let resolvedZ = pos.current.z + move.current.z;
      
      const playerRadius = 0.45;
      
      // Perform 2 iterations of collision resolution to handle corners/edges
      for (let iter = 0; iter < 2; iter++) {
        for (const col of colliders) {
          const dx = resolvedX - col.x;
          const dz = resolvedZ - col.z;
          const dist = Math.hypot(dx, dz);
          const minDist = col.radius + playerRadius;
          
          if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dist > 0.001 ? dx / dist : 1;
            const nz = dist > 0.001 ? dz / dist : 0;
            resolvedX += nx * overlap;
            resolvedZ += nz * overlap;
          }
        }
      }
      
      pos.current.x = resolvedX;
      pos.current.z = resolvedZ;
    }

    const maxR = 400;
    const r = Math.hypot(pos.current.x, pos.current.z);
    if (r > maxR) {
      pos.current.x *= maxR / r;
      pos.current.z *= maxR / r;
    }

    // Gravity and jump physics simulation
    if (!isOnGround.current) {
      jumpVelocity.current -= 21.0 * dt; // gravity deceleration
      jumpY.current += jumpVelocity.current * dt;
      if (jumpY.current <= 0) {
        jumpY.current = 0;
        jumpVelocity.current = 0;
        isOnGround.current = true;
      }
    }

    // Align with terrain height smoothly (acts as a shock absorber)
    const t = audioLevels.time;
    let landHeight = terrainHeight(world.terrain, pos.current.x, pos.current.z);
    let targetGround = landHeight;
    if (landHeight < WATER_LEVEL) {
      const amp = 0.4 + audioLevels.level * 0.6;
      
      const wave1 = Math.sin(pos.current.x * 0.035 + t * 0.8) * 0.24;
      const wave2 = Math.cos(pos.current.z * 0.042 + t * 0.7) * 0.22;
      const wave3 = Math.sin((pos.current.x + pos.current.z) * 0.025 - t * 1.1) * 0.16;
      const wave4 = Math.sin((pos.current.x - pos.current.z) * 0.06 + t * 1.5) * 0.08 * amp;
      const wave = wave1 + wave2 + wave3 + wave4;
      
      const distToLake = Math.hypot(pos.current.x - 90, pos.current.z - (-80));
      const rippleAmp = 0.18 * Math.max(0, 1 - distToLake / 150) * (0.5 + audioLevels.level * 0.5);
      const ripple = Math.sin(distToLake * 0.35 - t * 3.5) * rippleAmp;

      const distToSplash = Math.hypot(pos.current.x - 90, pos.current.z - (-199));
      const splashAmp = 0.12 * Math.max(0, 1 - distToSplash / 60) * (0.6 + audioLevels.level * 0.4);
      const splashRipple = Math.sin(distToSplash * 0.52 - t * 4.6) * splashAmp;
      
      targetGround = WATER_LEVEL + wave + ripple + splashRipple;
    }

    if (!hasInitializedGround.current) {
      currentGround.current = targetGround;
      hasInitializedGround.current = true;
    } else {
      currentGround.current = THREE.MathUtils.lerp(
        currentGround.current,
        targetGround,
        1 - Math.pow(0.01, dt),
      );
      // Prevent clipping: the traveler ground height must never sink below the physical terrain surface (plus a buffer to prevent feet sinking into low-poly meshes)
      const minimumHeight = targetGround + 0.03;
      if (currentGround.current < minimumHeight) {
        currentGround.current = minimumHeight;
      }
    }
    const speedFactor = isRunning ? 1.6 : isMoving ? 1.0 : 0.0;
    const runTimeScale = isRunning ? t * 22 : t * 15;

    // Body bobbing when walking (double the frequency of the stride so it bobs twice per full step cycle)
    const bob = isMoving ? (Math.cos(runTimeScale * 2) - 1.0) * (isRunning ? 0.045 : 0.025) : 0;

    // Lean forward when moving, leaning more when running
    const targetLeanX = isRunning ? 0.22 : isMoving ? 0.08 : 0;

    // 1. Update Traveler Position & Rotation
    if (travelerRef.current) {
      travelerRef.current.position.set(pos.current.x, currentGround.current + jumpY.current + bob, pos.current.z);
      
      // Smooth lean angle
      travelerRef.current.rotation.x = THREE.MathUtils.lerp(travelerRef.current.rotation.x, targetLeanX, 10 * dt);

      if (isMoving) {
        // Face the direction of movement (Math.atan2 Y-angle rotation)
        const angle = Math.atan2(move.current.x, move.current.z);
        let diff = angle - travelerRotationY.current;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        travelerRotationY.current += diff * 12 * dt;
        travelerRef.current.rotation.y = travelerRotationY.current;
      }
    }

    // Global and local wind vectors calculation
    const windSpeed = 2.4 + audioLevels.intensity * 2.0;
    const windForce = 0.14 + audioLevels.intensity * 0.38 + audioLevels.peak * 0.12;
    const windX = Math.sin(t * 0.8) * windForce;
    const windZ = Math.cos(t * 0.6) * windForce;

    // Movement drag velocity
    const playerVelX = dt > 0 ? move.current.x / dt : 0;
    const playerVelZ = dt > 0 ? move.current.z / dt : 0;

    // Combined global wind & movement drag forces
    const globalEffWindX = windX * 12 - playerVelX * 0.45;
    const globalEffWindZ = windZ * 12 - playerVelZ * 0.45;

    // Transform global effective wind into local space of the traveler
    const theta = travelerRotationY.current;
    const localWindX = globalEffWindX * Math.cos(theta) - globalEffWindZ * Math.sin(theta);
    const localWindZ = globalEffWindX * Math.sin(theta) + globalEffWindZ * Math.cos(theta);

    // Deform the back cape (Jubah) in the wind and movement drag
    if (capeRef.current) {
      const g = capeRef.current.geometry as THREE.PlaneGeometry;
      const posAttr = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const ratio = -y / 1.35; // 0 at the top, 1 at the bottom
        
        // Flutter wave
        const waveFreq = 16 + audioLevels.intensity * 8;
        const wave = Math.sin(t * waveFreq + y * 6) * (0.05 + audioLevels.level * 0.1);
        
        // Drape backward based on localWindZ, sway sideways based on localWindX
        const drapeZ = localWindZ * 0.06 * Math.pow(ratio, 1.5);
        const swayX = localWindX * 0.05 * Math.pow(ratio, 1.5);
        
        posAttr.setZ(i, drapeZ + wave * ratio);
        posAttr.setX(i, (x / 0.26) * 0.26 * (1 - ratio * 0.22) + swayX);
      }
      posAttr.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingSphere();
    }

    // Deform the main robe (baju) skirt in the wind and movement drag
    if (robeRef.current) {
      const g = robeRef.current.geometry;
      const posAttr = g.attributes.position as THREE.BufferAttribute;
      const base = robeBaseArray.arr;
      for (let i = 0; i < posAttr.count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        const bz = base[i * 3 + 2];
        const ratio = (0.65 - by) / 1.3; // original y goes from -0.65 to 0.65
        
        // Flutter wave ripples
        const waveFreq = 12 + audioLevels.intensity * 6;
        const waveX = Math.sin(t * waveFreq + by * 5) * (0.025 + audioLevels.level * 0.05) * ratio;
        const waveZ = Math.cos(t * (waveFreq - 1.5) + by * 5) * (0.025 + audioLevels.level * 0.05) * ratio;
        
        // Wind drag pushes the skirt back/sideways
        const windPushX = localWindX * 0.02 * Math.pow(ratio, 1.5);
        const windPushZ = localWindZ * 0.025 * Math.pow(ratio, 1.5);
        
        posAttr.setX(i, bx + waveX + windPushX);
        posAttr.setZ(i, bz + waveZ + windPushZ);
      }
      posAttr.needsUpdate = true;
      g.computeVertexNormals();
    }

    // 2. Swing legs based on walking/running/jumping state (articulated thigh & calf knee joints)
    if (legLRef.current && legRRef.current && legCalfLRef.current && legCalfRRef.current) {
      if (!isOnGround.current) {
        // Bend knees backward when going up, stretch down when falling
        const targetLegRot = jumpVelocity.current > 0 ? -0.36 : 0.26;
        legLRef.current.rotation.x = THREE.MathUtils.lerp(legLRef.current.rotation.x, targetLegRot, 12 * dt);
        legRRef.current.rotation.x = THREE.MathUtils.lerp(legRRef.current.rotation.x, targetLegRot, 12 * dt);
        
        const targetCalfRot = jumpVelocity.current > 0 ? -0.52 : -0.08;
        legCalfLRef.current.rotation.x = THREE.MathUtils.lerp(legCalfLRef.current.rotation.x, targetCalfRot, 12 * dt);
        legCalfRRef.current.rotation.x = THREE.MathUtils.lerp(legCalfRRef.current.rotation.x, targetCalfRot, 12 * dt);
      } else if (isMoving) {
        const swingRange = isRunning ? 0.65 : 0.45;
        const swing = Math.sin(runTimeScale) * swingRange;
        
        // Thigh swings
        legLRef.current.rotation.x = swing;
        legRRef.current.rotation.x = -swing;
        
        // Knees bend backward when swinging forward (swing > 0) to clear the ground, and stay straight on pushback
        const kneeBendL = swing > 0 ? -swing * 0.75 : 0;
        const kneeBendR = -swing > 0 ? -(-swing) * 0.75 : 0;
        
        legCalfLRef.current.rotation.x = kneeBendL;
        legCalfRRef.current.rotation.x = kneeBendR;
      } else {
        // Return to relaxed straight position
        legLRef.current.rotation.x = THREE.MathUtils.lerp(legLRef.current.rotation.x, 0, 8 * dt);
        legRRef.current.rotation.x = THREE.MathUtils.lerp(legRRef.current.rotation.x, 0, 8 * dt);
        legCalfLRef.current.rotation.x = THREE.MathUtils.lerp(legCalfLRef.current.rotation.x, 0, 8 * dt);
        legCalfRRef.current.rotation.x = THREE.MathUtils.lerp(legCalfRRef.current.rotation.x, 0, 8 * dt);
      }
    }

    // 2b. Swing jointed sleeves & forearms (react to walking, running, jumping, and wind)
    if (sleeveLRef.current && sleeveRRef.current && armForeLRef.current && armForeRRef.current) {
      if (!isOnGround.current) {
        // Raise arms upward/outward slightly when falling or jumping
        const targetArmRotX = -0.58;
        const targetArmRotZ = 0.38;
        
        sleeveLRef.current.rotation.x = THREE.MathUtils.lerp(sleeveLRef.current.rotation.x, targetArmRotX, 10 * dt);
        sleeveRRef.current.rotation.x = THREE.MathUtils.lerp(sleeveRRef.current.rotation.x, targetArmRotX, 10 * dt);
        sleeveLRef.current.rotation.z = THREE.MathUtils.lerp(sleeveLRef.current.rotation.z, -targetArmRotZ - 0.15, 10 * dt);
        sleeveRRef.current.rotation.z = THREE.MathUtils.lerp(sleeveRRef.current.rotation.z, targetArmRotZ + 0.15, 10 * dt);
        
        // Elbow bends (forearm rotates forward)
        armForeLRef.current.rotation.x = THREE.MathUtils.lerp(armForeLRef.current.rotation.x, 0.45, 10 * dt);
        armForeRRef.current.rotation.x = THREE.MathUtils.lerp(armForeRRef.current.rotation.x, 0.45, 10 * dt);
      } else if (isMoving) {
        const swingRange = isRunning ? 0.48 : 0.28;
        const swing = Math.sin(runTimeScale) * swingRange;
        
        // Upper arm swings (opposite to legs)
        // Add subtle wind offsets (Z blows backward, X blows sideways)
        sleeveLRef.current.rotation.x = -swing + localWindZ * 0.02;
        sleeveRRef.current.rotation.x = swing + localWindZ * 0.02;
        
        sleeveLRef.current.rotation.z = Math.abs(swing) * 0.15 - 0.15 + localWindX * 0.02;
        sleeveRRef.current.rotation.z = -Math.abs(swing) * 0.15 + 0.15 + localWindX * 0.02;
        
        // Elbows bend dynamically with swing phase and wind
        const elbowL = Math.max(0.1, -swing * 0.6) + 0.12 - localWindZ * 0.03;
        const elbowR = Math.max(0.1, swing * 0.6) + 0.12 - localWindZ * 0.03;
        
        armForeLRef.current.rotation.x = elbowL;
        armForeRRef.current.rotation.x = elbowR;
        armForeLRef.current.rotation.y = localWindX * 0.04;
        armForeRRef.current.rotation.y = localWindX * 0.04;
      } else {
        // Idle breathing swing
        const breathe = Math.sin(t * 1.8) * 0.025;
        
        sleeveLRef.current.rotation.x = THREE.MathUtils.lerp(sleeveLRef.current.rotation.x, breathe + localWindZ * 0.02, 8 * dt);
        sleeveRRef.current.rotation.x = THREE.MathUtils.lerp(sleeveRRef.current.rotation.x, -breathe + localWindZ * 0.02, 8 * dt);
        sleeveLRef.current.rotation.z = THREE.MathUtils.lerp(sleeveLRef.current.rotation.z, -0.15 + localWindX * 0.02, 8 * dt);
        sleeveRRef.current.rotation.z = THREE.MathUtils.lerp(sleeveRRef.current.rotation.z, 0.15 + localWindX * 0.02, 8 * dt);
        
        // Forearm elbow relaxed position plus wind flutter
        const elbowBreathe = 0.15 + Math.sin(t * 2.2) * 0.03 - localWindZ * 0.03;
        armForeLRef.current.rotation.x = THREE.MathUtils.lerp(armForeLRef.current.rotation.x, elbowBreathe, 8 * dt);
        armForeRRef.current.rotation.x = THREE.MathUtils.lerp(armForeRRef.current.rotation.x, elbowBreathe, 8 * dt);
        armForeLRef.current.rotation.y = THREE.MathUtils.lerp(armForeLRef.current.rotation.y, localWindX * 0.04, 8 * dt);
        armForeRRef.current.rotation.y = THREE.MathUtils.lerp(armForeRRef.current.rotation.y, localWindX * 0.04, 8 * dt);
      }
    }

    // 3. Pulse mask eyes with audio volume peaks
    const eyeScale = 0.8 + audioLevels.peak * 0.45;
    if (eyeLRef.current && eyeRRef.current) {
      eyeLRef.current.scale.setScalar(eyeScale);
      eyeRRef.current.scale.setScalar(eyeScale);
    }



    // 5. Animate Floating Fireflies (orbiting the character, floating vertically, and pulsing bioluminescently)
    sparkRefs.current.forEach((spark, idx) => {
      if (!spark) return;
      const count = sparkRefs.current.length;
      if (count === 0) return;
      
      // Dynamic expansion/contraction of orbit
      const r = 1.0 + 1.6 * Math.sin(t * 0.16 + idx * 2.3);
      
      // Float vertically between y = 0.1 and y = 2.4 (body heights)
      const py = 1.1 + 0.85 * Math.sin(t * 0.45 + idx * 3.7) + Math.cos(t * 0.22 + idx * 1.1) * 0.35;
      
      // Horizontal angle in orbit
      const angle = t * (0.35 + (idx % 3) * 0.15) + idx * (Math.PI * 2 / count);
      const px = Math.cos(angle) * r;
      const pz = Math.sin(angle) * r;
      
      // Local wind drift sway
      const driftX = localWindX * 0.08 * Math.sin(t * 1.4 + idx);
      const driftZ = localWindZ * 0.08 * Math.cos(t * 1.1 + idx);
      
      spark.position.set(px + driftX, py, pz + driftZ);
      
      // Bioluminescent pulsing glow (slow breathing cycles)
      const pulse = Math.max(0, Math.sin(t * 1.6 + idx * 1.8) * 0.5 + 0.5);
      const scaleVal = pulse * (1 + audioLevels.level * 0.45);
      spark.scale.setScalar(Math.max(0, scaleVal));
    });

    // 6. Dynamic FOV — running widens, emotional lines zoom in for focus
    if (camera instanceof THREE.PerspectiveCamera) {
      const targetFov = dreamEvents.isEmotionalLine ? 46 : isRunning ? 68 : 62;
      const fovLerpSpeed = dreamEvents.isEmotionalLine ? 1.2 : 5;
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, fovLerpSpeed * dt);
      camera.updateProjectionMatrix();
    }

    // 6b. Wish camera tilt — look upward after submitting a wish
    if (wishStore.tiltCamera) {
      wishStore.tiltTimer += dt;
      const targetTilt = Math.min(wishStore.tiltTimer / 1.5, 1) * 0.40;
      wishTiltRef.current = THREE.MathUtils.lerp(wishTiltRef.current, targetTilt, 2.5 * dt);
      if (wishStore.tiltTimer > 3.8) {
        wishStore.tiltCamera = false;
        wishStore.tiltTimer = 0;
      }
    } else {
      wishTiltRef.current = THREE.MathUtils.lerp(wishTiltRef.current, 0, 1.2 * dt);
    }

    // 7. Orbit Camera behind the Traveler (Third Person View)
    const distance = 9.0;
    const effectivePitch = pitch.current - wishTiltRef.current;
    const targetCamX = pos.current.x + Math.sin(yaw.current) * Math.cos(effectivePitch) * distance;
    const targetCamZ = pos.current.z + Math.cos(yaw.current) * Math.cos(effectivePitch) * distance;
    const targetCamY = currentGround.current + jumpY.current + 2.2 + Math.sin(-effectivePitch) * distance + 1.0;

    // Prevent camera from clipping below the terrain or water waves
    let landCamY = terrainHeight(world.terrain, targetCamX, targetCamZ);
    let minCamY = landCamY + 0.6;
    if (landCamY < WATER_LEVEL) {
      const amp = 0.4 + audioLevels.level * 0.6;
      
      const wave1 = Math.sin(targetCamX * 0.035 + t * 0.8) * 0.24;
      const wave2 = Math.cos(targetCamZ * 0.042 + t * 0.7) * 0.22;
      const wave3 = Math.sin((targetCamX + targetCamZ) * 0.025 - t * 1.1) * 0.16;
      const wave4 = Math.sin((targetCamX - targetCamZ) * 0.06 + t * 1.5) * 0.08 * amp;
      const wave = wave1 + wave2 + wave3 + wave4;
        
      const distToLake = Math.hypot(targetCamX - 90, targetCamZ - (-80));
      const rippleAmp = 0.18 * Math.max(0, 1 - distToLake / 150) * (0.5 + audioLevels.level * 0.5);
      const ripple = Math.sin(distToLake * 0.35 - t * 3.5) * rippleAmp;

      const distToSplash = Math.hypot(targetCamX - 90, targetCamZ - (-199));
      const splashAmp = 0.12 * Math.max(0, 1 - distToSplash / 60) * (0.6 + audioLevels.level * 0.4);
      const splashRipple = Math.sin(distToSplash * 0.52 - t * 4.6) * splashAmp;
      
      minCamY = WATER_LEVEL + wave + ripple + splashRipple + 0.6;
    }
    const safeCamY = Math.max(targetCamY, minCamY);

    const lerpSpeed = 1 - Math.pow(0.003, dt);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCamX, lerpSpeed);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, safeCamY, lerpSpeed);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, lerpSpeed);

    // drums stem → camera micro-shake on strong transients
    const drumPeak = stemLevels.drums;
    if (drumPeak > 0.6) {
      const shakeAmp = (drumPeak - 0.6) * 0.35;
      camera.position.x += (Math.random() - 0.5) * shakeAmp;
      camera.position.y += (Math.random() - 0.5) * shakeAmp * 0.4;
      camera.position.z += (Math.random() - 0.5) * shakeAmp;
    }

    // Camera always focus looks at the Traveler's upper torso/head
    const targetLookAt = new THREE.Vector3(pos.current.x, currentGround.current + jumpY.current + 1.2, pos.current.z);
    const lookMat = new THREE.Matrix4();
    lookMat.lookAt(camera.position, targetLookAt, new THREE.Vector3(0, 1, 0));
    targetQuat.current.setFromRotationMatrix(lookMat);
    camera.quaternion.slerp(targetQuat.current, 1 - Math.pow(0.0015, dt));
  });

  return (
    <group ref={travelerRef} rotation={[0, Math.PI, 0]}>
      {/* Butterflies fluttering around traveler */}
      <Butterflies world={world} />

      {/* Left Hip, Thigh, Knee & Boot */}
      <group ref={legLRef} position={[-0.14, 0.4, 0]}>
        {/* Thigh (Upper Leg) */}
        <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.032, 0.028, 0.2, 16]} />
          <meshStandardMaterial color={world.colors.structure} roughness={0.9} />
        </mesh>
        
        {/* Calf (Lower Leg) */}
        <group ref={legCalfLRef} position={[0, -0.2, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.028, 0.025, 0.2, 16]} />
            <meshStandardMaterial color={world.colors.structure} roughness={0.9} />
          </mesh>
          {/* Fitted Boot */}
          <mesh position={[0, -0.21, 0.04]} rotation={[0.08, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.042, 0.045, 0.11]} />
            <meshStandardMaterial color="#0b0c10" roughness={0.8} />
          </mesh>
        </group>
      </group>

      {/* Right Hip, Thigh, Knee & Boot */}
      <group ref={legRRef} position={[0.14, 0.4, 0]}>
        {/* Thigh (Upper Leg) */}
        <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.032, 0.028, 0.2, 16]} />
          <meshStandardMaterial color={world.colors.structure} roughness={0.9} />
        </mesh>
        
        {/* Calf (Lower Leg) */}
        <group ref={legCalfRRef} position={[0, -0.2, 0]}>
          <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.028, 0.025, 0.2, 16]} />
            <meshStandardMaterial color={world.colors.structure} roughness={0.9} />
          </mesh>
          {/* Fitted Boot */}
          <mesh position={[0, -0.21, 0.04]} rotation={[0.08, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.042, 0.045, 0.11]} />
            <meshStandardMaterial color="#0b0c10" roughness={0.8} />
          </mesh>
        </group>
      </group>

      {/* Left Sleeve/Arm */}
      <group ref={sleeveLRef} position={[-0.23, 1.38, 0]} rotation={[0, 0, -0.12]}>
        {/* Upper Arm */}
        <mesh position={[0, -0.12, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.06, 0.048, 0.24, 16]} />
          <meshStandardMaterial color={world.colors.banner} roughness={0.7} />
        </mesh>
        
        {/* Forearm & Cuff */}
        <group ref={armForeLRef} position={[0, -0.24, 0]}>
          <mesh position={[0, -0.12, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.048, 0.04, 0.24, 16]} />
            <meshStandardMaterial color={world.colors.banner} roughness={0.7} />
          </mesh>
          {/* Hanging Sleeve Cuff */}
          <mesh position={[0, -0.26, 0]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.08, 0.16, 16]} />
            <meshStandardMaterial
              color={world.colors.structureGlow}
              emissive={world.colors.structureGlow}
              emissiveIntensity={0.6}
              roughness={0.15}
              metalness={0.9}
            />
          </mesh>
        </group>
      </group>

      {/* Right Sleeve/Arm */}
      <group ref={sleeveRRef} position={[0.23, 1.38, 0]} rotation={[0, 0, 0.12]}>
        {/* Upper Arm */}
        <mesh position={[0, -0.12, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.06, 0.048, 0.24, 16]} />
          <meshStandardMaterial color={world.colors.banner} roughness={0.7} />
        </mesh>
        
        {/* Forearm & Cuff */}
        <group ref={armForeRRef} position={[0, -0.24, 0]}>
          <mesh position={[0, -0.12, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.048, 0.04, 0.24, 16]} />
            <meshStandardMaterial color={world.colors.banner} roughness={0.7} />
          </mesh>
          {/* Hanging Sleeve Cuff */}
          <mesh position={[0, -0.26, 0]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
            <coneGeometry args={[0.08, 0.16, 16]} />
            <meshStandardMaterial
              color={world.colors.structureGlow}
              emissive={world.colors.structureGlow}
              emissiveIntensity={0.6}
              roughness={0.15}
              metalness={0.9}
            />
          </mesh>
        </group>
      </group>

      {/* Traveler Flowing Cloak/Robe */}
      <mesh ref={robeRef} geometry={robeBaseArray.geom} position={[0, 1.05, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color={world.colors.banner}
          roughness={0.75}
          metalness={0.02}
          emissive={world.colors.banner}
          emissiveIntensity={0.05}
        />
      </mesh>

      {/* Flowing Back Cape (Jubah) */}
      <mesh ref={capeRef} geometry={capeGeom} position={[0, 1.46, -0.18]} castShadow receiveShadow frustumCulled={false}>
        <meshStandardMaterial
          vertexColors
          roughness={0.65}
          metalness={0.06}
          side={THREE.DoubleSide}
          emissive={new THREE.Color(world.colors.banner)}
          emissiveIntensity={0.08}
        />
      </mesh>



      {/* Neck */}
      <mesh position={[0, 1.58, 0.02]} castShadow receiveShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.16, 16]} />
        <meshStandardMaterial
          color={world.colors.structure}
          roughness={0.85}
        />
      </mesh>

      {/* Shoulder Bridge (Bahu) */}
      <mesh position={[0, 1.38, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.46, 16]} />
        <meshStandardMaterial
          color={world.colors.structure}
          roughness={0.8}
        />
      </mesh>

      {/* Left Shoulder Joint */}
      <mesh position={[-0.23, 1.38, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={world.colors.structure}
          roughness={0.8}
        />
      </mesh>

      {/* Right Shoulder Joint */}
      <mesh position={[0.23, 1.38, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={world.colors.structure}
          roughness={0.8}
        />
      </mesh>

      {/* Robe Cowl/Shoulders */}
      <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.3, 0.35, 20]} />
        <meshStandardMaterial
          color={world.colors.structure}
          roughness={0.8}
        />
      </mesh>

      {/* Gold Embroidered Cowl Rim (Detailing) */}
      <mesh position={[0, 1.62, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.177, 0.177, 0.04, 20, 1, true]} />
        <meshStandardMaterial
          color={world.colors.structureGlow}
          emissive={world.colors.structureGlow}
          emissiveIntensity={0.52}
          roughness={0.1}
          metalness={0.9}
        />
      </mesh>

      {/* Pointed Back Hood Tip (Wizard-like pointed cowl) */}
      <mesh geometry={hoodTipGeom} position={[0, 1.42, -0.16]} rotation={[-0.45, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color={world.colors.structure}
          roughness={0.82}
        />
      </mesh>

      {/* Dark Mask Head */}
      <group position={[0, 1.68, 0.04]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.2, 24, 24]} />
          <meshStandardMaterial color="#111218" roughness={0.9} />
        </mesh>
        
        {/* White Glowing Eyes (Reacting to music beats) */}
        <mesh ref={eyeLRef} position={[-0.065, 0.02, 0.17]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
        <mesh ref={eyeRRef} position={[0.065, 0.02, 0.17]}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      </group>



      {/* Floating Magical Sparks rising from cloak (Pulsing with music and blown by wind) */}
      {Array.from({ length: 18 }).map((_, i) => (
        <mesh key={i} ref={(el) => { if (el) sparkRefs.current[i] = el; }} castShadow>
          <sphereGeometry args={[0.07, 6, 6]} />
          <meshBasicMaterial color={world.colors.structureGlow} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
