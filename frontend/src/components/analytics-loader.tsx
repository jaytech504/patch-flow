"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { hasAnalyticsConsent } from "@/lib/consent";
import { plausibleScriptSrc, plausibleDomain } from "@/lib/analytics";

/**
 * Consent-gated analytics loader.
 *
 * • Only renders the <Script> tag after the visitor has explicitly clicked
 *   "Accept all" in the cookie consent banner.
 * • Listens for the patchflow:consent-change event so a single session that
 *   grants consent mid-visit loads Plausible without a page reload.
 * • When NEXT_PUBLIC_PLAUSIBLE_DOMAIN is not set, renders nothing at all.
 * • Uses next/script strategy="lazyOnload" — loads during browser idle time
 *   so it never blocks LCP or hydration.
 * • Completely separate from the PatchFlow error-reporting SDK.
 */
export default function AnalyticsLoader() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    // Hydrate from localStorage on mount
    setConsented(hasAnalyticsConsent());

    // React to runtime consent changes from the cookie banner
    const handler = (e: Event) => {
      const choice = (e as CustomEvent<string>).detail;
      setConsented(choice === "all");
    };
    window.addEventListener("patchflow:consent-change", handler);
    return () => window.removeEventListener("patchflow:consent-change", handler);
  }, []);

  const src = plausibleScriptSrc();
  if (!consented || !src) return null;

  return (
    <Script
      id="plausible-analytics"
      src={src}
      strategy="lazyOnload"
      data-domain={plausibleDomain()}
      // Defer any remaining execution until after the page is interactive.
      defer
    />
  );
}
