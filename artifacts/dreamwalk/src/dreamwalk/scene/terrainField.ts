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
    h = Math.sin(x * 0.012) * 2 + Math.cos(z * 0.01) * 2 + noise(x, z) * 3;
  } else {
    const amp = kind === "hills" ? 34 : kind === "snow" ? 20 : 24;
    h += Math.sin(x * 0.01) * amp * 0.5 + Math.cos(z * 0.012) * amp * 0.5;
    h += Math.sin((x + z) * 0.022) * amp * 0.25;
    h += noise(x, z) * amp * 0.5;
  }
  const d = Math.hypot(x, z);
  const flat = smoothstep(0, 70, d);
  return h * flat;
}
