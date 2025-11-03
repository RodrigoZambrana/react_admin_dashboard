"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type PanelBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type PanelBoundaryState = {
  hasError: boolean;
};

const DEFAULT_FALLBACK = (
  <div
    role="status"
    aria-live="polite"
    style={{
      borderRadius: 12,
      border: "1px solid rgba(148, 163, 184, 0.35)",
      background: "rgba(226, 232, 240, 0.35)",
      padding: 16,
      fontSize: 14,
      color: "#475569",
    }}
  >
    <strong style={{ display: "block", marginBottom: 4 }}>Panel no disponible</strong>
    <span>Intentalo nuevamente en unos instantes.</span>
  </div>
);

export default class PanelBoundary extends Component<
  PanelBoundaryProps,
  PanelBoundaryState
> {
  state: PanelBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PanelBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("[panel-boundary] Panel render failure", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? DEFAULT_FALLBACK;
    }
    return this.props.children;
  }
}
