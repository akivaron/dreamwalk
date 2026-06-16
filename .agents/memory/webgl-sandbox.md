---
name: WebGL unavailable in Replit preview/test browsers
description: Why the 3D scene can't render in-env and how DreamWalk degrades gracefully
---

# WebGL is unavailable in Replit's preview + Playwright browsers

The Replit preview iframe browser and the Playwright test browsers run sandboxed
**without GPU/WebGL** ("BindToCurrentSequence failed: Error creating WebGL context").
Any React Three Fiber `<Canvas>` will fail to initialize there. It renders fine in
real user browsers.

## The crash this caused (and the fix)
**Rule:** Detect WebGL support *before* mounting the R3F `<Canvas>`; if absent, render
a fallback and never mount the Canvas. An error boundary alone is NOT enough.

**Why:** When the Canvas throws on context creation, a React error boundary catches the
*render* error, but a separate **window-level unhandled error** still fires — something
serializes the Three.js fiber tree and throws `Converting circular structure to JSON`
(plus a spurious `Invalid hook call` / multiple-React message). That unhandled error
trips Replit's runtime-error overlay, which the user sees as a hard crash.

**How to apply:** `WebGLBoundary` checks `canvas.getContext('webgl2'|'webgl'|...)` in its
initial state. If null → show fallback immediately, so the throw/cascade never happens.
Keep `getDerivedStateFromError` as a backstop for real-browser context loss.
