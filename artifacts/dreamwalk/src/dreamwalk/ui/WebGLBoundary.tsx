import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onExit: () => void;
}

interface State {
  failed: boolean;
}

const BENIGN_PATTERNS = [
  /Converting circular structure to JSON/i,
  /Error creating WebGL context/i,
  /WebGLRenderer/i,
  /THREE\.WebGL/i,
  /Context Lost/i,
  /Invalid hook call/i,
  /CanvasImpl/i,
];

function isBenignWebGLError(error: Error): boolean {
  const text = `${error.message ?? ""}\n${error.stack ?? ""}`;
  return BENIGN_PATTERNS.some((re) => re.test(text));
}

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!gl) return false;
    // Release the probe context immediately. Holding an extra WebGL context can
    // cause a constrained sandbox to lose an existing context when the real
    // R3F renderer creates its own.
    (gl as WebGLRenderingContext)
      .getExtension("WEBGL_lose_context")
      ?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export class WebGLBoundary extends Component<Props, State> {
  state: State = { failed: !detectWebGL() };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    // Only log genuinely unexpected errors — benign WebGL/sandbox failures are
    // handled by the fallback UI and do not need a console trace.
    if (!isBenignWebGLError(error)) {
      console.error("DreamWalk scene failed to render", error);
    }
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#04050a] px-8 text-center">
          <h2 className="font-display text-2xl tracking-[0.35em] text-white/90">
            THE DREAM CANNOT OPEN
          </h2>
          <p className="mt-5 max-w-md text-lg font-light leading-relaxed tracking-wide text-white/55">
            DreamWalk needs hardware-accelerated graphics (WebGL). Please open it in a modern
            browser with graphics acceleration enabled.
          </p>
          <button
            onClick={this.props.onExit}
            className="mt-10 rounded-full border border-white/30 px-10 py-3 text-xs uppercase tracking-[0.35em] text-white/80 transition-colors hover:border-white/70 hover:text-white"
          >
            Return
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
