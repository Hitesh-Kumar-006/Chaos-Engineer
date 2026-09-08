"use client";

import { useState, useEffect, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: string;
  message: string;
  variant: "improvement";
}

/* ------------------------------------------------------------------ */
/*  Single toast item                                                  */
/* ------------------------------------------------------------------ */

function ToastItem({
  toast,
  onDismiss,
  onExpire,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
  onExpire: (id: string) => void;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => onExpire(toast.id), 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onExpire]);

  const handleDismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-white dark:bg-zinc-900/95 px-4 py-3 shadow-lg shadow-emerald-200/30 dark:shadow-emerald-900/20 backdrop-blur-sm transition-all duration-300 ${
        leaving ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100"
      }`}
      style={{ maxWidth: 360 }}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2l1.5 4.5H14l-3.5 2.5L12 14 8 11l-4 3 1.5-5L2 6.5h4.5z" />
        </svg>
      </span>

      <p className="flex-1 text-[12px] leading-relaxed text-zinc-700 dark:text-zinc-300">
        {toast.message}
      </p>

      <button
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-0.5 text-zinc-400 dark:text-zinc-600 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-400"
        aria-label="Dismiss"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toast container                                                    */
/* ------------------------------------------------------------------ */

export default function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  const handleExpire = useCallback(
    (id: string) => onDismiss(id),
    [onDismiss],
  );

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-[70] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} onExpire={handleExpire} />
        </div>
      ))}
    </div>
  );
}
