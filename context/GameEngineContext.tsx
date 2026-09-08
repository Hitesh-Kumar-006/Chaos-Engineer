"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  pickRandomChallenge,
  type Challenge,
  type Difficulty as ChallengeDifficulty,
} from "@/lib/challenges/challenge-bank";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type GameMode = "manual" | "auto_chaos";
export type Difficulty = ChallengeDifficulty;

interface GameState {
  /* ---- mode & difficulty ---- */
  mode: GameMode;
  difficulty: Difficulty;

  /* ---- current challenge ---- */
  currentChallenge: Challenge | null;

  /* ---- chaos time-attack ---- */
  countdownSeconds: number;
  streakCount: number;
  isTimerRunning: boolean;
  timerExpired: boolean;

  /* ---- actions ---- */
  setMode: (mode: GameMode) => void;
  setDifficulty: (d: Difficulty) => void;
  loadNextChallenge: () => void;
  recordSuccessfulRun: () => void;
  recordFailedRun: () => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  resetStreak: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BASE_COUNTDOWN = 900; // 15-minute countdown for chaos mode
const STREAK_DECREMENT = 30; // seconds shaved per consecutive win
const MIN_COUNTDOWN = 30; // floor — never go below 30 s
const TICK_INTERVAL = 1_000; // 1 s

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const GameEngineContext = createContext<GameState | undefined>(undefined);

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function GameEngineProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<GameMode>("manual");
  const [difficulty, setDifficultyState] = useState<Difficulty>("mild");
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(
    null,
  );

  const [countdownSeconds, setCountdownSeconds] = useState(BASE_COUNTDOWN);
  const [streakCount, setStreakCount] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---- Timer tick ------------------------------------------------- */
  useEffect(() => {
    if (!isTimerRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    intervalRef.current = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          setTimerExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, TICK_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTimerRunning]);

  /* ---- Timer controls --------------------------------------------- */
  const startTimer = useCallback(() => {
    setTimerExpired(false);
    setIsTimerRunning(true);
  }, []);

  const pauseTimer = useCallback(() => {
    setIsTimerRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setIsTimerRunning(false);
    setTimerExpired(false);
    setCountdownSeconds(BASE_COUNTDOWN);
  }, []);

  /* ---- Difficulty setter (resets streak on change) ---------------- */
  const setDifficulty = useCallback((d: Difficulty) => {
    setDifficultyState(d);
    setStreakCount(0);
    setCountdownSeconds(BASE_COUNTDOWN);
  }, []);

  /* ---- Challenge loading ------------------------------------------ */
  const loadNextChallenge = useCallback(() => {
    const next = pickRandomChallenge();
    setCurrentChallenge(next);
    setTimerExpired(false);
  }, []);

  /* ---- Streak logic ----------------------------------------------- */

  /**
   * Called when the player completes a run without errors.
   *
   * In extreme mode this:
   *  1. Increments the streak counter.
   *  2. Decrements the countdown for the *next* challenge by 30 s
   *     per consecutive win (floor 30 s).
   *     e.g. 180 -> 150 -> 120 -> 90 -> 60 -> 30 (cap)
   */
  const recordSuccessfulRun = useCallback(() => {
    setStreakCount((prev) => {
      const next = prev + 1;
      return next;
    });

    // Adjust countdown for next challenge only in chaos mode
    setDifficultyState((currentDiff) => {
      if (currentDiff === "chaos") {
        setStreakCount((streak) => {
          setCountdownSeconds(() => {
            const adjusted = BASE_COUNTDOWN - streak * STREAK_DECREMENT;
            return Math.max(adjusted, MIN_COUNTDOWN);
          });
          return streak;
        });
      }
      return currentDiff;
    });
  }, []);

  /**
   * Called when a run fails or the timer expires.
   * Resets streak and restores the base countdown.
   */
  const recordFailedRun = useCallback(() => {
    setStreakCount(0);
    setCountdownSeconds(BASE_COUNTDOWN);
  }, []);

  const resetStreak = useCallback(() => {
    setStreakCount(0);
    setCountdownSeconds(BASE_COUNTDOWN);
  }, []);

  /* ---- Provide value ---------------------------------------------- */
  return (
    <GameEngineContext.Provider
      value={{
        mode,
        difficulty,
        currentChallenge,
        countdownSeconds,
        streakCount,
        isTimerRunning,
        timerExpired,
        setMode,
        setDifficulty,
        loadNextChallenge,
        recordSuccessfulRun,
        recordFailedRun,
        startTimer,
        pauseTimer,
        resetTimer,
        resetStreak,
      }}
    >
      {children}
    </GameEngineContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useGameEngine(): GameState {
  const ctx = useContext(GameEngineContext);
  if (!ctx) {
    throw new Error(
      "useGameEngine must be used within a <GameEngineProvider>",
    );
  }
  return ctx;
}
