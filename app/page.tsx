"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGameEngine } from "@/context/GameEngineContext";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/dashboard/Header";
import ChallengeHeader from "@/components/challenges/ChallengeHeader";
import AutoAssessmentModal from "@/components/challenges/AutoAssessmentModal";
import ChaosControlDrawer from "@/components/editor/ChaosControlDrawer";
import StressTestSuite from "@/components/editor/StressTestSuite";
import type { StressReport } from "@/components/editor/StressTestSuite";
import MetricsCharts from "@/components/telemetry/MetricsCharts";
import ConsoleOutput, { type LogEntry, type Diagnostics, type ChaosReportTelemetry } from "@/components/telemetry/ConsoleOutput";
import SreCopilotDrawer from "@/components/chat/SreCopilotDrawer";
import { DEFAULT_CONFIG, DIFFICULTY_PRESETS, type ChaosConfig } from "@/lib/execution/chaos";
import { evaluateCode, inferCategories, TIER_PRESETS, type EvaluationResult, type PatternCategory } from "@/lib/challenges/evaluateCode";
import ChallengeResultsModal from "@/components/challenges/ChallengeResultsModal";
import { saveHistoryEntry, saveLastConfig, loadLastConfig, saveStressReport, type StressTestRecord } from "@/lib/persistence";
import { useCopilotMonitor, type CopilotEvent } from "@/lib/hooks/useCopilotMonitor";
import ToastContainer, { type Toast } from "@/components/ui/NotificationToast";
import PaneErrorBoundary from "@/components/ui/PaneErrorBoundary";
import ChaosStatusBanner, { type ChaosReport } from "@/components/ui/ChaosStatusBanner";

/* Language type — mirrors CodeEditor export */
type EditorLanguage = "javascript" | "python" | "java" | "c" | "cpp" | "csharp";

