import { useCallback, useEffect, useRef, useState } from "react";
import type { DreamContext, DreamContextState, MoodData, StemData } from "./types";
import type { DreamSong } from "./types";
import { fetchLyrics } from "./api/lyrics";
import { generateNarration } from "./api/narration";
import { fetchMoodFromCyanite } from "./api/mood";
import { getFFTStemData } from "./api/stems";
import { fetchItunesTrending, getSessionTrending, recordPlay } from "./trendingStore";
import {
  extractKeywords,
  inferMood,
  selectWorldId,
  buildWorldOverrides,
  buildNarrationText,
  detectImportantLines,
} from "./keywordAnalysis";

const DEFAULT_MOOD: MoodData = {
  primary: "hopeful",
  secondary: null,
  energy: 0.5,
  valence: 0.6,
};

const DEFAULT_STEMS: StemData = {
  drums: 0,
  bass: 0,
  vocals: 0,
  instruments: 0,
  source: "fft",
};

const DEFAULT_CONTEXT: DreamContext = {
  song: null,
  lyrics: null,
  keywords: [],
  themes: [],
  importantLines: [],
  mood: DEFAULT_MOOD,
  emotions: [],
  energy: 0.5,
  valence: 0.6,
  genre: "",
  stems: DEFAULT_STEMS,
  narrationText: null,
  narrationEnabled: true,
  narrationAudioUrl: null,
  trends: [],
  worldId: "savana-valley",
  worldOverrides: {},
};

export function useDreamContext() {
  const [state, setState] = useState<DreamContextState>({
    context: DEFAULT_CONTEXT,
    loading: false,
    loadingStep: "",
    error: null,
    ready: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async () => {
      const trends = await fetchItunesTrending();
      const session = getSessionTrending();
      const merged = [
        ...session,
        ...trends.filter((t) => !session.some((s) => s.id === t.id)),
      ].slice(0, 12);
      setState((prev) => ({
        ...prev,
        context: { ...prev.context, trends: merged },
      }));
    })();
  }, []);

  const buildForSong = useCallback(async (song: DreamSong) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState((prev) => ({
      ...prev,
      loading: true,
      loadingStep: "Tuning into the signal...",
      error: null,
      ready: false,
      context: {
        ...DEFAULT_CONTEXT,
        song,
        trends: prev.context.trends,
      },
    }));

    try {
      setState((prev) => ({ ...prev, loadingStep: "Reading the words..." }));
      const lyrics = ctrl.signal.aborted
        ? null
        : await fetchLyrics(song.artist, song.title).catch(() => null);

      if (ctrl.signal.aborted) return;

      const keywords = lyrics ? extractKeywords(lyrics.raw) : [];
      const themes = keywords.slice(0, 6);
      const importantLines = lyrics ? detectImportantLines(lyrics.lines) : [];
      const heuristicMood = inferMood(keywords, song.title, song.artist);

      setState((prev) => ({ ...prev, loadingStep: "Feeling the atmosphere..." }));

      const narrationText = buildNarrationText(song, heuristicMood, keywords);

      const [narrationResult, trends, cyaniteMood] = await Promise.all([
        generateNarration(narrationText).catch(() => ({ text: narrationText, audioUrl: null })),
        fetchItunesTrending().catch(() => [] as Awaited<ReturnType<typeof fetchItunesTrending>>),
        fetchMoodFromCyanite(song.artist, song.title, song.spotifyTrackId).catch(() => null),
      ]);

      if (ctrl.signal.aborted) return;

      const mood: MoodData = cyaniteMood ?? heuristicMood;
      const worldId = selectWorldId(keywords, mood);
      const worldOverrides = buildWorldOverrides(keywords, mood);

      const session = getSessionTrending();
      const trendsMerged = [
        ...session,
        ...trends.filter((t) => !session.some((s) => s.id === t.id)),
      ].slice(0, 12);

      recordPlay({
        id: song.id,
        title: song.title,
        artist: song.artist,
        artworkUrl: song.artworkUrl,
      });

      const stems: StemData = getFFTStemData();

      const context: DreamContext = {
        song,
        lyrics,
        keywords,
        themes,
        importantLines,
        mood,
        emotions: mood.moodTags ?? [],
        energy: mood.energy,
        valence: mood.valence,
        genre: (mood.genreTags ?? [song.genre]).filter(Boolean)[0] ?? "",
        stems,
        narrationText,
        narrationEnabled: true,
        narrationAudioUrl: narrationResult.audioUrl,
        trends: trendsMerged,
        worldId,
        worldOverrides,
      };

      setState({ context, loading: false, loadingStep: "", error: null, ready: true });
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        loadingStep: "",
        error: err instanceof Error ? err.message : "Something went wrong",
        ready: false,
      }));
    }
  }, []);

  const buildForCuratedTrack = useCallback(
    (trackId: string, title: string, artist: string, worldId: string) => {
      abortRef.current?.abort();
      const session = getSessionTrending();
      setState((prev) => ({
        context: {
          ...DEFAULT_CONTEXT,
          trends: prev.context.trends.length > 0 ? prev.context.trends : session,
          worldId,
          song: {
            id: trackId,
            title,
            artist,
            album: "",
            artworkUrl: "",
            previewUrl: null,
            genre: "Ambient",
            source: "curated",
          },
        },
        loading: false,
        loadingStep: "",
        error: null,
        ready: true,
      }));
    },
    [],
  );

  const toggleNarration = useCallback(() => {
    setState((prev) => ({
      ...prev,
      context: {
        ...prev.context,
        narrationEnabled: !prev.context.narrationEnabled,
      },
    }));
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    ...state,
    buildForSong,
    buildForCuratedTrack,
    toggleNarration,
  };
}
