"use client";
import React from "react";
interface Props {
  label: string;
  children: React.ReactNode;
  onReset?: () => void;
}
interface State { hasError: boolean; error: Error | null; retryCount: number }
export default class PaneErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null, retryCount: 0 }; }
  static getDerivedStateFromError(error: Error): Partial<State> { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("[PaneErrorBoundary/" + this.props.label + "]", error, info.componentStack); }

  handleRetry = () => { this.setState((s) => ({ hasError: false, error: null, retryCount: s.retryCount + 1 })); };
  handleResetAndRetry = () => { this.props.onReset?.(); this.setState((s) => ({ hasError: false, error: null, retryCount: s.retryCount + 1 })); };
  handleCopyError = () => {
    const msg = this.state.error?.message ?? "Unknown error";
    navigator.clipboard?.writeText(msg).then(() => console.info("[PaneErrorBoundary] Error copied to clipboard."));
  };

  render() {
    if (this.state.hasError) {
      const repeated = this.state.retryCount >= 2;
      return (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-6">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">{this.props.label} encountered an error</h4>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400 break-words">{this.state.error?.message || "An unexpected error occurred while rendering this panel."}</p>
              {repeated && <p className="mt-1 text-[10px] text-red-500 dark:text-red-400 italic">This panel has crashed multiple times. Consider resetting the chaos configuration to restore defaults.</p>}
              <div className="mt-3 flex items-center gap-2">
                <button onClick={this.handleRetry} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500">Retry</button>
                {this.props.onReset && <button onClick={this.handleResetAndRetry} className="rounded-md border border-red-400 dark:border-red-700 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/30">Reset &amp; Retry</button>}
                <button onClick={this.handleCopyError} className="rounded-md px-2 py-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-300" title="Copy error message">Copy Error</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
