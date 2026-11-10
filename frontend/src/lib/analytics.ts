/**
 * PatchFlow analytics helper — Plausible (privacy-friendly, no cookies).
 *
 * CONSENT GATE: The Plausible script is never loaded (and no events are sent)
 * until the visitor explicitly clicks "Accept all" in the cookie consent
 * banner. This is completely separate from the PatchFlow error-reporting SDK
 * which runs server-side in users' own apps.
 *
 * CONFIGURATION:
 *   NEXT_PUBLIC_PLAUSIBLE_DOMAIN  – the domain to pass to Plausible
 *                                   (e.g. patchflow.cloud). Leave unset to
 *                                   disable analytics without breaking anything.
 *
 * Usage:
 *   import { trackEvent } from "@/lib/analytics";
 *   trackEvent("github_connect_click");
 *   trackEvent("sdk_install_started", { framework: "fastapi" });
 */

export type AnalyticsEvent =
  | "github_connect_click"    // user clicks "Continue with GitHub" on login page
  | "sdk_install_started"     // user downloads the SDK file inside the setup panel
  | "repo_connected";         // user successfully creates/connects a new monitored site

/**
 * Fire a Plausible custom event if the script is loaded and the
 * visitor has consented. Safe to call unconditionally — if Plausible
 * isn't available it silently no-ops.
 */
export function trackEvent(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>
): void {
  if (typeof window === "undefined") return;
  // Plausible exposes a global `plausible()` function once its script loads.
  // If it's not there yet (e.g. consent not given) this is a silent no-op.
  const p = (window as Window & { plausible?: (...args: unknown[]) => void })
    .plausible;
  if (typeof p !== "function") return;
  try {
    if (props) {
      p(event, { props });
    } else {
      p(event);
    }
  } catch {
    // never throw from analytics
  }
}

/**
 * The Plausible script src derived from the env var.
 * Returns null when analytics is unconfigured (disables the <Script> entirely).
 */
export function plausibleScriptSrc(): string | null {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  // Using the tagged events extension so custom events work out of the box.
  return "https://plausible.io/js/script.tagged-events.js";
}

/** The domain attribute passed to the Plausible script tag. */
export function plausibleDomain(): string {
  return process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "www.patchflow.cloud";
}
