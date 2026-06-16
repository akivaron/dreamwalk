---
name: Cyanite API Plan Restrictions
description: Which Cyanite GraphQL fields are accessible on the current token vs which require higher-tier plans
---

The `CYANITE_ACCESS_TOKEN` in this project is a basic/app-level token.

**What WORKS:**
- `spotifyTrackSearch(data: { term: String!, limit: Int })` → returns `SpotifyTrackInfo[]` with `id`, `name`, `popularity`, `audioFeatures { energy, valence, danceability, tempo, acousticness, instrumentalness }`
- Note: `audioFeatures` may return `null` for some tracks even on this endpoint

**What is NOT AUTHORIZED (needs higher plan):**
- `spotifyTrack(id: "...")` → returns `ERR_NOT_AUTHORIZED`
- `freeTextSearch(...)` → returns `ERR_NOT_AUTHORIZED`
- `audioAnalysisV6` (mood tags, genre tags, energy level, primary mood) → only accessible via `SpotifyTrack` (not `SpotifyTrackInfo`), requires higher plan

**How to apply:**
- `/api/mood` uses `spotifyTrackSearch` + `audioFeatures` only
- Frontend `api/mood.ts` derives mood from energy/valence/acousticness numerically
- Graceful fallback to heuristic when `audioFeatures` is null (returns 404)

**Why:**
- Attempted `spotifyTrack(id:)` which returned ERR_NOT_AUTHORIZED
- Attempted `freeTextSearch` which returned ERR_NOT_AUTHORIZED
- `SpotifyTrackInfo.audioAnalysisV6` field doesn't exist (only on `SpotifyTrack`)
