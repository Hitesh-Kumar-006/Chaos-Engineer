"use client";

import { useState } from "react";
import type { ChaosConfig, ChaosPreset } from "@/lib/execution/chaos";
import { DEFAULT_CONFIG } from "@/lib/execution/chaos";
import { useGameEngine } from "@/context/GameEngineContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  config: ChaosConfig;
  onConfigChange: (cfg: ChaosConfig) => void;
  rightOffset?: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  Preset options                                                     */
/* ------------------------------------------------------------------ */

const PRESET_OPTIONS: { value: ChaosPreset; label: string; hint: string }[] = [
  { value: "custom", label: "Custom", hint: "Manual parameter control" },
  {
    value: "db_pool_exhaustion",
    label: "DB Pool Exhaustion",
    hint: "1200 ms jitter · 40 % timeout",
  },
  {
    value: "serverless_cold_start",
    label: "Serverless Cold Start",
    hint: "2000 ms blocking delay",
  },
  {
    value: "storage_503_outage",
    label: "Storage 503 Outage",
    hint: "Immediate 503 exception",
  },
];

/* ------------------------------------------------------------------ */
/*  Preset slider values                                               */
/* ------------------------------------------------------------------ */

interface PresetValues {
  latencyJitterMs: number;
  memoryLeakMb: number;
  failureRate: number;
  eventLoopBlockMs: number;
}

const PRESET_VALUES: Record<Exclude<ChaosPreset, "custom">, PresetValues> = {
  db_pool_exhaustion: {
    latencyJitterMs: 1200,
    memoryLeakMb: 0,
    failureRate: 40,
    eventLoopBlockMs: 0,
  },
  serverless_cold_start: {
    latencyJitterMs: 2000,
    memoryLeakMb: 0,
    failureRate: 0,
    eventLoopBlockMs: 500,
  },
  storage_503_outage: {
    latencyJitterMs: 0,
    memoryLeakMb: 0,
    failureRate: 100,
    eventLoopBlockMs: 0,
  },
};

/* ------------------------------------------------------------------ */
/*  Slider                                                             */
/* ------------------------------------------------------------------ */

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled?: boolean;
  highlighted?: boolean;
  chaosMode?: boolean;
  moderateMode?: boolean;
  onChange: (v: number) => void;
}

function SliderCol({
  label,
  value,
  min,
  max,
  step,
  unit,
  disabled,
  highlighted,
  chaosMode,
  moderateMode,
  onChange,
}: SliderRowProps) {
  const labelColor = chaosMode
    ? "text-red-500 dark:text-red-400"
    : moderateMode
      ? "text-sky-600 dark:text-sky-400"
      : highlighted
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-zinc-500 dark:text-zinc-500";
  const valueColor = chaosMode
    ? "text-red-600 dark:text-red-300"
    : moderateMode
      ? "text-sky-600 dark:text-sky-300"
      : highlighted
        ? "text-emerald-600 dark:text-emerald-300"
        : "text-zinc-700 dark:text-zinc-300";
  const accentColor = chaosMode
    ? "accent-red-500"
    : moderateMode
      ? "accent-sky-500"
      : highlighted
        ? "accent-emerald-500"
        : "accent-zinc-400";

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <span className={`text-[10px] font-medium leading-none ${labelColor}`}>{label}</span>
        <span className={`text-[10px] font-bold tabular-nums leading-none ${valueColor}`}>
          {value}
          <span className="ml-px font-normal text-zinc-400 dark:text-zinc-600">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`mt-1 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 dark:bg-zinc-700 ${accentColor}
          [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
          ${chaosMode ? "[&::-webkit-slider-thumb]:bg-red-500" : moderateMode ? "[&::-webkit-slider-thumb]:bg-sky-500" : highlighted ? "[&::-webkit-slider-thumb]:bg-emerald-500" : "[&::-webkit-slider-thumb]:bg-zinc-400"}`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChaosControlDrawer({ config, onConfigChange, rightOffset = "0px", open: controlledOpen, onToggle }: Props) {
  const [internalOpen, setInternalOpen] = useState(true);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const handleToggle = () => {
    const next = !open;
    if (onToggle) onToggle(next);
    else setInternalOpen(next);
  };
  const { difficulty } = useGameEngine();
  const isChaosMode = difficulty === "chaos";
  const isModerateMode = difficulty === "moderate";

  const isCustom = config.activePreset === "custom";

  /** Update a single slider; auto-switches preset to "custom". */
  function update<K extends keyof ChaosConfig>(key: K, value: ChaosConfig[K]) {
    const next = { ...config, [key]: value };
    if (key !== "activePreset") next.activePreset = "custom";
    onConfigChange(next);
  }

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
      {/* Toggle tab */}
      <button
        onClick={handleToggle}
        className="flex h-8 w-full items-center justify-center gap-2 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 transition hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        {open ? "Chaos Matrix" : "\u25B8 Chaos Matrix"}
      </button>

      {/* Collapsible content */}
      {open && (
        <div className="p-3">
          {/* Heading + Reset button row */}
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">
              Simulate Disaster &amp; Fault Injection
            </h2>
            <button
              onClick={() => onConfigChange({ ...DEFAULT_CONFIG })}
              className="shrink-0 rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              Reset to Defaults
            </button>
          </div>

          {/* Dropdown + inline hint */}
          <div className="mb-2 flex items-center gap-3">
            <select
              value={config.activePreset}
              onChange={(e) => {
                const preset = e.target.value as ChaosPreset;
                if (preset === "custom") {
                  onConfigChange({ ...config, activePreset: "custom" });
                } else {
                  const vals = PRESET_VALUES[preset];
                  onConfigChange({
                    ...config,
                    activePreset: preset,
                    latencyJitterMs: vals.latencyJitterMs,
                    memoryLeakMb: vals.memoryLeakMb,
                    failureRate: vals.failureRate,
                    eventLoopBlockMs: vals.eventLoopBlockMs,
                  });
                }
              }}
              className="w-40 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-[11px] text-zinc-800 dark:text-zinc-200 outline-none focus:border-sky-500"
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {/* Inline preset description */}
            <span className="text-[11px] text-zinc-500">
              {PRESET_OPTIONS.find((o) => o.value === config.activePreset)?.hint ?? ""}
            </span>
          </div>

          {/* Single-row sliders */}
          <div className="flex flex-row items-center gap-4">
            <SliderCol
              label="Network Lag"
              value={config.latencyJitterMs}
              min={0}
              max={3000}
              step={50}
              unit="ms"
              highlighted={!isCustom}
              chaosMode={isChaosMode}
              moderateMode={isModerateMode}
              onChange={(v) => update("latencyJitterMs", v)}
            />
            <SliderCol
              label="Memory Bloat"
              value={config.memoryLeakMb}
              min={0}
              max={100}
              step={1}
              unit="MB"
              highlighted={!isCustom}
              chaosMode={isChaosMode}
              moderateMode={isModerateMode}
              onChange={(v) => update("memoryLeakMb", v)}
            />
            <SliderCol
              label="Crash Chance"
              value={config.failureRate}
              min={0}
              max={100}
              step={1}
              unit="%"
              highlighted={!isCustom}
              chaosMode={isChaosMode}
              moderateMode={isModerateMode}
              onChange={(v) => update("failureRate", v)}
            />
            <SliderCol
              label="App Freeze Time"
              value={config.eventLoopBlockMs}
              min={0}
              max={500}
              step={10}
              unit="ms"
              highlighted={!isCustom}
              chaosMode={isChaosMode}
              moderateMode={isModerateMode}
              onChange={(v) => update("eventLoopBlockMs", v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
