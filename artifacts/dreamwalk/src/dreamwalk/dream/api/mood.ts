import type { MoodData, MoodPrimary } from "../types";

const API_BASE = import.meta.env.BASE_URL;

interface CyaniteResponse {
  primaryMood: string | null;
  secondaryMoods: string[];
  moodTags: string[];
  genreTags: string[];
  valence: number | null;
  arousal: number | null;
  energy: number | null;
  source: "cyanite";
}

const CYANITE_TO_MOOD: Record<string, MoodPrimary> = {
  happy: "energetic",
  sad: "melancholic",
  melancholic: "melancholic",
  angry: "epic",
  fear: "dark",
  surprise: "energetic",
  romantic: "romantic",
  calm: "calm",
  peaceful: "calm",
  epic: "epic",
  dramatic: "epic",
  hopeful: "hopeful",
  nostalgic: "nostalgic",
  dark: "dark",
  uplifting: "hopeful",
  tense: "dark",
  aggressive: "epic",
  dreamy: "calm",
  sensual: "romantic",
};

function mapCyaniteMood(name: string | null): MoodPrimary {
  if (!name) return "hopeful";
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(CYANITE_TO_MOOD)) {
    if (lower.includes(key)) return val;
  }
  return "hopeful";
}

export async function fetchMoodFromCyanite(
  artist: string,
  title: string,
  spotifyTrackId?: string,
): Promise<MoodData | null> {
  try {
    const body: Record<string, string> = { title, artist };
    if (spotifyTrackId) body["spotifyTrackId"] = spotifyTrackId;

    const res = await fetch(`${API_BASE}api/mood`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as CyaniteResponse;

    const primary = mapCyaniteMood(data.primaryMood);
    const secondary = data.secondaryMoods.length > 0
      ? mapCyaniteMood(data.secondaryMoods[0])
      : null;
    const finalSecondary: MoodPrimary | null = secondary !== primary ? secondary : null;

    return {
      primary,
      secondary: finalSecondary,
      energy: data.energy ?? 0.5,
      valence: data.valence !== null ? (data.valence + 1) / 2 : 0.5,
      arousal: data.arousal ?? undefined,
      moodTags: data.moodTags,
      genreTags: data.genreTags,
      source: "cyanite",
    };
  } catch {
    return null;
  }
}
