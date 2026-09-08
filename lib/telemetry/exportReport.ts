/**
 * Post-Mortem Incident Exporter
 *
 * Compiles run data and AI analysis into structured reports.
 * Supports two export formats: JSON blob and formatted Markdown.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RunData {
  /** ISO-8601 timestamp when the run started. */
  timestamp: string;
  /** ISO-8601 timestamp when the run completed. */
  endTimestamp?: string;
  /** Chaos parameters active during this run. */
  chaosParams: {
    latencyJitterMs: number;
    memoryLeakMb: number;
    failureRate: number;
    eventLoopBlockMs: number;
    activePreset?: string;
  };
  /** Error stack traces captured during the run (empty array = no errors). */
  errorStackTraces: string[];
  /** SLA latency distribution percentiles (in milliseconds). */
  slaLatency: {
    p50: number;
    p95: number;
    p99: number;
    mean?: number;
    min?: number;
    max?: number;
  };
  /** Overall success rate (0-100%). */
  successRate: number;
  /** SLA grade assigned to this run. */
  slaGrade: string;
  /** Number of iterations executed. */
  iterationCount: number;
  /** Number of iterations that failed. */
  failureCount: number;
  /** Challenge context (optional). */
  challengeId?: string;
  challengeTitle?: string;
}

export interface AIAnalysis {
  /** Root cause summary produced by Qwen-Max. */
  rootCauseSummary: string;
  /** Recommended remediation steps. */
  remediationSteps?: string[];
  /** Severity classification. */
  severity?: "low" | "medium" | "high" | "critical";
  /** Raw AI response text (for archival). */
  rawResponse?: string;
}

/** The compiled post-mortem report object. */
export interface PostMortemReport {
  id: string;
  generatedAt: string;
  run: RunData;
  aiAnalysis: AIAnalysis;
}

