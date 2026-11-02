/**
 * Cookie consent helper.
 *
 * Auth/session cookies are essential and require no consent.
 * Marketing/analytics scripts are gated behind an explicit "accept all"
 * choice so they never run until the visitor opts in.
 *
 * The choice is remembered in localStorage and a custom event is dispatched
 * on change so analytics loaders (see src/lib/analytics.ts) can react.
 */

export const CONSENT_STORAGE_KEY = "patchflow_cookie_consent";

export type ConsentChoice = "all" | "essential";

/**
 * Read the visitor's recorded consent choice.
 * Returns null when no choice has been made yet.
 */
export function getConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === "all" || v === "essential" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Persist the visitor's consent choice and notify listeners.
 */
export function setConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    window.dispatchEvent(
      new CustomEvent<ConsentChoice>("patchflow:consent-change", { detail: choice })
    );
  } catch {
    /* localStorage unavailable — fail silently, consent stays ungated */
  }
}

/**
 * True only when the visitor has explicitly accepted analytics.
 * Returns false until a choice is made OR if "essential only" was chosen.
 */
export function hasAnalyticsConsent(): boolean {
  return getConsent() === "all";
}

/**
 * True once the visitor has made any explicit choice (accept or reject).
 * Useful to decide whether the banner should keep showing.
 */
export function hasMadeChoice(): boolean {
  return getConsent() !== null;
}