/* SSR-safe CodeMirror import */
const CodeEditor = dynamic(
  () => import("@/components/editor/CodeEditor"),
  { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/50" /> },
);

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const { mode, difficulty, setDifficulty } = useGameEngine();
  const router = useRouter();
  const [chaosConfig, setChaosConfig] = useState<ChaosConfig>(DEFAULT_CONFIG);
  const chaosConfigRef = useRef<ChaosConfig>(chaosConfig);
  chaosConfigRef.current = chaosConfig;
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [latestReport, setLatestReport] = useState<StressReport | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [challengeActive, setChallengeActive] = useState(false);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [lastChallengeLang, setLastChallengeLang] = useState<string>("");
  const [lastChallengeTitle, setLastChallengeTitle] = useState<string>("");
  const [challengeCategories, setChallengeCategories] = useState<PatternCategory[] | undefined>(undefined);
  const categoriesRef = useRef<PatternCategory[] | undefined>(undefined);
  categoriesRef.current = challengeCategories;
  const [copilotEvent, setCopilotEvent] = useState<CopilotEvent | null>(null);
  const [latestInsight, setLatestInsight] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [blameLines, setBlameLines] = useState<number[]>([]);
  const [lastChaosReport, setLastChaosReport] = useState<ChaosReport | null>(null);
  const [chaosMatrixOpen, setChaosMatrixOpen] = useState(true);
  const [code, setCode] = useState(`function executePipeline() {
    console.log("System initialized.");
}
executePipeline();`);
  const [lang, setLang] = useState<EditorLanguage>("javascript");

  const codeRef = useRef(code);
  const langRef = useRef(lang);
  codeRef.current = code;
  langRef.current = lang;

  /* ---- Toast management -------------------------------------------- */
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ---- Execution timeouts ------------------------------------------ */
  const BROWSER_EXEC_TIMEOUT_MS = 5_000;   // 5s for browser-side JS
  const SERVER_EXEC_TIMEOUT_MS  = 30_000;  // 30s for server-side compilation

  /** Race a promise against a timeout — returns structured error on timeout. */
  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`[${label}] Execution timed out after ${ms / 1000}s`)), ms);
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); },
      );
    });
  }

  /* ---- Stress test code executor ---------------------------------- */
  const stressCodeExecutor = useCallback(async () => {
    const source = codeRef.current;
    const language = langRef.current;
    const t0 = performance.now();

    if (language === "javascript") {
      const logs: string[] = [];
      const fakeConsole = {
        log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
        warn: (...args: unknown[]) => logs.push("[warn] " + args.map(String).join(" ")),
        error: (...args: unknown[]) => logs.push("[error] " + args.map(String).join(" ")),
      };
      try {
        const fn = new Function("console", source);
        await withTimeout(Promise.resolve(fn(fakeConsole)), BROWSER_EXEC_TIMEOUT_MS, "JS");
        const stdout = logs.join("\n") + (logs.length ? "" : "");
        return { stdout: stdout || "(no output)", stderr: "", success: true, latencyMs: performance.now() - t0 };
      } catch (err) {
        const errorType = err instanceof Error ? err.constructor.name : "UnknownError";
        const errorMsg = err instanceof Error ? err.message : String(err);
        /* Parse stack trace to extract line number for blame highlighting */
        let errorLine: string | null = null;
        if (err instanceof Error && err.stack) {
          const frames = err.stack.split("\n").slice(1);
          for (const frame of frames) {
            const m = frame.match(/:(\d+):\d+/);
            if (m) {
              const raw = parseInt(m[1], 10);
              errorLine = String(raw > 1 ? raw - 1 : raw);
              break;
            }
          }
        }
        const formatted = errorLine
          ? `[${errorType}] Line ${errorLine}: ${errorMsg}`
          : `[${errorType}] ${errorMsg}`;
        return { stdout: logs.join("\n"), stderr: formatted, success: false, latencyMs: performance.now() - t0 };
      }
    } else {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SERVER_EXEC_TIMEOUT_MS);
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            code: source,
            chaos: {
              networkLag: chaosConfigRef.current.latencyJitterMs,
              memoryBloat: chaosConfigRef.current.memoryLeakMb,
              crashChance: chaosConfigRef.current.failureRate,
              freezeTime: chaosConfigRef.current.eventLoopBlockMs,
              activePreset: chaosConfigRef.current.activePreset,
            },
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        /* Handle chaos fault responses from the backend */
        if (!res.ok) {
          let faultData: Record<string, unknown> = {};
          try { faultData = await res.json(); } catch { /* non-JSON */ }
          if (faultData.status === "fault") {
            const stderr = (faultData.stderr as string) || `[ChaosFault] ${faultData.detail}`;
            const rpt = faultData.chaosReport as ChaosReport | undefined;
            if (rpt) setLastChaosReport(rpt);
            return { stdout: "", stderr, success: false, latencyMs: performance.now() - t0 };
          }
          throw new Error(`API error: ${res.status}`);
        }
        const data = await res.json();
        /* Capture chaosReport from successful stress round responses */
        if (data.chaosReport) setLastChaosReport(data.chaosReport as ChaosReport);
        const stdout: string = data.output ?? data.stdout ?? "";
        const stderr: string = data.error ?? data.stderr ?? "";
        return {
          stdout: stdout || (stderr ? "" : "(no output)"),
          stderr,
          success: !stderr,
          latencyMs: performance.now() - t0,
        };
      } catch (err) {
        const errorType = err instanceof Error ? err.constructor.name : "UnknownError";
        const errorMsg = err instanceof Error ? err.message : String(err);
        const isTimeout = errorMsg.includes("timed out") || (err instanceof DOMException && err.name === "AbortError");
        const stderr = isTimeout
          ? `[TimeoutError] Server execution exceeded ${SERVER_EXEC_TIMEOUT_MS / 1000}s limit`
          : `[${errorType}] ${errorMsg}`;
        return { stdout: "", stderr, success: false, latencyMs: performance.now() - t0 };
      }
    }
  }, []);

  /* ---- Stress test log streaming --------------------------------- */
  const handleStressLog = useCallback((entry: { type: "stdout" | "stderr"; message: string }) => {
    setConsoleLogs((prev) => [...prev, entry]);
  }, []);

  /* ---- Event-driven Copilot monitor (no polling) ------------------ */
  useCopilotMonitor(copilotEvent, {
    onInsight: (insight) => setLatestInsight(insight),
    onImprovement: (message) => {
      setToasts((prev) => [
        ...prev,
        { id: crypto.randomUUID(), message, variant: "improvement" },
      ]);
    },
  });

  /* ---- Restore last saved config on mount ------------------------- */
  useEffect(() => {
    loadLastConfig().then((saved) => {
      if (saved) setChaosConfig((prev) => ({ ...prev, ...saved }));
    });
  }, []);

  /* ---- Collapse Chaos Matrix drawer when Auto Mode activates ------ */
  useEffect(() => {
    if (mode === "auto_chaos") setChaosMatrixOpen(false);
  }, [mode]);

  /* ---- Sync difficulty pills → slider positions (explicit callback) */
  const handleDifficultyChange = useCallback((d: "mild" | "moderate" | "chaos") => {
    setChaosConfig(DIFFICULTY_PRESETS[d]);
  }, []);

  /* ---- Code execution -------------------------------------------- */
  const executeCode = useCallback(async (source: string, language: EditorLanguage) => {
    if (language === "javascript") {
      /* ---- Browser-based JS/TS execution with timeout ---- */
      const newLogs: LogEntry[] = [];
      try {
        const logs: string[] = [];
        const fakeConsole = {
          log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
          warn: (...args: unknown[]) => logs.push("[warn] " + args.map(String).join(" ")),
          error: (...args: unknown[]) => logs.push("[error] " + args.map(String).join(" ")),
        };
        const fn = new Function("console", source);
        await withTimeout(Promise.resolve(fn(fakeConsole)), BROWSER_EXEC_TIMEOUT_MS, "JS");
        for (const line of logs) {
          newLogs.push({ type: "stdout", message: line });
        }
        if (newLogs.length === 0) {
          newLogs.push({ type: "stdout", message: "(no output)" });
        }
      } catch (err) {
        const errorType = err instanceof Error ? err.constructor.name : "UnknownError";
        const errorMsg = err instanceof Error ? err.message : String(err);

        /* Parse stack trace to extract the line number within user code */
        let errorLine: string | null = null;
        if (err instanceof Error && err.stack) {
          const frames = err.stack.split("\n").slice(1);
          for (const frame of frames) {
            const m = frame.match(/:(\d+):\d+/);
            if (m) {
              const raw = parseInt(m[1], 10);
              errorLine = String(raw > 1 ? raw - 1 : raw);
              break;
            }
          }
        }

        const formatted = errorLine
          ? `[${errorType}] Line ${errorLine}: ${errorMsg}`
          : `[${errorType}] ${errorMsg}`;

        newLogs.push({ type: "stderr", message: formatted });
      }
      setConsoleLogs(newLogs);
      setDiagnostics(null);
      setLastChaosReport(null);
    } else {
      /* ---- Server-side execution via /api/execute with timeout ---- */
      setIsExecuting(true);
      const newLogs: LogEntry[] = [];
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SERVER_EXEC_TIMEOUT_MS);
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language,
            code: source,
            chaos: {
              networkLag: chaosConfig.latencyJitterMs,
              memoryBloat: chaosConfig.memoryLeakMb,
              crashChance: chaosConfig.failureRate,
              freezeTime: chaosConfig.eventLoopBlockMs,
              activePreset: chaosConfig.activePreset,
            },
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        /* Handle chaos fault (503 with status:"fault") gracefully */
        if (!res.ok) {
          let faultData: Record<string, unknown> = {};
          try { faultData = await res.json(); } catch { /* non-JSON */ }
          if (faultData.status === "fault") {
            const stderr = (faultData.stderr as string) || `[ChaosFault] ${faultData.detail}`;
            newLogs.push({ type: "stderr", message: stderr });
            const rpt = faultData.chaosReport as ChaosReport | undefined;
            if (rpt) setLastChaosReport(rpt);
            setConsoleLogs(newLogs);
            return;
          }
          throw new Error(`API error: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        setDiagnostics(data.diagnostics ?? null);

        /* Capture chaos report from the response if present */
        if (data.chaosReport) {
          setLastChaosReport(data.chaosReport as ChaosReport);
        } else {
          setLastChaosReport(null);
        }

        const stdout: string = data.output ?? data.stdout ?? "";
        const stderr: string = data.error ?? data.stderr ?? "";

        if (stderr) {
          for (const line of String(stderr).split("\n")) {
            if (line.trim()) newLogs.push({ type: "stderr", message: line });
          }
        }
        if (stdout) {
          for (const line of String(stdout).split("\n")) {
            if (line.trim()) newLogs.push({ type: "stdout", message: line });
          }
        }
        if (!stdout && !stderr) {
          newLogs.push({ type: "stdout", message: "(no output)" });
        }
      } catch (err) {
        setDiagnostics(null);
        const errorType = err instanceof Error ? err.constructor.name : "UnknownError";
        const errorMsg = err instanceof Error ? err.message : String(err);
        const isTimeout = errorMsg.includes("timed out") || (err instanceof DOMException && err.name === "AbortError");
        const message = isTimeout
          ? `[TimeoutError] Server execution exceeded ${SERVER_EXEC_TIMEOUT_MS / 1000}s limit. Check for infinite loops.`
          : `[${errorType}] ${errorMsg}`;
        newLogs.push({ type: "stderr", message });
      } finally {
        setIsExecuting(false);
      }
      setConsoleLogs(newLogs);
    }
  }, [chaosConfig]);

  /* ---- Run button handler (intercepts auto-chaos) ----------------- */
  const handleRun = useCallback(() => {
    if (mode === "auto_chaos" && challengeActive) {
      /* Stop the challenge timer and evaluate the code */
      setChallengeActive(false);
      const result = evaluateCode(code, categoriesRef.current);
      setEvalResult(result);
      setResultsOpen(true);
      return;
    }
    /* Normal execution path */
    executeCode(code, lang);
  }, [mode, challengeActive, code, lang, executeCode]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-zinc-950">
      {/* Non-blocking improvement toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <Header />

      {/* SRE Copilot -- floating bottom-right widget with live editor code and language context */}
      <PaneErrorBoundary label="Chat Panel">
        <SreCopilotDrawer 
          chaosConfig={chaosConfig} 
          currentCode={code} 
          language={lang}
          externalInsight={latestInsight}
        />
      </PaneErrorBoundary>

      <PaneErrorBoundary label="Assessment Modal" onReset={() => setAssessmentOpen(false)}>
        <AutoAssessmentModal
          open={assessmentOpen}
          onClose={() => setAssessmentOpen(false)}
        />
      </PaneErrorBoundary>

      <PaneErrorBoundary label="Results Modal" onReset={() => { setResultsOpen(false); setEvalResult(null); }}>
        <ChallengeResultsModal
          open={resultsOpen}
          result={evalResult}
        onSubmit={() => {
          if (!evalResult) return;
          const preset = TIER_PRESETS[evalResult.tier];
          const newConfig: ChaosConfig = {
            latencyJitterMs: preset.latencyJitterMs,
            memoryLeakMb: preset.memoryLeakMb,
            failureRate: preset.failureRate,
            eventLoopBlockMs: preset.eventLoopBlockMs,
            activePreset: "custom",
          };
          setChaosConfig(newConfig);
          setResultsOpen(false);
          /* Persist config + history on explicit submit */
          saveLastConfig(newConfig);
          saveHistoryEntry({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            language: lastChallengeLang,
            challengeTitle: lastChallengeTitle,
            score: evalResult.score,
            tier: evalResult.tier,
            presetName: preset.presetName,
            config: {
              latencyJitterMs: preset.latencyJitterMs,
              memoryLeakMb: preset.memoryLeakMb,
              failureRate: preset.failureRate,
              eventLoopBlockMs: preset.eventLoopBlockMs,
            },
          });
          /* Fire Copilot monitoring event */
          setCopilotEvent({
            kind: "challenge_submitted",
            tier: evalResult.tier,
            score: evalResult.score,
            language: lastChallengeLang,
            challengeTitle: lastChallengeTitle,
            presetName: preset.presetName,
            patterns: evalResult.patterns,
          });
        }}
        onRetry={() => {
          /* Full reset: close modal, deactivate challenge, restore defaults */
          setResultsOpen(false);
          setEvalResult(null);
          setChallengeActive(false);
          setChaosConfig(DEFAULT_CONFIG);
          /* Persist the reset config */
          saveLastConfig(DEFAULT_CONFIG);
        }}
      />
      </PaneErrorBoundary>

      {/* Dashboard body */}
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-[1600px]">
          {/* 12-column grid: left = editor workspace, right = telemetry */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* ──── Left pane: Welcome + Mode/Difficulty + Config + Editor ──── */}
            <div className="space-y-4 xl:col-span-7">
              {/* Welcome heading at very top */}
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Welcome, {user!.username}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-500">
                Write your resilience code below, configure fault injection
                in the Chaos Matrix, then run the stress suite.
              </p>

              {/* Mode Selector & Difficulty pills */}
              <PaneErrorBoundary label="Challenge Selector">
                <ChallengeHeader
                  challengeActive={challengeActive}
                  onChallengeStop={() => setChallengeActive(false)}
                  onDifficultyChange={handleDifficultyChange}
                  onLanguageChange={(language) => setLang(language as EditorLanguage)}
                  onStartChallenge={(language, starterCode, title) => {
                    setLang(language as EditorLanguage);
                    setCode(starterCode);
                    setDifficulty("moderate");
                    handleDifficultyChange("moderate");
                    setChallengeActive(true);
                    setLastChallengeLang(language);
                    setLastChallengeTitle(title);
                    const cats = inferCategories(title);
                    setChallengeCategories(cats);
                  }}
                />
              </PaneErrorBoundary>

              {/* Chaos status banner: shows active mode, injection state, and last-run telemetry */}
              <ChaosStatusBanner
                config={chaosConfig}
                difficulty={difficulty}
                lastReport={lastChaosReport}
                onResetChaos={() => {
                  setChaosConfig(DEFAULT_CONFIG);
                  setLastChaosReport(null);
                  saveLastConfig(DEFAULT_CONFIG);
                }}
                onRetryExecution={() => {
                  setLastChaosReport(null);
                  executeCode(code, lang);
                }}
              />

              {/* Configuration workspace (dropdown + 4 sliders) directly below */}
              <PaneErrorBoundary label="Chaos Matrix" onReset={() => { setChaosConfig(DEFAULT_CONFIG); saveLastConfig(DEFAULT_CONFIG); setLastChaosReport(null); }}>
                <ChaosControlDrawer
                  config={chaosConfig}
                  onConfigChange={setChaosConfig}
                  open={chaosMatrixOpen}
                  onToggle={setChaosMatrixOpen}
                />
              </PaneErrorBoundary>

              <PaneErrorBoundary label="Code Editor" onReset={() => { setCode(`function executePipeline() {\n    console.log("System initialized.");\n}\nexecutePipeline();`); setBlameLines([]); }}>
                <CodeEditor
                  language={lang}
                  blameLines={blameLines}
                  onLanguageChange={(l) => {
                    setLang(l);
                  }}
                  value={code}
                  onChange={(val) => {
                    setCode(val);
                  }}
                />
              </PaneErrorBoundary>
            </div>

            {/* ──── Right pane: Telemetry > Stress Suite > Console ──── */}
            {/* mt-[5.5rem] offsets the Welcome heading height so MetricsCharts aligns with ChallengeHeader */}
            <div className="mt-[5.5rem] flex flex-col gap-4 xl:col-span-5">
              <PaneErrorBoundary label="Metrics Dashboard" onReset={() => setLatestReport(null)}>
                <MetricsCharts
                  latestReport={latestReport}
                  chaosConfig={chaosConfig}
                />
              </PaneErrorBoundary>

              <PaneErrorBoundary label="Stress Test Suite" onReset={() => { setLatestReport(null); setConsoleLogs([]); setLastChaosReport(null); }}>
                <StressTestSuite
                config={chaosConfig}
                difficulty={difficulty}
                codeExecutor={stressCodeExecutor}
                onLog={handleStressLog}
                onBlame={setBlameLines}
                onRunComplete={(report) => {
                  setLatestReport(report);
                  /* Persist real telemetry to localStorage */
                  const record: StressTestRecord = {
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    grade: report.grade,
                    successRate: report.successRate,
                    mtbf: report.mtbf,
                    latency: { p50: report.p50, p95: report.p95, p99: report.p99 },
                    iterationCount: report.iterations.length,
                    failureCount: report.iterations.filter((i) => !i.success).length,
                    errorMessages: report.iterations
                      .filter((i) => i.error)
                      .map((i) => i.error!),
                    chaosConfig: {
                      latencyJitterMs: chaosConfig.latencyJitterMs,
                      memoryLeakMb: chaosConfig.memoryLeakMb,
                      failureRate: chaosConfig.failureRate,
                      eventLoopBlockMs: chaosConfig.eventLoopBlockMs,
                      activePreset: chaosConfig.activePreset ?? "custom",
                    },
                  };
                  saveStressReport(record);
                  /* Fire Copilot monitoring event */
                  setCopilotEvent({
                    kind: "stress_test_completed",
                    p50: report.p50,
                    p95: report.p95,
                    p99: report.p99,
                    mtbf: report.mtbf,
                    successRate: report.successRate,
                    grade: report.grade,
                  });
                  /* Toast: post-mortem ready for export */
                  setToasts((prev) => [
                    ...prev,
                    {
                      id: crypto.randomUUID(),
                      message: `Challenge complete — Grade ${report.grade}, ${report.successRate.toFixed(0)}% success. Post-mortem report ready for export.`,
                      variant: "improvement",
                    },
                  ]);
                }}
              />
              </PaneErrorBoundary>

              {/* Run / Stop bar + Console */}
              <PaneErrorBoundary label="Console Output" onReset={() => { setConsoleLogs([]); setDiagnostics(null); setLastChaosReport(null); }}>
                <div>
                  {/* Run/Stop controls */}
                  <div className="mb-2 flex items-center gap-3">
                    <button
                      onClick={handleRun}
                      disabled={isExecuting || (mode === "auto_chaos" && challengeActive && resultsOpen)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-500 disabled:opacity-40"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 2l10 6-10 6z" />
                      </svg>
                      Run
                    </button>
                  </div>

                  <ConsoleOutput
                    logs={consoleLogs}
                    diagnostics={diagnostics}
                    chaosReport={lastChaosReport ? { faulted: lastChaosReport.faulted, injected: lastChaosReport.injected, addedLatencyMs: lastChaosReport.addedLatencyMs } : null}
                    onClear={() => {
                      setConsoleLogs([]);
                      setDiagnostics(null);
                      setLastChaosReport(null);
                    }}
                  />
                </div>
              </PaneErrorBoundary>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}