---
name: React Three Fiber patterns that bit us
description: Cross-reconciler state sharing, deterministic randomness, and three.js typings for R3F apps in this monorepo.
---

- **Share per-frame data via a module singleton, not React context.** R3F renders in its own reconciler that does not share React context with the DOM tree, so a DOM-side provider won't reach scene components. Pattern that works: a plain exported mutable object (e.g. `audioLevels`) that one component writes each frame and every `useFrame` reads.
  **Why:** passing live audio/analyser state through context across the Canvas boundary silently doesn't update inside the scene.

- **Seed all randomness (mulberry32), never `Math.random()` in render/JSX.** Re-renders would otherwise reshuffle geometry every frame. A shared seeded height field keeps terrain, structures, and props aligned to the same ground.

- **`three` needs `@types/three` installed at the matching version** (typecheck errors `TS7016: Could not find a declaration file for module 'three'`). Install the same version as `three`.

- **For framebuffer capture** (screenshot/download), create the Canvas with `gl={{ preserveDrawingBuffer: true }}` then read `gl.domElement.toDataURL()`.
