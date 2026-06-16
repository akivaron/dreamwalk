import type { LyricsData, SyncedLyricLine } from "../types";
import { detectImportantLines } from "../keywordAnalysis";

const API_BASE = import.meta.env.BASE_URL;

interface LRCLIBResponse {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

function parseLRC(lrc: string): SyncedLyricLine[] {
  const lines: SyncedLyricLine[] = [];
  const regex = /^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]\s*(.*)/;
  for (const line of lrc.split("\n")) {
    const m = regex.exec(line.trim());
    if (!m) continue;
    const time = parseInt(m[1], 10) * 60 + parseFloat(m[2]);
    const text = m[3].trim();
    if (!text) continue;
    lines.push({ time, text, type: "verse", isEmotional: false });
  }
  return lines;
}

function classifySyncedLines(
  synced: SyncedLyricLine[],
  sections: LyricsData["sections"],
): SyncedLyricLine[] {
  const chorusSet = new Set(sections.chorus.map((l) => l.toLowerCase().trim()));
  const bridgeSet = new Set(sections.bridge.map((l) => l.toLowerCase().trim()));
  const outroSet = new Set(sections.outro.map((l) => l.toLowerCase().trim()));
  const allLines = synced.map((l) => l.text);
  const emotional = new Set(detectImportantLines(allLines).map((l) => l.toLowerCase().trim()));

  return synced.map((line) => {
    const low = line.text.toLowerCase().trim();
    const type: SyncedLyricLine["type"] = chorusSet.has(low)
      ? "chorus"
      : bridgeSet.has(low)
      ? "bridge"
      : outroSet.has(low)
      ? "outro"
      : "verse";
    return { ...line, type, isEmotional: emotional.has(low) };
  });
}

function parseSections(lines: string[]): LyricsData["sections"] {
  const sections: LyricsData["sections"] = { verse: [], chorus: [], bridge: [], outro: [] };
  let current: keyof typeof sections = "verse";
  const indicators = /\[(verse|chorus|bridge|outro|hook|pre-chorus|refrain|coda)[^\]]*\]/i;
  for (const line of lines) {
    const m = indicators.exec(line);
    if (m) {
      const tag = m[1].toLowerCase();
      if (tag === "chorus" || tag === "hook" || tag === "refrain") current = "chorus";
      else if (tag === "bridge") current = "bridge";
      else if (tag === "outro" || tag === "coda") current = "outro";
      else current = "verse";
      continue;
    }
    if (line.trim()) sections[current].push(line.trim());
  }
  return sections;
}

function buildHeuristicSyncedLines(lines: string[], sections: LyricsData["sections"]): SyncedLyricLine[] {
  const chorusSet = new Set(sections.chorus.map((l) => l.toLowerCase()));
  const bridgeSet = new Set(sections.bridge.map((l) => l.toLowerCase()));
  const outroSet = new Set(sections.outro.map((l) => l.toLowerCase()));
  const emotional = new Set(detectImportantLines(lines).map((l) => l.toLowerCase()));
  const contentLines = lines.filter((l) => l.trim() && !/^\[/.test(l.trim()));
  const estDuration = 210;
  const interval = contentLines.length > 0 ? estDuration / contentLines.length : 4;
  return contentLines.map((text, i) => {
    const low = text.trim().toLowerCase();
    const type: SyncedLyricLine["type"] = chorusSet.has(low)
      ? "chorus"
      : bridgeSet.has(low)
      ? "bridge"
      : outroSet.has(low)
      ? "outro"
      : "verse";
    return { time: i * interval, text: text.trim(), type, isEmotional: emotional.has(low) };
  });
}

async function fetchFromLRCLIB(
  artist: string,
  title: string,
): Promise<{ raw: string; synced: SyncedLyricLine[] } | null> {
  try {
    const params = new URLSearchParams({ artist_name: artist, track_name: title });
    const url = `https://lrclib.net/api/get?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as LRCLIBResponse;
    if (data.syncedLyrics) {
      const rawSynced = parseLRC(data.syncedLyrics);
      const raw = data.plainLyrics ?? rawSynced.map((l) => l.text).join("\n");
      return { raw, synced: rawSynced };
    }
    if (data.plainLyrics) {
      return { raw: data.plainLyrics, synced: [] };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchFromProxy(artist: string, title: string): Promise<string | null> {
  try {
    const url = `${API_BASE}api/lyrics?${new URLSearchParams({ artist, title })}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { lyrics?: string };
    return data.lyrics ?? null;
  } catch {
    return null;
  }
}

async function fetchFromOvh(artist: string, title: string): Promise<string | null> {
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

export async function fetchLyrics(artist: string, title: string): Promise<LyricsData | null> {
  const lrclib = await fetchFromLRCLIB(artist, title);

  if (lrclib) {
    const lines = lrclib.raw.split("\n").map((l) => l.replace(/\r$/, ""));
    const sections = parseSections(lines);

    let synced: SyncedLyricLine[];
    if (lrclib.synced.length > 0) {
      synced = classifySyncedLines(lrclib.synced, sections);
    } else {
      synced = buildHeuristicSyncedLines(lines, sections);
    }

    return { raw: lrclib.raw, lines, sections, synced };
  }

  let raw = await fetchFromProxy(artist, title);
  if (!raw) raw = await fetchFromOvh(artist, title);
  if (!raw) return null;

  const lines = raw.split("\n").map((l) => l.replace(/\r$/, ""));
  const sections = parseSections(lines);
  const synced = buildHeuristicSyncedLines(lines, sections);

  return { raw, lines, sections, synced };
}
