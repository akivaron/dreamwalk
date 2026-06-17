import type { MoodData, MoodPrimary } from "../types";

const API_BASE = import.meta.env.BASE_URL;

interface CyaniteAudioFeaturesResponse {
  trackId: string;
  trackName: string;
  energy: number | null;
  valence: number | null;
  danceability: number | null;
  tempo: number | null;
  acousticness: number | null;
  instrumentalness: number | null;
  source: "cyanite" | "heuristic";
}

function deriveMood(energy: number, valence: number, acousticness: number): MoodPrimary {
  if (energy > 0.75 && valence > 0.6) return "energetic";
  if (energy > 0.7 && valence < 0.35) return "epic";
  if (energy < 0.35 && valence > 0.55) return "calm";
  if (energy < 0.4 && valence < 0.35) return "melancholic";
  if (valence > 0.7 && energy > 0.5) return "hopeful";
  if (valence < 0.3 && energy > 0.55) return "dark";
  if (acousticness > 0.6 && valence > 0.5) return "romantic";
  if (energy < 0.5 && acousticness > 0.5) return "nostalgic";
  return "hopeful";
}

export async function fetchMoodFromCyanite(
  artist: string,
  title: string,
  _spotifyTrackId?: string,
): Promise<MoodData | null> {
  try {
    const res = await fetch(`${API_BASE}api/mood`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, artist }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as CyaniteAudioFeaturesResponse | { error: string };
    if ("error" in data) return null;

    const energy = data.energy ?? 0.5;
    const valence = data.valence ?? 0.5;
    const acousticness = data.acousticness ?? 0.3;

    const primary = deriveMood(energy, valence, acousticness);

    return {
      primary,
      secondary: null,
      energy,
      valence,
    };
  } catch {
    return null;
  }
}
