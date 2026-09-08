/**
 * Context-aware heuristic code evaluator for Auto Chaos challenges.
 *
 * Scoring philosophy:
 *   • Each positive pattern is tagged with one or more relevance categories.
 *   • When a challenge specifies which categories matter, ONLY those patterns
 *     are scored — irrelevant patterns (e.g. "retry/backoff" for a config
 *     validator) do not penalize the total.
 *   • Tier is assigned as a percentage of the applicable maximum score:
 *       A ≥ 80 % · B ≥ 60 % · C ≥ 40 % · D < 40 %
 *   • Anti-patterns (unsafe C functions, bare except, empty catch, unsafe
 *     casts) always subtract points regardless of category filtering.
 *   • Stub / placeholder code is auto-capped at D tier.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CodeTier = "D" | "C" | "B" | "A";

export type PatternCategory =
  | "validation"
  | "error_handling"
  | "data_structure"
  | "edge_case"
  | "logging"
  | "retry"
  | "timing"
  | "bounds"
  | "safe_ops"
  | "network";

export interface EvaluationResult {
  tier: CodeTier;
  score: number;
  patterns: { label: string; found: boolean; weight: number }[];
}

/* ------------------------------------------------------------------ */
/*  Title → category inference (used when categories are not explicit) */
/* ------------------------------------------------------------------ */

const CATEGORY_MAP: { keywords: string[]; categories: PatternCategory[] }[] = [
  {
    keywords: ["data stream", "parser", "csv"],
    categories: ["data_structure", "validation", "edge_case", "logging"],
  },
  {
    keywords: ["retry", "backoff"],
    categories: ["retry", "timing", "error_handling", "network", "logging"],
  },
  {
    keywords: ["rate limit", "token bucket"],
    categories: ["timing", "bounds", "data_structure", "edge_case"],
  },
  {
    keywords: ["config", "validator", "validation"],
    categories: ["validation", "data_structure", "edge_case", "error_handling"],
  },
];

/** Infer relevant pattern categories from a challenge title. */
export function inferCategories(title: string): PatternCategory[] | undefined {
  const lower = title.toLowerCase();
  for (const entry of CATEGORY_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.categories;
    }
  }
  return undefined; // no match → evaluate all patterns
}

/* ------------------------------------------------------------------ */
/*  Positive signals — best-practice patterns with category tags       */
/* ------------------------------------------------------------------ */

interface ScoredPattern {
  label: string;
  test: (code: string) => boolean;
  weight: number;
  categories: PatternCategory[];
}

