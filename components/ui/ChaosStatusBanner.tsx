"use client";
import type { ChaosConfig } from "@/lib/execution/chaos";
export interface ChaosReport { faulted: boolean; injected: string[]; addedLatencyMs: number; config: ChaosConfig }
interface Props { config: ChaosConfig; difficulty: "mild" | "moderate" | "chaos"; lastReport: ChaosReport | null; onResetChaos?: () => void; onRetryExecution?: () => void }
const M: Record<string, { l: string; c: string; bg: string }> = {
  mild: { l: "Mild", c: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500" },
  moderate: { l: "Moderate", c: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500" },
  chaos: { l: "Chaos", c: "text-red-600 dark:text-red-400", bg: "bg-red-500" },
};
function active(cfg: ChaosConfig) { return cfg.latencyJitterMs > 0 || cfg.memoryLeakMb > 0 || cfg.failureRate > 0 || cfg.eventLoopBlockMs > 0; }
function preset(p?: string) { return (!p || p === "custom") ? "Custom" : p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function ChaosStatusBanner({ config, difficulty, lastReport, onResetChaos, onRetryExecution }: Props) {
  const m = M[difficulty] ?? M.mild;
  const on = active(config);
  const faulted = lastReport?.faulted;
  return (
    <div className={`rounded-lg border px-3 py-2 transition-colors ${
      faulted ? "border-red-400 dark:border-red-700 bg-red-50/80 dark:bg-red-950/30"
      : difficulty === "chaos" ? "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
      : difficulty === "moderate" ? "border-sky-300 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20"
      : "border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            {on && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${m.bg}`} />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${faulted ? "bg-red-500" : m.bg}`} />
          </span>
          <span className={`text-xs font-bold uppercase tracking-wider ${faulted ? "text-red-600 dark:text-red-400" : m.c}`}>{faulted ? "Fault Active" : m.l + " Mode"}</span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">Preset: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{preset(config.activePreset)}</span></span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
          {config.latencyJitterMs > 0 && <span className={difficulty === "chaos" ? "text-red-500" : "text-zinc-600 dark:text-zinc-300"}>+{config.latencyJitterMs}ms lag</span>}
          {config.memoryLeakMb > 0 && <span className={difficulty === "chaos" ? "text-red-500" : "text-zinc-600 dark:text-zinc-300"}>{config.memoryLeakMb}MB leak</span>}
          {config.failureRate > 0 && <span className={difficulty === "chaos" ? "text-red-500" : difficulty === "moderate" ? "text-amber-500" : "text-zinc-600 dark:text-zinc-300"}>{config.failureRate}% fail</span>}
          {config.eventLoopBlockMs > 0 && <span className={difficulty === "chaos" ? "text-red-500" : "text-zinc-600 dark:text-zinc-300"}>{config.eventLoopBlockMs}ms freeze</span>}
          {!on && <span className="text-zinc-400 dark:text-zinc-600 italic">No active injections</span>}
        </div>
      </div>
      {lastReport && (
        <div className="mt-1.5 flex items-center gap-3 border-t border-zinc-200/50 dark:border-zinc-700/50 pt-1.5 text-[10px]">
          <span className={`font-semibold uppercase tracking-wider ${lastReport.faulted ? "text-red-500 dark:text-red-400" : "text-emerald-500 dark:text-emerald-400"}`}>
            {lastReport.faulted ? "Fault Triggered" : "Injection Clean"}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">+{lastReport.addedLatencyMs.toFixed(0)}ms added latency</span>
          {lastReport.injected.length > 0 && <span className="truncate text-zinc-400 dark:text-zinc-500" title={lastReport.injected.join(" | ")}>{lastReport.injected.join(" | ")}</span>}
          {lastReport.faulted && (
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {onRetryExecution && <button onClick={onRetryExecution} className="rounded bg-amber-600 px-2 py-0.5 text-[9px] font-semibold text-white transition hover:bg-amber-500">Retry Run</button>}
              {onResetChaos && <button onClick={onResetChaos} className="rounded border border-red-400 dark:border-red-700 px-2 py-0.5 text-[9px] font-semibold text-red-500 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-900/30">Reset Chaos</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
