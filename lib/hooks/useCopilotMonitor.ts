"use client";

/**
 * Event-driven Copilot monitoring hook.
 *
 * Analyses performance metrics ONLY when an explicit event fires
 * (challenge submitted or stress-test completed).  Zero background
 * polling - the hook is entirely reactive.
 */

import { useEffect, useRef } from "react";
import type { CodeTier } from "@/lib/challenges/evaluateCode";

/* ------------------------------------------------------------------ */
/*  Event types                                                        */
/* ------------------------------------------------------------------ */

export interface ChallengeSubmitEvent {
  kind: "challenge_submitted";
  tier: CodeTier;
  score: number;
  language: string;
  challengeTitle: string;
  presetName: string;
  patterns: { label: string; found: boolean; weight: number }[];
}

export interface StressTestEvent {
  kind: "stress_test_completed";
  p50: number;
  p95: number;
  p99: number;
  mtbf: number;
  successRate: number;
  grade: string;
}

export type CopilotEvent = ChallengeSubmitEvent | StressTestEvent;

/* ------------------------------------------------------------------ */
/*  Analysis engine                                                    */
/* ------------------------------------------------------------------ */

function analyzeChallengeSubmit(ev: ChallengeSubmitEvent): string {
  const parts: string[] = [];

  switch (ev.tier) {
    case "A":
      parts.push(
        `Excellent work on "${ev.challengeTitle}" (${ev.language}) - A Tier with ${ev.score} pts! ` +
          `Your code demonstrates strong input validation, error handling, bounds checking, and null safety. ` +
          `The "${ev.presetName}" stress preset will push your solution to the limit.`,
      );
      break;
    case "B":
      parts.push(
        `Solid B Tier (${ev.score} pts) on "${ev.challengeTitle}". ` +
          `Your solution handles most safety patterns well.`,
      );
      break;
    case "C":
      parts.push(
        `C Tier (${ev.score} pts) on "${ev.challengeTitle}". ` +
          `The basics are there, but some safety checks are missing.`,
      );
      break;
    case "D":
      parts.push(
        `D Tier (${ev.score} pts) on "${ev.challengeTitle}". ` +
          `The code needs significant improvement in defensive programming.`,
      );
      break;
  }

  const missing = ev.patterns.filter((p) => !p.found && p.weight > 0);
  if (missing.length > 0) {
    const topMissing = missing
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((p) => p.label.replace(/ \(.+\)$/, ""));
    parts.push(`To improve, focus on adding: ${topMissing.join(", ")}.`);
  }

  const penalties = ev.patterns.filter((p) => p.found && p.weight < 0);
  if (penalties.length > 0) {
    const names = penalties
      .map((p) => `${p.label.replace(/ \(.+\)$/, "")} (${p.weight})`)
      .join(", ");
    parts.push(`Anti-patterns detected: ${names}. Address these to avoid deductions.`);
  }

  return parts.join(" ");
}

function analyzeStressTest(ev: StressTestEvent): string {
  const parts: string[] = [];

  parts.push(
    `Stress test complete - Grade: ${ev.grade}, ` +
      `Success rate: ${ev.successRate.toFixed(1)}%, ` +
      `P95 latency: ${ev.p95.toFixed(0)}ms.`,
  );

  if (ev.p99 > 2000) {
    parts.push(
      `P99 latency is ${ev.p99.toFixed(0)}ms - critically high. ` +
        `Consider connection pooling, caching hot paths, or reducing payload size.`,
    );
  } else if (ev.p95 > 1000) {
    parts.push(
      `P95 at ${ev.p95.toFixed(0)}ms indicates moderate tail latency. ` +
        `Profile slow endpoints and check for N+1 queries.`,
    );
  }

  if (ev.successRate < 80) {
    parts.push(
      `Only ${ev.successRate.toFixed(1)}% of requests succeeded. ` +
        `Implement circuit breakers and retry logic with exponential backoff.`,
    );
  } else if (ev.successRate < 95) {
    parts.push(
      `Success rate below 95% (${ev.successRate.toFixed(1)}%). ` +
        `Add health checks and graceful degradation for partial failures.`,
    );
  }

  if (ev.mtbf > 0 && ev.mtbf < 5) {
    parts.push(
      `MTBF of ${ev.mtbf.toFixed(1)}s is very low - the system fails frequently under stress. ` +
        `Review error boundaries and ensure all external calls have timeouts.`,
    );
  }

  return parts.join(" ");
}

function analyze(ev: CopilotEvent): string {
  switch (ev.kind) {
    case "challenge_submitted":
      return analyzeChallengeSubmit(ev);
    case "stress_test_completed":
      return analyzeStressTest(ev);
  }
}

/* ------------------------------------------------------------------ */
/*  Improvement detection                                              */
/* ------------------------------------------------------------------ */

const TIER_RANK: Record<CodeTier, number> = { D: 0, C: 1, B: 2, A: 3 };

function detectImprovement(
  current: CopilotEvent,
  previous: CopilotEvent | null,
): string | null {
  if (!previous) {
    if (current.kind === "challenge_submitted") {
      return `First challenge scored ${current.score} pts (${current.tier} Tier). Keep going!`;
    }
    return null;
  }

  if (
    current.kind === "challenge_submitted" &&
    previous.kind === "challenge_submitted"
  ) {
    const curRank = TIER_RANK[current.tier];
    const prevRank = TIER_RANK[previous.tier];

    if (curRank > prevRank) {
      return `Tier upgrade! ${previous.tier} \u2192 ${current.tier} (${current.score} pts). Great progress!`;
    }
    if (curRank === prevRank && current.score > previous.score) {
      const delta = current.score - previous.score;
      return `Score improved by +${delta} pts on ${current.tier} Tier. Nice refinement!`;
    }
  }

  if (
    current.kind === "stress_test_completed" &&
    previous.kind === "stress_test_completed"
  ) {
    if (current.successRate > previous.successRate + 5) {
      const delta = (current.successRate - previous.successRate).toFixed(1);
      return `Reliability up +${delta}%! Success rate now ${current.successRate.toFixed(1)}%.`;
    }
    if (
      current.p95 < previous.p95 - 200 &&
      current.successRate >= previous.successRate
    ) {
      return `P95 latency reduced from ${previous.p95.toFixed(0)}ms to ${current.p95.toFixed(0)}ms. Faster under pressure!`;
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

interface Options {
  onInsight: (insight: string) => void;
  onImprovement: (message: string) => void;
}

/**
 * React hook that runs performance analysis exclusively in response
 * to discrete events.  Uses a ref-guarded useEffect - no intervals,
 * no polling, no keystroke listeners.
 */
export function useCopilotMonitor(
  event: CopilotEvent | null,
  opts: Options,
): void {
  const lastProcessedRef = useRef<CopilotEvent | null>(null);

  useEffect(() => {
    if (!event || event === lastProcessedRef.current) return;
    const previous = lastProcessedRef.current;
    lastProcessedRef.current = event;

    setTimeout(() => {
      const insight = analyze(event);
      opts.onInsight(insight);

      const improvement = detectImprovement(event, previous);
      if (improvement) {
        opts.onImprovement(improvement);
      }
    }, 0);
  }, [event]); // eslint-disable-line react-hooks/exhaustive-deps
}
