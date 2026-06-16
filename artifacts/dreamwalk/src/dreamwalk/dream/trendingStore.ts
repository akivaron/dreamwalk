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
    .map((e) => ({ ...e }));
}

export async function fetchItunesTrending(): Promise<TrendingTrack[]> {
  try {
    const API_BASE = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
    const res = await fetch(`${API_BASE}api/trending`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      feed: { results: Array<{ id: string; name: string; artistName: string; artworkUrl100: string }> };
    };
    return (data.feed?.results ?? []).map((r) => ({
      id: r.id,
      title: r.name,
      artist: r.artistName,
      artworkUrl: (r.artworkUrl100 ?? "").replace("100x100", "300x300"),
      plays: 0,
    }));
  } catch {
    return [];
  }
}
