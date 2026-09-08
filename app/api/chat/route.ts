import { NextResponse } from 'next/server';
import { QODER_SYSTEM_PROMPT } from '@/lib/ai-prompt';

const PRIMARY_MODEL = 'gpt-4o-mini';
const FALLBACK_MODEL = 'gpt-3.5-turbo';
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

async function callLLM(model: string, messages: { role: string; content: string }[]) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
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
        const { messages } = await request.json();

        /* ---- Exponential backoff retry on primary model --------------- */
        let response = await callLLM(PRIMARY_MODEL, messages);

        for (const delayMs of RETRY_DELAYS_MS) {
            if (response.status !== 503) break;
            console.warn(`LLM returned 503 — retrying in ${delayMs / 1000}s…`);
            await sleep(delayMs);
            response = await callLLM(PRIMARY_MODEL, messages);
        }

        /* ---- Fallback model if primary exhausted all retries ---------- */
        if (response.status === 503) {
            console.warn(`Primary model (${PRIMARY_MODEL}) exhausted retries — switching to ${FALLBACK_MODEL}`);
            response = await callLLM(FALLBACK_MODEL, messages);
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to fetch from LLM');
        }

        const reply = data.choices[0].message;
        return NextResponse.json(reply);
    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json(
            { error: 'Internal server error during chat processing.' },
            { status: 500 }
        );
    }
}
