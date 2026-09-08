import { NextResponse } from 'next/server';
import { auditEnv, optionalEnv, envErrorResponse, EnvMissingError } from '@/lib/env';
import {
  extractChaosConfig, injectBefore, injectAfter,
  buildReport, chaosFaultResponse, attachChaosReport, isChaosActive,
} from '@/lib/chaos-middleware';

/** Supported language aliases mapped to OnlineCompiler.io compiler IDs. */
const COMPILER_MAP: Record<string, string> = {
  javascript: 'nodejs', js: 'nodejs',
  csharp: 'dotnet-csharp-9', cs: 'dotnet-csharp-9', 'c#': 'dotnet-csharp-9',
  java: 'openjdk-25', python: 'python-3.14',
  c: 'gcc-15', cpp: 'g++-15', 'c++': 'g++-15',
  rust: 'rust-1.93', rs: 'rust-1.93',
};

/** Maximum time to wait for the upstream compiler before returning a timeout error. */
const EXECUTION_TIMEOUT_MS = 30_000;

export async function POST(request: Request) {
    try {
        auditEnv();

        /* Pre-flight: ensure ONLINE_COMPILER_API_KEY is available */
        const apiKey = optionalEnv("ONLINE_COMPILER_API_KEY");
        if (!apiKey) {
            return NextResponse.json({
                error: "Service configuration error",
                detail: "OnlineCompiler.io API key is not configured. Server-side code execution is unavailable.",
                missingVar: "ONLINE_COMPILER_API_KEY",
                hint: "Set ONLINE_COMPILER_API_KEY in your .env.local file and restart the dev server.",
            }, { status: 503 });
        }

        const body = await request.json();
        const { language, code, stdin } = body;

        if (!code || typeof code !== "string" || code.trim() === "") {
            return NextResponse.json(
                { error: "Missing required field: code (non-empty string)" },
                { status: 400 }
            );
        }

        const lang = (language || "").toLowerCase();
        const compilerId = COMPILER_MAP[lang];

        if (!compilerId) {
            return NextResponse.json(
                {
                    error: "Unsupported language",
                    detail: `Language "${language}" is not supported.`,
                    supported: Object.keys(COMPILER_MAP).filter((k) => !k.includes("#") && !k.includes("+")),
                },
                { status: 400 },
            );
        }

        /* ---- Chaos injection: pre-execution phase -------------------- */
        const chaosCfg = extractChaosConfig(body as Record<string, unknown>, request.headers.get("x-chaos-config"));
        const beforeResult = await injectBefore(chaosCfg);

        /* If the pre-run phase itself triggered a fault (rare, but possible with presets) */
        if (chaosCfg && isChaosActive(chaosCfg) && beforeResult?.faulted) {
            const report = buildReport(chaosCfg, beforeResult, null);
            return chaosFaultResponse(
                new (await import("@/lib/execution/chaos")).ChaosError("Pre-execution fault triggered", chaosCfg.activePreset ?? "custom"),
                report,
            );
        }

        /* ---- Timeout guard via AbortController ----------------------- */
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), EXECUTION_TIMEOUT_MS);

        let response: Response;
        try {
            response = await fetch('https://api.onlinecompiler.io/api/run-code-sync/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': apiKey },
                body: JSON.stringify({ compiler: compilerId, code: code, ...(typeof stdin === "string" && stdin ? { stdin } : {}) }),
                signal: controller.signal,
            });
        } catch (fetchErr: unknown) {
            clearTimeout(timeout);
            if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
                console.error(`[execute/compiler] Upstream timed out after ${EXECUTION_TIMEOUT_MS / 1000}s`);
                return NextResponse.json({
                    error: "Code execution timed out.",
                    detail: `The compiler did not respond within ${EXECUTION_TIMEOUT_MS / 1000} seconds. The code may contain an infinite loop or the service is overloaded.`,
                    hint: "Check your code for infinite loops or reduce complexity, then retry.",
                    stdout: "", stderr: `[TimeoutError] Execution exceeded ${EXECUTION_TIMEOUT_MS / 1000}s limit`,
                    status: "timeout",
                }, { status: 504 });
            }
            const msg = fetchErr instanceof Error ? fetchErr.message : "Unknown network error";
            console.error(`[execute/compiler] Network error: ${msg}`);
            return NextResponse.json({
                error: "Code execution service unreachable.", detail: msg,
                stdout: "", stderr: `[NetworkError] ${msg}`, status: "error",
            }, { status: 502 });
        }
        clearTimeout(timeout);

        if (!response.ok) {
            const status = response.status;
            console.error(`[execute/compiler] Upstream returned ${status}`);
            if (status === 401 || status === 403) {
                return NextResponse.json({
                    error: "Code execution service authentication failed.",
                    detail: "The ONLINE_COMPILER_API_KEY appears to be invalid or expired.",
                    hint: "Verify your API key at onlinecompiler.io and update .env.local.",
                }, { status: 503 });
            }
            let upstreamError = "";
            try { const errData = await response.json(); upstreamError = errData.error || errData.message || ""; } catch { /* non-JSON */ }
            return NextResponse.json({
                error: `Code execution service returned ${status}.`,
                stdout: "", stderr: upstreamError || `[UpstreamError] Compiler returned HTTP ${status}`,
                status: "error",
            }, { status: 502 });
        }

        const data = await response.json();

        /* ---- Chaos injection: post-execution phase ------------------- */
        const { result: afterResult, error: chaosErr } = await injectAfter(chaosCfg);
        const report = chaosCfg && isChaosActive(chaosCfg) ? buildReport(chaosCfg, beforeResult, afterResult) : null;

        if (chaosErr && report) {
            return chaosFaultResponse(chaosErr, report);
        }

        /* ---- Normalise + attach chaos metadata ----------------------- */
        const normalised: Record<string, unknown> = {
            ...data,
            output: data.output ?? data.stdout ?? "",
            error: data.error ?? data.stderr ?? "",
            status: data.status ?? (data.error || data.stderr ? "error" : "success"),
        };

        return NextResponse.json(attachChaosReport(normalised, report));

    } catch (error) {
        if (error instanceof EnvMissingError) return envErrorResponse(error);
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error('[execute/compiler]', message);
        return NextResponse.json({
            error: "Code execution service temporarily unavailable.",
            stdout: "", stderr: `[InternalError] ${message}`, status: "error",
        }, { status: 500 });
    }
}