const POSITIVE: ScoredPattern[] = [
  /* ── Input validation logic ─────────────────────────────────────── */
  {
    label: "Input validation logic",
    weight: 2,
    categories: ["validation"],
    test: (c) =>
      /\b(if\s*\(!\s*\w+|if\s+not\s+\w+|isNone|is_empty|!=\s*NULL|!=\s*nullptr|\.empty\(\)|\.length\s*==|\.size\(\)\s*==|\.hasOwnProperty|typeof\s+\w+|instanceof|\.includes\(|\.has\(|in\s+\w+|key\s+in\b|\bin\b.*\bkeys|Object\.keys|config\s*\[|schema|\.get\s*\(|\.getOrDefault|required)\b/.test(
        c,
      ),
  },

  /* ── Error handling ─────────────────────────────────────────────── */
  {
    label: "Error handling",
    weight: 2,
    categories: ["error_handling"],
    test: (c) =>
      /\b(try\s*\{|try:|catch\s*\(|except\s+\w+|except\s*:|fprintf\s*\(\s*stderr|perror|errno|\.push\s*\(|\.append\s*\(|errors\s*[=+]|return\s*\{.*errors|return\s+.*\[\]|\.add\s*\(|throw\s+new|raise\s+\w+)\b/.test(
        c,
      ),
  },

  /* ── Boundary comparisons ───────────────────────────────────────── */
  {
    label: "Boundary comparisons",
    weight: 2,
    categories: ["bounds"],
    test: (c) =>
      /\b(count\s*[<>]|i\s*[<>]|index\s*[<>]|for\s+\w+\s+in\b|\.length|\.size\(\)|sizeof|max_records|max_tokens|capacity|len\(|\.split|tokens\s*[<>]|<\s*\d+|<=\s*\d+|>=?\s*\d+)\b/.test(
        c,
      ),
  },

  /* ── Safe operations / buffer safety ────────────────────────────── */
  {
    label: "Safe operations / buffer safety",
    weight: 2,
    categories: ["safe_ops"],
    test: (c) =>
      /\b(strncpy|snprintf|sizeof|fgets|strncat|strlcpy|\.substring|\.slice|\.split|\.trim\(\)|\.strip\(\)|\.hasOwnProperty|parseInt|Number\(|\.replace\(|\.match\()\b/.test(
        c,
      ),
  },

  /* ── Edge case handling ─────────────────────────────────────────── */
  {
    label: "Edge case handling",
    weight: 1,
    categories: ["edge_case"],
    test: (c) =>
      /\b(continue|break|default|edge|skip|malformed|invalid|warning|skipped|append|push_back|add\(|missing|null|undefined|None|empty|"unknown"|'unknown'|"---")\b/i.test(
        c,
      ),
  },

  /* ── Logging / diagnostic output ────────────────────────────────── */
  {
    label: "Logging / diagnostic output",
    weight: 1,
    categories: ["logging"],
    test: (c) =>
      /\b(console\.|print\(|System\.out|std::cout|printf|Console\.Write|fprintf|stderr|std::cerr)\b/.test(
        c,
      ),
  },

  /* ── Retry / backoff pattern ────────────────────────────────────── */
  {
    label: "Retry / backoff pattern",
    weight: 1,
    categories: ["retry"],
    test: (c) =>
      /\b(retry|attempt|maxRetries|max_retries|backoff|retries|withRetry|with_retry)\b/i.test(c),
  },

  /* ── Timing / delay ─────────────────────────────────────────────── */
  {
    label: "Timing / delay",
    weight: 1,
    categories: ["timing"],
    test: (c) =>
      /\b(delay|sleep|setTimeout|time\.sleep|pow\(|Math\.Pow|Thread\.Sleep|std::this_thread|Date\.now|performance\.now|chrono|elapsed|refill|tokens)\b/i.test(
        c,
      ),
  },

  /* ── Data structures ────────────────────────────────────────────── */
  {
    label: "Data structures",
    weight: 1,
    categories: ["data_structure"],
    test: (c) =>
      /\b(HashMap|ArrayList|vector|List<|Map<|dict|Record|typedef\s+struct|struct\s+\w+|Dictionary<|\bnew\s+Map\b|\bnew\s+Set\b|\[\s*\]|\{\s*\}|class\s+\w+|interface\s+\w+)\b/.test(
        c,
      ),
  },

  /* ── Network / HTTP patterns ────────────────────────────────────── */
  {
    label: "Network / HTTP patterns",
    weight: 1,
    categories: ["network"],
    test: (c) =>
      /\b(fetch|axios|http|https|request|response|status|url|endpoint|api|\.ok|\.statusText|5\d\d|4\d\d)\b/i.test(
        c,
      ),
  },
];

/* ------------------------------------------------------------------ */
/*  Anti-patterns — unsafe or sloppy code (always penalised)           */
/* ------------------------------------------------------------------ */

const ANTI_PATTERNS: { label: string; test: (code: string) => boolean; penalty: number }[] = [
  {
    label: "Unsafe C functions (strcpy / gets / sprintf)",
    test: (c) => /\b(strcpy|gets|sprintf|strcat)(?!\w)/.test(c),
    penalty: 3,
  },
  {
    label: "Bare except (Python — no exception type)",
    test: (c) => /except\s*\n*\s*:/.test(c),
    penalty: 2,
  },
  {
    label: "Empty catch block (swallows errors)",
    test: (c) => /catch\s*\([^)]*\)\s*\{\s*\}/.test(c),
    penalty: 2,
  },
  {
    label: "Unsafe pointer cast",
    test: (c) => /\(\s*(void|int|char)\s*\*\s*\)\s*\w/.test(c),
    penalty: 2,
  },
];

/* ------------------------------------------------------------------ */
/*  Stub detection                                                     */
/* ------------------------------------------------------------------ */

function isStub(code: string): boolean {
  if (!/Your implementation here/i.test(code)) return false;
  const stripped = code
    .replace(/\/\/[^\n]*/g, "")
    .replace(/#[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length < 80;
}

/* ------------------------------------------------------------------ */
/*  Evaluator                                                          */
/* ------------------------------------------------------------------ */

/**
 * Evaluate user code with optional context-aware category filtering.
 *
 * @param code       — the source code to evaluate
 * @param categories — when provided, only patterns whose categories overlap
 *                     with this list contribute to the score.  Patterns whose
 *                     categories are irrelevant are still reported as "not
 *                     found" for the checklist UI but do NOT reduce the
 *                     percentage.  Anti-pattern penalties always apply.
 */
export function evaluateCode(
  code: string,
  categories?: PatternCategory[],
): EvaluationResult {
  const hasCategories = categories && categories.length > 0;
  const catSet = hasCategories ? new Set(categories) : null;

  /* 1. Evaluate positive signals ------------------------------------ */
  let score = 0;
  let maxApplicableWeight = 0;

  const positivePatterns = POSITIVE.map((p) => {
    const isApplicable = !catSet || p.categories.some((c) => catSet.has(c));
    const found = p.test(code);

    if (isApplicable) {
      maxApplicableWeight += p.weight;
      if (found) score += p.weight;
    }

    return { label: p.label, found, weight: p.weight };
  });

  /* 2. Anti-pattern penalties (always applied) ---------------------- */
  const antiPatterns = ANTI_PATTERNS.map((a) => {
    const found = a.test(code);
    if (found) score -= a.penalty;
    return { label: a.label, found, weight: -a.penalty };
  });

  /* 3. Combine for checklist display -------------------------------- */
  const patterns = [
    ...positivePatterns,
    ...antiPatterns.filter((a) => a.found),
  ];

  /* 4. Percentage-based tier assignment ----------------------------- */
  const pct =
    maxApplicableWeight > 0 ? score / maxApplicableWeight : 0;

  let tier: CodeTier;
  if (pct >= 0.8) tier = "A";
  else if (pct >= 0.6) tier = "B";
  else if (pct >= 0.4) tier = "C";
  else tier = "D";

  /* 5. Stub check — auto-cap at D ----------------------------------- */
  if (isStub(code)) {
    tier = "D";
  }

  return { tier, score: Math.max(score, 0), patterns };
}

/* ------------------------------------------------------------------ */
/*  Tier → Chaos Matrix preset mapping                                 */
/* ------------------------------------------------------------------ */

export interface TierPreset {
  latencyJitterMs: number;
  memoryLeakMb: number;
  failureRate: number;
  eventLoopBlockMs: number;
  presetName: string;
  description: string;
}

export const TIER_PRESETS: Record<CodeTier, TierPreset> = {
  D: {
    latencyJitterMs: 50,
    memoryLeakMb: 2,
    failureRate: 5,
    eventLoopBlockMs: 0,
    presetName: "Light Jitter",
    description: "Minimal fault injection — basic stress test",
  },
  C: {
    latencyJitterMs: 300,
    memoryLeakMb: 10,
    failureRate: 15,
    eventLoopBlockMs: 50,
    presetName: "Moderate Stress",
    description: "Network lag + light memory pressure",
  },
  B: {
    latencyJitterMs: 800,
    memoryLeakMb: 30,
    failureRate: 25,
    eventLoopBlockMs: 150,
    presetName: "Heavy Load",
    description: "Significant latency, memory bloat, and failure injection",
  },
  A: {
    latencyJitterMs: 1500,
    memoryLeakMb: 50,
    failureRate: 40,
    eventLoopBlockMs: 300,
    presetName: "DB Pool Exhaustion",
    description: "Maximum chaos — mirrors real-world outage patterns",
  },
};
