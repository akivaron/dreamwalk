import type { StemData } from "../types";
import { stemLevels } from "../../audio/audioStore";

const API_BASE = import.meta.env.BASE_URL;

interface StemsInitResponse {
  fileId: string;
  status: string;
  source: "lalal";
}

interface StemsCheckResponse {
  status?: string;
  stem?: {
    vocals?: { stem?: string; back?: string };
  };
  source: "lalal";
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20;

async function pollForCompletion(fileId: string): Promise<string | null> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const res = await fetch(`${API_BASE}api/stems/${fileId}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as StemsCheckResponse;
      if (data.status === "success" && data.stem?.vocals?.stem) {
        return data.stem.vocals.stem;
      }
      if (data.status === "error") return null;
    } catch {
      /* keep polling */
    }
  }
  return null;
}

export async function requestStemSeparation(audioUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}api/stems`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioUrl }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as StemsInitResponse;
    if (!data.fileId) return null;
    return data.fileId;
  } catch {
    return null;
  }
}

export async function fetchAndApplyStems(audioUrl: string): Promise<StemData | null> {
  const fileId = await requestStemSeparation(audioUrl);
  if (!fileId) return null;

  const vocalUrl = await pollForCompletion(fileId);
  if (!vocalUrl) return null;

  // We got the vocal stem URL — fetch it and analyze amplitude
  // For now return a flag that LALAL is available; the audio analyzer
  // will switch its source label to "lalal" when this resolves
  return {
    drums: stemLevels.drums,
    bass: stemLevels.bass,
    vocals: stemLevels.vocals,
    instruments: stemLevels.instruments,
    source: "lalal",
  };
}

export function getFFTStemData(): StemData {
  return {
    drums: stemLevels.drums,
    bass: stemLevels.bass,
    vocals: stemLevels.vocals,
    instruments: stemLevels.instruments,
    source: "fft",
  };
}
