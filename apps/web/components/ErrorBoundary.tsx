"use client";
import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="app-error"><span className="brand">pixel.</span><h1>Let’s try that again.</h1><p>The workspace couldn’t load. Your saved library is still in this browser.</p><button type="button" className="action action-primary" onClick={() => window.location.reload()}>Reload workspace</button></main>;
  }
}
