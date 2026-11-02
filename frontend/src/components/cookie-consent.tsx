"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { cn } from "@/lib/utils";
import { getConsent, setConsent, type ConsentChoice } from "@/lib/consent";

/**
 * Cookie consent banner.
 *
 * - Essential auth/session cookies need no consent and always work.
 * - Analytics is gated behind the "Accept all" choice (see src/lib/consent.ts).
 * - The choice is remembered in localStorage so the banner never reappears.
 * - Rendered once in the root layout so it is available on every route.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show once mounted on the client, and only if no choice exists yet.
    setVisible(getConsent() === null);
  }, []);

  const decide = (choice: ConsentChoice) => {
    setConsent(choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-4 sm:px-6 sm:pb-6 animate-in fade-in duration-300"
    >
      <div className="mx-auto max-w-3xl apple-glass rounded-2xl border border-black/[0.08] dark:border-white/[0.1] shadow-[0_12px_40px_rgba(0,0,0,0.12)] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Cookie className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            We use essential cookies to keep you signed in. With your consent, we
            also use privacy-friendly analytics to understand how PatchFlow is
            used. You can change this anytime. See our{" "}
            <Link
              href="/privacy#cookies"
              className="font-semibold text-foreground underline underline-offset-2 hover:text-primary"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => decide("essential")}
            className={cn(
              "h-9 px-4 rounded-[10px] text-[13px] font-semibold border border-black/[0.1] dark:border-white/[0.15]",
              "text-text-secondary hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.06]",
              "apple-press-subtle cursor-pointer",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            )}
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => decide("all")}
            className={cn(
              "h-9 px-4 rounded-[10px] text-[13px] font-semibold text-white bg-primary hover:bg-[#E04E16]",
              "apple-press-subtle cursor-pointer shadow-[0_2px_10px_rgba(255,90,31,0.3)]",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            )}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
