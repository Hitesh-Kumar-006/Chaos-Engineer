"use client";

import { useAuth, type Role } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/*  Role badge styling                                                  */
/* ------------------------------------------------------------------ */

const roleStyles: Record<Role, string> = {
  Junior: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 ring-emerald-500/30",
  SRE: "bg-sky-500/15 text-sky-600 dark:text-sky-400 ring-sky-500/30",
  "Chaos Engineer": "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30",
};

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
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${roleStyles[user.role]}`}
        >
          {user.role}
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
