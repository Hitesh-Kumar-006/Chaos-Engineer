"use client";

import { useState, useRef, useCallback } from "react";
import type { ChaosConfig } from "@/lib/execution/chaos";
import {
  applyChaosBeforeRun,
  applyChaosAfterRun,
  buildRoundConfigs,
  ChaosError,
  ROUND_DISRUPTIONS,
  ROUND_LABELS,
  type DisruptionType,
} from "@/lib/execution/chaos";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CodeExecutionResult {
  stdout: string;
  stderr: string;
  success: boolean;
  latencyMs: number;
}

interface Props {
  config: ChaosConfig;
  /** Current difficulty tier — scales the per-round disruption intensity. */
  difficulty: "mild" | "moderate" | "chaos";
  onRunComplete?: (report: StressReport) => void;
  /** Execute user code once — called by the round runner. */
  codeExecutor?: () => Promise<CodeExecutionResult>;
  /** Stream a log line to the Console Output. */
  onLog?: (entry: { type: "stdout" | "stderr"; message: string }) => void;
  /** Report line numbers that caused failures (for editor blame highlighting). */
  onBlame?: (lines: number[]) => void;
}

interface RoundResult {
  round: number;
  disruptionType: DisruptionType;
  latencyMs: number;
  success: boolean;
  error: string | null;
  summary: string[];
}

export interface StressReport {
  iterations: RoundResult[];
  p50: number;
  p95: number;
  p99: number;
  mtbf: number;
  successRate: number;
  grade: string;
}

type Phase = "idle" | "running" | "waiting-for-fix" | "complete";

const TOTAL_ROUNDS = 5;

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(0)}ms`;
}

function formatMtbf(hours: number): string {
  if (!isFinite(hours)) return "\u221E";
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${(hours * 60).toFixed(0)}m`;
}

/* ------------------------------------------------------------------ */
/*  Percentile                                                         */
/* ------------------------------------------------------------------ */

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/* ------------------------------------------------------------------ */
/*  Grading                                                            */
/* ------------------------------------------------------------------ */

function computeGrade(successRate: number, p99: number): string {
  if (successRate >= 99 && p99 < 500) return "A+";
  if (successRate >= 99) return "A";
  if (successRate >= 95) return "B";
  if (successRate >= 90) return "C";
  if (successRate >= 80) return "D";
  return "F";
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-400";
  if (grade === "B") return "text-sky-400";
  if (grade === "C") return "text-amber-400";
  return "text-red-400";
}

/* ------------------------------------------------------------------ */
/*  Line number extraction                                             */
/* ------------------------------------------------------------------ */

function extractLineNumbers(text: string): number[] {
  const lines: number[] = [];
  // Match "[ErrorType] Line 5:" pattern (from JS executor)
  const re1 = /\]\s*Line\s+(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > 0) lines.push(n);
  }
  // Match "line 5" pattern (from Python/Java/C++ compilers)
  const re2 = /\bline\s+(\d+)\b/gi;
  while ((m = re2.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > 0 && !lines.includes(n)) lines.push(n);
  }
  return lines;
}

/* ------------------------------------------------------------------ */
/*  Report builder                                                     */
/* ------------------------------------------------------------------ */

