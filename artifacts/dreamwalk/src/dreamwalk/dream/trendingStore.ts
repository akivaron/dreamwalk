import type { TrendingTrack } from "./types";

const SESSION_KEY = "dw_trending";
const MAX_SESSION = 20;

export interface SessionEntry {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  lastPlayed: number;
  plays: number;
}

function loadSession(): SessionEntry[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionEntry[]) : [];
  } catch {
    return [];
  }
}

function saveSession(entries: SessionEntry[]): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function recordPlay(song: { id: string; title: string; artist: string; artworkUrl: string }): void {
  const entries = loadSession();
  const existing = entries.find((e) => e.id === song.id);
  if (existing) {
    existing.plays += 1;
    existing.lastPlayed = Date.now();
  } else {
    entries.unshift({ ...song, plays: 1, lastPlayed: Date.now() });
  }
  entries.sort((a, b) => b.plays - a.plays || b.lastPlayed - a.lastPlayed);
  saveSession(entries.slice(0, MAX_SESSION));
}

export function getSessionTrending(): TrendingTrack[] {
  return loadSession()
    .slice(0, 8)
    .map((e) => ({ ...e, source: "session" as const }));
}

interface SongstatsChart {
  track_id: string;
  track_name: string;
  artist_name: string;
  cover_url?: string;
  streams?: number;
}

interface AppleResult {
  id: string;
  name: string;
  artistName: string;
  artworkUrl100?: string;
}

interface TrendingResponse {
  source: "songstats" | "apple";
  chart?: SongstatsChart[];
  feed?: { results?: AppleResult[] };
}

export async function fetchItunesTrending(): Promise<TrendingTrack[]> {
  try {
    const API_BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
    const res = await fetch(`${API_BASE}api/trending`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];

    const data = (await res.json()) as TrendingResponse;

    // Songstats chart
    if (data.source === "songstats" && data.chart?.length) {
      return data.chart.map((item) => ({
        id: item.track_id,
        title: item.track_name,
        artist: item.artist_name,
        artworkUrl: item.cover_url ?? "",
        plays: item.streams ?? 0,
        source: "songstats" as const,
      }));
    }

    // Apple RSS fallback
    const results = data.feed?.results ?? [];
    return results.map((r) => ({
      id: r.id,
      title: r.name,
      artist: r.artistName,
      artworkUrl: (r.artworkUrl100 ?? "").replace("100x100", "300x300"),
      plays: 0,
      source: "apple" as const,
    }));
  } catch {
    return [];
  }
}
