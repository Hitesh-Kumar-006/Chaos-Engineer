/**
 * Lightweight async localStorage persistence for Chaos Engineering Lab.
 *
 * All reads and writes are deferred via setTimeout(0) so they never
 * block the main thread during rendering or user interactions.
 * State is only persisted on explicit user actions (challenge
 * completion, retry, config restore) — never on every render.
 */

import type { ChaosConfig } from "@/lib/execution/chaos";
import type { CodeTier } from "@/lib/challenges/evaluateCode";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ChallengeHistoryEntry {
  id: string;
  timestamp: number;
  language: string;
  challengeTitle: string;
  score: number;
  tier: CodeTier;
  presetName: string;
  config: {
    latencyJitterMs: number;
    memoryLeakMb: number;
    failureRate: number;
    eventLoopBlockMs: number;
  };
}

/** Persisted snapshot of a completed stress test run. */
export interface StressTestRecord {
  id: string;
  timestamp: number;
  grade: string;
  successRate: number;
  mtbf: number;
  latency: { p50: number; p95: number; p99: number };
  iterationCount: number;
  failureCount: number;
  errorMessages: string[];
  chaosConfig: {
    latencyJitterMs: number;
    memoryLeakMb: number;
    failureRate: number;
    eventLoopBlockMs: number;
    activePreset: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Storage keys                                                       */
/* ------------------------------------------------------------------ */

const KEYS = {
  HISTORY: "chaos-lab:history",
  LAST_CONFIG: "chaos-lab:last-config",
  STRESS_REPORTS: "chaos-lab:stress-reports",
} as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Defer execution to the next macrotask so localStorage I/O
 * never competes with the current render or event handler.
 */
function defer<T>(fn: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    }, 0);
  });
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    console.warn(`[persistence] localStorage read blocked for "${key}":`, err);
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    /* Storage full, privacy mode, or sandboxed read-only env */
    console.warn(`[persistence] localStorage write blocked for "${key}":`, err);
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[persistence] localStorage remove blocked for "${key}":`, err);
  }
}

/* ------------------------------------------------------------------ */
/*  Challenge history                                                  */
/* ------------------------------------------------------------------ */

/** Append a completed challenge entry to the history log. */
export async function saveHistoryEntry(
  entry: ChallengeHistoryEntry,
): Promise<void> {
  return defer(() => {
    const history = loadHistorySync();
    history.push(entry);
    safeSet(KEYS.HISTORY, JSON.stringify(history));
  });
}

/** Load all saved challenge history entries (oldest first). */
export async function loadHistory(): Promise<ChallengeHistoryEntry[]> {
  return defer(() => loadHistorySync());
}

function loadHistorySync(): ChallengeHistoryEntry[] {
  const raw = safeGet(KEYS.HISTORY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Clear the entire challenge history. */
export async function clearHistory(): Promise<void> {
  return defer(() => {
    safeRemove(KEYS.HISTORY);
  });
}

/* ------------------------------------------------------------------ */
/*  Last chaos configuration                                           */
/* ------------------------------------------------------------------ */

/** Persist the current ChaosConfig slider values. */
export async function saveLastConfig(config: ChaosConfig): Promise<void> {
  return defer(() => {
    safeSet(
      KEYS.LAST_CONFIG,
      JSON.stringify({
        latencyJitterMs: config.latencyJitterMs,
        memoryLeakMb: config.memoryLeakMb,
        failureRate: config.failureRate,
        eventLoopBlockMs: config.eventLoopBlockMs,
      }),
    );
  });
}

/** Restore the most recently saved ChaosConfig, or null if none. */
export async function loadLastConfig(): Promise<ChaosConfig | null> {
  return defer(() => {
    const raw = safeGet(KEYS.LAST_CONFIG);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed?.latencyJitterMs === "number" &&
        typeof parsed?.memoryLeakMb === "number" &&
        typeof parsed?.failureRate === "number" &&
        typeof parsed?.eventLoopBlockMs === "number"
      ) {
        return parsed as ChaosConfig;
      }
      return null;
    } catch {
      return null;
    }
  });
}

/* ------------------------------------------------------------------ */
/*  Stress test reports                                                */
/* ------------------------------------------------------------------ */

/** Persist a completed stress test report (appends to history). */
export async function saveStressReport(
  record: StressTestRecord,
): Promise<void> {
  return defer(() => {
    const reports = loadStressReportsSync();
    reports.push(record);
    safeSet(KEYS.STRESS_REPORTS, JSON.stringify(reports));
  });
}

/** Load all saved stress test reports (oldest first). */
export async function loadStressReports(): Promise<StressTestRecord[]> {
  return defer(() => loadStressReportsSync());
}

function loadStressReportsSync(): StressTestRecord[] {
  const raw = safeGet(KEYS.STRESS_REPORTS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Clear all saved stress test reports. */
export async function clearStressReports(): Promise<void> {
  return defer(() => {
    safeRemove(KEYS.STRESS_REPORTS);
  });
}

/* ------------------------------------------------------------------ */
/*  Tier statistics                                                    */
/* ------------------------------------------------------------------ */

export interface TierStats {
  total: number;
  counts: Record<CodeTier, number>;
  bestTier: CodeTier | null;
  averageScore: number;
}

/** Compute aggregate statistics from saved challenge history. */
export async function getTierStats(): Promise<TierStats> {
  return defer(() => {
    const history = loadHistorySync();
    const counts: Record<CodeTier, number> = { D: 0, C: 0, B: 0, A: 0 };
    let totalScore = 0;

    for (const entry of history) {
      if (entry.tier in counts) counts[entry.tier]++;
      totalScore += entry.score;
    }

    const tierOrder: CodeTier[] = ["A", "B", "C", "D"];
    const bestTier = tierOrder.find((t) => counts[t] > 0) ?? null;

    return {
      total: history.length,
      counts,
      bestTier,
      averageScore:
        history.length > 0
          ? Math.round((totalScore / history.length) * 10) / 10
          : 0,
    };
  });
}
