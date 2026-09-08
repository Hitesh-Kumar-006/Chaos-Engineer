"use client";

import { useEffect, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface LogEntry {
  type: "stdout" | "stderr" | "stdin";
  message: string;
  timestamp?: Date;
}

/** Structured run metrics returned by /api/execute. */
export interface Diagnostics {
  time: number;
  memory: number;
  sorting: boolean;
}

/** Chaos report metadata returned by the backend after a chaos-aware execution. */
export interface ChaosReportTelemetry {
  faulted: boolean;
  injected: string[];
  addedLatencyMs: number;
}

interface Props {
  logs: LogEntry[];
  diagnostics?: Diagnostics | null;
  status?: string | null;
  chaosReport?: ChaosReportTelemetry | null;
  onClear?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ConsoleOutput({ logs, diagnostics, status, chaosReport, onClear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Console Output
          </span>
          {/* Dynamic execution status */}
          {status && (
            <span
              className={
                status === "done"
                  ? "font-mono text-[11px] text-emerald-400"
                  : "animate-pulse font-mono text-[11px] text-amber-400"
              }
            >
              {status}
            </span>
          )}
        </div>
        {onClear && logs.length > 0 && (
          <button
            onClick={onClear}
            className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto bg-zinc-50 dark:bg-black p-4 font-mono text-[13px] leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-zinc-400 dark:text-zinc-600">
              No output yet. Run code to see results here.
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((entry, i) => (
              <div key={i} className="flex gap-2">
                {/* Line number */}
                <span className="select-none text-zinc-400 dark:text-zinc-600">
                  {String(i + 1).padStart(3, " ")}
                </span>

                {/* Message */}
                <span
                  className={
                    entry.type === "stderr"
                      ? "text-red-500 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }
                >
                  {entry.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diagnostics status bar */}
      {diagnostics && (
        <div className="flex flex-row items-center gap-6 text-xs font-mono text-zinc-500 dark:text-gray-400 bg-zinc-100 dark:bg-gray-900/50 px-4 py-2 border-t border-zinc-200 dark:border-gray-800">
          <span className="flex items-center gap-1.5">
            {/* Clock icon */}
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6l4 2"
              />
            </svg>
            Time:
            <span className="font-semibold text-zinc-800 dark:text-gray-200">
              {diagnostics.time}ms
            </span>
          </span>

          <span className="flex items-center gap-1.5">
            {/* Chip icon */}
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <rect x="6" y="6" width="12" height="12" rx="1" />
              <path
                strokeLinecap="round"
                d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"
              />
            </svg>
            Memory:
            <span className="font-semibold text-zinc-800 dark:text-gray-200">
              {diagnostics.memory}MB
            </span>
          </span>

          {diagnostics.sorting && (
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              {/* Sort icon */}
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 6h18M6 12h12M10 18h4"
                />
              </svg>
              Sorting Detected
            </span>
          )}
        </div>
      )}

      {/* Chaos injection telemetry bar */}
      {chaosReport && (
        <div className={`flex flex-row items-center gap-4 text-xs font-mono px-4 py-2 border-t border-zinc-200 dark:border-gray-800 ${
          chaosReport.faulted
            ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
            : "bg-zinc-100 dark:bg-gray-900/50 text-zinc-500 dark:text-gray-400"
        }`}>
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="font-semibold">{chaosReport.faulted ? "FAULT" : "CHAOS"}</span>
          </span>
          <span className="flex items-center gap-1">
            +{chaosReport.addedLatencyMs.toFixed(0)}ms
          </span>
          {chaosReport.injected.length > 0 && (
            <span className="truncate opacity-75" title={chaosReport.injected.join(" | ")}>
              {chaosReport.injected.join(" | ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
