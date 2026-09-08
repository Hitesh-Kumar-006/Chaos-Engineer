/**
 * Centralized environment variable validation and access.
 *
 * All server-side env vars are declared here with metadata so that API routes
 * can use `getEnvOrError()` for required keys or `getEnvOptional()` for
 * optional ones, returning descriptive JSON errors instead of crashing.
 */

/* ------------------------------------------------------------------ */
/*  Env var registry                                                   */
/* ------------------------------------------------------------------ */

export interface EnvVarDef {
  /** Environment variable name (e.g. GEMINI_API_KEY). */
  name: string;
  /** Whether the variable is required for the application to function. */
  required: boolean;
  /** Human-readable description for error messages. */
  description: string;
  /** Which API route(s) consume this variable. */
  usedBy: string[];
}

export const ENV_REGISTRY: EnvVarDef[] = [
  {
    name: "GEMINI_API_KEY",
    required: true,
    description: "Google Gemini API key for the Chaos Copilot AI assistant",
    usedBy: ["/api/ai-chat"],
  },
  {
    name: "OPENAI_API_KEY",
    required: false,
    description: "OpenAI API key for the legacy chat fallback route",
    usedBy: ["/api/chat"],
  },
  {
    name: "ONLINE_COMPILER_API_KEY",
    required: false,
    description: "OnlineCompiler.io API key for server-side code execution",
    usedBy: ["/api/execute"],
  },
];

/* ------------------------------------------------------------------ */
/*  Accessors                                                          */
/* ------------------------------------------------------------------ */

/**
 * Return the env var value or throw a structured error suitable for
 * returning as a JSON response to the client.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    const def = ENV_REGISTRY.find((d) => d.name === name);
    const detail = def
      ? `${def.description} (used by ${def.usedBy.join(", ")})`
      : `Referenced in server-side code`;
    throw new EnvMissingError(name, detail);
  }
  return value;
}

/**
 * Return the env var value or `null` if it is not set.
 * Use for optional integrations where a graceful fallback is acceptable.
 */
export function optionalEnv(name: string): string | null {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : null;
}

/* ------------------------------------------------------------------ */
/*  Custom error class                                                 */
/* ------------------------------------------------------------------ */

export class EnvMissingError extends Error {
  public readonly varName: string;
  public readonly detail: string;

  constructor(varName: string, detail: string) {
    super(`Missing required environment variable: ${varName}`);
    this.name = "EnvMissingError";
    this.varName = varName;
    this.detail = detail;
  }
}

/* ------------------------------------------------------------------ */
/*  Startup audit (logs warnings for missing optional vars)            */
/* ------------------------------------------------------------------ */

let _audited = false;

/**
 * Run once at first API request. Logs warnings for any env vars that are
 * not set, so misconfiguration is visible in the dev console immediately.
 */
export function auditEnv(): void {
  if (_audited) return;
  _audited = true;

  for (const def of ENV_REGISTRY) {
    const value = process.env[def.name];
    if (!value || value.trim() === "") {
      if (def.required) {
        console.error(
          `[env] REQUIRED variable "${def.name}" is not set. ${def.description}. Routes ${def.usedBy.join(", ")} will return 503 until configured.`
        );
      } else {
        console.warn(
          `[env] Optional variable "${def.name}" is not set. ${def.description}. Routes ${def.usedBy.join(", ")} will degrade gracefully.`
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: build a standard JSON error response for env failures      */
/* ------------------------------------------------------------------ */

import { NextResponse } from "next/server";

export function envErrorResponse(error: unknown): NextResponse {
  if (error instanceof EnvMissingError) {
    return NextResponse.json(
      {
        error: "Service configuration error",
        detail: error.detail,
        missingVar: error.varName,
        hint: `Set ${error.varName} in your .env.local file and restart the dev server.`,
      },
      { status: 503 }
    );
  }
  const message =
    error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}
