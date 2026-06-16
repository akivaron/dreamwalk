import type { World } from "../types";
import { WORLDS } from "../worlds";
import type { DreamContext } from "./types";

export function buildWorldFromContext(context: DreamContext): World {
  const base = WORLDS.find((w) => w.id === context.worldId) ?? WORLDS[0];

  const overrides = context.worldOverrides;

  return {
    ...base,
    ...(overrides.fogDensity !== undefined ? { fogDensity: overrides.fogDensity } : {}),
    ...(overrides.sunPosition !== undefined ? { sunPosition: overrides.sunPosition } : {}),
    ...(overrides.sunSize !== undefined ? { sunSize: overrides.sunSize } : {}),
    ...(overrides.bloom !== undefined ? { bloom: overrides.bloom } : {}),
    ...(overrides.ambientIntensity !== undefined ? { ambientIntensity: overrides.ambientIntensity } : {}),
    ...(overrides.lightIntensity !== undefined ? { lightIntensity: overrides.lightIntensity } : {}),
    colors: {
      ...base.colors,
      ...(overrides.colors ?? {}),
    },
    features: {
      ...base.features,
      ...(overrides.features ?? {}),
    },
  };
}
