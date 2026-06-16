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
**Rule:** A graceful in-app fallback is necessary but NOT sufficient to stop the dev
crash overlay. The fix that actually works is the runtime-error plugin's `filter` option
in `vite.config.ts` — suppress the benign WebGL/serialization error signatures there.

**Why:** Even with a `WebGLBoundary` that fails closed, two unavoidable window-level
errors still fire in a no-GPU browser: `Error creating WebGL context` (thrown by THREE's
`WebGLRenderer`, re-emitted to `window` by React's dev `reportError` after the boundary
catches it) and `Converting circular structure to JSON` (dev tooling serializing the
Three.js fiber tree). Both reach `@replit/vite-plugin-runtime-error-modal` → Vite error
overlay → looks like a hard crash. A client-side capture-phase `window` 'error' guard
only stops one message and is fragile (context-lost errors fire repeatedly, async). The
server-side `filter(error)=>!benign` is the robust, centralized fix: returning false
drops the overlay, the `[RUNTIME_ERROR]` server log, AND the parent postMessage in one
place, while all other errors still surface. Match on message+stack for: `Error creating
WebGL context`, `Converting circular structure to JSON`, `WebGLRenderer`, `THREE.WebGL`,
`Context Lost`. No production effect (plugin is dev-only).

**Also:** the window errors still appear in browser-console *log capture* (refresh_all_logs)
— that's the capture mechanism recording window events, NOT a visible crash. Verify the
real behavior with an e2e test (no overlay, fallback shows, Return restores title), not
by grepping console logs.

**How to apply:** `WebGLBoundary` checks `canvas.getContext('webgl2'|'webgl'|...)` in its
initial state and keeps `getDerivedStateFromError` as a backstop; the `vite.config.ts`
`filter` is what prevents the dev overlay. Also make phase/exit transitions throw-safe
(wrap audio cleanup in try/catch) so a stuck fallback can always return to the title.
