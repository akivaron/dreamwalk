import type { LyricsData, SyncedLyricLine } from "../types";
import { detectImportantLines } from "../keywordAnalysis";

const API_BASE = import.meta.env.BASE_URL;

// ─── LRC / LRCLIB ────────────────────────────────────────────────────────────

interface LRCLIBResponse {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

function parseLRC(lrc: string): Array<{ time: number; text: string }> {
  const out: Array<{ time: number; text: string }> = [];
  const regex = /^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]\s*(.*)/;
  for (const line of lrc.split("\n")) {
    const m = regex.exec(line.trim());
    if (!m) continue;
    const time = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    const text = m[3].trim();
    if (text) out.push({ time, text });
  }
  return out;
}

async function fetchLRCLIB(
  artist: string,
  title: string,
): Promise<{ raw: string; timed: Array<{ time: number; text: string }> } | null> {
  try {
    const params = new URLSearchParams({ artist_name: artist, track_name: title });
    const res = await fetch(`https://lrclib.net/api/get?${params}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LRCLIBResponse;
    if (data.syncedLyrics) {
      const timed = parseLRC(data.syncedLyrics);
      const raw = data.plainLyrics ?? timed.map((l) => l.text).join("\n");
      return { raw, timed };
    }
    if (data.plainLyrics) return { raw: data.plainLyrics, timed: [] };
    return null;
  } catch {
    return null;
  }
}

// ─── Proxy (Musixmatch richsync → plain → lyrics.ovh) ───────────────────────

interface ProxyResponse {
  lyrics: string | null;
  synced: Array<{ time: number; text: string }>;
  source: string | null;
}

async function fetchFromProxy(artist: string, title: string): Promise<ProxyResponse | null> {
  try {
    const url = `${API_BASE}api/lyrics?${new URLSearchParams({ artist, title })}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as ProxyResponse;
    if (!data.lyrics && !data.synced?.length) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── lyrics.ovh browser-direct fallback ──────────────────────────────────────

async function fetchOvh(artist: string, title: string): Promise<string | null> {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { lyrics?: string };
    return data.lyrics ?? null;
  } catch {
    return null;
  }
}

// ─── Section parsing & classification ────────────────────────────────────────

function parseSections(lines: string[]): LyricsData["sections"] {
  const sections: LyricsData["sections"] = { verse: [], chorus: [], bridge: [], outro: [] };
  let current: keyof typeof sections = "verse";
  const tagRe = /\[(verse|chorus|bridge|outro|hook|pre-chorus|refrain|coda)[^\]]*\]/i;
  for (const line of lines) {
    const m = tagRe.exec(line);
    if (m) {
      const tag = m[1].toLowerCase();
      current =
        tag === "chorus" || tag === "hook" || tag === "refrain"
          ? "chorus"
          : tag === "bridge"
          ? "bridge"
          : tag === "outro" || tag === "coda"
          ? "outro"
          : "verse";
      continue;
    }
    if (line.trim()) sections[current].push(line.trim());
  }
  return sections;
}

function classifyLines(
  timed: Array<{ time: number; text: string }>,
  sections: LyricsData["sections"],
): SyncedLyricLine[] {
  const chorusSet = new Set(sections.chorus.map((l) => l.toLowerCase().trim()));
  const bridgeSet = new Set(sections.bridge.map((l) => l.toLowerCase().trim()));
  const outroSet = new Set(sections.outro.map((l) => l.toLowerCase().trim()));
  const emotionalSet = new Set(
    detectImportantLines(timed.map((l) => l.text)).map((l) => l.toLowerCase().trim()),
  );
  return timed.map((l) => {
    const low = l.text.toLowerCase().trim();
    const type: SyncedLyricLine["type"] = chorusSet.has(low)
      ? "chorus"
      : bridgeSet.has(low)
      ? "bridge"
      : outroSet.has(low)
      ? "outro"
      : "verse";
    return { time: l.time, text: l.text, type, isEmotional: emotionalSet.has(low) };
  });
}

function heuristicSync(lines: string[], sections: LyricsData["sections"]): SyncedLyricLine[] {
  const chorusSet = new Set(sections.chorus.map((l) => l.toLowerCase()));
  const bridgeSet = new Set(sections.bridge.map((l) => l.toLowerCase()));
  const outroSet = new Set(sections.outro.map((l) => l.toLowerCase()));
  const emotionalSet = new Set(detectImportantLines(lines).map((l) => l.toLowerCase()));
  const content = lines.filter((l) => l.trim() && !/^\[/.test(l.trim()));
  const interval = content.length > 0 ? 210 / content.length : 4;
  return content.map((text, i) => {
    const low = text.trim().toLowerCase();
    const type: SyncedLyricLine["type"] = chorusSet.has(low)
      ? "chorus"
      : bridgeSet.has(low)
      ? "bridge"
      : outroSet.has(low)
      ? "outro"
      : "verse";
    return { time: i * interval, text: text.trim(), type, isEmotional: emotionalSet.has(low) };
  });
}

function buildFromRaw(raw: string): LyricsData {
  const lines = raw.split("\n").map((l) => l.replace(/\r$/, ""));
  const sections = parseSections(lines);
  const synced = heuristicSync(lines, sections);
  return { raw, lines, sections, synced };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchLyrics(artist: string, title: string): Promise<LyricsData | null> {
  // 1. Try the api-server proxy (Musixmatch richsync has the best timestamps)
  const proxy = await fetchFromProxy(artist, title);

  if (proxy) {
    const raw = proxy.lyrics ?? proxy.synced.map((l) => l.text).join("\n");
    const lines = raw.split("\n").map((l) => l.replace(/\r$/, ""));
    const sections = parseSections(lines);

    if (proxy.synced.length > 0) {
      // Musixmatch richsync: real word-level timestamps — classify and return
      const synced = classifyLines(proxy.synced, sections);
      return { raw, lines, sections, synced };
    }

    // Proxy has plain lyrics (no timestamps) — try LRCLIB for timestamps
    const lrclib = await fetchLRCLIB(artist, title);
    if (lrclib?.timed.length) {
      const synced = classifyLines(lrclib.timed, sections);
      return { raw, lines, sections, synced };
    }

    // Fallback: heuristic sync on the plain text
    const synced = heuristicSync(lines, sections);
    return { raw, lines, sections, synced };
  }

  // 2. Proxy unavailable — try LRCLIB directly from browser
  const lrclib = await fetchLRCLIB(artist, title);
  if (lrclib) {
    const lines = lrclib.raw.split("\n").map((l) => l.replace(/\r$/, ""));
    const sections = parseSections(lines);
    const synced = lrclib.timed.length
      ? classifyLines(lrclib.timed, sections)
      : heuristicSync(lines, sections);
    return { raw: lrclib.raw, lines, sections, synced };
  }

  // 3. Last resort — lyrics.ovh direct
  const ovh = await fetchOvh(artist, title);
  if (ovh) return buildFromRaw(ovh);

  return null;
}
