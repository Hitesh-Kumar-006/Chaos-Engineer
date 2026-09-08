import { NextResponse } from "next/server";
import {
  type ChaosConfig, type ChaosResult, ChaosError,
  sanitiseConfig, resolveConfig, applyChaosBeforeRun, applyChaosAfterRun,
} from "@/lib/execution/chaos";

export interface ChaosBody {
  networkLag?: number; memoryBloat?: number; crashChance?: number;
  freezeTime?: number; activePreset?: string; difficulty?: string;
}
export interface ChaosReport {
  faulted: boolean; injected: string[]; addedLatencyMs: number; config: ChaosConfig;
}

function bodyToConfig(body: ChaosBody): ChaosConfig {
  return sanitiseConfig({
    latencyJitterMs: body.networkLag, memoryLeakMb: body.memoryBloat,
    failureRate: body.crashChance, eventLoopBlockMs: body.freezeTime,
    activePreset: body.activePreset as ChaosConfig["activePreset"],
  });
}
function headerToConfig(h: string | null): ChaosConfig | null {
  if (!h) return null;
  try { return bodyToConfig(JSON.parse(atob(h)) as ChaosBody); } catch { return null; }
}

export function extractChaosConfig(body: Record<string, unknown> | null, headerValue: string | null): ChaosConfig | null {
  if (body && typeof body.chaos === "object" && body.chaos !== null) return bodyToConfig(body.chaos as ChaosBody);
  return headerToConfig(headerValue);
}

export function isChaosActive(cfg: ChaosConfig): boolean {
  return cfg.latencyJitterMs > 0 || cfg.memoryLeakMb > 0 || cfg.failureRate > 0 || cfg.eventLoopBlockMs > 0 ||
    (cfg.activePreset !== undefined && cfg.activePreset !== "custom");
}

export async function injectBefore(cfg: ChaosConfig | null): Promise<ChaosResult | null> {
  if (!cfg || !isChaosActive(cfg)) return null;
  return applyChaosBeforeRun(resolveConfig(cfg));
}

export async function injectAfter(cfg: ChaosConfig | null): Promise<{ result: ChaosResult | null; error: ChaosError | null }> {
  if (!cfg || !isChaosActive(cfg)) return { result: null, error: null };
  try { return { result: await applyChaosAfterRun(resolveConfig(cfg)), error: null }; }
  catch (err) {
    if (err instanceof ChaosError) return { result: { faulted: true, summary: ["FAULT: " + err.message], addedLatencyMs: 0 }, error: err };
    throw err;
  }
}

export function buildReport(cfg: ChaosConfig, before: ChaosResult | null, after: ChaosResult | null): ChaosReport {
  const injected: string[] = []; let addedLatencyMs = 0; let faulted = false;
  if (before) { injected.push(...before.summary); addedLatencyMs += before.addedLatencyMs; if (before.faulted) faulted = true; }
  if (after) { injected.push(...after.summary); addedLatencyMs += after.addedLatencyMs; if (after.faulted) faulted = true; }
  return { faulted, injected, addedLatencyMs, config: cfg };
}

export function chaosFaultResponse(err: ChaosError, report: ChaosReport): NextResponse {
  return NextResponse.json({
    error: "Chaos fault injected", detail: err.message, preset: err.preset,
    chaosReport: report, stdout: "", stderr: "[ChaosFault] " + err.message, status: "fault",
  }, { status: 503 });
}

export function attachChaosReport(data: Record<string, unknown>, report: ChaosReport | null): Record<string, unknown> {
  if (!report) return data;
  return { ...data, chaosReport: report };
}
