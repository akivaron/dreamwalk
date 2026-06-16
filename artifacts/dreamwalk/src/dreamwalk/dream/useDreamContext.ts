import { useCallback, useEffect, useRef, useState } from "react";
import type { DreamContext, DreamContextState, MoodData, StemData } from "./types";
import type { DreamSong } from "./types";
import { fetchLyrics } from "./api/lyrics";
import { generateNarration } from "./api/narration";
import { fetchConcerts } from "./api/concerts";
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
  concert: null,
  concertModeActive: false,
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

      // Heuristic mood as baseline
      const heuristicMood = inferMood(keywords, song.title, song.artist);

      setState((prev) => ({ ...prev, loadingStep: "Feeling the atmosphere..." }));

      // Cyanite mood analysis (parallel with narration + concerts + trending)
      const cyaniteMoodPromise = fetchMoodFromCyanite(
        song.artist,
        song.title,
        song.spotifyTrackId,
      ).catch(() => null);

      const narrationText = buildNarrationText(song, heuristicMood, keywords);
      const worldId = selectWorldId(keywords, heuristicMood);
      const worldOverrides = buildWorldOverrides(keywords, heuristicMood);

      const [narrationResult, concerts, trends, cyaniteMood] = await Promise.all([
        generateNarration(narrationText).catch(() => ({ text: narrationText, audioUrl: null })),
        fetchConcerts(song.artist).catch(() => [] as Awaited<ReturnType<typeof fetchConcerts>>),
        fetchItunesTrending().catch(() => [] as Awaited<ReturnType<typeof fetchItunesTrending>>),
        cyaniteMoodPromise,
      ]);

      if (ctrl.signal.aborted) return;

      // Merge: prefer Cyanite if available, else heuristic
      const mood: MoodData = cyaniteMood ?? heuristicMood;

      // If Cyanite gave us richer data, update worldId + overrides with it
      const finalWorldId = cyaniteMood ? selectWorldId(keywords, mood) : worldId;
      const finalWorldOverrides = cyaniteMood ? buildWorldOverrides(keywords, mood) : worldOverrides;

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

      const concert = concerts[0] ?? null;
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
        concert,
        concertModeActive: false,
        worldId: finalWorldId,
        worldOverrides: finalWorldOverrides,
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

  const toggleConcertMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      context: {
        ...prev.context,
        concertModeActive: !prev.context.concertModeActive,
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
    toggleConcertMode,
  };
}
