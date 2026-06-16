import type { LyricsData, SyncedLyricLine } from "../types";
import { detectImportantLines } from "../keywordAnalysis";

const API_BASE = import.meta.env.BASE_URL;

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

function buildSyncedLines(lines: string[], sections: LyricsData["sections"]): SyncedLyricLine[] {
  const chorusSet = new Set(sections.chorus.map((l) => l.toLowerCase()));
  const bridgeSet = new Set(sections.bridge.map((l) => l.toLowerCase()));
  const outroSet = new Set(sections.outro.map((l) => l.toLowerCase()));
  const emotional = detectImportantLines(lines);
  const emotionalSet = new Set(emotional.map((l) => l.toLowerCase()));

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

    return {
      time: i * interval,
      text: text.trim(),
      type,
      isEmotional: emotionalSet.has(low),
    };
  });
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
  let raw = await fetchFromProxy(artist, title);
  if (!raw) raw = await fetchFromOvh(artist, title);
  if (!raw) return null;

  const lines = raw.split("\n").map((l) => l.replace(/\r$/, ""));
  const sections = parseSections(lines);
  const synced = buildSyncedLines(lines, sections);
  const importantLines = detectImportantLines(lines);

  return { raw, lines, sections, synced };
}
