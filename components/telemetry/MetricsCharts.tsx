"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChaosConfig } from "@/lib/execution/chaos";
import type { StressReport } from "@/components/editor/StressTestSuite";
import {
  generatePostMortem,
  downloadJSON,
  type AIAnalysis,
  type RunData,
} from "@/lib/telemetry/exportReport";
import {
  loadStressReports,
  type StressTestRecord,
} from "@/lib/persistence";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  latestReport: StressReport | null;
  chaosConfig: ChaosConfig;
  aiAnalysis?: AIAnalysis;
}

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

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-400";
  if (grade === "B") return "text-sky-400";
  if (grade === "C") return "text-amber-400";
  return "text-red-400";
}

/* ------------------------------------------------------------------ */
/*  Mock telemetry data (used when no stress-test report exists)       */
/* ------------------------------------------------------------------ */

function buildMockRunData(): RunData {
  return {
    timestamp: new Date().toISOString(),
    chaosParams: {
      latencyJitterMs: 450,
      memoryLeakMb: 12,
      failureRate: 8,
      eventLoopBlockMs: 75,
      activePreset: "custom",
    },
    errorStackTraces: [
      "TimeoutError: request exceeded 2000ms deadline\n  at HttpClient.send (api/client.ts:42)\n  at retryWithBackoff (lib/retry.ts:18)",
      "ConnectionRefusedError: ECONNREFUSED 10.0.0.5:5432\n  at Socket.connect (net.js:67)\n  at Pool.acquire (db/pool.ts:91)",
    ],
    slaLatency: { p50: 48, p95: 320, p99: 1280, mean: 92, min: 12, max: 1840 },
    successRate: 92.4,
    slaGrade: "B",
    iterationCount: 10,
    failureCount: 1,
  };
}

function buildMockAnalysis(): AIAnalysis {
  return {
    rootCauseSummary:
      "Sample telemetry export. The system experienced moderate latency jitter (450ms) and minor connection failures under simulated chaos conditions. P99 latency peaked at 1280ms due to database pool contention.",
    severity: "medium" as const,
  };
}

/* ------------------------------------------------------------------ */
/*  CSV export helper                                                  */
/* ------------------------------------------------------------------ */

