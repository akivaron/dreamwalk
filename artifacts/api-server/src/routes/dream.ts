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

  // Genre → mood heuristic used when Cyanite is unavailable
  const GENRE_MOOD: Record<string, { energy: number; valence: number; danceability: number; tempo: number; acousticness: number; instrumentalness: number }> = {
    "Rock": { energy: 0.78, valence: 0.46, danceability: 0.55, tempo: 120, acousticness: 0.12, instrumentalness: 0.08 },
    "Pop": { energy: 0.65, valence: 0.62, danceability: 0.72, tempo: 118, acousticness: 0.22, instrumentalness: 0.05 },
    "Hip-Hop/Rap": { energy: 0.72, valence: 0.54, danceability: 0.82, tempo: 92, acousticness: 0.15, instrumentalness: 0.04 },
    "Electronic": { energy: 0.84, valence: 0.56, danceability: 0.82, tempo: 128, acousticness: 0.05, instrumentalness: 0.38 },
    "Dance": { energy: 0.84, valence: 0.62, danceability: 0.87, tempo: 128, acousticness: 0.05, instrumentalness: 0.28 },
    "R&B/Soul": { energy: 0.52, valence: 0.56, danceability: 0.72, tempo: 88, acousticness: 0.35, instrumentalness: 0.04 },
    "Jazz": { energy: 0.38, valence: 0.62, danceability: 0.52, tempo: 98, acousticness: 0.75, instrumentalness: 0.52 },
    "Classical": { energy: 0.32, valence: 0.52, danceability: 0.25, tempo: 82, acousticness: 0.92, instrumentalness: 0.85 },
    "Country": { energy: 0.55, valence: 0.66, danceability: 0.62, tempo: 105, acousticness: 0.55, instrumentalness: 0.05 },
    "Metal": { energy: 0.94, valence: 0.30, danceability: 0.38, tempo: 142, acousticness: 0.04, instrumentalness: 0.12 },
    "Alternative": { energy: 0.62, valence: 0.48, danceability: 0.55, tempo: 118, acousticness: 0.22, instrumentalness: 0.12 },
    "Folk": { energy: 0.38, valence: 0.58, danceability: 0.42, tempo: 98, acousticness: 0.78, instrumentalness: 0.15 },
    "K-Pop": { energy: 0.74, valence: 0.66, danceability: 0.78, tempo: 122, acousticness: 0.12, instrumentalness: 0.08 },
    "Ambient": { energy: 0.22, valence: 0.48, danceability: 0.22, tempo: 72, acousticness: 0.82, instrumentalness: 0.78 },
    "Soundtrack": { energy: 0.45, valence: 0.50, danceability: 0.30, tempo: 90, acousticness: 0.65, instrumentalness: 0.70 },
  };

  const heuristicFromGenre = (genre: string) => {
    const key = Object.keys(GENRE_MOOD).find((k) => genre.includes(k)) ?? "Pop";
    return { ...(GENRE_MOOD[key] ?? GENRE_MOOD["Pop"]), source: "heuristic", genre };
  };

  try {
    // ── Try Cyanite first ──────────────────────────────────────────────────────
    const query = `
      query SearchTrack($term: String!) {
        spotifyTrackSearch(data: { term: $term, limit: 1 }) {
          ... on SpotifyTrackSearchResult {
            items {
              id
              name
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

    let cyaniteOk = false;
    try {
      const searchRes = await fetch("https://api.cyanite.ai/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cyaniteToken}`,
        },
        body: JSON.stringify({ query, variables: { term: `${artist} ${title}` } }),
        signal: AbortSignal.timeout(8000),
      });

      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
          data?: {
            spotifyTrackSearch?: {
              items?: Array<{
                id: string;
                name: string;
                audioFeatures?: {
                  energy?: number;
                  valence?: number;
                  danceability?: number;
                  tempo?: number;
                  acousticness?: number;
                  instrumentalness?: number;
                } | null;
              }>;
            };
          };
          errors?: Array<{ message: string }>;
        };

        if (!searchData.errors?.length) {
          const track = searchData.data?.spotifyTrackSearch?.items?.[0];
          const af = track?.audioFeatures;
          if (af && track) {
            cyaniteOk = true;
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
          }
        }
      }
    } catch {
      // Cyanite unavailable — fall through to heuristic
    }

    if (cyaniteOk) return;

    // ── iTunes genre-based heuristic fallback ─────────────────────────────────
    let genre = "Pop";
    try {
      const itunesRes = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}&limit=1&entity=song&country=us`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (itunesRes.ok) {
        const data = (await itunesRes.json()) as { results?: Array<{ primaryGenreName?: string }> };
        const g = data.results?.[0]?.primaryGenreName;
        if (g) genre = g;
      }
    } catch {
      // keep default genre
    }

    res.json({ trackId: null, trackName: `${artist} - ${title}`, ...heuristicFromGenre(genre) });
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

// ─── /api/song-wiki — Wikipedia song + artist summaries (free, no key) ─────────

router.get("/song-wiki", async (req: Request, res: Response) => {
  const artist = String(req.query["artist"] ?? "").trim();
  const title  = String(req.query["title"]  ?? "").trim();
  if (!artist || !title) { res.status(400).json({ error: "artist and title required" }); return; }

  const BASE = "https://en.wikipedia.org";

  async function wikiSummary(pageTitle: string) {
    try {
      const r = await fetch(`${BASE}/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
        { signal: AbortSignal.timeout(5000), headers: { Accept: "application/json" } });
      if (!r.ok) return null;
      const d = (await r.json()) as {
        extract?: string; description?: string;
        thumbnail?: { source: string };
        content_urls?: { desktop?: { page?: string } };
      };
      return {
        extract: d.extract ?? "",
        description: d.description ?? "",
        thumbnail: d.thumbnail?.source ?? null,
        url: d.content_urls?.desktop?.page ?? null,
      };
    } catch { return null; }
  }

  async function wikiSearch(query: string): Promise<string | null> {
    try {
      const r = await fetch(
        `${BASE}/w/api.php?` + new URLSearchParams({
          action: "query", list: "search",
          srsearch: query, format: "json", utf8: "1", srlimit: "3",
        }),
        { signal: AbortSignal.timeout(5000) },
      );
      if (!r.ok) return null;
      const d = (await r.json()) as { query?: { search?: Array<{ title: string }> } };
      return d.query?.search?.[0]?.title ?? null;
    } catch { return null; }
  }

  try {
    // For artist, try exact name first — if the top result title contains the artist name, use it.
    // Otherwise fall back to broader music query.
    async function findArtistPage(name: string): Promise<string | null> {
      const direct = await wikiSearch(name);
      if (direct && direct.toLowerCase().includes(name.toLowerCase().split(" ")[0])) return direct;
      return wikiSearch(`${name} musician singer rapper artist discography`);
    }

    const [songTitle, artistTitle] = await Promise.all([
      wikiSearch(`"${title}" ${artist} song single`),
      findArtistPage(artist),
    ]);

    const [songData, artistData] = await Promise.all([
      songTitle  ? wikiSummary(songTitle)  : Promise.resolve(null),
      artistTitle ? wikiSummary(artistTitle) : Promise.resolve(null),
    ]);

    res.json({
      songExtract:     songData?.extract   ? songData.extract.slice(0, 700)   : null,
      songDescription: songData?.description ?? null,
      songWikiTitle:   songTitle,
      songWikiUrl:     songData?.url ?? null,
      artistExtract:     artistData?.extract   ? artistData.extract.slice(0, 500)   : null,
      artistDescription: artistData?.description ?? null,
      artistThumbnail:   artistData?.thumbnail ?? null,
      artistWikiTitle:   artistTitle,
      artistWikiUrl:     artistData?.url ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `song-wiki failed: ${msg.slice(0, 200)}` });
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

// ─── /api/audio-proxy — stream iTunes preview with CORS + Range support ──────

const AUDIO_PROXY_ALLOWED = ["audio-ssl.itunes.apple.com", "audio.itunes.apple.com", "a1.mzstatic.com"];

router.options("/audio-proxy", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Range, Origin, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.status(204).send();
});

