"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 px-6 py-3 backdrop-blur">
      {/* Left — identity */}
      <div className="flex items-center gap-3">
        {/* Avatar circle */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {user.username}
        </span>
      </div>

      {/* Center — heading */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <span className="text-sm font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Chaos Engineering
        </span>
      </div>

      {/* Right — logout */}
      <button
        onClick={handleLogout}
        className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
      >
        Logout
      </button>
    </header>
  );
}
