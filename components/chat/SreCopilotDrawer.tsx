"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useGameEngine } from "@/context/GameEngineContext";
import type { ChaosConfig } from "@/lib/execution/chaos";

interface Props {
  chaosConfig?: ChaosConfig;
  currentCode?: string;
  language?: string;
  /** External insight from the event-driven monitor hook (changes trigger a new message). */
  externalInsight?: string | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ApiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const AUTO_PROMPT =
  "Great job mitigating that fault! Would you like an architectural breakdown of what failed and how production systems prevent it?";

const GREETING_TEXT =
  "Welcome to Chaos Engineering! I'm Chaos, your dedicated Code Tutor and Software Architecture Advisor.";

export default function SreCopilotDrawer({ chaosConfig, currentCode, language, externalInsight }: Props) {
  const { difficulty, streakCount, currentChallenge } = useGameEngine();

  const [open, setOpen] = useState(false);
  
  // Initialize messages directly with the greeting so it shows up fresh upon every login/page load
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: GREETING_TEXT,
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevStreakRef = useRef(0);
  const prevInsightRef = useRef<string | null>(null);

  /* ---- Ingest external insights from the monitoring hook ---------- */
  useEffect(() => {
    if (!externalInsight || externalInsight === prevInsightRef.current) return;
    prevInsightRef.current = externalInsight;
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: externalInsight, timestamp: new Date() },
    ]);
    setUnread((u) => u + 1);
    // Panel stays closed — the parent shows a toast notification instead
  }, [externalInsight]);

  const sendMessage = useCallback(
    async (userText: string, proactiveExplainer = false) => {
      if (loading) return;
      if (!userText.trim() && !proactiveExplainer) return;

      if (userText.trim()) {
        setMessages((prev) => [
          ...prev,
          { role: "user", content: userText.trim(), timestamp: new Date() },
        ]);
      }

      setLoading(true);

      try {
        const history: ApiChatMessage[] = messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const context: Record<string, unknown> = {};
        if (currentChallenge) context.challengeId = currentChallenge.id;
        if (difficulty) context.difficulty = difficulty;
        if (currentCode) context.currentCode = currentCode;
        if (language) context.language = language;

        if (chaosConfig) {
          context.chaosParams = {
            latencyJitterMs: chaosConfig.latencyJitterMs,
            memoryLeakMb: chaosConfig.memoryLeakMb,
            failureRate: chaosConfig.failureRate,
            eventLoopBlockMs: chaosConfig.eventLoopBlockMs,
          };
        }

        const response = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            history,
            proactiveExplainer,
            context,
          }),
        });

        const data = await response.json();

        if (data.error) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `**Error:** ${data.error}`, timestamp: new Date() },
          ]);
          setUnread((u) => u + 1);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.reply, timestamp: new Date() },
          ]);
          setUnread((u) => u + 1);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "**Error:** Failed to reach the Chaos Copilot service.", timestamp: new Date() },
        ]);
        setUnread((u) => u + 1);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, currentChallenge, difficulty, currentCode, language, chaosConfig],
  );

  useEffect(() => {
    const prev = prevStreakRef.current;
    prevStreakRef.current = streakCount;

    if (streakCount <= prev) return;
    if (difficulty !== "chaos") return;

    const timer = setTimeout(() => {
      sendMessage(AUTO_PROMPT, true);
    }, 1_000);

    return () => clearTimeout(timer);
  }, [streakCount, difficulty, sendMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      inputRef.current?.focus();
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
      setInput("");
    }
  }

  function clearChat() {
    setMessages([
      {
        role: "assistant",
        content: GREETING_TEXT,
        timestamp: new Date(),
      },
    ]);
    setUnread(0);
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <div className="mb-4 flex w-96 flex-col overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-2xl shadow-black/20 dark:shadow-black/50">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Chaos Copilot</h3>
                <p className="text-[10px] text-zinc-500">Powered by Gemini Flash</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button onClick={clearChat} className="rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-300">
                  Clear
                </button>
              )}
              <button onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="h-[380px] space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "bg-sky-600 text-white" : "border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"}`}>
                  <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${msg.role === "user" ? "text-sky-200/60" : "text-zinc-500"}`}>
                    {msg.role === "user" ? "You" : "Chaos Copilot"}
                  </p>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <p className={`mt-1.5 text-[10px] ${msg.role === "user" ? "text-sky-200/40" : "text-zinc-600"}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-sky-500 [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about code, bugs, or architecture..."
                rows={1}
                className="flex-1 resize-none rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-sky-500"
                disabled={loading}
              />
              <button type="submit" disabled={loading || !input.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white transition hover:bg-sky-500 disabled:opacity-40">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      <button onClick={() => setOpen((v) => !v)} className={`group relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 ${open ? "rotate-0 scale-100 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-zinc-300/50 dark:shadow-zinc-900/50 hover:bg-zinc-300 dark:hover:bg-zinc-700" : "bg-sky-600 text-white shadow-sky-900/40 hover:bg-sky-500 hover:scale-105"}`}>
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
        )}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-950">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}