router.get("/audio-proxy", async (req: Request, res: Response) => {
  const raw = String(req.query.url ?? "").trim();
  if (!raw) { res.status(400).json({ error: "missing url" }); return; }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    res.status(400).json({ error: "invalid url" }); return;
  }

  if (!AUDIO_PROXY_ALLOWED.some((h) => url.hostname === h || url.hostname.endsWith("." + h))) {
    res.status(403).json({ error: "url not allowed" }); return;
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 DreamWalk/1.0",
    };
    const range = req.headers["range"];
    if (range) upstreamHeaders["Range"] = range;

    const upstream = await fetch(url.toString(), {
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(15000),
    });

    if ((!upstream.ok && upstream.status !== 206) || !upstream.body) {
      res.status(502).json({ error: `upstream ${upstream.status}` }); return;
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", upstream.headers.get("Content-Type") ?? "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");

    const cl = upstream.headers.get("Content-Length");
    if (cl) res.setHeader("Content-Length", cl);
    const cr = upstream.headers.get("Content-Range");
    if (cr) res.setHeader("Content-Range", cr);

    res.status(upstream.status);
    const { Readable } = await import("node:stream");
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!res.headersSent) res.status(502).json({ error: msg.slice(0, 200) });
  }
});

// ─── /api/artist-listeners — Bandsintown tracker + Songstats monthly listeners ─

