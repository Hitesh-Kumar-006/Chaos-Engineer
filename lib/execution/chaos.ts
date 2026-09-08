/**
 * Chaos injection engine for fault-injection test runs.
 *
 * Supports granular per-parameter config as well as pre-built
 * Cloud Incident Presets that mirror real-world outage patterns.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ChaosPreset =
  | "custom"
  | "db_pool_exhaustion"
  | "serverless_cold_start"
  | "storage_503_outage";

export interface ChaosConfig {
  /** Extra latency jitter added to each request (0 – 3 000 ms). */
  latencyJitterMs: number;
  /** Simulated memory leak size (0 – 100 MB). */
  memoryLeakMb: number;
  /** Percentage chance a request fails outright (0 – 100). */
  failureRate: number;
  /** Duration the Node.js event loop is blocked (0 – 500 ms). */
  eventLoopBlockMs: number;
  /**
   * When set to a named preset (anything other than "custom"),
   * the preset values override the granular fields above.
   */
  activePreset?: ChaosPreset;
}

/** Result produced by a chaos injection hook. */
export interface ChaosResult {
  /** Whether the hook decided to throw an error. */
  faulted: boolean;
  /** Human-readable description of what was injected. */
  summary: string[];
  /** Wall-clock time the injection added (ms). */
  addedLatencyMs: number;
}

/* ------------------------------------------------------------------ */
/*  Defaults & helpers                                                 */
/* ------------------------------------------------------------------ */

export const DEFAULT_CONFIG: ChaosConfig = {
  latencyJitterMs: 0,
  memoryLeakMb: 0,
  failureRate: 0,
  eventLoopBlockMs: 0,
  activePreset: "custom",
};

/**
 * Preset slider values for each difficulty tier (Mild / Moderate / Chaos).
 *
 * When the user clicks a difficulty pill the chaos config sliders are
 * snapped to these values so the visual positions match the selected tier.
 */
export const DIFFICULTY_PRESETS: Record<"mild" | "moderate" | "chaos", ChaosConfig> = {
  mild: {
    latencyJitterMs: 100,
    memoryLeakMb: 5,
    failureRate: 5,
    eventLoopBlockMs: 0,
    activePreset: "custom",
  },
  moderate: {
    latencyJitterMs: 500,
    memoryLeakMb: 20,
    failureRate: 15,
    eventLoopBlockMs: 100,
    activePreset: "custom",
  },
  chaos: {
    latencyJitterMs: 1500,
    memoryLeakMb: 50,
    failureRate: 40,
    eventLoopBlockMs: 300,
    activePreset: "custom",
  },
};

/* ------------------------------------------------------------------ */
/*  Round-based resilience challenge                                   */
/* ------------------------------------------------------------------ */

/**
 * Five distinct disruption types for the interactive multi-round
 * resilience challenge.  Each round injects a different kind of
 * chaos so the user's code is tested against varied failure modes.
 */
export type DisruptionType =
  | "latency_spike"
  | "memory_pressure"
  | "failure_spike"
  | "combined_stress"
  | "service_outage";

export const ROUND_DISRUPTIONS: DisruptionType[] = [
  "latency_spike",
  "memory_pressure",
  "failure_spike",
  "combined_stress",
  "service_outage",
];

export const ROUND_LABELS: Record<DisruptionType, string> = {
  latency_spike: "Latency Spike",
  memory_pressure: "Memory Pressure",
  failure_spike: "Failure Spike",
  combined_stress: "Combined Stress",
  service_outage: "Service Outage",
};

/**
 * Build the ChaosConfig for a specific challenge round.
 *
 * The disruption type determines *what* kind of chaos is injected,
 * while the difficulty tier controls *how intense* each parameter is.
 */