/** Return type for generatePostMortem -- both export formats. */
export interface ExportBundle {
  /** The structured report object. */
  report: PostMortemReport;
  /** Downloadable JSON string (pretty-printed). */
  json: string;
  /** Formatted Markdown string. */
  markdown: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `PM-${ts}-${rand}`.toUpperCase();
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(1)}ms`;
}

function severityEmoji(severity?: string): string {
  switch (severity) {
    case "critical":
      return "\uD83D\uDD34";
    case "high":
      return "\uD83D\uDFE0";
    case "medium":
      return "\uD83D\uDFE1";
    case "low":
      return "\uD83D\uDFE2";
    default:
      return "\u26AA";
  }
}

/* ------------------------------------------------------------------ */
/*  Report generation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Compile run data and AI analysis into a post-mortem report.
 *
 * @returns An ExportBundle containing the structured report, a
 *          downloadable JSON string, and a formatted Markdown string.
 */
export function generatePostMortem(
  runData: RunData,
  aiAnalysis: AIAnalysis,
): ExportBundle {
  const report: PostMortemReport = {
    id: generateId(),
    generatedAt: new Date().toISOString(),
    run: runData,
    aiAnalysis,
  };

  return {
    report,
    json: toJSON(report),
    markdown: toMarkdown(report),
  };
}

/* ------------------------------------------------------------------ */
/*  JSON export                                                        */
/* ------------------------------------------------------------------ */

function toJSON(report: PostMortemReport): string {
  return JSON.stringify(report, null, 2);
}

/* ------------------------------------------------------------------ */
/*  Markdown export                                                    */
/* ------------------------------------------------------------------ */

function toMarkdown(report: PostMortemReport): string {
  const { run, aiAnalysis } = report;
  const lines: string[] = [];

  /* ---- Title ------------------------------------------------------ */
  lines.push(`# Post-Mortem Report: ${report.id}`);
  lines.push("");
  lines.push(`> Generated: ${report.generatedAt}`);
  if (run.challengeTitle) {
    lines.push(
      `> Challenge: **${run.challengeTitle}** (${run.challengeId ?? "N/A"})`,
    );
  }
  lines.push("");

  /* ---- Run Timestamps --------------------------------------------- */
  lines.push("## Run Timestamps");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|---|---|");
  lines.push(`| Start | \`${run.timestamp}\` |`);
  if (run.endTimestamp) {
    lines.push(`| End | \`${run.endTimestamp}\` |`);
  }
  lines.push(`| Iterations | ${run.iterationCount} |`);
  lines.push(`| Failures | ${run.failureCount} |`);
  lines.push(`| Success Rate | ${run.successRate.toFixed(1)}% |`);
  lines.push(`| SLA Grade | **${run.slaGrade}** |`);
  lines.push("");

  /* ---- Injected Chaos Parameters ---------------------------------- */
  lines.push("## Injected Chaos Parameters");
  lines.push("");
  lines.push("| Parameter | Value |");
  lines.push("|---|---|");
  lines.push(`| Latency Jitter | ${run.chaosParams.latencyJitterMs} ms |`);
  lines.push(`| Memory Leak | ${run.chaosParams.memoryLeakMb} MB |`);
  lines.push(`| Failure Rate | ${run.chaosParams.failureRate}% |`);
  lines.push(
    `| Event Loop Block | ${run.chaosParams.eventLoopBlockMs} ms |`,
  );
  if (
    run.chaosParams.activePreset &&
    run.chaosParams.activePreset !== "custom"
  ) {
    lines.push(
      `| Active Preset | \`${run.chaosParams.activePreset}\` |`,
    );
  }
  lines.push("");

  /* ---- Error Stack Traces ----------------------------------------- */
  lines.push("## Error Stack Traces");
  lines.push("");
  if (run.errorStackTraces.length === 0) {
    lines.push("_No errors captured during this run._");
  } else {
    run.errorStackTraces.forEach((trace, i) => {
      lines.push(`### Error ${i + 1}`);
      lines.push("");
      lines.push("```");
      lines.push(trace);
      lines.push("```");
      lines.push("");
    });
  }
  lines.push("");

  /* ---- SLA Latency Distribution ----------------------------------- */
  lines.push("## SLA Latency Distribution");
  lines.push("");
  lines.push("| Percentile | Latency |");
  lines.push("|---|---|");
  lines.push(`| p50 | ${formatMs(run.slaLatency.p50)} |`);
  lines.push(`| p95 | ${formatMs(run.slaLatency.p95)} |`);
  lines.push(`| p99 | ${formatMs(run.slaLatency.p99)} |`);
  if (run.slaLatency.mean != null) {
    lines.push(`| Mean | ${formatMs(run.slaLatency.mean)} |`);
  }
  if (run.slaLatency.min != null) {
    lines.push(`| Min | ${formatMs(run.slaLatency.min)} |`);
  }
  if (run.slaLatency.max != null) {
    lines.push(`| Max | ${formatMs(run.slaLatency.max)} |`);
  }
  lines.push("");

  /* ---- Qwen-Max Root Cause Summary -------------------------------- */
  lines.push("## Root Cause Summary (AI Analysis)");
  lines.push("");
  lines.push(
    `${severityEmoji(aiAnalysis.severity)} **Severity:** ${aiAnalysis.severity ?? "unclassified"}`,
  );
  lines.push("");
  lines.push(aiAnalysis.rootCauseSummary);
  lines.push("");

  /* ---- Remediation Steps ------------------------------------------ */
  if (
    aiAnalysis.remediationSteps &&
    aiAnalysis.remediationSteps.length > 0
  ) {
    lines.push("## Recommended Remediation");
    lines.push("");
    aiAnalysis.remediationSteps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    lines.push("");
  }

  /* ---- Footer ----------------------------------------------------- */
  lines.push("---");
  lines.push(
    `_Report ID: ${report.id} | Generated by SRE Copilot (Qwen-Max)_`,
  );
  lines.push("");

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Browser download helpers                                           */
/* ------------------------------------------------------------------ */

/**
 * Trigger a browser download for the JSON report.
 * Only works in a browser environment. Silently degrades in
 * sandboxed/headless contexts where Blob or DOM APIs are unavailable.
 */
export function downloadJSON(
  bundle: ExportBundle,
  filename?: string,
): void {
  if (typeof document === "undefined") return;
  const name = filename ?? `postmortem-${bundle.report.id}.json`;
  downloadBlob(bundle.json, name, "application/json");
}

/**
 * Trigger a browser download for the Markdown report.
 * Only works in a browser environment. Silently degrades in
 * sandboxed/headless contexts where Blob or DOM APIs are unavailable.
 */
export function downloadMarkdown(
  bundle: ExportBundle,
  filename?: string,
): void {
  if (typeof document === "undefined") return;
  const name = filename ?? `postmortem-${bundle.report.id}.md`;
  downloadBlob(bundle.markdown, name, "text/markdown");
}

function downloadBlob(
  content: string,
  filename: string,
  mimeType: string,
): void {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  } catch (err) {
    /* Sandboxed iframe, headless env, or restricted CSP — fall back to
       copying content to clipboard so the user can paste manually. */
    console.warn("[export] Blob download failed, attempting clipboard fallback:", err);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(
          () => console.info("[export] Report copied to clipboard."),
          () => console.warn("[export] Clipboard write also failed."),
        );
      }
    } catch {
      console.warn("[export] Clipboard API unavailable. Report data lost.");
    }
  }
}
