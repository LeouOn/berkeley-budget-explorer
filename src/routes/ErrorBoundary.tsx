import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <main id="main" tabIndex={-1} style={{ padding: "2rem", maxWidth: "60ch" }}>
          <h1>Something went wrong</h1>
          <p>
            This view failed to render. The data behind other pages is unaffected. Try reloading, or
            return to the <a href="#/">Overview</a> or <a href="#/methodology">Methodology</a> page.
          </p>
          <p>
            <a href="mailto:data@berkeleyca.gov?subject=Budget%20Explorer%20render%20error">
              Report this problem
            </a>
          </p>
          <details>
            <summary>Technical detail</summary>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
              {this.state.error.message}
            </pre>
          </details>
        </main>
      );
    }
    return this.props.children;
  }
}
