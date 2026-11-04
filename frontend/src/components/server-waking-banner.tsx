"use client";

import { Cloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Non-blocking "server is waking up" banner shown when the Render backend
 * is on a free/starter tier and takes longer than ~2.5s to respond.
 * Displayed above the page content — never replaces it — so the user knows
 * what is happening instead of seeing an infinite spinner.
 */
export default function ServerWakingBanner({
  state,
}: {
  state: "waking" | "error" | "checking" | "ready";
}) {
  if (state === "ready" || state === "checking") return null;

  const isError = state === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 px-5 py-3 text-[13px] font-medium",
        "border-b",
        isError
          ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
          : "bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900 text-sky-700 dark:text-sky-300"
      )}
    >
      {isError ? (
        <>
          <Cloud className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Unable to reach PatchFlow servers. Please check your connection or{" "}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="underline font-semibold hover:no-underline"
            >
              refresh the page
            </button>
            .
          </span>
        </>
      ) : (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
          <span>
            Waking up the server&hellip; this takes about 30 seconds on first load.
          </span>
        </>
      )}
    </div>
  );
}
