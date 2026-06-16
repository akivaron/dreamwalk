import type { World } from "../types";

export interface DreamSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl: string | null;
  genre: string;
  source: "itunes" | "curated";
}

export interface SyncedLyricLine {
  time: number;
  text: string;
  type: "verse" | "chorus" | "bridge" | "outro" | "unknown";
  isEmotional: boolean;
}

export interface LyricsData {
  raw: string;
  lines: string[];
  synced: SyncedLyricLine[];
  sections: {
    verse: string[];
    chorus: string[];
    bridge: string[];
    outro: string[];
  };
}

export type MoodPrimary =
  | "hopeful"
  | "melancholic"
  | "epic"
  | "calm"
  | "energetic"
  | "dark"
  | "romantic"
  | "nostalgic";

export interface MoodData {
  primary: MoodPrimary;
  secondary: MoodPrimary | null;
  energy: number;
  valence: number;
}

export interface TrendingTrack {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  plays: number;
}

export interface ConcertInfo {
  id: string;
  name: string;
  date: string;
  venue: string;
  city: string;
  url: string;
}

export interface DreamContext {
  song: DreamSong | null;
  lyrics: LyricsData | null;
  keywords: string[];
  themes: string[];
  importantLines: string[];
  mood: MoodData;
  narrationText: string | null;
  narrationEnabled: boolean;
  narrationAudioUrl: string | null;
  trends: TrendingTrack[];
  concert: ConcertInfo | null;
  concertModeActive: boolean;
  worldId: string;
  worldOverrides: Partial<World>;
}

export interface DreamContextState {
  context: DreamContext;
  loading: boolean;
  loadingStep: string;
  error: string | null;
  ready: boolean;
}
