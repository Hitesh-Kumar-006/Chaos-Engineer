"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useGameEngine, type Difficulty } from "@/context/GameEngineContext";
import { SCENARIO_POOL, type SnippetLang } from "@/lib/challenges/scenarios";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  onStartChallenge?: (language: string, code: string, title: string) => void;
  /** Whether the auto-chaos challenge is currently active (controlled by parent). */
  challengeActive?: boolean;
  /** Called when parent needs to stop the challenge (e.g. Run intercepted). */
  onChallengeStop?: () => void;
  /** Called synchronously when a difficulty pill is clicked, so parent can update slider values. */
  onDifficultyChange?: (d: Difficulty) => void;
}

const SNIPPET_LANGS: { value: SnippetLang; label: string }[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
];



/* ------------------------------------------------------------------ */
/*  Difficulty pill styling                                            */
/* ------------------------------------------------------------------ */

const DIFFICULTY_TIERS: { value: Difficulty; label: string; active: string; idle: string }[] = [
  { value: "mild",     label: "Mild",     active: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/40", idle: "text-zinc-500 hover:text-emerald-400 hover:ring-emerald-500/20" },
  { value: "moderate", label: "Moderate", active: "bg-sky-500/20 text-sky-400 ring-sky-500/40",             idle: "text-zinc-500 hover:text-sky-400 hover:ring-sky-500/20" },
  { value: "chaos",    label: "Chaos",    active: "bg-red-500/20 text-red-400 ring-red-500/40",             idle: "text-zinc-500 hover:text-red-400 hover:ring-red-500/20" },
];

/* ------------------------------------------------------------------ */
/*  Timer formatting                                                   */
/* ------------------------------------------------------------------ */

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChallengeHeader({ onStartChallenge, challengeActive = false, onChallengeStop, onDifficultyChange }: Props) {
  const {
    mode,
    difficulty,
    countdownSeconds,
    isTimerRunning,
    timerExpired,
    streakCount,
    setMode,
    setDifficulty,
    startTimer,
    pauseTimer,
    resetTimer,
  } = useGameEngine();

  const isChaos = difficulty === "chaos";
  const isCritical = isChaos && countdownSeconds <= 30 && countdownSeconds > 0;
  const beepRef = useRef<(() => void) | null>(null);
  const [autoLang, setAutoLang] = useState<SnippetLang | null>(null);
  const [scenarioIdx, setScenarioIdx] = useState(0);

  /* ---- Auto Chaos 20-minute countdown ------------------------------ */
  const AUTO_COUNTDOWN = 1200; // 20 minutes in seconds
  const [autoSeconds, setAutoSeconds] = useState(AUTO_COUNTDOWN);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoExpired, setAutoExpired] = useState(false);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!autoRunning) {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
      autoIntervalRef.current = null;
      return;
    }
    autoIntervalRef.current = setInterval(() => {
      setAutoSeconds((prev) => {
        if (prev <= 1) {
          setAutoRunning(false);
          setAutoExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (autoIntervalRef.current) clearInterval(autoIntervalRef.current);
    };
  }, [autoRunning]);

  /* Stop timer when parent signals challenge end */
  useEffect(() => {
    if (!challengeActive && autoRunning) {
      setAutoRunning(false);
    }
  }, [challengeActive]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Pull a fresh random scenario when challenge ends (e.g. Retry from results) */
  useEffect(() => {
    if (!challengeActive && autoLang) {
      setScenarioIdx(Math.floor(Math.random() * SCENARIO_POOL[autoLang].length));
    }
  }, [challengeActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartChallenge = useCallback(() => {
    if (!autoLang || !onStartChallenge) return;
    onStartChallenge(autoLang, SCENARIO_POOL[autoLang][scenarioIdx].starterCode, SCENARIO_POOL[autoLang][scenarioIdx].title);
    setAutoSeconds(AUTO_COUNTDOWN);
    setAutoExpired(false);
    setAutoRunning(true);
  }, [autoLang, scenarioIdx, onStartChallenge]);

  const handleReset = useCallback(() => {
    setAutoRunning(false);
    setAutoExpired(false);
    setAutoSeconds(AUTO_COUNTDOWN);
    onChallengeStop?.();
  }, [onChallengeStop]);

  /* ---- Initialise Web Audio beep on first user gesture ------------ */
  useEffect(() => {
    function initBeep() {
      if (beepRef.current) return;
      try {
        const AudioCtx = window.AudioContext;
        const ctx = new AudioCtx();
        beepRef.current = () => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          osc.type = "square";
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.12);
        };
      } catch {
        // Web Audio unavailable in this environment
      }
    }
    initBeep();
  }, []);

  /* ---- Beep every second when timer is critical ------------------- */
  useEffect(() => {
    if (isCritical && isTimerRunning && !timerExpired && beepRef.current) {
      beepRef.current();
    }
  }, [countdownSeconds, isCritical, isTimerRunning, timerExpired]);

  /* ---- Render ----------------------------------------------------- */
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-6 py-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Mode toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Mode
          </span>
          <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5">
            {(["manual", "auto_chaos"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === m
                    ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
                }`}
              >
                {m === "manual" ? "Manual Selection" : "Auto Chaos"}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty pills (manual mode only) */}
        {mode === "manual" && (
          <div className="flex flex-wrap items-center gap-2">
            {DIFFICULTY_TIERS.map((tier) => (
              <div key={tier.value} className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setDifficulty(tier.value);
                    onDifficultyChange?.(tier.value);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition ${
                    difficulty === tier.value ? tier.active : tier.idle
                  }`}
                >
                  {tier.label}
                </button>

                {/* 05:00 countdown timer badge directly next to Chaos button when selected */}
                {tier.value === "chaos" && isChaos && (
                  <button
                    onClick={isTimerRunning ? pauseTimer : startTimer}
                    onDoubleClick={resetTimer}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] font-bold tabular-nums transition ${
                      timerExpired
                        ? "border-red-700 bg-red-950/40 text-red-400"
                        : isCritical
                          ? "border-red-500 bg-red-950/30 text-red-400 animate-pulse"
                          : isTimerRunning
                            ? "border-sky-700 bg-sky-950/30 text-sky-400"
                            : "border-red-700/60 bg-red-950/30 text-red-400"
                    }`}
                  >
                    {isTimerRunning && !timerExpired && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                          isCritical ? "bg-red-500" : "bg-sky-500"
                        }`}
                      />
                    )}
                    {!isTimerRunning && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                    {formatTimer(countdownSeconds)}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto Chaos workflow */}
      {mode === "auto_chaos" && (
        <>
          {/* Active challenge: show only the timer */}
          {challengeActive && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-sky-200 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-950/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Challenge Active
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 font-mono text-sm font-bold tabular-nums transition ${
                    autoExpired
                      ? "border-red-700 bg-red-950/40 text-red-400"
                      : autoSeconds <= 60
                        ? "border-red-500 bg-red-950/30 text-red-400 animate-pulse"
                        : "border-sky-700 bg-sky-950/30 text-sky-400"
                  }`}
                >
                  {autoRunning && !autoExpired && (
                    <span
                      className={`h-2 w-2 rounded-full animate-pulse ${
                        autoSeconds <= 60 ? "bg-red-500" : "bg-sky-500"
                      }`}
                    />
                  )}
                  {!autoRunning && (
                    <span className={`h-2 w-2 rounded-full ${autoExpired ? "bg-red-500" : "bg-sky-500"}`} />
                  )}
                  {formatTimer(autoSeconds)}
                </span>
              </div>

              {/* Pause / Resume toggle */}
              <button
                onClick={() => {
                  if (autoExpired) return;
                  setAutoRunning((r) => !r);
                }}
                disabled={autoExpired}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 disabled:opacity-40"
              >
                {autoRunning ? "Pause" : autoExpired ? "Expired" : "Resume"}
              </button>

              {/* Reset challenge — return to setup */}
              <button
                onClick={handleReset}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2.5 py-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                Reset
              </button>
            </div>
          )}

          {/* Setup panel: language selector + description + start button */}
          {!challengeActive && (
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-sky-200 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-950/10 p-4">
              {/* Language selector */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Select Language
                </span>
                <select
                  value={autoLang ?? ""}
                  onChange={(e) => {
                    setAutoLang(e.target.value as SnippetLang);
                    setScenarioIdx(Math.floor(Math.random() * SCENARIO_POOL[e.target.value as SnippetLang].length));
                  }}
                  className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-[11px] text-zinc-800 dark:text-zinc-200 outline-none focus:border-sky-500"
                >
                  <option value="" disabled>
                    Choose a language…
                  </option>
                  {SNIPPET_LANGS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Challenge description */}
              {autoLang && (
                <>
                  {/* Scenario selector */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                      Scenario
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={scenarioIdx}
                        onChange={(e) => setScenarioIdx(Number(e.target.value))}
                        className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-[11px] text-zinc-800 dark:text-zinc-200 outline-none focus:border-sky-500"
                      >
                        {SCENARIO_POOL[autoLang].map((ch, i) => (
                          <option key={i} value={i}>
                            {i + 1}. {ch.title}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const next = Math.floor(Math.random() * SCENARIO_POOL[autoLang].length);
                          setScenarioIdx(next);
                        }}
                        className="rounded border border-zinc-300 dark:border-zinc-700 p-1 text-zinc-500 transition hover:border-sky-500 dark:hover:border-sky-600 hover:text-sky-500 dark:hover:text-sky-400"
                        title="Random scenario"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 4h3l3 4-3 4H1" />
                          <path d="M15 4h-3l-3 4 3 4h3" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">
                        Moderate
                      </span>
                      <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                        {SCENARIO_POOL[autoLang][scenarioIdx].title}
                      </span>
                    </div>
                    <p className="mb-3 text-[12px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                      {SCENARIO_POOL[autoLang][scenarioIdx].description}
                    </p>
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                        Requirements
                      </span>
                      <ul className="list-inside list-disc space-y-0.5">
                        {SCENARIO_POOL[autoLang][scenarioIdx].requirements.map((req, i) => (
                          <li key={i} className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                            {req}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Start Challenge button */}
                  <button
                    onClick={handleStartChallenge}
                    className="flex w-fit items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-sky-500"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4 2l10 6-10 6z" />
                    </svg>
                    Start Challenge
                  </button>
                </>
              )}
            </div>
          )}

          {/* Auto Chaos timer expired warning */}
          {autoExpired && challengeActive && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                Time Expired
              </span>
              <span className="text-xs text-red-400/70">
                20-minute challenge timer ran out. Click Reset to try again.
              </span>
            </div>
          )}
        </>
      )}

      {/* Timer expired warning */}
      {timerExpired && isChaos && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider text-red-400">
            Time Expired
          </span>
          <span className="text-xs text-red-400/70">
            Challenge timer ran out. Streak reset. Double-click the timer to restart.
          </span>
        </div>
      )}
    </div>
  );
}
