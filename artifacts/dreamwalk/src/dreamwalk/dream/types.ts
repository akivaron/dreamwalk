import type { World } from "../types";

export interface DreamSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl: string | null;
  genre: string;
  spotifyTrackId?: string;
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
  arousal?: number;
  moodTags?: string[];
  genreTags?: string[];
  source?: "cyanite" | "heuristic";
}

export interface StemData {
  drums: number;
  bass: number;
  vocals: number;
  instruments: number;
  source: "lalal" | "fft";
}

export interface TrendingTrack {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  plays: number;
  source?: "songstats" | "apple" | "session";
}

export interface DreamContext {
  song: DreamSong | null;
  lyrics: LyricsData | null;
  keywords: string[];
  themes: string[];
  importantLines: string[];
  mood: MoodData;
  emotions: string[];
  energy: number;
  valence: number;
  genre: string;
  stems: StemData;
  narrationText: string | null;
  narrationEnabled: boolean;
  narrationAudioUrl: string | null;
  trends: TrendingTrack[];
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
