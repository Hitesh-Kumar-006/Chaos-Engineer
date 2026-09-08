import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { QODER_SYSTEM_PROMPT } from "@/lib/ai-prompt";
import { auditEnv, requireEnv, envErrorResponse, EnvMissingError } from "@/lib/env";
import { sanitiseConfig, resolveConfig, applyChaosBeforeRun, ChaosError, applyChaosAfterRun, type ChaosConfig } from "@/lib/execution/chaos";

/* Lazy-initialised Gemini client */
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  return _ai;
}

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
interface RequestBody {
  message?: string;
  history?: ChatMessage[];
  proactiveExplainer?: boolean;
  context?: {
    challengeId?: string; difficulty?: string; currentCode?: string; language?: string;
    chaosParams?: Record<string, number | string>;
  };
}

function buildProactivePrompt(context?: RequestBody["context"]): string {
  const parts: string[] = [
    "Provide a structured post-mortem breakdown of the most recently mitigated incident.",
    "", "Use the following format:",
    "## Incident Summary", "One-paragraph overview of what happened.",
    "## Timeline", "Bullet-point timeline of detection, investigation, and mitigation.",
    "## Root Cause Analysis", "Technical deep-dive into why the failure occurred.",
    "## Remediation Actions", "Concrete steps to prevent recurrence.",
  ];
  if (context?.chaosParams) {
    parts.push("", "## Chaos Parameters Active During Incident");
    for (const [key, value] of Object.entries(context.chaosParams)) parts.push(`- **${key}**: ${value}`);
  }
  return parts.join("\n");
}

/** Extract chaos config from the x-chaos-config header or the context.chaosParams body field. */
function extractChaos(body: RequestBody, headerVal: string | null): ChaosConfig | null {
  /* 1. Header takes precedence (base64 JSON) */
  if (headerVal) {
    try {
      const parsed = JSON.parse(atob(headerVal)) as Record<string, number | string>;
      const cfg = sanitiseConfig({
        latencyJitterMs: (parsed.networkLag as number) ?? (parsed.latencyJitterMs as number),
        memoryLeakMb: (parsed.memoryBloat as number) ?? (parsed.memoryLeakMb as number),
        failureRate: (parsed.crashChance as number) ?? (parsed.failureRate as number),
        eventLoopBlockMs: (parsed.freezeTime as number) ?? (parsed.eventLoopBlockMs as number),
        activePreset: parsed.activePreset as ChaosConfig["activePreset"],
      });
      if (cfg.latencyJitterMs > 0 || cfg.failureRate > 0 || cfg.memoryLeakMb > 0 || cfg.eventLoopBlockMs > 0) return cfg;
    } catch { /* malformed header, fall through */ }
  }

  /* 2. Body context.chaosParams */
  if (body.context?.chaosParams) {
    const p = body.context.chaosParams;
    const cfg = sanitiseConfig({
      latencyJitterMs: typeof p.latencyJitterMs === "number" ? p.latencyJitterMs : 0,
      memoryLeakMb: typeof p.memoryLeakMb === "number" ? p.memoryLeakMb : 0,
      failureRate: typeof p.failureRate === "number" ? p.failureRate : 0,
      eventLoopBlockMs: typeof p.eventLoopBlockMs === "number" ? p.eventLoopBlockMs : 0,
    });
    if (cfg.latencyJitterMs > 0 || cfg.failureRate > 0 || cfg.memoryLeakMb > 0 || cfg.eventLoopBlockMs > 0) return cfg;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    auditEnv();

    try { requireEnv("GEMINI_API_KEY"); } catch (e) { return envErrorResponse(e); }

    const body = (await request.json()) as RequestBody;
    if (!body.message && !body.proactiveExplainer) {
      return NextResponse.json({ error: "Missing required field: message" }, { status: 400 });
    }

    /* ---- Chaos injection: pre-execution (latency/memory/block) ---- */
    const chaosCfg = extractChaos(body, request.headers.get("x-chaos-config"));
    let chaosInjected: string[] = [];
    let chaosAddedLatencyMs = 0;

    if (chaosCfg) {
      const resolved = resolveConfig(chaosCfg);
      const before = await applyChaosBeforeRun(resolved);
      chaosInjected = before.summary;
      chaosAddedLatencyMs = before.addedLatencyMs;
    }

    /* Build the active user message */
    let activeUserMessage = "";
    if (body.proactiveExplainer) {
      activeUserMessage = buildProactivePrompt(body.context);
    } else {
      activeUserMessage = body.message || "";
      if (body.context) {
        const ctxLines: string[] = [];
        if (body.context.language) ctxLines.push(`[Active Editor Language: ${body.context.language}]`);
        if (body.context.currentCode) {
          const numbered = body.context.currentCode.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");
          ctxLines.push(`[Active Editor Code with Line Numbers:\n${numbered}\n]`);
        }
        if (body.context.challengeId) ctxLines.push(`[Context: challenge=${body.context.challengeId}, difficulty=${body.context.difficulty ?? "unknown"}]`);
        if (body.context.chaosParams) {
          ctxLines.push(`[Chaos params: ${Object.entries(body.context.chaosParams).map(([k, v]) => `${k}=${v}`).join(", ")}]`);
        }
        if (ctxLines.length > 0) activeUserMessage = `${ctxLines.join("\n")}\n\nUser Question: ${activeUserMessage}`;
      }
    }

    const recentHistory = body.history ? body.history.slice(-6) : [];
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
    for (const msg of recentHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        contents.push({ role: msg.role === "assistant" ? "model" : "user", parts: [{ text: msg.content }] });
      }
    }
    contents.push({ role: "user", parts: [{ text: activeUserMessage }] });

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents,
      config: { systemInstruction: QODER_SYSTEM_PROMPT, temperature: 0.3, maxOutputTokens: 400 },
    });
    const reply = response.text || "";

    /* ---- Chaos injection: post-execution (failure roll) ----------- */
    if (chaosCfg) {
      try {
        const resolved = resolveConfig(chaosCfg);
        const after = await applyChaosAfterRun(resolved);
        chaosInjected.push(...after.summary);
        chaosAddedLatencyMs += after.addedLatencyMs;
      } catch (err) {
        if (err instanceof ChaosError) {
          /* Chaos fault triggered — return structured 503 with the AI reply as fallback context */
          return NextResponse.json({
            error: "Chaos fault injected",
            detail: err.message,
            preset: err.preset,
            reply: "",
            fallbackReply: reply,
            chaosReport: { faulted: true, injected: [...chaosInjected, "FAULT: " + err.message], addedLatencyMs: chaosAddedLatencyMs },
          }, { status: 503 });
        }
        throw err;
      }
    }

    return NextResponse.json({
      reply,
      finishReason: "stop",
      tokensUsed: null,
      ...(chaosCfg ? { chaosReport: { faulted: false, injected: chaosInjected, addedLatencyMs: chaosAddedLatencyMs } } : {}),
    });

  } catch (error) {
    if (error instanceof EnvMissingError) return envErrorResponse(error);
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[ai-chat/gemini]", message);
    return NextResponse.json({ error: "AI service temporarily unavailable. Please try again." }, { status: 500 });
  }
}
