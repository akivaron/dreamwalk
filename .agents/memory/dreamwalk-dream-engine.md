---
name: DreamWalk Dream Engine
description: Architecture of the dream context system that translates song data into 3D world parameters
---

## Architecture

`useDreamContext` hook assembles a `DreamContext` object by chaining:
1. iTunes Search API → `DreamSong` (artist, title, album, artworkUrl, previewUrl, genre)
2. `fetchLyrics(artist, title)` → tries api-server proxy (Musixmatch if key set) then lyrics.ovh
3. `extractKeywords(lyricsText)` → themed keyword buckets (ocean, stars, fire, rain, etc.)
4. `inferMood(keywords, title, artist)` → `MoodData { primary, secondary, energy, valence }`
5. `selectWorldId(keywords, mood)` → picks one of 6 world presets
6. `buildWorldOverrides(keywords, mood)` → Partial<World> overrides layered on top of base world
7. `buildNarrationText(song, mood, keywords)` → string, then POSTed to `/api/narrate` (ElevenLabs)

**Note:** Concert/live-events integration was explicitly removed per user request — do not re-add JamBase, Ticketmaster, Bandsintown, `/api/concerts`, or any ConcertInfo type.

## Key Types

- `DreamContext` in `src/dreamwalk/dream/types.ts`
- `DreamSong`, `LyricsData`, `MoodData`, `TrendingTrack`

## LyricsClock

- `createLyricsClock(syncedLines)` + `tickLyricsClock(state, currentTime, delta)` in `LyricsClock.ts`
- Called from `AudioAnalyzer.tsx` `useFrame` loop when `getAudioTime` prop is provided
- Writes to global `dreamEvents` store (chorus/bridge/emotional intensity)
- Scene components (`Particles.tsx`, `Firmament.tsx`) read `dreamEvents` in their render loops

## World Builder

- `buildWorldFromContext(context)` in `worldBuilder.ts` merges base world + partial overrides
- Features merged with spread: `{ ...base.features, ...overrides.features }` 
- 6 world presets in `worlds.ts`: savana-valley, midnight-ocean, eternal-winter, golden-sunrise, crimson-dusk, mystic-valley

**Why:** The `audioLevels` + `dreamEvents` module singletons are the only safe way to share state between the React 19 component tree and the R3F reconciler render loop without triggering re-renders on every frame.
