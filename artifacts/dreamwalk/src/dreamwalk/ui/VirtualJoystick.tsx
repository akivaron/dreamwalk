import { useEffect, useRef } from "react";
import { joystickInput } from "../scene/joystickStore";

const BASE_R = 44;
const KNOB_R = 20;

export function VirtualJoystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!("ontouchstart" in window)) return;

    const base = baseRef.current;
    if (!base) return;

    const onTouchStart = (e: TouchEvent) => {
      if (touchIdRef.current !== null) return;
      const t = e.changedTouches[0];
      touchIdRef.current = t.identifier;
      originRef.current = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;
      let touch: Touch | null = null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touch = e.changedTouches[i];
          break;
        }
      }
      if (!touch) return;

      const dx = touch.clientX - originRef.current.x;
      const dy = touch.clientY - originRef.current.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(dist, BASE_R);
      const angle = Math.atan2(dy, dx);

      joystickInput.dx = (Math.cos(angle) * clamped) / BASE_R;
      joystickInput.dy = (Math.sin(angle) * clamped) / BASE_R;
      joystickInput.active = true;

      if (knobRef.current) {
        knobRef.current.style.transform = `translate(${Math.cos(angle) * clamped}px, ${Math.sin(angle) * clamped}px)`;
      }
      e.preventDefault();
    };

    const onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touchIdRef.current = null;
          joystickInput.dx = 0;
          joystickInput.dy = 0;
          joystickInput.active = false;
          if (knobRef.current) {
            knobRef.current.style.transform = "translate(0px, 0px)";
          }
          break;
        }
      }
      e.preventDefault();
    };

    base.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: false });
    window.addEventListener("touchcancel", onTouchEnd, { passive: false });

    return () => {
      base.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      joystickInput.dx = 0;
      joystickInput.dy = 0;
      joystickInput.active = false;
    };
  }, []);

  if (!("ontouchstart" in window)) return null;

  return (
    <div
      className="pointer-events-auto absolute bottom-36 left-8 z-40 flex items-center justify-center rounded-full border border-white/20 bg-black/25 backdrop-blur-sm"
      style={{ width: BASE_R * 2, height: BASE_R * 2 }}
      ref={baseRef}
    >
      <div
        ref={knobRef}
        className="rounded-full bg-white/35"
        style={{ width: KNOB_R * 2, height: KNOB_R * 2 }}
      />
    </div>
  );
}
