import { mulberry32 } from "../rng";
import type { TerrainKind } from "../types";

export const TERRAIN_SIZE = 1400;

const GRID = 64;
const rand = mulberry32(1337);
const vals: number[] = [];
for (let i = 0; i < (GRID + 1) * (GRID + 1); i++) vals.push(rand() * 2 - 1);

function idx(a: number, b: number): number {
  const ca = Math.max(0, Math.min(GRID, a));
  const cb = Math.max(0, Math.min(GRID, b));
  return cb * (GRID + 1) + ca;
}

function noise(x: number, z: number): number {
  const gx = (x / TERRAIN_SIZE + 0.5) * GRID;
  const gz = (z / TERRAIN_SIZE + 0.5) * GRID;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const tx = gx - x0;
  const tz = gz - z0;
  const v00 = vals[idx(x0, z0)];
  const v10 = vals[idx(x0 + 1, z0)];
  const v01 = vals[idx(x0, z0 + 1)];
  const v11 = vals[idx(x0 + 1, z0 + 1)];
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  return (v00 * (1 - sx) + v10 * sx) * (1 - sz) + (v01 * (1 - sx) + v11 * sx) * sz;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function terrainHeight(kind: TerrainKind, x: number, z: number): number {
  if (kind === "water") return 0;
  let h = 0;
  if (kind === "plains") {
    // Base height for rolling hills/savanna
    const baseNoise = noise(x, z) * 11;
    const sineHills = Math.sin(x * 0.007) * 12 + Math.cos(z * 0.006) * 10;
    h = baseNoise + sineHills;
    
    // Winding river valley
    const riverZ = 45 + Math.sin(x * 0.012) * 50;
    const distToRiver = Math.abs(z - riverZ);
    
    // Valley depression (river basin)
    const valleyWidth = 130;
    const valleyFactor = smoothstep(valleyWidth, 15, distToRiver);
    h = h * (1 - valleyFactor) - valleyFactor * 6.5;
    
    // Circular lake basin centered at [90, -80]
    const lakeX = 90;
    const lakeZ = -80;
    const distToLake = Math.hypot(x - lakeX, z - lakeZ);
    const lakeRadius = 130;
    const lakeFactor = smoothstep(lakeRadius + 40, lakeRadius - 20, distToLake);
    h = h * (1 - lakeFactor) - lakeFactor * 8.0;
    
    // Waterfall Cliff behind the lake
    const cliffX = 90;
    const distToCliffX = Math.abs(x - cliffX);
    const cliffZ = -200;
    
    if (distToCliffX < 60 && z < cliffZ) {
      const cliffWidthFactor = smoothstep(60, 30, distToCliffX);
      const cliffHeight = 18.0 * cliffWidthFactor;
      
      // Sheer vertical face dropping from cliffZ - 10 to cliffZ
      const dropFactor = smoothstep(cliffZ - 10, cliffZ, z);
      h = cliffHeight * (1 - dropFactor) + h * dropFactor;
    }
    
    // Micro-topography details
    h += noise(x * 2.5, z * 2.5) * 1.2;
  } else {
    const amp = kind === "hills" ? 34 : kind === "snow" ? 20 : 24;
    h += Math.sin(x * 0.01) * amp * 0.5 + Math.cos(z * 0.012) * amp * 0.5;
    h += Math.sin((x + z) * 0.022) * amp * 0.25;
    h += noise(x, z) * amp * 0.5;
    
    // Add high-frequency micro-topography (sand ripples / fine ridges)
    if (kind === "dunes") {
      h += Math.sin(x * 0.16 + z * 0.12) * 0.38 * (0.25 + noise(x * 0.05, z * 0.05));
    } else {
      h += noise(x * 2.8, z * 2.8) * amp * 0.06;
    }
  }
  const d = Math.hypot(x, z);
  const flat = smoothstep(0, 70, d);
  return h * flat;
}
