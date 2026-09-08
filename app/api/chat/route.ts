import { NextResponse } from 'next/server';
import { QODER_SYSTEM_PROMPT } from '@/lib/ai-prompt';
import { auditEnv, requireEnv, envErrorResponse, EnvMissingError } from '@/lib/env';
import { sanitiseConfig, resolveConfig, applyChaosBeforeRun, applyChaosAfterRun, ChaosError, type ChaosConfig } from '@/lib/execution/chaos';

const PRIMARY_MODEL = 'gpt-4o-mini';
const FALLBACK_MODEL = 'gpt-3.5-turbo';
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

async function callLLM(model: string, apiKey: string, messages: { role: string; content: string }[]) {
    return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: QODER_SYSTEM_PROMPT }, ...messages],
            temperature: 0.3,
        }),
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract chaos config from the x-chaos-config header (base64 JSON). */
function extractChaosFromHeader(headerVal: string | null) {
    if (!headerVal) return null;
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
    } catch { /* malformed */ }
    return null;
}

export async function POST(request: Request) {
    try {
        auditEnv();

        let apiKey: string;
        try { apiKey = requireEnv("OPENAI_API_KEY"); } catch (e) { return envErrorResponse(e); }

        const { messages } = await request.json();
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: "Missing required field: messages (non-empty array)" }, { status: 400 });
        }

        /* ---- Chaos injection: pre-execution ---------------------------- */
        const chaosCfg = extractChaosFromHeader(request.headers.get("x-chaos-config"));
        let chaosInjected: string[] = [];
        let chaosAddedLatencyMs = 0;

        if (chaosCfg) {
            const resolved = resolveConfig(chaosCfg);
            const before = await applyChaosBeforeRun(resolved);
            chaosInjected = before.summary;
            chaosAddedLatencyMs = before.addedLatencyMs;
        }

        /* ---- Exponential backoff retry on primary model --------------- */
        let response = await callLLM(PRIMARY_MODEL, apiKey, messages);
        for (const delayMs of RETRY_DELAYS_MS) {
            if (response.status !== 503) break;
            console.warn(`[chat/openai] Primary model returned 503 — retrying in ${delayMs / 1000}s`);
            await sleep(delayMs);
            response = await callLLM(PRIMARY_MODEL, apiKey, messages);
        }

        /* ---- Fallback model if primary exhausted all retries ---------- */
        if (response.status === 503) {
            console.warn(`[chat/openai] Primary model (${PRIMARY_MODEL}) exhausted retries — switching to ${FALLBACK_MODEL}`);
            response = await callLLM(FALLBACK_MODEL, apiKey, messages);
        }

        const data = await response.json();
        if (!response.ok) {
            const upstreamMsg = data.error?.message || `OpenAI API returned ${response.status}`;
            console.error(`[chat/openai] Upstream error: ${upstreamMsg}`);
            return NextResponse.json({ error: "Chat service temporarily unavailable. Please try again." }, { status: 502 });
        }

        const reply = data.choices?.[0]?.message;
        if (!reply) {
            return NextResponse.json({ error: "Chat service returned an empty response." }, { status: 502 });
        }

        /* ---- Chaos injection: post-execution (failure roll) ----------- */
        if (chaosCfg) {
            try {
                const resolved = resolveConfig(chaosCfg);
                const after = await applyChaosAfterRun(resolved);
                chaosInjected.push(...after.summary);
                chaosAddedLatencyMs += after.addedLatencyMs;
            } catch (err) {
                if (err instanceof ChaosError) {
                    return NextResponse.json({
                        error: "Chaos fault injected",
                        detail: err.message,
                        preset: err.preset,
                        content: "",
                        fallbackContent: reply,
                        chaosReport: { faulted: true, injected: [...chaosInjected, "FAULT: " + err.message], addedLatencyMs: chaosAddedLatencyMs },
                    }, { status: 503 });
                }
                throw err;
            }
        }

        const responseBody: Record<string, unknown> = { ...reply };
        if (chaosCfg) {
            responseBody.chaosReport = { faulted: false, injected: chaosInjected, addedLatencyMs: chaosAddedLatencyMs };
        }
        return NextResponse.json(responseBody);

    } catch (error) {
        if (error instanceof EnvMissingError) return envErrorResponse(error);
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error('[chat/openai]', message);
        return NextResponse.json({ error: "Chat service temporarily unavailable. Please try again." }, { status: 500 });
    }
}
