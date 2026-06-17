import type { WishesData } from "./types";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

export async function fetchWishes(songId: string): Promise<WishesData> {
  try {
    const res = await fetch(`${BASE}/wishes?songId=${encodeURIComponent(songId)}`);
    if (!res.ok) return { count: 0, samples: [] };
    return (await res.json()) as WishesData;
  } catch {
    return { count: 0, samples: [] };
  }
}

export async function submitWish(
  wishText: string,
  songId: string,
  songTitle: string,
  worldId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/wishes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wishText, songId, songTitle, worldId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
