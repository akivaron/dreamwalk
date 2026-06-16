import type { TrackDef } from "./types";

const base = import.meta.env.BASE_URL;

export const TRACKS: TrackDef[] = [
  {
    id: "golden-hour",
    title: "Golden Hour",
    artist: "Auralune",
    file: `${base}audio/golden-hour.mp3`,
    suggestedWorld: "golden-desert",
  },
  {
    id: "moonlit-tide",
    title: "Moonlit Tide",
    artist: "Sela Voss",
    file: `${base}audio/moonlit-tide.mp3`,
    suggestedWorld: "moon-ocean",
  },
  {
    id: "ascension",
    title: "Ascension",
    artist: "Orenda Choir",
    file: `${base}audio/ascension.mp3`,
    suggestedWorld: "ancient-kingdom",
  },
  {
    id: "aurora-dreams",
    title: "Aurora Dreams",
    artist: "Nyx Avalon",
    file: `${base}audio/aurora-dreams.mp3`,
    suggestedWorld: "dream-night",
  },
];
