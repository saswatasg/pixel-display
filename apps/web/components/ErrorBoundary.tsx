"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Wordmark } from "./ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("app crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="bg-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />
        <Wordmark />
        <p className="max-w-xs text-sm text-zinc-400">
          Something went wrong while rendering the app. Your display is unaffected — reload to keep going.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-400"
        >
          Reload app
        </button>
      </main>
    );
  }
}