function downloadCSV(filename: string, report: { run: RunData; aiAnalysis: AIAnalysis; id: string; generatedAt: string }): void {
  const rows: string[][] = [
    ["Field", "Value"],
    ["Report ID", report.id],
    ["Generated At", report.generatedAt],
    [""],
    ["-- Run Summary --"],
    ["Timestamp", report.run.timestamp],
    ["Success Rate (%)", report.run.successRate.toFixed(2)],
    ["SLA Grade", report.run.slaGrade],
    ["Iteration Count", String(report.run.iterationCount)],
    ["Failure Count", String(report.run.failureCount)],
    [""],
    ["-- Latency Percentiles (ms) --"],
    ["p50", String(report.run.slaLatency.p50)],
    ["p95", String(report.run.slaLatency.p95)],
    ["p99", String(report.run.slaLatency.p99)],
    ["Mean", String(report.run.slaLatency.mean ?? "N/A")],
    ["Min", String(report.run.slaLatency.min ?? "N/A")],
    ["Max", String(report.run.slaLatency.max ?? "N/A")],
    [""],
    ["-- Chaos Parameters --"],
    ["Latency Jitter (ms)", String(report.run.chaosParams.latencyJitterMs)],
    ["Memory Leak (MB)", String(report.run.chaosParams.memoryLeakMb)],
    ["Failure Rate (%)", String(report.run.chaosParams.failureRate)],
    ["Event Loop Block (ms)", String(report.run.chaosParams.eventLoopBlockMs)],
    ["Active Preset", report.run.chaosParams.activePreset ?? "N/A"],
    [""],
    ["-- Error Stack Traces --"],
    ...report.run.errorStackTraces.map((t, i) => [`Error ${i + 1}`, t.replace(/\n/g, " | ")]),
    [""],
    ["-- AI Analysis --"],
    ["Severity", report.aiAnalysis.severity ?? "unclassified"],
    ["Root Cause", report.aiAnalysis.rootCauseSummary],
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MetricsCharts({
  latestReport,
  chaosConfig,
  aiAnalysis,
}: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [persistedRecords, setPersistedRecords] = useState<StressTestRecord[]>([]);

  /* Enabled only when at least one stress test has been run */
  const hasData = !!latestReport || persistedRecords.length > 0;

  /* ---- Load persisted stress reports on mount ------------------- */
  useEffect(() => {
    loadStressReports().then(setPersistedRecords);
  }, []);

  /* ---- Reload when latestReport changes (new test just completed) */
  useEffect(() => {
    if (latestReport) {
      loadStressReports().then(setPersistedRecords);
    }
  }, [latestReport]);

  /* ---- Close dropdown when clicking outside ----------------------- */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ---- Map a persisted StressTestRecord to RunData --------------- */
  function recordToRunData(rec: StressTestRecord): RunData {
    return {
      timestamp: new Date(rec.timestamp).toISOString(),
      chaosParams: {
        latencyJitterMs: rec.chaosConfig.latencyJitterMs,
        memoryLeakMb: rec.chaosConfig.memoryLeakMb,
        failureRate: rec.chaosConfig.failureRate,
        eventLoopBlockMs: rec.chaosConfig.eventLoopBlockMs,
        activePreset: rec.chaosConfig.activePreset,
      },
      errorStackTraces: rec.errorMessages.length > 0 ? rec.errorMessages : ["No errors captured during this run."],
      slaLatency: {
        p50: rec.latency.p50,
        p95: rec.latency.p95,
        p99: rec.latency.p99,
      },
      successRate: rec.successRate,
      slaGrade: rec.grade,
      iterationCount: rec.iterationCount,
      failureCount: rec.failureCount,
    };
  }

  /* ---- Export handler --------------------------------------------- */
  const handleExport = useCallback(async (format: "json" | "csv") => {
    /* Priority: 1) live in-memory report  2) persisted localStorage  3) mock */
    let runData: RunData;
    let analysis: AIAnalysis;

    if (latestReport) {
      /* Live report from the current session */
      runData = {
        timestamp: new Date().toISOString(),
        chaosParams: {
          latencyJitterMs: chaosConfig.latencyJitterMs,
          memoryLeakMb: chaosConfig.memoryLeakMb,
          failureRate: chaosConfig.failureRate,
          eventLoopBlockMs: chaosConfig.eventLoopBlockMs,
          activePreset: chaosConfig.activePreset,
        },
        errorStackTraces: latestReport.iterations
          .filter((i) => i.error)
          .map((i) => i.error!),
        slaLatency: {
          p50: latestReport.p50,
          p95: latestReport.p95,
          p99: latestReport.p99,
        },
        successRate: latestReport.successRate,
        slaGrade: latestReport.grade,
        iterationCount: latestReport.iterations.length,
        failureCount: latestReport.iterations.filter((i) => !i.success).length,
      };
      analysis = aiAnalysis ?? {
        rootCauseSummary: "No AI analysis available. Run the SRE Copilot to generate an automated breakdown.",
        severity: "medium" as const,
      };
    } else {
      /* Attempt to load from persisted localStorage records */
      const records = await loadStressReports();
      if (records.length > 0) {
        const latest = records[records.length - 1]; // newest is last
        runData = recordToRunData(latest);
        analysis = aiAnalysis ?? {
          rootCauseSummary: `Persisted stress test from ${new Date(latest.timestamp).toLocaleString()}. Grade ${latest.grade}, ${latest.successRate.toFixed(1)}% success rate across ${latest.iterationCount} iterations with ${latest.failureCount} failures.`,
          severity: latest.successRate >= 95 ? ("low" as const) : latest.successRate >= 80 ? ("medium" as const) : ("high" as const),
        };
      } else {
        /* No real data anywhere — fall back to mock */
        runData = buildMockRunData();
        analysis = aiAnalysis ?? buildMockAnalysis();
      }
    }

    const bundle = generatePostMortem(runData, analysis);

    if (format === "json") {
      downloadJSON(bundle);
    } else {
      downloadCSV(`postmortem-${bundle.report.id}.csv`, bundle.report);
    }

    setDropdownOpen(false);
  }, [latestReport, chaosConfig, aiAnalysis]);

  /* ---- Render ----------------------------------------------------- */
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between">
        {/* Header */}
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Telemetry Overview
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {latestReport
              ? `Last run: Grade ${latestReport.grade} \u00B7 ${latestReport.successRate.toFixed(0)}% success`
              : "Run the stress suite to see metrics"}
          </p>
        </div>

        {/* Export dropdown button */}
        <div ref={dropdownRef} className="relative">
          <button
            disabled={!hasData}
            onClick={() => hasData && setDropdownOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
              hasData
                ? "border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                : "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50"
            }`}
            title={hasData ? "Export incident post-mortem" : "Run a stress test first to enable export"}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
            Export Incident Post-Mortem
            <svg
              className={`h-3 w-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m19.5 8.25-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>

          {/* Dropdown menu */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-1 shadow-xl">
              <button
                onClick={() => handleExport("json")}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 transition hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <svg
                  className="h-4 w-4 shrink-0 text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5"
                  />
                </svg>
                <div className="text-left">
                  <p className="font-medium">Export as JSON</p>
                  <p className="text-[10px] text-zinc-500">
                    Structured data export
                  </p>
                </div>
              </button>
              <div className="mx-3 border-t border-zinc-200 dark:border-zinc-700" />
              <button
                onClick={() => handleExport("csv")}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 transition hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <svg
                  className="h-4 w-4 shrink-0 text-zinc-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12c0-.621.504-1.125 1.125-1.125m0 0c.621 0 1.125-.504 1.125-1.125M12 12v1.5m0-1.5c0-.621-.504-1.125-1.125-1.125M12 13.5c0 .621-.504 1.125-1.125 1.125M12 13.5v1.5m0-1.5c0-.621.504-1.125 1.125-1.125"
                  />
                </svg>
                <div className="text-left">
                  <p className="font-medium">Export as CSV</p>
                  <p className="text-[10px] text-zinc-500">
                    Spreadsheet-compatible
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick metric cards (shown after a run) */}
      {latestReport && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: "Grade",
              value: latestReport.grade,
              cls: gradeColor(latestReport.grade),
            },
            { label: "Success", value: `${latestReport.successRate.toFixed(0)}%` },
            { label: "p50", value: formatMs(latestReport.p50) },
            { label: "p95", value: formatMs(latestReport.p95) },
            { label: "p99", value: formatMs(latestReport.p99) },
            { label: "MTBF", value: formatMtbf(latestReport.mtbf) },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-3 py-2 text-center"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                {m.label}
              </p>
              <p
                className={`mt-0.5 text-lg font-bold tabular-nums ${m.cls ?? "text-zinc-800 dark:text-zinc-200"}`}
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
