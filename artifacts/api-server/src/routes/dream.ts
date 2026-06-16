import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

const router: IRouter = Router();

// ─── /api/trending — Songstats → Apple RSS fallback ─────────────────────────

router.get("/trending", async (_req: Request, res: Response) => {
  const songstatsKey = process.env["SONGSTATS_KEY"];

  if (songstatsKey) {
    try {
      const url = "https://api.songstats.com/enterprise/v1/charts/global?source=spotify&limit=15";
      const apiRes = await fetch(url, {
        headers: { apikey: songstatsKey },
        signal: AbortSignal.timeout(6000),
      });
      if (apiRes.ok) {
        const data = (await apiRes.json()) as {
          chart?: Array<{
            track_id: string;
            track_name: string;
            artist_name: string;
            cover_url?: string;
            streams?: number;
          }>;
        };
        if (data.chart?.length) {
          res.json({ source: "songstats", chart: data.chart });
          return;
        }
      }
    } catch {
      /* fall through */
    }
  }

  // Fallback: Apple RSS top songs
  try {
    const url = "https://rss.applemarketingtools.com/api/v2/us/music/most-played/15/songs.json";
    const apiRes = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!apiRes.ok) { res.json({ source: "apple", feed: { results: [] } }); return; }
    const data = (await apiRes.json()) as Record<string, unknown>;
    res.json({ source: "apple", ...data });
  } catch {
    res.json({ source: "apple", feed: { results: [] } });
  }
});

// ─── /api/lyrics — Musixmatch richsync → plain → lyrics.ovh ─────────────────

interface RichsyncLine {
  ts: number;
  te: number;
  x: string;
  l?: Array<{ c: string; o: number }>;
}

interface SyncedLine {
  time: number;
  text: string;
}

function parseRichsync(body: string): SyncedLine[] {
  try {
    const lines = JSON.parse(body) as RichsyncLine[];
    return lines
      .filter((l) => typeof l.x === "string" && l.x.trim().length > 0)
      .map((l) => ({ time: l.ts, text: l.x.trim() }));
  } catch {
    return [];
  }
}

async function musixmatchLyrics(
  artist: string,
  title: string,
  apiKey: string,
): Promise<{ lyrics: string; synced: SyncedLine[]; source: string } | null> {
  const BASE = "https://api.musixmatch.com/ws/1.1";

  const searchUrl =
    `${BASE}/track.search?` +
    new URLSearchParams({
      q_track: title,
      q_artist: artist,
      page_size: "1",
      page: "1",
      s_track_rating: "desc",
      apikey: apiKey,
    });

  const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(6000) });
  if (!searchRes.ok) return null;

  const searchData = (await searchRes.json()) as {
    message: {
      body: { track_list: Array<{ track: { track_id: number; has_richsync: number } }> };
    };
  };

  const trackEntry = searchData.message?.body?.track_list?.[0]?.track;
  if (!trackEntry?.track_id) return null;

  const trackId = trackEntry.track_id;

  if (trackEntry.has_richsync === 1) {
    try {
      const richsyncUrl =
        `${BASE}/track.richsync.get?` +
        new URLSearchParams({ track_id: String(trackId), apikey: apiKey });

      const richRes = await fetch(richsyncUrl, { signal: AbortSignal.timeout(6000) });
      if (richRes.ok) {
        const richData = (await richRes.json()) as {
          message: { body: { richsync: { richsync_body: string; richsync_id: number } } };
        };
        const richBody = richData.message?.body?.richsync?.richsync_body;
        if (richBody) {
          const synced = parseRichsync(richBody);
          if (synced.length > 0) {
            const lyrics = synced.map((l) => l.text).join("\n");
            return { lyrics, synced, source: "musixmatch-richsync" };
          }
        }
      }
    } catch {
      /* fall through to plain lyrics */
    }
  }

  try {
    const lyricsUrl =
      `${BASE}/track.lyrics.get?` +
      new URLSearchParams({ track_id: String(trackId), apikey: apiKey });

    const lyricsRes = await fetch(lyricsUrl, { signal: AbortSignal.timeout(6000) });
    if (lyricsRes.ok) {
      const lyricsData = (await lyricsRes.json()) as {
        message: { body: { lyrics: { lyrics_body: string } } };
      };
      const body = lyricsData.message?.body?.lyrics?.lyrics_body;
      if (body) {
        const cleaned = body
          .replace(/\*{7} This Lyrics is NOT for Commercial use \*{7}.*$/s, "")
          .trim();
        return { lyrics: cleaned, synced: [], source: "musixmatch" };
      }
    }
  } catch {
    /* fall through */
  }

  return null;
}

