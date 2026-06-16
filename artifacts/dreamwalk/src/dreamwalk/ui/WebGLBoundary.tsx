import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onExit: () => void;
}

interface State {
  failed: boolean;
}

function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl2 = canvas.getContext("webgl2");
    const gl1 = canvas.getContext("webgl");
    const glExp = canvas.getContext("experimental-webgl");
    const gl = gl2 ?? gl1 ?? glExp;
    
    console.log("WebGL detection probe results:", {
      hasWebGL2: !!gl2,
      hasWebGL1: !!gl1,
      hasExperimental: !!glExp,
      selectedContext: gl ? gl.constructor.name : null
    });

    if (!gl) return false;
    // Release the probe context immediately. Holding an extra WebGL context can
    // cause a constrained sandbox to lose an existing context when the real
    // R3F renderer creates its own.
    (gl as WebGLRenderingContext)
      .getExtension("WEBGL_lose_context")
      ?.loseContext();
    return true;
  } catch (e) {
    console.error("Error during WebGL detection:", e);
    return false;
  }
}

export class WebGLBoundary extends Component<Props, State> {
  state: State = { failed: !detectWebGL() };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("DreamWalk scene failed to render", error, info);
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
