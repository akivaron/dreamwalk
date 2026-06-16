import * as THREE from "three";

let glow: THREE.Texture | null = null;

export function makeGlowTexture(): THREE.Texture {
  if (glow) return glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.78)");
  g.addColorStop(0.6, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  glow = t;
  return t;
}

let soft: THREE.Texture | null = null;

export function makeSoftTexture(): THREE.Texture {
  if (soft) return soft;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  soft = t;
  return t;
}

function valNoise2D(x: number, y: number, seed: number = 0): number {
  const X = Math.floor(x);
  const Y = Math.floor(y);
  const fx = x - X;
  const fy = y - Y;
  
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  
  const hash = (rx: number, ry: number) => {
    const h = Math.sin(rx * 12.9898 + ry * 78.233 + seed) * 43758.5453123;
    return h - Math.floor(h);
  };
  
  const a = hash(X, Y);
  const b = hash(X + 1, Y);
  const c = hash(X, Y + 1);
  const d = hash(X + 1, Y + 1);
  
  return a * (1 - u) * (1 - v) +
         b * u * (1 - v) +
         c * (1 - u) * v +
         d * u * v;
}

let groundNoise: THREE.Texture | null = null;

export function makeGroundNoiseTexture(): THREE.Texture {
  if (groundNoise) return groundNoise;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;
  
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      
      const nx = x * 0.04;
      const ny = y * 0.04;
      const o1 = valNoise2D(nx, ny, 42) * 1.0;
      const o2 = valNoise2D(nx * 3.1, ny * 3.1, 87) * 0.45;
      const o3 = valNoise2D(nx * 9.2, ny * 9.2, 13) * 0.2;
      const o4 = (Math.random() - 0.5) * 0.12;
      
      const val = (o1 + o2 + o3 + o4) / 1.77;
      const v = Math.floor(Math.max(0, Math.min(1, val)) * 255);
      
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  t.needsUpdate = true;
  groundNoise = t;
  return t;
}

let structureStone: THREE.Texture | null = null;

export function makeStructureStoneTexture(): THREE.Texture {
  if (structureStone) return structureStone;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;
  
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      
      // Vertical grain marbling
      const n1 = Math.sin(y * 0.08 + Math.sin(x * 0.05) * 1.5) * 0.4;
      // Secondary horizontal bands
      const n2 = Math.sin(x * 0.02) * Math.cos(y * 0.02) * 0.2;
      // High frequency stone speckles
      const n3 = (Math.random() - 0.5) * 0.22;
      
      const val = Math.floor((0.5 + (n1 + n2 + n3) * 0.35) * 255);
      const v = Math.max(0, Math.min(255, val));
      
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.needsUpdate = true;
  structureStone = t;
  return t;
}

let foamTex: THREE.Texture | null = null;

export function makeFoamTexture(): THREE.Texture {
  if (foamTex) return foamTex;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;
  
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      
      const nx = x * 0.08;
      const ny = y * 0.08;
      const n1 = valNoise2D(nx, ny, 19);
      const n2 = valNoise2D(nx * 2.5, ny * 2.5, 53) * 0.5;
      
      const val = n1 + n2;
      const foamLine = val > 0.88 ? 255 : val > 0.76 ? Math.floor((val - 0.76) / 0.12 * 255) : 0;
      
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = foamLine;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(16, 16);
  t.needsUpdate = true;
  foamTex = t;
  return t;
}

let waterNoise: THREE.Texture | null = null;

export function makeWaterNoiseTexture(): THREE.Texture {
  if (waterNoise) return waterNoise;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;
  
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      
      const nx = x * 0.04;
      const ny = y * 0.04;
      const o1 = valNoise2D(nx, ny, 42) * 1.0;
      const o2 = valNoise2D(nx * 3.1, ny * 3.1, 87) * 0.45;
      const o3 = valNoise2D(nx * 9.2, ny * 9.2, 13) * 0.2;
      const o4 = (Math.random() - 0.5) * 0.12;
      
      const val = (o1 + o2 + o3 + o4) / 1.77;
      const v = Math.floor(Math.max(0, Math.min(1, val)) * 255);
      
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  t.needsUpdate = true;
  waterNoise = t;
  return t;
}
