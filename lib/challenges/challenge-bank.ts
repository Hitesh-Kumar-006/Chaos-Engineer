/**
 * Challenge bank — a curated set of 3-5 minute micro-coding challenges
 * focused on resilience patterns.  Each challenge ships with JS and
 * Python boilerplate, human-readable test criteria, and a baseline
 * difficulty rating.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Difficulty = "mild" | "moderate" | "chaos";

export interface TestCriterion {
  /** Short machine-friendly key (e.g. "retry_count"). */
  key: string;
  /** Human-readable description of what the test validates. */
  description: string;
}

export interface Challenge {
  /** Stable identifier. */
  id: string;
  /** Display title. */
  title: string;
  /** Full prompt / instructions shown to the player. */
  prompt: string;
  /** Starter code per language. */
  boilerplate: { javascript: string; python: string };
  /** What the test harness validates. */
  testCriteria: TestCriterion[];
  /** Baseline difficulty tier. */
  difficulty: Difficulty;
  /** Target completion window (minutes). */
  timeLimitMin: number;
}

/* ------------------------------------------------------------------ */
/*  Challenges                                                         */
/* ------------------------------------------------------------------ */

export const CHALLENGES: Challenge[] = [
  /* ---------------------------------------------------------------- */
  /*  1. Resilient Fetch with Exponential Backoff                     */
  /* ---------------------------------------------------------------- */
  {
    id: "exponential_backoff",
    title: "Resilient Fetch with Exponential Backoff",
    prompt:
      "Implement a resilientFetch(url, options) function that automatically retries failed HTTP requests using exponential backoff.\n\n" +
      "Requirements:\n" +
      "- Initial delay of 100 ms, doubling after each retry.\n" +
      "- Maximum 5 retry attempts before propagating the error.\n" +
      "- Add random jitter (0-50 ms) to each delay to prevent thundering-herd.\n" +
      "- Only retry on network errors and 5xx status codes; let 4xx through.",
    boilerplate: {
      javascript:
        "/**\n" +
        " * @param {string} url\n" +
        " * @param {RequestInit & { maxRetries?: number; baseDelay?: number }} options\n" +
        " * @returns {Promise<Response>}\n" +
        " */\n" +
        "async function resilientFetch(url, options = {}) {\n" +
        "  const maxRetries = options.maxRetries ?? 5;\n" +
        "  const baseDelay  = options.baseDelay  ?? 100;\n\n" +
        "  // Your implementation here\n\n" +
        "}\n\n" +
        "module.exports = { resilientFetch };",
      python:
        "import time, random, requests\n\n" +
        "def resilient_fetch(url: str, *, max_retries: int = 5, base_delay: float = 0.1, **kwargs):\n" +
        '    """Retry GET/POST with exponential backoff + jitter."""\n\n' +
        "    # Your implementation here\n\n" +
        "    pass",
    },
    testCriteria: [
      { key: "retry_count", description: "Exhausts all retry attempts before throwing on persistent failure" },
      { key: "backoff_delays", description: "Delays follow the pattern base * 2^n + jitter (100, 200, 400, 800, 1600 ms +/- 50 ms)" },
      { key: "success_passthrough", description: "Returns the response immediately on a successful 2xx call" },
      { key: "no_retry_4xx", description: "4xx client errors are NOT retried" },
    ],
    difficulty: "mild",
    timeLimitMin: 4,
  },

  /* ---------------------------------------------------------------- */
  /*  2. Memory-Bounded Stream Collector                              */
  /* ---------------------------------------------------------------- */
  {
    id: "stream_collector",
    title: "Memory-Bounded Stream Collector",
    prompt:
      "Implement a BoundedCollector class that accumulates items from a stream while enforcing a strict memory ceiling.\n\n" +
      "Requirements:\n" +
      "- Constructor takes maxItems (the memory ceiling).\n" +
      "- add(item) stores the item; if the buffer is full, evict the oldest item first (FIFO).\n" +
      "- flush() returns all collected items in insertion order and resets the internal buffer.\n" +
      "- stats() returns { collected, evicted, currentSize }.",
    boilerplate: {
      javascript:
        "class BoundedCollector {\n" +
        "  /** @param {number} maxItems */\n" +
        "  constructor(maxItems) {\n" +
        "    // Your implementation here\n" +
        "  }\n\n" +
        "  /** @param {*} item */\n" +
        "  add(item) {\n" +
        "    // Your implementation here\n" +
        "  }\n\n" +
        "  /** @returns {Array<*>} */\n" +
        "  flush() {\n" +
        "    // Your implementation here\n" +
        "  }\n\n" +
        "  /** @returns {{ collected: number, evicted: number, currentSize: number }} */\n" +
        "  stats() {\n" +
        "    // Your implementation here\n" +
        "  }\n" +
        "}\n\n" +
        "module.exports = { BoundedCollector };",
      python:
        "from typing import Any\n\n" +
        "class BoundedCollector:\n" +
        "    def __init__(self, max_items: int):\n" +
        "        # Your implementation here\n" +
        "        pass\n\n" +
        "    def add(self, item: Any) -> None:\n" +
        "        # Your implementation here\n" +
        "        pass\n\n" +
        "    def flush(self) -> list:\n" +
        "        # Your implementation here\n" +
        "        pass\n\n" +
        "    def stats(self) -> dict:\n" +
        "        # Your implementation here\n" +
        "        pass",
    },
    testCriteria: [
      { key: "bounded_memory", description: "Internal buffer never exceeds maxItems after any sequence of add() calls" },
      { key: "fifo_eviction", description: "When full, the oldest item is evicted before the new item is stored" },
      { key: "flush_order", description: "flush() returns items in FIFO order and resets the buffer" },
      { key: "stats_accuracy", description: "collected = total adds, evicted = total evictions, currentSize = live buffer length" },
    ],
    difficulty: "moderate",
    timeLimitMin: 3,
  },

  /* ---------------------------------------------------------------- */
  /*  3. Circuit Breaker Implementation                               */
  /* ---------------------------------------------------------------- */
  {
    id: "circuit_breaker",
    title: "Circuit Breaker Implementation",
    prompt:
      "Implement a CircuitBreaker that wraps an async operation and prevents cascading failures.\n\n" +
      "States:\n" +
      "- CLOSED (default): requests pass through normally.\n" +
      "- OPEN: all requests are immediately rejected with a CircuitOpenError.\n" +
      "- HALF_OPEN: after the cooldown period, allow exactly one probe request. Success transitions to CLOSED; failure returns to OPEN.\n\n" +
      "Requirements:\n" +
      "- Constructor takes failureThreshold and cooldownMs.\n" +
      "- Track consecutive failure count in CLOSED state.\n" +
      "- execute(fn) is the public entry point.",
    boilerplate: {
      javascript:
        "class CircuitOpenError extends Error {\n" +
        '  constructor() { super("Circuit breaker is open"); this.name = "CircuitOpenError"; }\n' +
        "}\n\n" +
        "class CircuitBreaker {\n" +
        "  /**\n" +
        "   * @param {number} failureThreshold\n" +
        "   * @param {number} cooldownMs\n" +
        "   */\n" +
        "  constructor(failureThreshold, cooldownMs) {\n" +
        '    this.state = "CLOSED";\n' +
        "    this.failureCount = 0;\n" +
        "    this.failureThreshold = failureThreshold;\n" +
        "    this.cooldownMs = cooldownMs;\n" +
        "    this.lastFailureTime = 0;\n" +
        "  }\n\n" +
        "  /**\n" +
        "   * @template T\n" +
        "   * @param {() => Promise<T>} fn\n" +
        "   * @returns {Promise<T>}\n" +
        "   */\n" +
        "  async execute(fn) {\n" +
        "    // Your implementation here\n" +
        "  }\n" +
        "}\n\n" +
        "module.exports = { CircuitBreaker, CircuitOpenError };",
      python:
        "import time\n\n" +
        "class CircuitOpenError(Exception):\n" +
        "    pass\n\n" +
        "class CircuitBreaker:\n" +
        "    def __init__(self, failure_threshold: int, cooldown_s: float):\n" +
        '        self.state = "CLOSED"\n' +
        "        self.failure_count = 0\n" +
        "        self.failure_threshold = failure_threshold\n" +
        "        self.cooldown_s = cooldown_s\n" +
        "        self.last_failure_time = 0.0\n\n" +
        "    async def execute(self, fn):\n" +
        "        # Your implementation here\n" +
        "        pass",
    },
    testCriteria: [
      { key: "closed_passthrough", description: "execute() returns fn() result while in CLOSED state" },
      { key: "open_after_threshold", description: "Transitions to OPEN after failureThreshold consecutive failures" },
      { key: "open_rejection", description: "All calls during OPEN state throw CircuitOpenError without invoking fn" },
      { key: "halfopen_probe", description: "After cooldownMs, one probe request is allowed; success resets to CLOSED, failure returns to OPEN" },
      { key: "counter_reset", description: "Failure count resets to 0 on any successful execution" },
    ],
    difficulty: "chaos",
    timeLimitMin: 5,
  },

  /* ---------------------------------------------------------------- */
  /*  4. Sliding Window Rate Limiter                                  */
  /* ---------------------------------------------------------------- */
  {
    id: "rate_limiter",
    title: "Sliding Window Rate Limiter",
    prompt:
      "Implement a RateLimiter using the sliding window counter algorithm.\n\n" +
      "Requirements:\n" +
      "- Constructor takes maxRequests and windowMs.\n" +
      "- allow() returns true if the request is within the rate limit, false otherwise.\n" +
      "- The window slides continuously: a request at time T only considers other requests in (T - windowMs, T].\n" +
      "- remaining() returns how many requests are still allowed in the current window.",
    boilerplate: {
      javascript:
        "class RateLimiter {\n" +
        "  /**\n" +
        "   * @param {number} maxRequests\n" +
        "   * @param {number} windowMs\n" +
        "   */\n" +
        "  constructor(maxRequests, windowMs) {\n" +
        "    // Your implementation here\n" +
        "  }\n\n" +
        "  /** @returns {boolean} */\n" +
        "  allow() {\n" +
        "    // Your implementation here\n" +
        "  }\n\n" +
        "  /** @returns {number} */\n" +
        "  remaining() {\n" +
        "    // Your implementation here\n" +
        "  }\n" +
        "}\n\n" +
        "module.exports = { RateLimiter };",
      python:
        "import time\n\n" +
        "class RateLimiter:\n" +
        "    def __init__(self, max_requests: int, window_s: float):\n" +
        "        # Your implementation here\n" +
        "        pass\n\n" +
        "    def allow(self) -> bool:\n" +
        "        # Your implementation here\n" +
        "        pass\n\n" +
        "    def remaining(self) -> int:\n" +
        "        # Your implementation here\n" +
        "        pass",
    },
    testCriteria: [
      { key: "within_limit", description: "First maxRequests calls to allow() return true within a fresh window" },
      { key: "over_limit", description: "Subsequent calls return false until the window slides past old entries" },
      { key: "sliding_window", description: "Requests outside (now - windowMs) no longer count toward the limit" },
      { key: "remaining_accuracy", description: "remaining() matches maxRequests - count of live entries" },
    ],
    difficulty: "moderate",
    timeLimitMin: 4,
  },

  /* ---------------------------------------------------------------- */
  /*  5. Graceful Degradation with Fallback Cascade                   */
  /* ---------------------------------------------------------------- */
  {
    id: "graceful_degradation",
    title: "Graceful Degradation with Fallback Cascade",
    prompt:
      "Implement fetchUserProfile(userId) that attempts multiple data sources in order, falling back on failure or timeout.\n\n" +
      "Cascade order:\n" +
      "1. Primary API: full profile (may throw or time out after 2 s).\n" +
      "2. Cache: stale but available (may throw).\n" +
      "3. Hardcoded default: minimal safe profile.\n\n" +
      "Requirements:\n" +
      "- Each source has a 2-second timeout; if exceeded, move to the next.\n" +
      "- The final return value must always be a valid UserProfile object with at least { id, name, email, source }.\n" +
      "- Track which source ultimately served the response.",
    boilerplate: {
      javascript:
        "/**\n" +
        " * @param {string} userId\n" +
        " * @param {{ primary: () => Promise<Object>, cache: () => Promise<Object> }} sources\n" +
        " * @returns {Promise<Object>}\n" +
        " */\n" +
        "async function fetchUserProfile(userId, sources) {\n" +
        "  const TIMEOUT_MS = 2000;\n\n" +
        "  const defaultProfile = {\n" +
        "    id: userId,\n" +
        '    name: "Unknown User",\n' +
        '    email: "unknown@example.com",\n' +
        '    source: "default",\n' +
        "  };\n\n" +
        "  // Your implementation here\n\n" +
        "}\n\n" +
        "module.exports = { fetchUserProfile };",
      python:
        "import asyncio\n" +
        "from typing import Callable, Awaitable\n\n" +
        "async def fetch_user_profile(\n" +
        "    user_id: str,\n" +
        "    primary: Callable[[], Awaitable[dict]],\n" +
        "    cache: Callable[[], Awaitable[dict]],\n" +
        ") -> dict:\n" +
        "    TIMEOUT_S = 2.0\n\n" +
        "    default_profile = {\n" +
        '        "id": user_id,\n' +
        '        "name": "Unknown User",\n' +
        '        "email": "unknown@example.com",\n' +
        '        "source": "default",\n' +
        "    }\n\n" +
        "    # Your implementation here\n\n" +
        "    pass",
    },
    testCriteria: [
      { key: "primary_success", description: "Returns primary API result when it resolves within 2 s" },
      { key: "cache_fallback", description: "Falls back to cache when primary throws or exceeds the timeout" },
      { key: "default_fallback", description: "Returns the default profile when both primary and cache fail" },
      { key: "source_tag", description: "Returned profile.source reflects which tier served the response" },
      { key: "timeout_enforcement", description: "No single source blocks longer than 2 s before falling through" },
    ],
    difficulty: "chaos",
    timeLimitMin: 5,
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Pick a random challenge from the bank. */
export function pickRandomChallenge(): Challenge {
  return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
}

/** Pick a random challenge filtered by difficulty. */
export function pickChallengeByDifficulty(d: Difficulty): Challenge {
  const pool = CHALLENGES.filter((c) => c.difficulty === d);
  if (pool.length === 0) return pickRandomChallenge();
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Look up a challenge by its stable id. */
export function getChallengeById(id: string): Challenge | undefined {
  return CHALLENGES.find((c) => c.id === id);
}
