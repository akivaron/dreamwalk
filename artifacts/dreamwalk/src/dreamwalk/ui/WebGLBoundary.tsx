import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onExit: () => void;
}

interface State {
  failed: boolean;
}

export class WebGLBoundary extends Component<Props, State> {
  state: State = { failed: false };

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
