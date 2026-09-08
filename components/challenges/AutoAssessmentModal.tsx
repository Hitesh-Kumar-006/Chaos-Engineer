"use client";

import { useState, useEffect, useCallback } from "react";
import { useGameEngine, type Difficulty } from "@/context/GameEngineContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  /** Controlled by the parent -- true when the modal should be visible. */
  open: boolean;
  /** Called when the user dismisses the modal (complete or close). */
  onClose: () => void;
}

interface DiagnosticMetrics {
  avgLatencyMs: number;
  memorySpikeMb: number;
  errorRate: number;
  score: number;
  recommendedDifficulty: Difficulty;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ASSESSMENT_DURATION = 300; // 5 minutes in seconds

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-sky-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function diffColor(d: Difficulty): string {
  const map: Record<Difficulty, string> = {
    mild: "text-emerald-400",
    moderate: "text-sky-400",
    chaos: "text-red-400",
  };
  return map[d];
}

/**
 * Simulate running a diagnostic assessment and produce metrics.
 *
 * In a real implementation this would execute the user's submitted code
 * against a test harness.  Here we generate realistic random metrics
 * and derive a score + recommended difficulty.
 */
function simulateAssessment(): DiagnosticMetrics {
  const avgLatencyMs = 40 + Math.random() * 260; // 40 - 300
  const memorySpikeMb = 5 + Math.random() * 75; // 5 - 80
  const errorRate = Math.random() * 35; // 0 - 35 %

  // Weighted score: lower latency, lower memory, lower error rate = better
  const latencyScore = Math.max(0, 100 - (avgLatencyMs / 300) * 100);
  const memoryScore = Math.max(0, 100 - (memorySpikeMb / 80) * 100);
  const errorScore = Math.max(0, 100 - (errorRate / 35) * 100);
  const score = Math.round((latencyScore + memoryScore + errorScore) / 3);

  let recommendedDifficulty: Difficulty;
  if (score >= 70) recommendedDifficulty = "chaos";
  else if (score >= 45) recommendedDifficulty = "moderate";
  else recommendedDifficulty = "mild";

  return {
    avgLatencyMs: Math.round(avgLatencyMs),
    memorySpikeMb: Math.round(memorySpikeMb),
    errorRate: Math.round(errorRate * 10) / 10,
    score,
    recommendedDifficulty,
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AutoAssessmentModal({ open, onClose }: Props) {
  const { setDifficulty, setMode } = useGameEngine();

  const [timeLeft, setTimeLeft] = useState(ASSESSMENT_DURATION);
  const [running, setRunning] = useState(false);
  const [metrics, setMetrics] = useState<DiagnosticMetrics | null>(null);
  const [submitted, setSubmitted] = useState(false);

  /* ---- 5-minute assessment timer ----------------------------------- */
  useEffect(() => {
    if (!open || !running) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => clearInterval(interval);
  }, [open, running]);

  /* ---- Reset when modal opens ------------------------------------- */
  useEffect(() => {
    if (open) {
      setTimeLeft(ASSESSMENT_DURATION);
      setRunning(true);
      setMetrics(null);
      setSubmitted(false);
    }
  }, [open]);

  /* ---- Complete / submit the assessment --------------------------- */
  const complete = useCallback(() => {
    const result = simulateAssessment();
    setMetrics(result);
    setRunning(false);
    setSubmitted(true);
  }, []);

  /* ---- Apply the recommended difficulty --------------------------- */
  function applyRecommendation() {
    if (!metrics) return;
    setDifficulty(metrics.recommendedDifficulty);
    setMode("manual");
    onClose();
  }

  /* ---- Cancel & revert to manual ---------------------------------- */
  function cancel() {
    setMode("manual");
    onClose();
  }

  if (!open) return null;

  const progress = ((ASSESSMENT_DURATION - timeLeft) / ASSESSMENT_DURATION) * 100;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Diagnostic Assessment
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              5-minute evaluation to calibrate your difficulty tier
            </p>
          </div>
          <span className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 font-mono text-sm font-bold tabular-nums text-zinc-800 dark:text-zinc-300">
            {formatTime(timeLeft)}
          </span>
        </div>

        {/* Progress bar */}
        {running && (
          <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Running state */}
        {running && !submitted && (
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800/50 p-5">
              <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-300">
                Implement a Health-Check Endpoint
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Write a{" "}
                <code className="text-violet-400">/health</code> endpoint that
                returns <code className="text-violet-400">200</code> when all
                dependencies are healthy and{" "}
                <code className="text-violet-400">503</code> when any critical
                dependency is degraded. Include timeout handling (2 s) for each
                dependency probe.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Latency", icon: "\u23F1" },
                { label: "Memory", icon: "\uD83E\uDDE0" },
                { label: "Error Rate", icon: "\u26A0" },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 px-3 py-2 text-center"
                >
                  <span className="text-lg">{m.icon}</span>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    {m.label}
                  </p>
                  <p className="text-xs text-zinc-400">measuring...</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={complete}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Submit Solution
              </button>
              <button
                onClick={cancel}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Results state */}
        {submitted && metrics && (
          <div className="mt-6 space-y-5">
            {/* Score */}
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-800/50 px-5 py-3">
                <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                  Score
                </span>
                <span className={`text-3xl font-black ${scoreColor(metrics.score)}`}>
                  {metrics.score}
                </span>
              </div>
              <div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  Recommended tier:{" "}
                  <span
                    className={`font-bold capitalize ${diffColor(metrics.recommendedDifficulty)}`}
                  >
                    {metrics.recommendedDifficulty}
                  </span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Based on your latency, memory, and error-handling profile.
                </p>
              </div>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Avg Latency", value: `${metrics.avgLatencyMs} ms` },
                { label: "Memory Spike", value: `${metrics.memorySpikeMb} MB` },
                { label: "Error Rate", value: `${metrics.errorRate}%` },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 px-3 py-2 text-center"
                >
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    {m.label}
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
                    {m.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={applyRecommendation}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Apply &amp; Continue
              </button>
              <button
                onClick={cancel}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
