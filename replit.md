# DreamWalk

DreamWalk is an atmospheric, meditative 3D web experience where you pick a curated song and a dream world, then walk slowly through a vast low-poly landscape that reacts subtly to the live audio. Tagline: "Walk inside your music." It is a calm experience, not a game or a literal music visualizer.

## Run & Operate

- The `artifacts/dreamwalk: web` workflow runs the experience (Vite dev server, binds to `PORT`).
- `pnpm --filter @workspace/dreamwalk exec tsc --noEmit -p tsconfig.json` — typecheck the DreamWalk artifact
- Frontend-only artifact: no backend, database, or env vars required.

## Stack

- React 19 + Vite 7, TypeScript, Tailwind CSS v4
- 3D: three.js (`three`), @react-three/fiber 9, @react-three/drei, @react-three/postprocessing
- Animation/UI: framer-motion
- Fonts: Cinzel (display) + Cormorant Garamond (body), loaded in `index.html`

## Where things live

- `artifacts/dreamwalk/src/App.tsx` — phase state machine: title → entering → experience → exiting, with a framer-motion fade overlay
- `artifacts/dreamwalk/src/dreamwalk/worlds.ts` — the six world definitions (palette, terrain, features)
- `artifacts/dreamwalk/src/dreamwalk/tracks.ts` — curated track list + each track's suggested world
- `artifacts/dreamwalk/src/dreamwalk/audio/` — `audioStore.ts` (module-singleton `audioLevels`), `useAudioEngine.ts` (WebAudio + AnalyserNode)
- `artifacts/dreamwalk/src/dreamwalk/scene/` — Experience (Canvas) and all 3D layers (Terrain, Firmament, Structures, Banners, Particles, etc.)
- `artifacts/dreamwalk/src/dreamwalk/ui/` — TitleScreen, Hud, WebGLBoundary
- `artifacts/dreamwalk/public/audio/` — generated music tracks (mp3)

## Architecture decisions

- Audio reactivity flows through a module-level singleton (`audioLevels`) that `AudioAnalyzer` writes each frame and every scene component reads in `useFrame`. This deliberately avoids React Three Fiber's context-bridge limitation (R3F renders in its own reconciler that does not share React context with the DOM tree).
- Deterministic randomness everywhere via `mulberry32` (seeded RNG) instead of `Math.random()`, so scene layout is stable across re-renders and the shared `terrainHeight` field is consistent between terrain, structures, and banners.
- The Canvas uses `preserveDrawingBuffer: true` so the in-experience "Capture" button can read the framebuffer via `toDataURL`.
- A `WebGLBoundary` error boundary wraps the Canvas and shows a calm fallback if WebGL cannot initialize, instead of a raw crash.

## Product

- Minimal Journey-style UI. The title screen lets the user pick one of four curated songs (with preview) and one of six worlds (Golden Desert, Moon Ocean, Ancient Kingdom, Emerald Valley, Snow Sanctuary, Dream Night). Selecting a song defaults the world to its suggested match.
- In-experience controls (pause/play, capture screenshot, exit) auto-fade on inactivity. Drag to look, WASD/arrows to walk.

## User preferences

- No emojis in the UI.
- Curated tracks only (no user upload); user manually picks the world (no lyrics-driven selection); visuals react to live audio.

## Gotchas

- The Replit preview AND the Playwright test browser run sandboxed without GPU/WebGL ("BindToCurrentSequence failed" / "Error creating WebGL context"). The 3D scene cannot be visually verified inside this environment — only the 2D DOM layers (title, HUD, fallback). It renders normally in real user browsers.
- `three` does not ship its own types here; `@types/three` must be installed at the matching version (currently 0.184.0).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
