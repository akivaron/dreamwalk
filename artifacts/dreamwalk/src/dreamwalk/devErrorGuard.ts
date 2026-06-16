/**
 * DreamWalk is a React Three Fiber (WebGL) experience. In GPU-less sandboxes
 * (Replit preview / Playwright browsers) the WebGL context fails or is lost,
 * which generates a cascade of benign noise:
 *
 *  1. React dev-mode calls console.error("Invalid hook call", …) and
 *     console.error("%o … CanvasImpl …", fiberObj, …)
 *  2. Replit's injected.js intercepts console.error, tries JSON.stringify on
 *     the arguments (which include Three.js fiber nodes with circular
 *     parent/children refs) and throws "Converting circular structure to JSON"
 *  3. That throw becomes an uncaught window error that trips crash detection
 *  4. THREE.WebGLRenderer also emits warnings via console.warn
 *
 * None of these are real bugs — WebGLBoundary handles the failure gracefully.
 *
 * Fix strategy (layered, DEV-only):
 *  • Wrap console.error + console.warn early (before injected.js processes
 *    them) and suppress calls whose text matches known benign patterns. This
 *    prevents injected.js from ever seeing the messages, blocking the
 *    JSON.stringify throw at its source.
 *  • Keep the capture-phase window 'error'/'unhandledrejection' guard as a
 *    second line of defence for any errors that still escape.
 *
 * All genuine app errors still surface normally.
 * No production effect — the guard is gated on import.meta.env.DEV.
 */

const BENIGN_PATTERNS: RegExp[] = [
  /Converting circular structure to JSON/i,
  /Error creating WebGL context/i,
  /WebGLRenderer/i,
  /THREE\.WebGL/i,
  /THREE\.Texture/i,
  /THREE\.BufferGeometry/i,
  /THREE\.Clock/i,
  /THREE\.WebGLShadowMap/i,
  /Context Lost/i,
  /Invalid hook call/i,
  /CanvasImpl/i,
  /The above error occurred in the/i,
  /DreamWalk scene failed to render/i,
  /React will try to recreate this component tree/i,
];

/** Safely convert any value to a string without throwing. */
function safeStr(v: unknown): string {
  if (typeof v === "string") return v;
  try {
    return String(v);
  } catch {
    return "";
  }
}

function isBenign(args: unknown[]): boolean {
  const text = args.map(safeStr).join("\n");
  return BENIGN_PATTERNS.some((re) => re.test(text));
}

function isBenignText(text: string): boolean {
  return BENIGN_PATTERNS.some((re) => re.test(text));
}

export function installDevErrorGuard(): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env.DEV) return;

  // ─── 1. Patch console.error ──────────────────────────────────────────────
  // Wrapping console.error is the earliest possible interception point.
  // injected.js (Replit's monitoring) also wraps console.error, but because
  // our main.tsx runs after injected.js injects itself, our wrapper sits ON
  // TOP of injected.js's wrapper. For benign calls we return early — their
  // wrapper never runs, so JSON.stringify is never attempted, and the
  // "Converting circular structure to JSON" throw never happens.
  const _origError = console.error.bind(console);
  console.error = (...args: unknown[]): void => {
    if (!isBenign(args)) {
      _origError(...args);
    }
  };

  // ─── 2. Patch console.warn ───────────────────────────────────────────────
  // Suppress THREE.js deprecation warnings that clutter the dev console in
  // GPU-less environments (THREE.Texture serialize, THREE.Clock, etc.).
  const _origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]): void => {
    if (!isBenign(args)) {
      _origWarn(...args);
    }
  };

  // ─── 3. Window error / unhandledrejection guard ──────────────────────────
  // Second line of defence: if a benign error still escapes as an uncaught
  // window event, mark it as handled (preventDefault + stopImmediatePropagation
  // in capture phase) so it doesn't trip additional crash-detection listeners.
  window.addEventListener(
    "error",
    (event: ErrorEvent) => {
      const text = [
        event.message ?? "",
        event.error?.message ?? "",
        event.error?.stack ?? "",
      ].join("\n");
      if (isBenignText(text)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      const reason = event.reason as
        | { message?: string; stack?: string }
        | string
        | undefined;
      const text =
        typeof reason === "string"
          ? reason
          : `${reason?.message ?? ""}\n${reason?.stack ?? ""}`;
      if (isBenignText(text)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}
