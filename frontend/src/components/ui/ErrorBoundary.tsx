import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex min-h-[50vh] flex-col items-center justify-center px-[var(--space-page)] py-12 text-center"
          role="alert"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-danger/30 bg-[var(--color-danger-muted)]">
            <AlertTriangle className="icon-lg text-danger" strokeWidth={2} aria-hidden />
          </div>
          <h1 className="type-display text-lg">{this.props.fallbackTitle ?? "Something went wrong"}</h1>
          <p className="type-body mt-2 max-w-md">
            An unexpected error occurred. You can retry or refresh the page.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button onClick={this.handleRetry}>
              <RefreshCw className="icon-sm" strokeWidth={2} aria-hidden />
              Try again
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Refresh page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
