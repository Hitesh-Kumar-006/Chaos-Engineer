"use client";
import React from "react";
interface Props { label: string; children: React.ReactNode }
interface State { hasError: boolean; error: Error | null }
export default class PaneErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("[PaneErrorBoundary/" + this.props.label + "]", error, info.componentStack); }
  handleRetry = () => { this.setState({ hasError: false, error: null }); };
  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-6">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">{this.props.label} encountered an error</h4>
              <p className="mt-1 text-xs text-red-600 dark:text-red-400 break-words">{this.state.error?.message || "An unexpected error occurred while rendering this panel."}</p>
              <button onClick={this.handleRetry} className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-500">Retry</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