router.get("/lyrics", async (req: Request, res: Response) => {
  const artist = String(req.query.artist ?? "").trim();
  const title = String(req.query.title ?? "").trim();
  if (!artist || !title) {
    res.status(400).json({ error: "artist and title are required" });
    return;
  }

  const musixKey = process.env["MUSIXMATCH_KEY"];

  if (musixKey) {
    try {
      const result = await musixmatchLyrics(artist, title, musixKey);
      if (result) {
        res.json(result);
        return;
      }
    } catch {
      /* fall through to lyrics.ovh */
    }
  }

  try {
    const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const ovhRes = await fetch(ovhUrl, { signal: AbortSignal.timeout(6000) });
    if (ovhRes.ok) {
      const ovhData = (await ovhRes.json()) as { lyrics?: string; error?: string };
      if (ovhData.lyrics) {
        res.json({ lyrics: ovhData.lyrics, synced: [], source: "ovh" });
        return;
      }
    }
  } catch {
    /* no lyrics available */
  }

  res.json({ lyrics: null, synced: [], source: null });
});

// ─── /api/mood — Cyanite mood via spotifyTrackSearch + audioFeatures ─────────

router.post("/mood", async (req: Request, res: Response) => {
  const cyaniteToken = process.env["CYANITE_ACCESS_TOKEN"];
  if (!cyaniteToken) {
    res.status(503).json({ error: "mood analysis not configured" });
    return;
  }

  const { title, artist } = req.body as { title?: string; artist?: string };
  if (!(title && artist)) {
    res.status(400).json({ error: "title and artist required" });
    return;
  }

  try {
    const query = `
      query SearchTrack($term: String!) {
        spotifyTrackSearch(data: { term: $term, limit: 1 }) {
          ... on SpotifyTrackSearchResult {
            items {
              id
              name
              popularity
              audioFeatures {
                energy
                valence
                danceability
                tempo
                acousticness
                instrumentalness
              }
            }
          }
          ... on SpotifyTrackSearchError {
            message
          }
        }
      }
    `;

    const searchRes = await fetch("https://api.cyanite.ai/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cyaniteToken}`,
      },
      body: JSON.stringify({ query, variables: { term: `${artist} ${title}` } }),
      signal: AbortSignal.timeout(10000),
    });

    if (!searchRes.ok) {
      res.status(502).json({ error: "Cyanite API error" });
      return;
    }

    const searchData = (await searchRes.json()) as {
      data?: {
        spotifyTrackSearch?: {
          items?: Array<{
            id: string;
            name: string;
            popularity?: number;
            audioFeatures?: {
              energy?: number;
              valence?: number;
              danceability?: number;
              tempo?: number;
              acousticness?: number;
              instrumentalness?: number;
            } | null;
          }>;
          message?: string;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (searchData.errors?.length) {
      res.status(502).json({ error: searchData.errors[0]?.message ?? "Cyanite error" });
      return;
    }

    const track = searchData.data?.spotifyTrackSearch?.items?.[0];
    if (!track) {
      res.status(404).json({ error: "track not found in Cyanite" });
      return;
    }

    const af = track.audioFeatures;
    if (!af) {
      // audioFeatures not available on this plan — return null so frontend falls back to heuristic
      res.status(404).json({ error: "audioFeatures not available" });
      return;
    }

    res.json({
      trackId: track.id,
      trackName: track.name,
      energy: af.energy ?? null,
      valence: af.valence ?? null,
      danceability: af.danceability ?? null,
      tempo: af.tempo ?? null,
      acousticness: af.acousticness ?? null,
      instrumentalness: af.instrumentalness ?? null,
      source: "cyanite",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `mood analysis failed: ${msg.slice(0, 200)}` });
  }
});

// ─── /api/search — Musixmatch track search (enriched with iTunes for media) ──

interface MusixmatchTrackEntry {
  track: {
    track_id: number;
    track_name: string;
    artist_name: string;
    album_name: string;
    primary_genres?: {
      music_genre_list?: Array<{
        music_genre?: { music_genre_name?: string };
      }>;
    };
  };
}

interface ItunesSearchResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  primaryGenreName?: string;
}

