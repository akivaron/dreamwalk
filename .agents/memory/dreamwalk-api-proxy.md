---
name: DreamWalk API proxy pattern
description: Which APIs are CORS-safe from browser vs must be proxied through api-server
---

## CORS-safe (browser-direct)
- **iTunes Search API**: `https://itunes.apple.com/search?term=...` — fully CORS-enabled, no key needed
- **iTunes Lookup**: `https://itunes.apple.com/lookup?id=...` — same
- **lyrics.ovh**: `https://api.lyrics.ovh/v1/{artist}/{title}` — CORS-enabled, no key needed

## Must be proxied through api-server (CORS blocked or key must stay server-side)
- **Apple RSS trending**: `https://rss.applemarketingtools.com/api/v2/us/music/most-played/15/songs.json` → `/api/trending`
- **Musixmatch**: `https://api.musixmatch.com/ws/1.1/...` → `/api/lyrics` (optional env: `MUSIXMATCH_KEY`)
- **ElevenLabs TTS**: `https://api.elevenlabs.io/v1/text-to-speech/...` → `/api/narrate` (optional env: `ELEVENLABS_API_KEY`)
- **Ticketmaster**: `https://app.ticketmaster.com/discovery/v2/events.json` → `/api/concerts` (optional env: `TICKETMASTER_KEY`)

## Graceful degradation
All proxied endpoints return empty/null when the env key is not set. No crashes.
- `/api/narrate` without key → 503, frontend skips narration silently
- `/api/concerts` without key → `{ concerts: [] }`, no concert badge shown
- `/api/lyrics` without Musixmatch key → falls back to lyrics.ovh (also proxied)

**Why:** Apple's CDN blocks CORS for their RSS feed. Musixmatch/ElevenLabs/Ticketmaster require API keys that must not be exposed in browser JS bundles.
