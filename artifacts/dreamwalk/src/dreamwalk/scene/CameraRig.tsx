import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { audioLevels } from "../audio/audioStore";

export function CameraRig() {
  const { camera, gl } = useThree();
  const yaw = useRef(0);
  const pitch = useRef(-0.03);
  const keys = useRef<Record<string, boolean>>({});
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const pos = useRef(new THREE.Vector3(0, 3.2, 14));

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
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const targetQuat = useRef(new THREE.Quaternion());

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = keys.current;
    forward.current.set(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    rightV.current.crossVectors(forward.current, up.current).normalize();
    const speed = 6.0 * (1 + audioLevels.intensity * 0.35);
    move.current.set(0, 0, 0);
    if (k["KeyW"] || k["ArrowUp"]) move.current.add(forward.current);
    if (k["KeyS"] || k["ArrowDown"]) move.current.sub(forward.current);
    if (k["KeyA"] || k["ArrowLeft"]) move.current.sub(rightV.current);
    if (k["KeyD"] || k["ArrowRight"]) move.current.add(rightV.current);
    if (move.current.lengthSq() > 0) {
      move.current.normalize().multiplyScalar(speed * dt);
      pos.current.add(move.current);
    }

    const maxR = 400;
    const r = Math.hypot(pos.current.x, pos.current.z);
    if (r > maxR) {
      pos.current.x *= maxR / r;
      pos.current.z *= maxR / r;
    }

    const t = audioLevels.time;
    const sway = Math.sin(t * 0.5) * 0.06 + Math.sin(t * 0.23) * 0.04;
    const baseY =
      3.2 +
      audioLevels.intensity * 2.4 +
      Math.sin(t * 0.8) * 0.12 * (0.5 + audioLevels.level);
    camera.position.set(pos.current.x, baseY, pos.current.z);

    euler.current.set(
      pitch.current + sway * 0.02 + audioLevels.intensity * 0.05,
      yaw.current + sway * 0.01,
      Math.sin(t * 0.35) * 0.012,
    );
    targetQuat.current.setFromEuler(euler.current);
    camera.quaternion.slerp(targetQuat.current, 1 - Math.pow(0.0015, dt));
  });

  return null;
}
