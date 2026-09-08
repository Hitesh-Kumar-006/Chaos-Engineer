"use client";

import { type EvaluationResult, type CodeTier, TIER_PRESETS } from "@/lib/challenges/evaluateCode";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  open: boolean;
  result: EvaluationResult | null;
  onSubmit: () => void;
  onRetry: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const TIER_STYLES: Record<CodeTier, { badge: string; text: string; ring: string; bar: string }> = {
  D: {
    badge: "bg-red-500/15 border-red-500/30",
    text: "text-red-400",
    ring: "ring-red-500/20",
    bar: "bg-red-500",
  },
  C: {
    badge: "bg-amber-500/15 border-amber-500/30",
    text: "text-amber-400",
    ring: "ring-amber-500/20",
    bar: "bg-amber-500",
  },
  B: {
    badge: "bg-sky-500/15 border-sky-500/30",
    text: "text-sky-400",
    ring: "ring-sky-500/20",
    bar: "bg-sky-500",
  },
  A: {
    badge: "bg-emerald-500/15 border-emerald-500/30",
    text: "text-emerald-400",
    ring: "ring-emerald-500/20",
    bar: "bg-emerald-500",
  },
};

const TIER_LABELS: Record<CodeTier, string> = {
  D: "Basic",
  C: "Competent",
  B: "Proficient",
  A: "Expert",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChallengeResultsModal({ open, result, onSubmit, onRetry }: Props) {
  if (!open || !result) return null;

  const preset = TIER_PRESETS[result.tier];
  const style = TIER_STYLES[result.tier];
  const maxScore = 14;
  const pct = Math.min((Math.max(result.score, 0) / maxScore) * 100, 100);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl shadow-black/20 dark:shadow-black/40">

        {/* ── Header strip ── */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">
            Challenge Evaluation
          </h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Code analysis complete — tier rating and stress-test preset assigned
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* ── Tier rating row ── */}
          <div className="flex items-center gap-4">
            {/* Badge */}
            <div
              className={`flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center rounded-xl border ring-1 ${style.badge} ${style.ring}`}
            >
              <span className={`text-3xl font-black leading-none ${style.text}`}>
                {result.tier}
              </span>
              <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-zinc-500 dark:text-zinc-500">
                Tier
              </span>
            </div>

            {/* Label + score */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <div>
                <p className={`text-sm font-bold ${style.text}`}>
                  {result.tier} Tier — {TIER_LABELS[result.tier]}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
                  Score: <span className="font-semibold text-zinc-800 dark:text-zinc-300">{result.score}</span>
                  <span className="text-zinc-400 dark:text-zinc-600"> / {maxScore} pts</span>
                </p>
              </div>
              {/* Score bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Detected patterns — 2-column compact grid ── */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-4">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
              Code Analysis
            </p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {result.patterns.map((p, i) => {
                const isPenalty = p.weight < 0;
                return (
                  <div key={i} className="flex items-center gap-1.5">
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-[9px] font-bold ${
                        isPenalty
                          ? "bg-red-500/20 text-red-400"
                          : p.found
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600"
                      }`}
                    >
                      {isPenalty ? "!" : p.found ? "✓" : "✗"}
                    </span>
                    <span
                      className={`truncate text-[11px] leading-tight ${
                        isPenalty
                          ? "text-red-400"
                          : p.found
                            ? "text-zinc-800 dark:text-zinc-300"
                            : "text-zinc-400 dark:text-zinc-600"
                      }`}
                    >
                      {p.label.replace(/ \(.+\)$/, "")}
                    </span>
                    {p.found && (
                      <span
                        className={`ml-auto shrink-0 text-[9px] font-bold tabular-nums ${
                          isPenalty ? "text-red-400" : "text-zinc-500"
                        }`}
                      >
                        {isPenalty ? `${p.weight}` : `+${p.weight}`}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Chaos Matrix preset ── */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                Chaos Preset
              </p>
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.badge} ${style.text}`}
              >
                {preset.presetName}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
              {preset.description}
            </p>

            {/* Slider values — 2×2 grid */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: "Network Lag", value: `${preset.latencyJitterMs}`, unit: "ms" },
                { label: "Memory Bloat", value: `${preset.memoryLeakMb}`, unit: "MB" },
                { label: "Crash Chance", value: `${preset.failureRate}`, unit: "%" },
                { label: "Freeze Time", value: `${preset.eventLoopBlockMs}`, unit: "ms" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-zinc-100 dark:bg-zinc-900 px-3 py-2"
                >
                  <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-500">{s.label}</span>
                  <span className="text-xs font-bold tabular-nums text-zinc-800 dark:text-zinc-200">
                    {s.value}
                    <span className="ml-0.5 text-[10px] font-normal text-zinc-500">{s.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={onSubmit}
              className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow transition hover:bg-sky-500 active:scale-[0.98]"
            >
              Submit and Proceed
            </button>
            <button
              onClick={onRetry}
              className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/50 px-4 py-2.5 text-[13px] font-semibold text-zinc-700 dark:text-zinc-300 transition hover:border-zinc-400 dark:hover:border-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 active:scale-[0.98]"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
