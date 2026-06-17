# DreamWalk

DreamWalk is an atmospheric, meditative 3D web experience where you pick a song and a dream world, then walk slowly through a vast low-poly landscape that reacts to the live audio. Tagline: "Walk inside your music."

Two modes:
- **Curated** — hand-picked songs with full lyrics, narration, and world suggestions
- **Any Song** — search any track; lyrics fetched live, stems separated for cleaner audio reactivity

## Quick start

```bash
pnpm install
# Start both services (each binds to its own PORT set by Replit):
#   artifacts/api-server: API Server
#   artifacts/dreamwalk: web
```

Copy `.env.example` → `.env` and fill in the keys you want (all are optional — the app gracefully falls back without them).

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite 7, TypeScript, Tailwind CSS v4 |
| 3D | three.js, @react-three/fiber 9, @react-three/drei, @react-three/postprocessing |
| Animation/UI | framer-motion |
| API server | Express + pino, Node 20 |
| Database | PostgreSQL via Drizzle ORM (wishes feature) |
| Fonts | Cinzel (display) + Cormorant Garamond (body) |

## Where things live

```
artifacts/
  dreamwalk/              ← Vite frontend
    src/
      App.tsx             ← phase state machine: title → entering → experience → exiting
      dreamwalk/
        worlds.ts         ← six world definitions (palette, terrain, features)
        tracks.ts         ← curated track list + suggested worlds
        audio/
          audioStore.ts   ← module-singleton audioLevels (shared across R3F reconciler boundary)
          useAudioEngine.ts ← WebAudio + AnalyserNode, loadAndPlay
        dream/
          useDreamContext.ts  ← buildForSong / buildForCuratedTrack, lyrics, mood, narration
          useCuratedSongs.ts  ← fetches /api/curated, maps previewUrl → file
        scene/            ← Experience (Canvas) + all 3D layers
        ui/               ← TitleScreen, Hud, SongDetail, WebGLBoundary

  api-server/             ← Express API
    src/routes/
      dream.ts            ← /api/trending, /api/lyrics, /api/mood, /api/search,
                             /api/stems, /api/narrate, /api/song-wiki, /api/track-details,
                             /api/audio-proxy, /api/curated
      wishes.ts           ← /api/wishes (GET + POST, persisted to PostgreSQL)

lib/
  db/                     ← @workspace/db — Drizzle schema + pg Pool
```

## Environment variables

All external API keys are **optional** — each endpoint falls back gracefully without a key. See `.env.example` for descriptions and sign-up links.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | For wishes | PostgreSQL — auto-set by Replit database provisioning |
| `MUSIXMATCH_KEY` | Optional | Synced/richsync lyrics + song search |
| `SONGSTATS_KEY` | Optional | Global trending charts (falls back to Apple RSS) |
| `CYANITE_ACCESS_TOKEN` | Optional | Mood/audio-feature analysis for world selection |
| `LALAL_KEY` | Optional | Vocal/instrument stem separation (Any Song mode) |
| `ELEVEN_KEY` | Optional | ElevenLabs TTS — atmospheric intro narration |
| `LOG_LEVEL` | Optional | API server log verbosity (default: `info`) |

## Architecture decisions

- **Audio singleton**: `audioLevels` is a module-level singleton written by `AudioAnalyzer` each frame and read by every 3D scene component in `useFrame`. This bypasses React Three Fiber's reconciler boundary, which doesn't share React context with the DOM tree.
- **Deterministic randomness**: `mulberry32` seeded RNG instead of `Math.random()` everywhere — scene layout (terrain, structures, banners) is stable across re-renders and consistent between components that share a seed.
- **`preserveDrawingBuffer: true`**: Required so the in-experience "Capture" button can read the framebuffer via `toDataURL` after each rendered frame.
- **`WebGLBoundary`**: Error boundary wrapping the Canvas — shows a calm fallback instead of a raw crash when WebGL cannot initialize.
- **Background curated build**: When the Curated tab is active, `buildForSong` runs in the background silently (no loading overlay). The loading screen only appears for user-initiated Any Song / SongDetail builds.
- **Audio proxy**: `/api/audio-proxy` streams iTunes preview URLs server-side with CORS + Range headers so the browser's `<audio>` element can seek within the sandboxed iframe.

## Running checks

```bash
# Type-check the frontend
pnpm --filter @workspace/dreamwalk exec tsc --noEmit -p tsconfig.json

# Type-check the API server
pnpm --filter @workspace/api-server exec tsc --noEmit -p tsconfig.json
```

## Gotchas

- The Replit preview iframe and Playwright test browsers run sandboxed without GPU/WebGL. The 3D scene cannot be visually verified inside this environment — only 2D DOM layers (title, HUD, fallback). It renders normally in real user browsers.
- `three` does not ship its own types; `@types/three` must be installed at the matching version (currently 0.184.0).
- The `AudioContext` must be resumed inside a user-gesture handler. `useAudioEngine.ts` uses `Promise.all([ctx.resume(), el.play()])` to stay within the browser's gesture-expiry window — do not separate these into sequential awaits.
- `/api/mood` (Cyanite) returns 502 when the access token lacks `audioFeatures` permissions on the current plan. The frontend falls back to a genre/title heuristic silently.

## User preferences

- No emojis in the UI.
- Curated tracks use hand-picked songs; world selection defaults to each track's `suggestedWorld` but the user can override.
