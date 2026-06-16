---
name: WebGL unavailable in Replit env browsers
description: The preview and test browsers in this environment cannot create a WebGL context, so 3D/canvas-GPU apps can only be verified at the DOM layer here.
---

Both the Replit app-preview screenshot browser and the Playwright testing subagent browser run sandboxed without GPU access. Any WebGL app (three.js / React Three Fiber / regl / babylon) fails to create a context with errors like:

- `THREE.WebGLRenderer: Error creating WebGL context.`
- `Could not create a WebGL context ... ErrorMessage = BindToCurrentSequence failed`
- Vite runtime-error overlay: `[plugin:runtime-error-plugin] Error creating WebGL context.`

**Why:** the sandbox has no usable GPU and no software GL fallback. This is an environment limitation, NOT a bug in the app.

**How to apply:**
- Do not treat a WebGL-context failure in the preview/test browser as a real defect. Verify the 2D/DOM layers (menus, HUD, overlays) instead, and confirm the 3D code is correct by typecheck + code review.
- Downstream noise to ignore in this case: "Invalid hook call / more than one copy of React", "Converting circular structure to JSON", "THREE.Texture: Unable to serialize" — these cascade from the reconciler unwinding after the context failure / the dev overlay trying to serialize the error. Confirm React is single-copy via `pnpm why react` before chasing the hook-call message.
- Wrap the Canvas in a React error boundary so real browsers without WebGL get a graceful fallback instead of a crash.