router.get("/search", async (req: Request, res: Response) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) { res.json({ results: [] }); return; }

  const musixKey = process.env["MUSIXMATCH_KEY"];

  let tracks: Array<{
    id: string;
    title: string;
    artist: string;
    album: string;
    genre: string;
    source: string;
  }> = [];

  if (musixKey) {
    try {
      const mmUrl =
        `https://api.musixmatch.com/ws/1.1/track.search?` +
        new URLSearchParams({
          q_track: q,
          page_size: "8",
          page: "1",
          s_track_rating: "desc",
          apikey: musixKey,
        });

      const mmRes = await fetch(mmUrl, { signal: AbortSignal.timeout(6000) });
      if (mmRes.ok) {
        const mmData = (await mmRes.json()) as {
          message?: { body?: { track_list?: MusixmatchTrackEntry[] } };
        };
        const list = mmData.message?.body?.track_list ?? [];
        tracks = list.map(({ track }) => ({
          id: String(track.track_id),
          title: track.track_name,
          artist: track.artist_name,
          album: track.album_name ?? "",
          genre:
            track.primary_genres?.music_genre_list?.[0]?.music_genre
              ?.music_genre_name ?? "Unknown",
          source: "musixmatch",
        }));
      }
    } catch {
      /* fall through to iTunes */
    }
  }

  // If Musixmatch returned nothing, fall back to iTunes search
  if (tracks.length === 0) {
    try {
      const itunesRes = await fetch(
        `https://itunes.apple.com/search?${new URLSearchParams({
          term: q,
          media: "music",
          entity: "song",
          limit: "8",
        })}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (itunesRes.ok) {
        const itunesData = (await itunesRes.json()) as { results?: ItunesSearchResult[] };
        tracks = (itunesData.results ?? []).map((t) => ({
          id: String(t.trackId ?? Math.random()),
          title: t.trackName ?? "",
          artist: t.artistName ?? "",
          album: t.collectionName ?? "",
          genre: t.primaryGenreName ?? "Unknown",
          source: "itunes",
        }));
      }
    } catch {
      /* no results */
    }
  }

  // Enrich each Musixmatch track with iTunes media (artwork + preview URL)
  const enriched = await Promise.all(
    tracks.map(async (track) => {
      if (track.source === "itunes") {
        // Already have minimal data; do a full lookup for media
        try {
          const r = await fetch(
            `https://itunes.apple.com/search?${new URLSearchParams({
              term: `${track.artist} ${track.title}`,
              media: "music",
              entity: "song",
              limit: "1",
            })}`,
            { signal: AbortSignal.timeout(5000) },
          );
          if (r.ok) {
            const d = (await r.json()) as { results?: ItunesSearchResult[] };
            const it = d.results?.[0];
            if (it) {
              return {
                ...track,
                artworkUrl: it.artworkUrl100?.replace("100x100bb", "400x400bb") ?? null,
                previewUrl: it.previewUrl ?? null,
              };
            }
          }
        } catch { /* keep without media */ }
        return { ...track, artworkUrl: null as null, previewUrl: null as null };
      }

      // Musixmatch track: enrich via iTunes
      try {
        const r = await fetch(
          `https://itunes.apple.com/search?${new URLSearchParams({
            term: `${track.artist} ${track.title}`,
            media: "music",
            entity: "song",
            limit: "1",
          })}`,
          { signal: AbortSignal.timeout(5000) },
        );
        if (r.ok) {
          const d = (await r.json()) as { results?: ItunesSearchResult[] };
          const it = d.results?.[0];
          return {
            ...track,
            artworkUrl: it?.artworkUrl100?.replace("100x100bb", "400x400bb") ?? null,
            previewUrl: it?.previewUrl ?? null,
          };
        }
      } catch { /* keep without media */ }
      return { ...track, artworkUrl: null as null, previewUrl: null as null };
    }),
  );

  res.json({ results: enriched });
});

// ─── /api/stems — LALAL.AI stem separation ──────────────────────────────────

router.post("/stems", async (req: Request, res: Response) => {
  const lalalKey = process.env["LALAL_KEY"];
  if (!lalalKey) {
    res.status(503).json({ error: "stem separation not configured" });
    return;
  }

  const { audioUrl } = req.body as { audioUrl?: string };
  if (!audioUrl) {
    res.status(400).json({ error: "audioUrl required" });
    return;
  }

  try {
    const uploadRes = await fetch("https://www.lalal.ai/api/upload/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `license ${lalalKey}`,
      },
      body: JSON.stringify({ url: audioUrl }),
      signal: AbortSignal.timeout(15000),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      res.status(502).json({ error: `LALAL upload failed: ${err.slice(0, 200)}` });
      return;
    }

    const uploadData = (await uploadRes.json()) as { id?: string; error?: string };
    if (!uploadData.id) {
      res.status(502).json({ error: uploadData.error ?? "no file id returned" });
      return;
    }

    const fileId = uploadData.id;

    const sepRes = await fetch("https://www.lalal.ai/api/separate/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `license ${lalalKey}`,
      },
      body: JSON.stringify({ id: fileId, stem: "vocals", splitter: "phoenix" }),
      signal: AbortSignal.timeout(10000),
    });

    if (!sepRes.ok) {
      res.status(502).json({ error: "LALAL separate request failed" });
      return;
    }

    res.json({ fileId, status: "processing", source: "lalal" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `stem separation failed: ${msg.slice(0, 200)}` });
  }
});

router.get("/stems/:fileId", async (req: Request, res: Response) => {
  const lalalKey = process.env["LALAL_KEY"];
  if (!lalalKey) {
    res.status(503).json({ error: "stem separation not configured" });
    return;
  }

  const { fileId } = req.params;
  try {
    const checkRes = await fetch(`https://www.lalal.ai/api/check/?id=${fileId}`, {
      headers: { Authorization: `license ${lalalKey}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!checkRes.ok) {
      res.status(502).json({ error: "LALAL check failed" });
      return;
    }

    const data = (await checkRes.json()) as {
      status?: string;
      stem?: { vocals?: { stem?: string; back?: string } };
    };

    res.json({ ...data, source: "lalal" });
  } catch {
    res.status(500).json({ error: "stem check failed" });
  }
});

// ─── /api/narrate — ElevenLabs TTS ──────────────────────────────────────────

router.post("/narrate", async (req: Request, res: Response) => {
  const elevenKey = process.env["ELEVEN_KEY"];
  if (!elevenKey) {
    res.status(503).json({ error: "narration not configured" });
    return;
  }

  const text = String(req.body?.text ?? "").trim().slice(0, 300);
  const voiceId = String(req.body?.voice ?? "21m00Tcm4TlvDq8ikWAM");
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  try {
    const apiRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );

    if (!apiRes.ok) {
      const err = await apiRes.text();
      res.status(502).json({ error: `ElevenLabs error: ${err.slice(0, 200)}` });
      return;
    }

    const audioBuffer = await apiRes.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `narration failed: ${msg.slice(0, 200)}` });
  }
});

// ─── /api/track-details — Musixmatch track + artist metadata ─────────────────

router.get("/track-details", async (req: Request, res: Response) => {
  const artist = String(req.query["artist"] ?? "").trim();
  const title = String(req.query["title"] ?? "").trim();
  const mxKey = process.env["MUSIXMATCH_KEY"];

  if (!artist || !title) { res.status(400).json({ error: "artist and title required" }); return; }
  if (!mxKey) { res.status(503).json({ error: "Musixmatch not configured" }); return; }

  try {
    const BASE = "https://api.musixmatch.com/ws/1.1";

    const searchUrl = `${BASE}/track.search?` + new URLSearchParams({
      q_track: title, q_artist: artist, page_size: "1",
      s_track_rating: "desc", apikey: mxKey,
    });

    const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(7000) });
    if (!searchRes.ok) { res.status(502).json({ error: "mx search failed" }); return; }

    const searchData = (await searchRes.json()) as {
      message: {
        header: { status_code: number };
        body: {
          track_list: Array<{
            track: {
              track_id: number; artist_id: number;
              track_rating: number; track_length: number;
              explicit: number; num_favourite: number;
              primary_genres?: { music_genre_list: Array<{ music_genre: { music_genre_name: string } }> };
            };
          }>;
        };
      };
    };

    const track = searchData.message?.body?.track_list?.[0]?.track;
    if (!track) { res.status(404).json({ error: "track not found" }); return; }

    let artistCountry: string | null = null;
    let artistGenres: string[] = [];

    try {
      const artistRes = await fetch(
        `${BASE}/artist.get?` + new URLSearchParams({ artist_id: String(track.artist_id), apikey: mxKey }),
        { signal: AbortSignal.timeout(6000) },
      );
      if (artistRes.ok) {
        const artistData = (await artistRes.json()) as {
          message: {
            body: {
              artist: {
                artist_country: string;
                primary_genres?: { music_genre_list: Array<{ music_genre: { music_genre_name: string } }> };
              };
            };
          };
        };
        const a = artistData.message?.body?.artist;
        if (a) {
          artistCountry = a.artist_country || null;
          artistGenres = a.primary_genres?.music_genre_list?.map((g) => g.music_genre.music_genre_name).filter(Boolean) ?? [];
        }
      }
    } catch { /* artist optional */ }

    const trackGenres = track.primary_genres?.music_genre_list?.map((g) => g.music_genre.music_genre_name).filter(Boolean) ?? [];

    res.json({
      trackRating: track.track_rating ?? null,
      trackLength: track.track_length ?? null,
      explicit: track.explicit === 1,
      numFavourite: track.num_favourite ?? null,
      genres: trackGenres,
      artistCountry: artistCountry,
      artistGenres: artistGenres,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `track-details failed: ${msg.slice(0, 200)}` });
  }
});

export default router;
