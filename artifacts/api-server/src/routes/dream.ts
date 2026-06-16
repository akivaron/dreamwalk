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

// ─── /api/mood — Cyanite mood analysis ──────────────────────────────────────

router.post("/mood", async (req: Request, res: Response) => {
  const cyaniteToken = process.env["CYANITE_ACCESS_TOKEN"];
  if (!cyaniteToken) {
    res.status(503).json({ error: "mood analysis not configured" });
    return;
  }

  const { spotifyTrackId, title, artist } = req.body as {
    spotifyTrackId?: string;
    title?: string;
    artist?: string;
  };

  if (!spotifyTrackId && !(title && artist)) {
    res.status(400).json({ error: "spotifyTrackId or title+artist required" });
    return;
  }

  try {
    // Cyanite GraphQL API
    // Step 1: search for track if no Spotify ID provided
    let trackId: string | null = spotifyTrackId ?? null;

    if (!trackId && title && artist) {
      const searchQuery = `
        query {
          spotifyTrackSearch(query: "${artist} ${title}", first: 1) {
            ... on SpotifyTrackSearchSuccess {
              tracks { id }
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
        body: JSON.stringify({ query: searchQuery }),
        signal: AbortSignal.timeout(8000),
      });
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
          data?: {
            spotifyTrackSearch?: { tracks?: Array<{ id: string }> };
          };
        };
        trackId = searchData.data?.spotifyTrackSearch?.tracks?.[0]?.id ?? null;
      }
    }

    if (!trackId) {
      res.status(404).json({ error: "track not found in Cyanite" });
      return;
    }

    // Step 2: fetch mood + audio analysis
    const analysisQuery = `
      query {
        spotifyTrack(id: "${trackId}") {
          ... on SpotifyTrack {
            id
            title
            audioAnalysisV6 {
              ... on AudioAnalysisV6Finished {
                result {
                  genreTags
                  moodTags
                  valence
                  arousal
                  energyLevel
                  primaryMood { name value }
                  secondaryMoods { name value }
                }
              }
            }
          }
        }
      }
    `;
    const analysisRes = await fetch("https://api.cyanite.ai/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cyaniteToken}`,
      },
      body: JSON.stringify({ query: analysisQuery }),
      signal: AbortSignal.timeout(10000),
    });

    if (!analysisRes.ok) {
      res.status(502).json({ error: "Cyanite API error" });
      return;
    }

    const analysisData = (await analysisRes.json()) as {
      data?: {
        spotifyTrack?: {
          audioAnalysisV6?: {
            result?: {
              genreTags?: string[];
              moodTags?: string[];
              valence?: number;
              arousal?: number;
              energyLevel?: string;
              primaryMood?: { name: string; value: number };
              secondaryMoods?: Array<{ name: string; value: number }>;
            };
          };
        };
      };
    };

    const result = analysisData.data?.spotifyTrack?.audioAnalysisV6?.result;
    if (!result) {
      res.status(404).json({ error: "no analysis available yet" });
      return;
    }

    const energyMap: Record<string, number> = {
      low: 0.2, medium: 0.5, high: 0.75, very_high: 0.95,
    };

    res.json({
      primaryMood: result.primaryMood?.name ?? null,
      secondaryMoods: result.secondaryMoods?.map((m) => m.name) ?? [],
      moodTags: result.moodTags ?? [],
      genreTags: result.genreTags ?? [],
      valence: result.valence ?? null,
      arousal: result.arousal ?? null,
      energy: energyMap[result.energyLevel ?? ""] ?? null,
      source: "cyanite",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `mood analysis failed: ${msg.slice(0, 200)}` });
  }
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
    // LALAL.AI v2 upload + separate
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

    // Trigger separation (stems: vocals, drums, bass, other)
    const sepRes = await fetch("https://www.lalal.ai/api/separate/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `license ${lalalKey}`,
      },
      body: JSON.stringify({
        id: fileId,
        stem: "vocals",
        splitter: "phoenix",
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!sepRes.ok) {
      res.status(502).json({ error: "LALAL separate request failed" });
      return;
    }

    // Return file ID for polling
    res.json({ fileId, status: "processing", source: "lalal" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `stem separation failed: ${msg.slice(0, 200)}` });
  }
});

// Poll for completed stem separation
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
      stem?: {
        vocals?: { stem?: string; back?: string };
        drums?: { stem?: string };
        bass?: { stem?: string };
        other?: { stem?: string };
      };
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

// ─── /api/concerts — Bandsintown ────────────────────────────────────────────

router.get("/concerts", async (req: Request, res: Response) => {
  const artist = String(req.query.artist ?? "").trim();
  if (!artist) {
    res.json({ concerts: [] });
    return;
  }

  const appId = process.env["BANDSINTOWN_APP_ID"];
  if (!appId) {
    res.json({ concerts: [] });
    return;
  }

  try {
    const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}/events?app_id=${encodeURIComponent(appId)}&date=upcoming`;
    const apiRes = await fetch(url, { signal: AbortSignal.timeout(6000) });

    if (!apiRes.ok) {
      res.json({ concerts: [] });
      return;
    }

    const events = (await apiRes.json()) as Array<{
      id: string;
      title?: string;
      datetime: string;
      url: string;
      venue: {
        name: string;
        city: string;
        country: string;
      };
      lineup?: string[];
    }>;

    if (!Array.isArray(events)) {
      res.json({ concerts: [] });
      return;
    }

    const concerts = events.slice(0, 5).map((e) => ({
      id: String(e.id),
      name: e.title ?? `${artist} Live`,
      date: e.datetime.split("T")[0] ?? e.datetime,
      venue: e.venue?.name ?? "Unknown Venue",
      city: [e.venue?.city, e.venue?.country].filter(Boolean).join(", "),
      url: e.url,
    }));

    res.json({ concerts });
  } catch {
    res.json({ concerts: [] });
  }
});

export default router;
