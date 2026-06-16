import { useEffect, useState } from "react";
import type { TrackDef } from "../types";
import { TRACKS } from "../tracks";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "");
const API = `${BASE}/api`;

export function useCuratedSongs(): TrackDef[] {
  const [tracks, setTracks] = useState<TrackDef[]>(TRACKS);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/curated`, { signal: AbortSignal.timeout(10000) })
      .then((r) => r.json())
      .then((data: { tracks?: TrackDef[] }) => {
        if (cancelled) return;
        const live = (data.tracks ?? [])
          .filter((t) => t.file)
          .map((t) => ({
            ...t,
            file: `${API}/audio-proxy?url=${encodeURIComponent(t.file as string)}`,
          }));
        if (live.length > 0) setTracks(live);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return tracks;
}
