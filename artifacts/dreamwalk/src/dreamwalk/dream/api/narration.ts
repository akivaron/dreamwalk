const API_BASE = import.meta.env.BASE_URL;

const DEFAULT_VOICE = "pNInz6obpgDQGcFmaJgB";

export interface NarrationResult {
  text: string;
  audioUrl: string | null;
}

export async function generateNarration(text: string): Promise<NarrationResult> {
  try {
    const res = await fetch(`${API_BASE}api/narrate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: DEFAULT_VOICE }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { text, audioUrl: null };
    const blob = await res.blob();
    if (blob.size < 100) return { text, audioUrl: null };
    const audioUrl = URL.createObjectURL(blob);
    return { text, audioUrl };
  } catch {
    return { text, audioUrl: null };
  }
}

export function releaseNarrationUrl(url: string | null): void {
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}