function buildReport(results: RoundResult[]): StressReport {
  const successful = results.filter((r) => r.success);
  const latencies = successful.map((r) => r.latencyMs).sort((a, b) => a - b);

  const p50 = percentile(latencies, 50);
  const p95 = percentile(latencies, 95);
  const p99 = percentile(latencies, 99);

  const totalSuccessMs = successful.reduce((s, r) => s + r.latencyMs, 0);
  const failureCount = results.length - successful.length;
  const mtbf =
    failureCount > 0 ? totalSuccessMs / failureCount / 3_600_000 : Infinity;

  const successRate = results.length > 0
    ? (successful.length / results.length) * 100
    : 0;
  const grade = computeGrade(successRate, p99);

  return { iterations: results, p50, p95, p99, mtbf, successRate, grade };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StressTestSuite({
  config,
  difficulty,
  onRunComplete,
  codeExecutor,
  onLog,
  onBlame,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentRound, setCurrentRound] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [report, setReport] = useState<StressReport | null>(null);

  const blameLinesRef = useRef<Set<number>>(new Set());
  const codeExecutorRef = useRef(codeExecutor);
  codeExecutorRef.current = codeExecutor;
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;
  const onBlameRef = useRef(onBlame);
  onBlameRef.current = onBlame;

  /* ---- Execute a single round ----------------------------------- */
  const runRound = useCallback(
    async (roundIdx: number, roundConfigs: ChaosConfig[]) => {
      const roundConfig = roundConfigs[roundIdx];
      const disruptionType = ROUND_DISRUPTIONS[roundIdx];
      const label = ROUND_LABELS[disruptionType];
      const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

      blameLinesRef.current = new Set();
      onBlameRef.current?.([]);
      setPhase("running");
      setCurrentRound(roundIdx);

      onLogRef.current?.({ type: "stdout", message: "" });
      onLogRef.current?.({
        type: "stdout",
        message: `━━━ Round ${roundIdx + 1}/${TOTAL_ROUNDS}: ${label} (${diffLabel}) ━━━`,
      });

      const t0 = performance.now();
      let success = true;
      let error: string | null = null;
      const summary: string[] = [];

      try {
        /* ---- Pre-run chaos ---------------------------------------- */
        const pre = await applyChaosBeforeRun(roundConfig);
        summary.push(...pre.summary);
        for (const line of pre.summary) {
          onLogRef.current?.({ type: "stdout", message: `  \u26A1 ${line}` });
        }

        /* ---- Execute user code with timeout guard ------------------ */
        if (codeExecutorRef.current) {
          const STRESS_ROUND_TIMEOUT_MS = 35_000;
          let exec: Awaited<ReturnType<NonNullable<Props["codeExecutor"]>>>;
          try {
            exec = await Promise.race([
              codeExecutorRef.current(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`[StressRound] Execution timed out after ${STRESS_ROUND_TIMEOUT_MS / 1000}s`)), STRESS_ROUND_TIMEOUT_MS),
              ),
            ]);
          } catch (timeoutErr) {
            const msg = timeoutErr instanceof Error ? timeoutErr.message : "Execution timed out";
            success = false;
            error = msg;
            summary.push(`TIMEOUT: ${msg}`);
            onLogRef.current?.({ type: "stderr", message: `  TIMEOUT: ${msg}` });
            /* Skip post-run chaos on timeout */
            const latencyMs = performance.now() - t0;
            const result: RoundResult = { round: roundIdx, disruptionType, latencyMs, success, error, summary };
            onLogRef.current?.({ type: "stderr", message: `  ✗ Round ${roundIdx + 1} FAILED (${latencyMs.toFixed(0)}ms)` });
            onLogRef.current?.({ type: "stdout", message: "" });
            return result;
          }
          summary.push(`Code: ${exec.success ? "OK" : "ERROR"} (${exec.latencyMs.toFixed(0)}ms)`);
          if (exec.stdout) {
            for (const line of exec.stdout.split("\n").filter(Boolean)) {
              onLogRef.current?.({ type: "stdout", message: `  ${line}` });
            }
          }
          if (exec.stderr) {
            for (const line of exec.stderr.split("\n").filter(Boolean)) {
              onLogRef.current?.({ type: "stderr", message: `  ${line}` });
            }
          }
          if (!exec.success) {
            success = false;
            error = exec.stderr || "Code execution error";
            summary.push(`CODE ERROR: ${error}`);
            const lines = extractLineNumbers(error);
            for (const l of lines) blameLinesRef.current.add(l);
          }
        } else {
          await new Promise((r) => setTimeout(r, 20 + Math.random() * 10));
          summary.push("Simulated workload (no code executor)");
        }

        /* ---- Post-run chaos --------------------------------------- */
        const post = await applyChaosAfterRun(roundConfig);
        summary.push(...post.summary);
        for (const line of post.summary) {
          onLogRef.current?.({ type: "stdout", message: `  \u26A1 ${line}` });
        }
      } catch (err) {
        success = false;
        error = err instanceof ChaosError ? err.message : "Unknown chaos error";
        summary.push(`FAULT: ${error}`);
        onLogRef.current?.({ type: "stderr", message: `  FAULT: ${error}` });
      }

      const latencyMs = performance.now() - t0;
      const result: RoundResult = {
        round: roundIdx,
        disruptionType,
        latencyMs,
        success,
        error,
        summary,
      };

      onLogRef.current?.({
        type: success ? "stdout" : "stderr",
        message: `  \u2192 ${success ? "PASS" : "FAIL"} (${latencyMs.toFixed(0)}ms)${error ? ` \u2014 ${error}` : ""}`,
      });
      onLogRef.current?.({ type: "stdout", message: "" });

      /* ---- Advance or pause -------------------------------------- */
      if (success) {
        setResults((prev) => {
          const next = [...prev, result];
          if (roundIdx < TOTAL_ROUNDS - 1) {
            // Schedule next round after React processes this state update
            setTimeout(() => runRound(roundIdx + 1, roundConfigs), 0);
          } else {
            const rpt = buildReport(next);
            onLogRef.current?.({
              type: "stdout",
              message: `\u25B8 Challenge complete \u2014 Grade ${rpt.grade}, ${rpt.successRate.toFixed(0)}% success`,
            });
            setReport(rpt);
            setPhase("complete");
            onRunComplete?.(rpt);
          }
          return next;
        });
      } else {
        // Failure \u2014 pause for interactive fix & retry
        const blame = [...blameLinesRef.current].sort((a, b) => a - b);
        if (blame.length > 0) onBlameRef.current?.(blame);

        onLogRef.current?.({
          type: "stderr",
          message: `\u25B8 Round ${roundIdx + 1} FAILED. Fix your code and click \u201CRetry Round\u201D to continue.`,
        });

        setResults((prev) => [...prev, result]);
        setPhase("waiting-for-fix");
      }
    },
    [difficulty, onRunComplete],
  );

  /* ---- Start challenge -------------------------------------------- */
  const handleStart = useCallback(() => {
    setPhase("running");
    setResults([]);
    setReport(null);
    blameLinesRef.current = new Set();
    onBlameRef.current?.([]);

    const roundConfigs = buildRoundConfigs(difficulty);
    const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

    onLogRef.current?.({
      type: "stdout",
      message: `\u25B8 Starting 5-round resilience challenge (${diffLabel} difficulty)\u2026`,
    });
    onLogRef.current?.({ type: "stdout", message: "" });

    runRound(0, roundConfigs);
  }, [difficulty, runRound]);

  /* ---- Continue after pass ---------------------------------------- */
  const handleContinue = useCallback(() => {
    const roundConfigs = buildRoundConfigs(difficulty);
    runRound(currentRound + 1, roundConfigs);
  }, [difficulty, currentRound, runRound]);

  /* ---- Retry after fix -------------------------------------------- */
  const handleRetry = useCallback(() => {
    const roundConfigs = buildRoundConfigs(difficulty);
    // Remove the failed attempt from results so re-run replaces it
    setResults((prev) => prev.slice(0, -1));
    onLogRef.current?.({
      type: "stdout",
      message: `\u25B8 Retrying Round ${currentRound + 1}\u2026`,
    });
    runRound(currentRound, roundConfigs);
  }, [difficulty, currentRound, runRound]);

  /* ---- Skip a round ----------------------------------------------- */
  const handleSkip = useCallback(() => {
    if (currentRound < TOTAL_ROUNDS - 1) {
      const roundConfigs = buildRoundConfigs(difficulty);
      runRound(currentRound + 1, roundConfigs);
    } else {
      const rpt = buildReport(results);
      onLogRef.current?.({
        type: "stdout",
        message: `\u25B8 Challenge complete \u2014 Grade ${rpt.grade}, ${rpt.successRate.toFixed(0)}% success`,
      });
      setReport(rpt);
      setPhase("complete");
      onRunComplete?.(rpt);
    }
  }, [difficulty, currentRound, results, onRunComplete, runRound]);

  /* ---- Render ----------------------------------------------------- */
  const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const disruptionLabel =
    phase !== "idle" && currentRound < TOTAL_ROUNDS
      ? ROUND_LABELS[ROUND_DISRUPTIONS[currentRound]]
      : "";

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6">
      {/* Header + action button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Resilience Challenge
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {phase === "running" && currentRound < TOTAL_ROUNDS
              ? `Round ${currentRound + 1}/${TOTAL_ROUNDS}: Injecting ${disruptionLabel} (${diffLabel})`
              : phase === "waiting-for-fix"
                ? `Round ${currentRound + 1} failed \u2014 fix your code to continue`
                : phase === "complete"
                  ? "Challenge complete"
                  : `5 rounds \u00D7 ${diffLabel} difficulty \u2014 latency, memory, failures, combined, outage`}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {phase === "waiting-for-fix" && (
            <>
              <button
                onClick={handleSkip}
                className="flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Skip Round
              </button>
              <button
                onClick={handleRetry}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-amber-900/20 transition hover:bg-amber-500"
              >
                Retry Round
              </button>
            </>
          )}

          {phase === "idle" && (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/20 transition hover:bg-red-500"
            >
              Run Challenge
            </button>
          )}

          {phase === "running" && (
            <span className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-zinc-600" />
              Running\u2026
            </span>
          )}

          {phase === "complete" && (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/20 transition hover:bg-red-500"
            >
              Run Again
            </button>
          )}
        </div>
      </div>

      {/* Round progress indicators */}
      {phase !== "idle" && (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
              const r = results[i];
              const isActive = phase === "running" && i === currentRound;
              const isWaiting = phase === "waiting-for-fix" && i === currentRound;
              let pillClass =
                "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition ";
              if (r?.success) {
                pillClass +=
                  "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40";
              } else if (r && !r.success) {
                pillClass +=
                  "bg-red-500/20 text-red-400 ring-1 ring-red-500/40";
              } else if (isActive) {
                pillClass +=
                  "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40 animate-pulse";
              } else if (isWaiting) {
                pillClass +=
                  "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40 animate-pulse";
              } else {
                pillClass +=
                  "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 ring-1 ring-zinc-300 dark:ring-zinc-700";
              }
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div className={pillClass}>
                    {r?.success
                      ? "\u2713"
                      : r && !r.success
                        ? "\u2717"
                        : i + 1}
                  </div>
                  <span className="text-[8px] font-medium text-zinc-400">
                    {ROUND_LABELS[ROUND_DISRUPTIONS[i]]?.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          {(phase === "running" || phase === "waiting-for-fix") && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  phase === "waiting-for-fix" ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{
                  width: `${
                    (Math.min(results.length, TOTAL_ROUNDS) / TOTAL_ROUNDS) *
                    100
                  }%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Results report */}
      {report && phase === "complete" && (
        <div className="mt-6 space-y-6">
          {/* Grade + metrics grid */}
          <div className="flex items-start gap-6">
            <div className="flex flex-col items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-6 py-4">
              <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                SLA Grade
              </span>
              <span
                className={`mt-1 text-5xl font-black ${gradeColor(report.grade)}`}
              >
                {report.grade}
              </span>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: "p50", value: formatMs(report.p50) },
                { label: "p95", value: formatMs(report.p95) },
                { label: "p99", value: formatMs(report.p99) },
                { label: "MTBF", value: formatMtbf(report.mtbf) },
                {
                  label: "Success",
                  value: `${report.successRate.toFixed(0)}%`,
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-3 py-2 text-center"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                    {m.label}
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Round details */}
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition">
              Round details ({report.iterations.length} rounds)
            </summary>

            <div className="mt-3 space-y-1.5">
              {report.iterations.map((iter) => (
                <div
                  key={iter.round}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${
                    iter.success
                      ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30"
                      : "border-red-300 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20"
                  }`}
                >
                  <span className="font-mono text-zinc-500">
                    R{iter.round + 1}
                  </span>
                  <span className="rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                    {ROUND_LABELS[iter.disruptionType]}
                  </span>
                  <span
                    className={`font-semibold ${
                      iter.success ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {iter.success ? "PASS" : "FAIL"}
                  </span>
                  <span className="tabular-nums text-zinc-400">
                    {formatMs(iter.latencyMs)}
                  </span>
                  {iter.error && (
                    <span className="truncate text-red-400/70">
                      {iter.error}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
