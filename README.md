# DreamWalk

A meditative 3D audio experience built with React Three Fiber. Walk inside your music across six atmospheric worlds.

## Overview

DreamWalk is an immersive, atmospheric web experience that pairs curated music tracks with procedurally generated 3D landscapes. Each track has a suggested world that matches its mood and energy.

- **4 curated tracks** with preview playback
- **6 atmospheric worlds**: Golden Desert, Moon Ocean, Ancient Kingdom, Emerald Valley, Snow Sanctuary, Dream Night
- **First-person exploration**: drag to look, WASD to walk
- **Real-time audio visualization**: terrain reacts to the music
- **Screenshot capture**: save your favorite moments
- **Journey-inspired minimal UI**: no emojis, clean typography

## Tech Stack

- **React 19** + **Vite** + **TypeScript**
- **React Three Fiber** (R3F) + **Three.js** for 3D rendering
- **Drei** for R3F helpers (camera controls, effects, environment)
- **Postprocessing** for bloom and atmospheric effects
- **Framer Motion** for UI transitions
- **Tailwind CSS** for styling
- **Web Audio API** for real-time audio analysis

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **pnpm** (required by this monorepo)
- **GPU/WebGL** enabled browser (for the 3D experience)

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd <repo-folder>

# Install dependencies (pnpm required)
pnpm install
```

## Running the Project

### Development

```bash
# Start DreamWalk in development mode
pnpm --filter @workspace/dreamwalk run dev

# Or start all workspace packages
cd artifacts/dreamwalk && pnpm run dev
```

The dev server will start on the assigned port. In the Replit environment, it automatically uses the correct `PORT` and `BASE_PATH`.

### Building

```bash
# Type-check all packages
pnpm run typecheck

# Build DreamWalk for production
pnpm --filter @workspace/dreamwalk run build

# Build all packages
pnpm run build
```

### Preview Production Build

```bash
# Preview the production build locally
pnpm --filter @workspace/dreamwalk run serve
```

## Project Structure

```
workspace/
  artifacts/
    dreamwalk/              # DreamWalk web app
      src/
        dreamwalk/
          audio/            # Audio engine and store
          scene/          # 3D experience (R3F Canvas)
          ui/             # React UI components (TitleScreen, HUD, WebGLBoundary)
          tracks.ts       # Track definitions
          worlds.ts       # World definitions
          types.ts        # TypeScript types
          rng.ts          # Procedural generation helpers
        App.tsx           # Main app with phase machine
        main.tsx          # Entry point
        index.css         # Tailwind + custom styles
      public/
        audio/            # Music tracks (MP3)
      vite.config.ts      # Vite configuration
      package.json
  package.json            # Root monorepo config
  pnpm-workspace.yaml
```

## Available Scripts

### Root (monorepo)

| Script | Description |
|--------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm run typecheck` | Type-check all packages |
| `pnpm run build` | Type-check then build all packages |

### DreamWalk Package

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start development server with HMR |
| `pnpm run build` | Build for production |
| `pnpm run serve` | Preview production build |
| `pnpm run typecheck` | Type-check without emitting files |

## Controls

- **WASD** — Walk forward/left/backward/right
- **Drag** — Look around
- **Click** — Enter the experience
- **Space** — Pause/play music
- **S** — Take screenshot
- **Esc** — Return to title screen

## Audio Files

Place your MP3 files in `artifacts/dreamwalk/public/audio/` and update `src/dreamwalk/tracks.ts` to reference them.

## WebGL Compatibility

DreamWalk requires a browser with WebGL 2.0 support. If your browser or device doesn't support it, the app gracefully shows a fallback message with an option to return to the title screen.

## License

MIT
