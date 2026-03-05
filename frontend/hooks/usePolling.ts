import { useEffect, useRef } from "react";

/**
 * Calls `fn` every `ms` milliseconds (default 30 s).
 * Also re-calls when the browser tab becomes visible again.
 * Safe to pass an unstable function reference — always calls the latest version.
 */
export function usePolling(fn: () => void, ms = 30_000) {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    const tick = () => ref.current();
    const id = setInterval(tick, ms);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ms]);
}
