import { useEffect, useRef } from "react";

interface Spirit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  baseAlpha: number;
  phase: number;
  pulseSpeed: number;
  driftAmp: number;
  driftFreq: number;
  hue: number;
  kind: "bloom" | "orb" | "spark";
}

function makeSpirit(W: number, H: number): Spirit {
  const roll = Math.random();
  const kind: Spirit["kind"] = roll < 0.15 ? "bloom" : roll < 0.6 ? "orb" : "spark";
  const hue = 195 + Math.random() * 80; // cyan → violet band

  if (kind === "bloom") {
    return {
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.06 - Math.random() * 0.06,
      r: 90 + Math.random() * 80,
      baseAlpha: 0.055 + Math.random() * 0.055,
      phase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.006 + Math.random() * 0.005,
      driftAmp: 0.25, driftFreq: 0.004 + Math.random() * 0.003,
      hue, kind,
    };
  }
  if (kind === "orb") {
    return {
      x: Math.random() * W, y: H + Math.random() * H * 0.3,
      vx: (Math.random() - 0.5) * 0.28,
      vy: -0.18 - Math.random() * 0.22,
      r: 14 + Math.random() * 22,
      baseAlpha: 0.18 + Math.random() * 0.22,
      phase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.018 + Math.random() * 0.014,
      driftAmp: 0.6, driftFreq: 0.012 + Math.random() * 0.010,
      hue, kind,
    };
  }
  return {
    x: Math.random() * W, y: H + Math.random() * H * 0.5,
    vx: (Math.random() - 0.5) * 0.55,
    vy: -0.28 - Math.random() * 0.35,
    r: 4 + Math.random() * 7,
    baseAlpha: 0.30 + Math.random() * 0.38,
    phase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.035 + Math.random() * 0.025,
    driftAmp: 0.9, driftFreq: 0.022 + Math.random() * 0.018,
    hue, kind,
  };
}

export function SpiritBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas: HTMLCanvasElement = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const COUNT = 24;
    let spirits: Spirit[] = Array.from({ length: COUNT }, () =>
      makeSpirit(canvas.width, canvas.height),
    );
    // Scatter initial blooms anywhere on screen
    spirits.forEach((s) => {
      if (s.kind === "bloom") s.y = Math.random() * canvas.height;
    });

    let t = 0;
    let animId: number;

    function draw() {
      t++;
      const W = canvas.width;
      const H = canvas.height;
      ctx!.clearRect(0, 0, W, H);

      spirits.forEach((s, i) => {
        s.x += s.vx + Math.sin(t * s.driftFreq + s.phase) * s.driftAmp;
        s.y += s.vy;

        // Respawn when drifted off top; blooms also wrap horizontally
        if (s.y < -s.r * 5) {
          spirits[i] = makeSpirit(W, H);
          return;
        }
        if (s.x < -s.r * 6) s.x = W + s.r * 3;
        if (s.x > W + s.r * 6) s.x = -s.r * 3;

        const pulse = s.baseAlpha * (0.65 + Math.sin(t * s.pulseSpeed + s.phase) * 0.35);
        const gR = s.kind === "bloom" ? s.r * 3.2 : s.kind === "orb" ? s.r * 2.8 : s.r * 2.4;

        const grad = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, gR);
        grad.addColorStop(0,   `hsla(${s.hue},72%,88%,${pulse})`);
        grad.addColorStop(0.35,`hsla(${s.hue},65%,78%,${pulse * 0.48})`);
        grad.addColorStop(1,   `hsla(${s.hue},55%,68%,0)`);

        ctx!.beginPath();
        ctx!.arc(s.x, s.y, gR, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();

        // Bright white core for orbs and sparks
        if (s.kind !== "bloom") {
          const coreR = s.kind === "orb" ? s.r * 0.32 : s.r * 0.45;
          const coreGrad = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, coreR * 3);
          coreGrad.addColorStop(0,   `rgba(255,255,255,${pulse * 1.1})`);
          coreGrad.addColorStop(0.5, `hsla(${s.hue},80%,96%,${pulse * 0.5})`);
          coreGrad.addColorStop(1,   `hsla(${s.hue},80%,90%,0)`);
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, coreR * 3, 0, Math.PI * 2);
          ctx!.fillStyle = coreGrad;
          ctx!.fill();
        }
      });

      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
