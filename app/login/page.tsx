"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import NetworkBackground from "@/components/ui/NetworkBackground";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [handle, setHandle] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = handle.trim();
    if (!trimmed) return;

    login({ username: trimmed, role: "Junior" });
    router.push("/");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Animated network canvas */}
      <NetworkBackground />

      {/* Glassmorphism login card */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/20 bg-white/40 p-8 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-black/40">
        {/* Header */}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Welcome back
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in with your developer handle
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {/* Handle */}
          <div>
            <label
              htmlFor="handle"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Handle
            </label>
            <input
              id="handle"
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="e.g. sre_hawk"
              autoFocus
              required
              className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white/60 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus:ring-zinc-400 dark:focus:ring-offset-zinc-900"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}
