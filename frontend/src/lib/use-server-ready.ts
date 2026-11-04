"use client";

import { useEffect, useState, useRef } from "react";
import { API_BASE_URL } from "./api-config";

type ServerState = "checking" | "waking" | "ready" | "error";

/**
 * Polls the backend /health endpoint and returns the current server state.
 *
 * - "checking"  Initial probe in flight.
 * - "waking"    Server did not respond within FAST_TIMEOUT_MS — likely on a
 *               Render free-tier cold start. Shows a "waking up…" banner.
 * - "ready"     /health returned 200. Calls are safe.
 * - "error"     Server failed to respond after MAX_RETRIES.
 *
 * Only used in app pages that make an initial API call on mount. Public
 * marketing pages do not need it.
 */
export function useServerReady(): ServerState {
  const [state, setState] = useState<ServerState>("checking");
  const attemptRef = useRef(0);
  const MAX_RETRIES = 8;
  const FAST_TIMEOUT_MS = 2_500;  // if no response by 2.5s, show waking banner
  const RETRY_DELAY_MS = 3_000;   // retry every 3s

  useEffect(() => {
    let cancelled = false;
    let wakeTimer: ReturnType<typeof setTimeout>;

    const probe = async () => {
      // Show "waking" banner if the first probe takes more than 2.5s
      wakeTimer = setTimeout(() => {
        if (!cancelled) setState("waking");
      }, FAST_TIMEOUT_MS);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);
        const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        clearTimeout(wakeTimer);
        if (!cancelled && res.ok) {
          setState("ready");
          return;
        }
      } catch {
        // Network error or abort — fall through to retry
        clearTimeout(wakeTimer);
      }

      attemptRef.current += 1;
      if (cancelled) return;

      if (attemptRef.current >= MAX_RETRIES) {
        setState("error");
        return;
      }

      // Not ready yet — keep polling
      if (!cancelled) setState("waking");
      setTimeout(probe, RETRY_DELAY_MS);
    };

    probe();

    return () => {
      cancelled = true;
      clearTimeout(wakeTimer);
    };
  }, []);

  return state;
}