export function buildRoundConfigs(
  difficulty: "mild" | "moderate" | "chaos",
): ChaosConfig[] {
  return ROUND_DISRUPTIONS.map((type) => {
    let cfg: ChaosConfig;
    switch (type) {
      case "latency_spike":
        cfg = {
          latencyJitterMs: difficulty === "mild" ? 200 : difficulty === "moderate" ? 800 : 2000,
          memoryLeakMb: 0,
          failureRate: difficulty === "mild" ? 0 : difficulty === "moderate" ? 5 : 10,
          eventLoopBlockMs: 0,
          activePreset: "custom",
        };
        break;
      case "memory_pressure":
        cfg = {
          latencyJitterMs: difficulty === "mild" ? 50 : difficulty === "moderate" ? 200 : 500,
          memoryLeakMb: difficulty === "mild" ? 10 : difficulty === "moderate" ? 40 : 80,
          failureRate: difficulty === "mild" ? 0 : difficulty === "moderate" ? 5 : 10,
          eventLoopBlockMs: 0,
          activePreset: "custom",
        };
        break;
      case "failure_spike":
        cfg = {
          latencyJitterMs: difficulty === "mild" ? 50 : difficulty === "moderate" ? 200 : 400,
          memoryLeakMb: 0,
          failureRate: difficulty === "mild" ? 15 : difficulty === "moderate" ? 40 : 70,
          eventLoopBlockMs: 0,
          activePreset: "custom",
        };
        break;
      case "combined_stress":
        cfg = {
          latencyJitterMs: difficulty === "mild" ? 100 : difficulty === "moderate" ? 400 : 1000,
          memoryLeakMb: difficulty === "mild" ? 5 : difficulty === "moderate" ? 15 : 30,
          failureRate: difficulty === "mild" ? 10 : difficulty === "moderate" ? 30 : 60,
          eventLoopBlockMs: difficulty === "mild" ? 0 : difficulty === "moderate" ? 50 : 200,
          activePreset: "custom",
        };
        break;
      case "service_outage":
        cfg = {
          latencyJitterMs: difficulty === "mild" ? 100 : difficulty === "moderate" ? 300 : 800,
          memoryLeakMb: difficulty === "mild" ? 0 : difficulty === "moderate" ? 10 : 20,
          failureRate: difficulty === "mild" ? 25 : difficulty === "moderate" ? 50 : 80,
          eventLoopBlockMs: difficulty === "mild" ? 0 : difficulty === "moderate" ? 100 : 300,
          activePreset: "custom",
        };
        break;
    }
    return cfg;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Ensure every numeric field stays within its documented range. */
export function sanitiseConfig(cfg: Partial<ChaosConfig>): ChaosConfig {
  return {
    latencyJitterMs: clamp(cfg.latencyJitterMs ?? 0, 0, 3000),
    memoryLeakMb: clamp(cfg.memoryLeakMb ?? 0, 0, 100),
    failureRate: clamp(cfg.failureRate ?? 0, 0, 100),
    eventLoopBlockMs: clamp(cfg.eventLoopBlockMs ?? 0, 0, 500),
    activePreset: cfg.activePreset ?? "custom",
  };
}

/* ------------------------------------------------------------------ */
/*  Preset resolution                                                  */
/* ------------------------------------------------------------------ */

/**
 * Resolve a preset into a concrete ChaosConfig.
 *
 * When `activePreset` is `"custom"` (or undefined) the caller's own
 * numeric values pass through unchanged.  For named presets the
 * corresponding values override the granular fields.
 */
export function resolveConfig(raw: Partial<ChaosConfig>): ChaosConfig {
  const base = sanitiseConfig(raw);

  switch (base.activePreset) {
    /* ---- db_pool_exhaustion -------------------------------------- */
    case "db_pool_exhaustion":
      return {
        ...base,
        latencyJitterMs: 1200,
        failureRate: 40,
      };

    /* ---- serverless_cold_start ----------------------------------- */
    case "serverless_cold_start":
      return {
        ...base,
        eventLoopBlockMs: 500, // cap at interface max
        latencyJitterMs: 2000,
      };

    /* ---- storage_503_outage -------------------------------------- */
    case "storage_503_outage":
      return {
        ...base,
        failureRate: 100,
      };

    /* ---- custom (pass-through) ----------------------------------- */
    default:
      return base;
  }
}

/* ------------------------------------------------------------------ */
/*  Low-level injection primitives                                     */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Block the event loop for `ms` milliseconds using a busy-wait.
 * This simulates CPU-bound stalls that prevent timer / I/O callbacks
 * from being processed.
 */
function blockEventLoop(ms: number): void {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    // spin
  }
}

/**
 * Allocate (and hold a reference to) a buffer of `mb` megabytes.
 * Returns the buffer so the caller can release it when done.
 */
function allocateMemory(mb: number): Uint8Array | null {
  if (mb <= 0) return null;
  return new Uint8Array(mb * 1024 * 1024);
}

/* ------------------------------------------------------------------ */
/*  Injection hooks                                                    */
/* ------------------------------------------------------------------ */

/**
 * Run chaos injections **before** the main execution payload.
 *
 * Handles:
 *  - Event-loop blocking (serverless cold-start style)
 *  - Memory-leak allocation
 *  - Latency jitter (pre-run portion)
 *
 * @returns a `ChaosResult` describing what was injected.
 */
export async function applyChaosBeforeRun(
  rawConfig: Partial<ChaosConfig>,
): Promise<ChaosResult> {
  const cfg = resolveConfig(rawConfig);
  const summary: string[] = [];
  let addedLatencyMs = 0;
  let faulted = false;

  /* -- Preset: serverless_cold_start → one-time blocking delay ---- */
  if (cfg.activePreset === "serverless_cold_start") {
    const blockMs = Math.min(cfg.latencyJitterMs, 2000); // 2 000 ms
    const start = performance.now();
    blockEventLoop(blockMs);
    const elapsed = performance.now() - start;
    addedLatencyMs += elapsed;
    summary.push(`Cold-start blocking delay: ${elapsed.toFixed(0)} ms`);
  }

  /* -- Event-loop block (generic) --------------------------------- */
  if (cfg.eventLoopBlockMs > 0 && cfg.activePreset !== "serverless_cold_start") {
    const start = performance.now();
    blockEventLoop(cfg.eventLoopBlockMs);
    const elapsed = performance.now() - start;
    addedLatencyMs += elapsed;
    summary.push(`Event-loop blocked: ${elapsed.toFixed(0)} ms`);
  }

  /* -- Memory leak ------------------------------------------------ */
  if (cfg.memoryLeakMb > 0) {
    allocateMemory(cfg.memoryLeakMb);
    summary.push(`Memory leak allocated: ${cfg.memoryLeakMb} MB`);
  }

  /* -- Latency jitter --------------------------------------------- */
  if (cfg.latencyJitterMs > 0 && cfg.activePreset !== "serverless_cold_start") {
    const start = performance.now();
    await sleep(cfg.latencyJitterMs);
    const elapsed = performance.now() - start;
    addedLatencyMs += elapsed;
    summary.push(`Latency jitter: ${elapsed.toFixed(0)} ms`);
  }

  return { faulted, summary, addedLatencyMs };
}

/**
 * Run chaos injections **after** the main execution payload.
 *
 * Handles:
 *  - Failure-rate roll (may throw a synthetic error)
 *  - Preset-specific post-run faults (db timeout, 503, etc.)
 *
 * @returns a `ChaosResult` describing what was injected.
 * @throws Error when the failure roll hits.
 */
export async function applyChaosAfterRun(
  rawConfig: Partial<ChaosConfig>,
): Promise<ChaosResult> {
  const cfg = resolveConfig(rawConfig);
  const summary: string[] = [];
  let addedLatencyMs = 0;
  let faulted = false;

  /* -- Preset: db_pool_exhaustion → 40 % connection timeout ------- */
  if (cfg.activePreset === "db_pool_exhaustion") {
    const roll = Math.random() * 100;
    if (roll < 40) {
      faulted = true;
      summary.push("DB pool exhausted — connection timeout (preset)");
      throw new ChaosError(
        "ECONNREFUSED: Connection pool exhausted — timed out waiting for available connection",
        "db_pool_exhaustion",
      );
    }
    summary.push("DB pool exhaustion roll: survived");
  }

  /* -- Preset: storage_503_outage → immediate 503 ----------------- */
  if (cfg.activePreset === "storage_503_outage") {
    faulted = true;
    summary.push("Storage 503 Service Unavailable (preset)");
    throw new ChaosError(
      "503 Service Unavailable: Upstream storage backend is temporarily unavailable",
      "storage_503_outage",
    );
  }

  /* -- Generic failure-rate roll ---------------------------------- */
  if (cfg.failureRate > 0 && cfg.activePreset === "custom") {
    const roll = Math.random() * 100;
    if (roll < cfg.failureRate) {
      faulted = true;
      summary.push(
        `Failure injected (roll ${roll.toFixed(1)}% < threshold ${cfg.failureRate}%)`,
      );
      throw new ChaosError(
        `Injected failure: random roll ${roll.toFixed(1)}% breached ${cfg.failureRate}% threshold`,
        "custom",
      );
    }
    summary.push(
      `Failure roll ${roll.toFixed(1)}% — below threshold ${cfg.failureRate}%`,
    );
  }

  /* -- Post-run latency jitter (half of pre-run value) ------------ */
  if (cfg.latencyJitterMs > 0 && cfg.activePreset === "custom") {
    const half = Math.round(cfg.latencyJitterMs / 2);
    const start = performance.now();
    await sleep(half);
    const elapsed = performance.now() - start;
    addedLatencyMs += elapsed;
    summary.push(`Post-run latency jitter: ${elapsed.toFixed(0)} ms`);
  }

  return { faulted, summary, addedLatencyMs };
}

/* ------------------------------------------------------------------ */
/*  Custom error type                                                  */
/* ------------------------------------------------------------------ */

export class ChaosError extends Error {
  public readonly preset: ChaosPreset;

  constructor(message: string, preset: ChaosPreset) {
    super(message);
    this.name = "ChaosError";
    this.preset = preset;
  }
}
