import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import App from "./App";
import "./index.css";
import { installDevErrorGuard } from "./dreamwalk/devErrorGuard";

installDevErrorGuard();

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

createRoot(document.getElementById("root")!, {
  onCaughtError(error: unknown) {
    if (!isBenign(error)) console.error("[DreamWalk] Error caught by boundary:", error);
  },
  onUncaughtError(error: unknown) {
    if (!isBenign(error)) console.error("[DreamWalk] Uncaught error:", error);
  },
  onRecoverableError(error: unknown) {
    if (!isBenign(error)) console.error("[DreamWalk] Recoverable error:", error);
  },
}).render(
  <Router>
    <App />
  </Router>
);
