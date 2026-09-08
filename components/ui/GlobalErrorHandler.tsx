"use client";
import { useEffect } from "react";
export default function GlobalErrorHandler() {
  useEffect(() => {
    const onErr = (ev: ErrorEvent) => { console.error("[Global] Uncaught:", ev.error ?? ev.message); };
    const onRej = (ev: PromiseRejectionEvent) => {
      const m = ev.reason instanceof Error ? ev.reason.message : String(ev.reason);
      if (m.includes("fetch") || m.includes("Network") || m.includes("Load failed")) { console.warn("[Global] Network rejection:", m); return; }
      console.error("[Global] Unhandled rejection:", ev.reason);
    };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);
  return null;
}
