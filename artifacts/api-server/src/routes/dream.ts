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
      const searchUrl = `https://api.musixmatch.com/ws/1.1/track.search?q_track=${encodeURIComponent(title)}&q_artist=${encodeURIComponent(artist)}&page_size=1&page=1&s_track_rating=desc&apikey=${musixKey}`;
      const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
          message: {
            body: { track_list: Array<{ track: { track_id: number } }> };
          };
        };
        const trackId = searchData.message?.body?.track_list?.[0]?.track?.track_id;
        if (trackId) {
          const lyricsUrl = `https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_id=${trackId}&apikey=${musixKey}`;
          const lyricsRes = await fetch(lyricsUrl, { signal: AbortSignal.timeout(5000) });
          if (lyricsRes.ok) {
            const lyricsData = (await lyricsRes.json()) as {
              message: { body: { lyrics: { lyrics_body: string } } };
            };
            const lyricsBody = lyricsData.message?.body?.lyrics?.lyrics_body;
            if (lyricsBody) {
              const cleaned = lyricsBody.replace(/\*{7} This Lyrics is NOT for Commercial use \*{7}.*$/s, "").trim();
              res.json({ lyrics: cleaned, source: "musixmatch" });
              return;
            }
          }
        }
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
        res.json({ lyrics: ovhData.lyrics, source: "ovh" });
        return;
      }
    }
  } catch {
    /* no lyrics available */
  }

  res.json({ lyrics: null, source: null });
});

router.post("/narrate", async (req: Request, res: Response) => {
  const elevenKey = process.env["ELEVENLABS_API_KEY"];
  if (!elevenKey) {
    res.status(503).json({ error: "narration not configured" });
    return;
  }

  const text = String(req.body?.text ?? "").trim().slice(0, 300);
  const voice = String(req.body?.voice ?? "pNInz6obpgDQGcFmaJgB");
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  try {
    const apiRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        "xi-api-key": elevenKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!apiRes.ok) {
      const err = await apiRes.text();
      res.status(502).json({ error: `ElevenLabs error: ${err.slice(0, 200)}` });
      return;
    }

    const audioBuffer = await apiRes.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));
  } catch {
    res.status(500).json({ error: "narration generation failed" });
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
