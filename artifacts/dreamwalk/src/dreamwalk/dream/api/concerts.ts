import type { ConcertInfo } from "../types";

const API_BASE = import.meta.env.BASE_URL;

export async function fetchConcerts(artist: string): Promise<ConcertInfo[]> {
  try {
    const url = `${API_BASE}api/concerts?${new URLSearchParams({ artist })}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { concerts: ConcertInfo[] };
    return data.concerts ?? [];
  } catch {
    return [];
  }
}
