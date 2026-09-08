import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { QODER_SYSTEM_PROMPT } from "@/lib/ai-prompt";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RequestBody {
  message?: string;
  history?: ChatMessage[];
  proactiveExplainer?: boolean;
  context?: {
    challengeId?: string;
    difficulty?: string;
    currentCode?: string;
    language?: string;
    chaosParams?: Record<string, number | string>;
  };
}

function buildProactivePrompt(context?: RequestBody["context"]): string {
  const parts: string[] = [
    "Provide a structured post-mortem breakdown of the most recently mitigated incident.",
    "",
    "Use the following format:",
    "## Incident Summary",
    "One-paragraph overview of what happened.",
    "## Timeline",
    "Bullet-point timeline of detection, investigation, and mitigation.",
    "## Root Cause Analysis",
    "Technical deep-dive into why the failure occurred.",
    "## Remediation Actions",
    "Concrete steps to prevent recurrence.",
  ];

  if (context?.chaosParams) {
    parts.push("", "## Chaos Parameters Active During Incident");
    for (const [key, value] of Object.entries(context.chaosParams)) {
      parts.push(`- **${key}**: ${value}`);
    }
  }

  return parts.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY environment variable is not configured" },
        { status: 503 }
      );
    }

    const body = (await request.json()) as RequestBody;

    if (!body.message && !body.proactiveExplainer) {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 }
      );
    }

    let activeUserMessage = "";
    if (body.proactiveExplainer) {
      activeUserMessage = buildProactivePrompt(body.context);
    } else {
      activeUserMessage = body.message || "";
      if (body.context) {
        const ctxLines: string[] = [];
        
        if (body.context.language) {
          ctxLines.push(`[Active Editor Language: ${body.context.language}]`);
        }
        if (body.context.currentCode) {
          // Include line numbers so the AI can easily reference specific lines like "line 4"
          const numberedCode = body.context.currentCode
            .split("\n")
            .map((line, idx) => `${idx + 1}: ${line}`)
            .join("\n");
          ctxLines.push(`[Active Editor Code with Line Numbers:\n${numberedCode}\n]`);
        }
        if (body.context.challengeId) {
          ctxLines.push(`[Context: challenge=${body.context.challengeId}, difficulty=${body.context.difficulty ?? "unknown"}]`);
        }
        if (body.context.chaosParams) {
          ctxLines.push(
            `[Chaos params: ${Object.entries(body.context.chaosParams)
              .map(([k, v]) => `${k}=${v}`)
              .join(", ")}]`,
          );
        }

        if (ctxLines.length > 0) {
          activeUserMessage = `${ctxLines.join("\n")}\n\nUser Question: ${activeUserMessage}`;
        }
      }
    }

    const recentHistory = body.history ? body.history.slice(-6) : [];

    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    for (const msg of recentHistory) {
      if (msg.role === "user" || msg.role === "assistant") {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    contents.push({
      role: "user",
      parts: [{ text: activeUserMessage }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: contents,
      config: {
        systemInstruction: QODER_SYSTEM_PROMPT,
        temperature: 0.3,
        maxOutputTokens: 400,
      },
    });

    const reply = response.text || "";

    return NextResponse.json({
      reply,
      finishReason: "stop",
      tokensUsed: null,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[ai-chat-gemini]", message);

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}