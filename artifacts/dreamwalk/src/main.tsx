import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { installDevErrorGuard } from "./dreamwalk/devErrorGuard";

// Install the capture-phase window error guard before anything else.
installDevErrorGuard();

// Patterns for errors that are expected in GPU-less environments (Replit
// preview browser, Playwright, etc.) and are fully handled by WebGLBoundary.
// In a real browser with working WebGL these never fire at all.
const BENIGN_PATTERNS: RegExp[] = [
  /Converting circular structure to JSON/i,
  /Error creating WebGL context/i,
  /WebGLRenderer/i,
  /THREE\.WebGL/i,
  /Context Lost/i,
  /Invalid hook call/i,
  /CanvasImpl/i,
];

function isBenign(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.message}\n${error.stack ?? ""}`
      : String(error);
  return BENIGN_PATTERNS.some((re) => re.test(text));
}

// React 19 lets us provide custom error handlers on createRoot.
// When provided, React calls these INSTEAD of its default console.error
// behaviour, giving us the ability to suppress benign WebGL errors that would
// otherwise appear via injected dev tooling (e.g. injected.js in Replit).
createRoot(document.getElementById("root")!, {
  // Errors caught by an error boundary (e.g. WebGLBoundary)
  onCaughtError(error: unknown) {
    if (!isBenign(error)) {
      console.error("[DreamWalk] Error caught by boundary:", error);
    }
  },
  // Errors not caught by any boundary
  onUncaughtError(error: unknown) {
    if (!isBenign(error)) {
      console.error("[DreamWalk] Uncaught error:", error);
    }
  },
  // Recoverable errors React auto-retried
  onRecoverableError(error: unknown) {
    if (!isBenign(error)) {
      console.error("[DreamWalk] Recoverable error:", error);
    }
  },
}).render(<App />);