router.get("/artist-listeners", async (req: Request, res: Response) => {
  const artist = String(req.query["artist"] ?? "").trim();
  if (!artist) { res.status(400).json({ error: "artist required" }); return; }

  const bandsintownId = process.env["BANDSINTOWN_APP_ID"];
  const songstatsKey  = process.env["SONGSTATS_KEY"];

  let trackerCount: number | null = null;
  let monthlyListeners: number | null = null;
  const sources: string[] = [];

  // Bandsintown: fans tracking this artist globally
  if (bandsintownId) {
    try {
      const btUrl =
        `https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}` +
        `?app_id=${encodeURIComponent(bandsintownId)}`;
      const btRes = await fetch(btUrl, { signal: AbortSignal.timeout(6000) });
      if (btRes.ok) {
        const btData = (await btRes.json()) as { tracker_count?: number };
        if (typeof btData.tracker_count === "number") {
          trackerCount = btData.tracker_count;
          sources.push("bandsintown");
        }
      }
    } catch { /* fall through */ }
  }

  // Songstats: Spotify monthly listeners via artist stats
  if (songstatsKey) {
    try {
      const ssUrl =
        `https://api.songstats.com/enterprise/v1/artists/stats?source=spotify` +
        `&artist_name=${encodeURIComponent(artist)}`;
      const ssRes = await fetch(ssUrl, {
        headers: { apikey: songstatsKey },
        signal: AbortSignal.timeout(6000),
      });
      if (ssRes.ok) {
        const ssData = (await ssRes.json()) as {
          stats?: { monthly_listeners?: number };
          data?: { stats?: { monthly_listeners?: number } };
        };
        const ml =
          ssData.stats?.monthly_listeners ??
          ssData.data?.stats?.monthly_listeners ??
          null;
        if (typeof ml === "number") {
          monthlyListeners = ml;
          sources.push("songstats");
        }
      }
    } catch { /* fall through */ }
  }

  res.json({ artist, trackerCount, monthlyListeners, sources });
});

// ─── /api/curated — hand-picked popular songs via iTunes lookup ───────────────

const CURATED_QUERIES = [
  { q: "Blinding Lights The Weeknd", world: "savana-valley" },
  { q: "As It Was Harry Styles", world: "savana-valley" },
  { q: "Golden Hour JVKE", world: "savana-valley" },
  { q: "Levitating Dua Lipa", world: "savana-valley" },
  { q: "Flowers Miley Cyrus", world: "savana-valley" },
];

router.get("/curated", async (_req: Request, res: Response) => {
  try {
    const results = await Promise.all(
      CURATED_QUERIES.map(async ({ q, world }) => {
        const r = await fetch(
          `https://itunes.apple.com/search?${new URLSearchParams({
            term: q,
            media: "music",
            entity: "song",
            limit: "1",
          })}`,
          { signal: AbortSignal.timeout(7000) },
        );
        if (!r.ok) return null;
        const data = (await r.json()) as { results?: ItunesSearchResult[] };
        const t = data.results?.[0];
        if (!t) return null;
        const artwork = (t.artworkUrl100 ?? "").replace("100x100", "300x300");
        return {
          id: String(t.trackId ?? q),
          title: t.trackName ?? q,
          artist: t.artistName ?? "",
          file: t.previewUrl ?? null,
          artworkUrl: artwork,
          suggestedWorld: world,
        };
      }),
    );
    const tracks = results.filter(Boolean);
    res.json({ tracks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `curated failed: ${msg.slice(0, 200)}` });
  }
});

export default router;
