export type TerrainKind = "dunes" | "hills" | "snow" | "plains" | "water";

export interface WorldColors {
  skyTop: string;
  skyBottom: string;
  fog: string;
  sun: string;
  sunGlow: string;
  ground: string;
  groundDeep: string;
  structure: string;
  structureGlow: string;
  particle: string;
  ambient: string;
  light: string;
  banner: string;
  auroraA: string;
  auroraB: string;
}

export interface WorldFeatures {
  aurora: boolean;
  stars: boolean;
  clouds: boolean;
  islands: boolean;
  water: boolean;
  embers: boolean;
  snow: boolean;
}

export interface World {
  id: string;
  name: string;
  subtitle: string;
  terrain: TerrainKind;
  colors: WorldColors;
  features: WorldFeatures;
  fogDensity: number;
  sunPosition: [number, number, number];
  sunSize: number;
  bloom: number;
  ambientIntensity: number;
  lightIntensity: number;
}

export interface TrackDef {
  id: string;
  title: string;
  artist: string;
  file: string | null;
  artworkUrl?: string;
  suggestedWorld: string;
}
