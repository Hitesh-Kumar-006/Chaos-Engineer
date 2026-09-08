import { NextResponse } from 'next/server';
import { QODER_SYSTEM_PROMPT } from '@/lib/ai-prompt';
import { auditEnv, requireEnv, envErrorResponse, EnvMissingError } from '@/lib/env';

const PRIMARY_MODEL = 'gpt-4o-mini';
const FALLBACK_MODEL = 'gpt-3.5-turbo';
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

async function callLLM(model: string, apiKey: string, messages: { role: string; content: string }[]) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: QODER_SYSTEM_PROMPT },
                ...messages
            ],
            temperature: 0.3,
        }),
    });
    return response;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
    try {
        auditEnv();

        /* Pre-flight: ensure OPENAI_API_KEY is available */
        let apiKey: string;
        try {
            apiKey = requireEnv("OPENAI_API_KEY");
        } catch (e) {
            return envErrorResponse(e);
        }

        const { messages } = await request.json();

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "Missing required field: messages (non-empty array)" },
                { status: 400 }
            );
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
            return NextResponse.json(
                { error: "Chat service temporarily unavailable. Please try again." },
                { status: 502 }
            );
        }

        const reply = data.choices?.[0]?.message;
        if (!reply) {
            return NextResponse.json(
                { error: "Chat service returned an empty response." },
                { status: 502 }
            );
        }

        return NextResponse.json(reply);

    } catch (error) {
        if (error instanceof EnvMissingError) {
            return envErrorResponse(error);
        }
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error('[chat/openai]', message);
        return NextResponse.json(
            { error: "Chat service temporarily unavailable. Please try again." },
            { status: 500 }
        );
    }
}
