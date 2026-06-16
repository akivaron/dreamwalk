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
**Rule:** TWO independent mechanisms must both be neutralized — the runtime-error plugin
overlay AND the raw uncaught window error. Use BOTH: (1) the plugin's `filter` option in
`vite.config.ts` to suppress the overlay, AND (2) a capture-phase `window` 'error'/
'unhandledrejection' guard (DEV-only, e.g. `devErrorGuard.ts`) that calls
`preventDefault()+stopImmediatePropagation()` for the benign signatures so the error is
not seen as *uncaught*. The `filter` ALONE is insufficient: it stops the overlay and the
`[RUNTIME_ERROR]` server log, but Replit's separate browser-console crash detection still
fires on the uncaught exception and regenerates the "artifact crashed" report. Also free
the WebGL probe context (`WEBGL_lose_context.loseContext()`) so a leaked second context
doesn't itself trigger "Context Lost" in constrained sandboxes.

**Why:** Even with a `WebGLBoundary` that fails closed, multiple unavoidable window-level
errors still fire in a no-GPU browser: `Error creating WebGL context` (thrown by THREE's
`WebGLRenderer`), `Converting circular structure to JSON` (dev tooling serializing the
Three.js fiber tree), `Invalid hook call` (React's internal `CanvasImpl` error during
error-boundary recovery), and `CanvasImpl` (the R3F component that throws during recovery).
All reach `@replit/vite-plugin-runtime-error-modal` → Vite error overlay → looks like a
hard crash. A client-side capture-phase `window` 'error' guard only stops one message and
is fragile (context-lost errors fire repeatedly, async). The server-side `filter` is the
robust, centralized fix: returning false drops the overlay, the `[RUNTIME_ERROR]` server
log, AND the parent postMessage in one place, while all other errors still surface. The
client-side guard is also needed because Replit's browser-console crash detection is
separate from the plugin and still fires on the raw uncaught exception. Match on
message+stack for: `Error creating WebGL context`, `Converting circular structure to JSON`,
`WebGLRenderer`, `THREE.WebGL`, `Context Lost`, `Invalid hook call`, `CanvasImpl`.
No production effect (plugin is dev-only).

**Also:** the window errors still appear in browser-console *log capture* (refresh_all_logs)
— that's the capture mechanism recording window events, NOT a visible crash. Verify the
real behavior with an e2e test (no overlay, fallback shows, Return restores title), not
by grepping console logs.

**How to apply:** `WebGLBoundary` checks `canvas.getContext('webgl2'|'webgl'|...)` in its
initial state and keeps `getDerivedStateFromError` as a backstop; the `vite.config.ts`
`filter` is what prevents the dev overlay. Also make phase/exit transitions throw-safe
(wrap audio cleanup in try/catch) so a stuck fallback can always return to the title.
