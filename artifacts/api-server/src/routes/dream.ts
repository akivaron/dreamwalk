import { Router, type IRouter } from "express";
import type { Request, Response } from "express";

const router: IRouter = Router();

router.get("/trending", async (_req: Request, res: Response) => {
  try {
    const url = "https://rss.applemarketingtools.com/api/v2/us/music/most-played/15/songs.json";
    const apiRes = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!apiRes.ok) { res.json({ feed: { results: [] } }); return; }
    const data = await apiRes.json();
    res.json(data);
  } catch {
    res.json({ feed: { results: [] } });
  }
});

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

  // 1. Search for the track
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

  // 2a. Try richsync (word-level timestamps) first
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

  // 2b. Fall back to plain lyrics (no timestamps)
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

router.get("/concerts", async (req: Request, res: Response) => {
  const artist = String(req.query.artist ?? "").trim();
  if (!artist) {
    res.json({ concerts: [] });
    return;
  }

  const ticketKey = process.env["TICKETMASTER_KEY"];
  if (!ticketKey) {
    res.json({ concerts: [] });
    return;
  }

  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?${new URLSearchParams({
      keyword: artist,
      classificationName: "music",
      size: "3",
      sort: "date,asc",
      apikey: ticketKey,
    })}`;
    const apiRes = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!apiRes.ok) {
      res.json({ concerts: [] });
      return;
    }
    const data = (await apiRes.json()) as {
      _embedded?: {
        events: Array<{
          id: string;
          name: string;
          dates: { start: { localDate: string } };
          _embedded?: { venues: Array<{ name: string; city: { name: string } }> };
          url: string;
        }>;
      };
    };

    const events = data._embedded?.events ?? [];
    const concerts = events.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.dates.start.localDate,
      venue: e._embedded?.venues?.[0]?.name ?? "Unknown Venue",
      city: e._embedded?.venues?.[0]?.city?.name ?? "",
      url: e.url,
    }));

    res.json({ concerts });
  } catch {
    res.json({ concerts: [] });
  }
});

export default router;
