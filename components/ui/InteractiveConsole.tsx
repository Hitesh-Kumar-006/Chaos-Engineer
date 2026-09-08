"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import type { LogEntry, Diagnostics, ChaosReportTelemetry } from "@/components/telemetry/ConsoleOutput";
export type { LogEntry, Diagnostics, ChaosReportTelemetry };

interface Props {
  logs: LogEntry[];
  diagnostics?: Diagnostics | null;
  status?: string | null;
  chaosReport?: ChaosReportTelemetry | null;
  onClear?: () => void;
  onStdin?: (input: string) => void;
  disabled?: boolean;
}

export default function InteractiveConsole({ logs, diagnostics, status, chaosReport, onClear, onStdin, disabled = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const draftRef = useRef("");

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, input]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const text = input.trim();
      if (!text) return;
      setHistory((h) => [text, ...h]);
      setHistoryIdx(-1);
      draftRef.current = "";
      setInput("");
      onStdin?.(text);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIdx === -1) draftRef.current = input;
      const next = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(next);
      setInput(history[next]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx <= 0) { setHistoryIdx(-1); setInput(draftRef.current); return; }
      const next = historyIdx - 1;
      setHistoryIdx(next);
      setInput(history[next]);
    }
  }, [input, history, historyIdx, onStdin]);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between border-b border-zinc-700/60 bg-zinc-900 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Terminal</span>
          {status && <span className={status === "done" ? "font-mono text-[11px] text-emerald-400" : "animate-pulse font-mono text-[11px] text-amber-400"}>{status}</span>}
        </div>
        {onClear && logs.length > 0 && (
          <button onClick={onClear} className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 transition hover:text-zinc-300">Clear</button>
        )}
      </div>

      <div ref={scrollRef} onClick={() => setFocused(true)} className="h-72 cursor-text overflow-y-auto bg-black p-4 font-mono text-[13px] leading-relaxed">
        {logs.length === 0 && !focused && (
          <div className="flex h-full items-center justify-center"><span className="text-zinc-600">No output yet. Run code or type a command below.</span></div>
        )}
        <div className="space-y-0.5">
          {logs.map((entry, i) => {
            if (entry.type === "stdin") {
              return <div key={i} className="flex gap-1"><span className="shrink-0 text-sky-400 font-bold">$</span><span className="text-zinc-300">{entry.message}</span></div>;
            }
            return (
              <div key={i} className="flex gap-2">
                <span className="shrink-0 select-none text-zinc-600">{String(i + 1).padStart(3, " ")}</span>
                <span className={entry.type === "stderr" ? "text-red-400" : "text-emerald-400"}>{entry.message}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className="shrink-0 text-sky-400 font-bold">$</span>
          <span className="text-zinc-200">{input}</span>
          {focused && !disabled && <span className="inline-block h-[14px] w-[7px] animate-pulse bg-zinc-200 align-middle" />}
          {disabled && <span className="ml-2 text-[10px] text-amber-500 animate-pulse">executing…</span>}
        </div>
      </div>

      {focused && !disabled && (
        <input autoFocus className="absolute opacity-0 h-0 w-0" aria-label="Terminal input" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onBlur={() => setFocused(false)} />
      )}

      {diagnostics && (
        <div className="flex flex-row items-center gap-6 text-xs font-mono text-zinc-400 bg-zinc-900 px-4 py-2 border-t border-zinc-800">
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /></svg>
            Time: <span className="font-semibold text-zinc-200">{diagnostics.time}ms</span>
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="6" y="6" width="12" height="12" rx="1" /><path strokeLinecap="round" d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></svg>
            Memory: <span className="font-semibold text-zinc-200">{diagnostics.memory}MB</span>
          </span>
          {diagnostics.sorting && <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Sorting Detected</span>}
        </div>
      )}

      {chaosReport && (
        <div className={`flex flex-row items-center gap-4 text-xs font-mono px-4 py-2 border-t border-zinc-800 ${chaosReport.faulted ? "bg-red-950/40 text-red-400" : "bg-zinc-900 text-zinc-500"}`}>
          <span className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
            <span className="font-semibold">{chaosReport.faulted ? "FAULT" : "CHAOS"}</span>
          </span>
          <span>+{chaosReport.addedLatencyMs.toFixed(0)}ms</span>
          {chaosReport.injected.length > 0 && <span className="truncate opacity-75" title={chaosReport.injected.join(" | ")}>{chaosReport.injected.join(" | ")}</span>}
        </div>
      )}
    </div>
  );
}
