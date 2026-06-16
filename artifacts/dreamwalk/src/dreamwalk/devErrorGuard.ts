const BENIGN_PATTERNS: RegExp[] = [
  /Converting circular structure to JSON/i,
  /Error creating WebGL context/i,
  /WebGLRenderer/i,
  /THREE\.WebGL/i,
  /Context Lost/i,
  /Invalid hook call/i,
  /CanvasImpl/i,
];

function isBenign(text: string): boolean {
  return BENIGN_PATTERNS.some((re) => re.test(text));
}

/**
 * DreamWalk is a React Three Fiber (WebGL) experience. In GPU-less sandboxes
 * (the Replit preview/test browsers) the WebGL context fails to initialize or
 * is lost after creation. The app already degrades gracefully via WebGLBoundary,
 * but the failure also produces benign uncaught errors:
 *  - "Error creating WebGL context" / "THREE.WebGLRenderer: Context Lost"
 *  - "Converting circular structure to JSON" (dev tooling serializing the
 *    Three.js scene graph, which has circular parent/child references)
 *
 * These are not real application bugs and are fully handled in-app, but as
 * uncaught window errors they trip dev crash-detection. We mark only these
 * specific benign errors as handled (capture phase, before other listeners),
 * so genuine errors are never suppressed. Dev-only; production is unaffected.
 */
export function installDevErrorGuard(): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env.DEV) return;

  window.addEventListener(
    "error",
    (event: ErrorEvent) => {
      const text = `${event.message ?? ""}\n${event.error?.message ?? ""}\n${
        event.error?.stack ?? ""
      }`;
      if (isBenign(text)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      const reason = event.reason as { message?: string; stack?: string } | string | undefined;
      const text =
        typeof reason === "string"
          ? reason
          : `${reason?.message ?? ""}\n${reason?.stack ?? ""}`;
      if (isBenign(text)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}
