import type { DreamSong } from "../types";

interface iTunesResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  artworkUrl100: string;
  previewUrl: string;
  primaryGenreName: string;
  kind: string;
}

interface iTunesResponse {
  resultCount: number;
  results: iTunesResult[];
}

export async function searchSongs(query: string): Promise<DreamSong[]> {
  if (!query.trim()) return [];
  const url = `https://itunes.apple.com/search?${new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: "15",
  })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("iTunes search failed");
  const data = (await res.json()) as iTunesResponse;
  return data.results
    .filter((r) => r.kind === "song")
    .map((r) => ({
      id: String(r.trackId),
      title: r.trackName,
      artist: r.artistName,
      album: r.collectionName,
      artworkUrl: (r.artworkUrl100 ?? "").replace("100x100bb", "300x300bb"),
      previewUrl: r.previewUrl ?? null,
      genre: r.primaryGenreName ?? "Unknown",
      source: "itunes" as const,
    }));
}

export async function lookupSong(trackId: string): Promise<DreamSong | null> {
  const url = `https://itunes.apple.com/lookup?id=${trackId}&entity=song`;
  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const data = (await res.json()) as iTunesResponse;
  const r = data.results[0];
  if (!r) return null;
  return {
    id: String(r.trackId),
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName,
    artworkUrl: (r.artworkUrl100 ?? "").replace("100x100bb", "300x300bb"),
    previewUrl: r.previewUrl ?? null,
    genre: r.primaryGenreName ?? "Unknown",
    source: "itunes" as const,
  };
}
