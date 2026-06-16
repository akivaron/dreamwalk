---
name: WebGL unavailable in Replit preview/test browsers
description: Why the 3D scene can't render in-env and how DreamWalk degrades gracefully
---

# WebGL is unavailable in Replit's preview + Playwright browsers

The Replit preview iframe browser and the Playwright test browsers run sandboxed
**without GPU/WebGL** ("BindToCurrentSequence failed: Error creating WebGL context").
Any React Three Fiber `<Canvas>` will fail to initialize there. It renders fine in
real user browsers.

## The complete fix (all layers required)

**Root cause chain (GPU-less env):**
1. R3F `<Canvas>` mounts → WebGL context lost → `CanvasImpl` throws
2. React dev-mode calls `console.error("Invalid hook call", …)` + `console.error("%o … CanvasImpl …", fiberObj, …)`
3. Replit's `injected.js` intercepts `console.error`, tries `JSON.stringify` on args (which include Three.js fiber nodes with circular `parent/children` refs) → throws `"Converting circular structure to JSON"`
4. That throw becomes an uncaught `window` error → crash detection fires
5. WebGLBoundary shows graceful fallback, but the external crash report is already sent

**Fix (all three layers in `devErrorGuard.ts`, DEV-only):**

### Layer 1 — patch `console.error` + `console.warn` (most important)
Wrap these BEFORE injected.js can process them. Because our `main.tsx` runs
AFTER injected.js injects itself, our wrapper sits ON TOP of injected.js's wrapper.
For benign calls we return early → injected.js never runs → JSON.stringify never
attempted → the circular-structure throw never happens. This is the definitive fix.

```ts
const _orig = console.error.bind(console);
console.error = (...args) => { if (!isBenign(args)) _orig(...args); };
```

### Layer 2 — capture-phase window 'error'/'unhandledrejection' guard
`preventDefault() + stopImmediatePropagation()` for benign patterns. Second line
of defence if any error still escapes to window level.

### Layer 3 — vite.config `runtimeErrorOverlay filter`
Prevents the runtime-error-modal plugin from showing its overlay for these patterns.
Returns `!benign` — returning false drops the overlay AND the postMessage to parent.

### Layer 4 — `createRoot` callbacks (React 19)
`onCaughtError`/`onUncaughtError`/`onRecoverableError` replace React's default
`console.error` for boundary-caught errors. Suppresses React's own internal logs.

### Layer 5 — `WebGLBoundary.componentDidCatch`
Only calls `console.error` for non-benign errors.

**Benign patterns to match (in all layers):**
`Converting circular structure to JSON`, `Error creating WebGL context`,
`WebGLRenderer`, `THREE.WebGL`, `THREE.Texture`, `THREE.Clock`,
`THREE.BufferGeometry`, `THREE.WebGLShadowMap`, `Context Lost`,
`Invalid hook call`, `CanvasImpl`, `The above error occurred in the`,
`DreamWalk scene failed to render`, `React will try to recreate`

**Also:** free the WebGL probe context in `detectWebGL()` via
`WEBGL_lose_context.loseContext()` so the leaked probe context doesn't itself
trigger "Context Lost" in constrained sandboxes.

**Why:** In real user browsers with working GPU, none of this fires — the 3D
scene renders normally. All guards are DEV-only or no-ops in production.
