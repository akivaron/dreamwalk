import type { StemData } from "../types";
import { lalalEnvelope, stemLevels } from "../../audio/audioStore";

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
const ENVELOPE_WINDOW_MS = 100;

async function computeRmsEnvelope(arrayBuffer: ArrayBuffer): Promise<number[]> {
  try {
    const tempCtx = new AudioContext();
    const decoded = await tempCtx.decodeAudioData(arrayBuffer.slice(0));
    await tempCtx.close();

    const channelData = decoded.getChannelData(0);
    const sampleRate = decoded.sampleRate;
    const windowSamples = Math.max(1, Math.floor((sampleRate * ENVELOPE_WINDOW_MS) / 1000));
    const numWindows = Math.ceil(channelData.length / windowSamples);
    const rms: number[] = [];

    for (let w = 0; w < numWindows; w++) {
      const start = w * windowSamples;
      const end = Math.min(start + windowSamples, channelData.length);
      let sum = 0;
      for (let i = start; i < end; i++) {
        sum += channelData[i] * channelData[i];
      }
      rms.push(Math.sqrt(sum / (end - start)));
    }

    const max = Math.max(...rms, 0.001);
    return rms.map((v) => v / max);
  } catch {
    return [];
  }
}

async function pollForCompletion(fileId: string): Promise<{ vocalUrl: string; backUrl: string | null } | null> {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    try {
      const res = await fetch(`${API_BASE}api/stems/${fileId}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as StemsCheckResponse;
      if (data.status === "success" && data.stem?.vocals?.stem) {
        return {
          vocalUrl: data.stem.vocals.stem,
          backUrl: data.stem.vocals.back ?? null,
        };
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

  const result = await pollForCompletion(fileId);
  if (!result) return null;

  const { vocalUrl, backUrl } = result;

  try {
    // Fetch vocal stem and optionally the back (instrumental) track in parallel
    const [vocalBuf, backBuf] = await Promise.all([
      fetch(vocalUrl, { signal: AbortSignal.timeout(30000) }).then((r) =>
        r.ok ? r.arrayBuffer() : null,
      ),
      backUrl
        ? fetch(backUrl, { signal: AbortSignal.timeout(30000) }).then((r) =>
            r.ok ? r.arrayBuffer() : null,
          )
        : Promise.resolve(null),
    ]);

    const [vocalEnv, instrEnv] = await Promise.all([
      vocalBuf ? computeRmsEnvelope(vocalBuf) : Promise.resolve([] as number[]),
      backBuf ? computeRmsEnvelope(backBuf) : Promise.resolve([] as number[]),
    ]);

    if (vocalEnv.length > 0 || instrEnv.length > 0) {
      lalalEnvelope.available = true;
      lalalEnvelope.vocals = vocalEnv;
      lalalEnvelope.instruments = instrEnv;
      lalalEnvelope.windowMs = ENVELOPE_WINDOW_MS;
      lalalEnvelope.durationMs = vocalEnv.length * ENVELOPE_WINDOW_MS;
    }
  } catch {
    /* envelope computation failed — stems.source stays lalal but envelope unavailable */
  }

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
