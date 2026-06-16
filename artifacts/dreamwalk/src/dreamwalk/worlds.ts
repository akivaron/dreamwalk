import type { World } from "./types";

export const WORLDS: World[] = [
  {
    id: "savana-valley",
    name: "Savana Valley",
    subtitle: "A lush valley of golden grass, floating lands, and quiet rivers",
    terrain: "plains",
    fogDensity: 0.0048,
    sunPosition: [300, 200, -600],
    sunSize: 52,
    bloom: 0.95,
    ambientIntensity: 0.58,
    lightIntensity: 1.25,
    colors: {
      skyTop: "#5bbce3",
      skyBottom: "#d0ecd4",
      fog: "#cbead1",
      sun: "#fffef5",
      sunGlow: "#ffe699",
      ground: "#6ab879",
      groundDeep: "#255938",
      structure: "#4e321e",
      structureGlow: "#ffe9ad",
      particle: "#ffe9ad",
      ambient: "#365640",
      light: "#fff7dd",
      banner: "#d6533c",
      auroraA: "#60dfaa",
      auroraB: "#c5e884",
    },
    features: {
      aurora: true,
      stars: true,
      clouds: true,
      islands: true,
      water: true,
      embers: true,
      snow: false,
    },
  },
];

export function getWorld(id: string): World {
  return WORLDS.find((w) => w.id === id) ?? WORLDS[0];
}
