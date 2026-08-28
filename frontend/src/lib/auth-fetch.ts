/**
 * Authenticated fetch wrapper.
 *
 * - Automatically attaches the JWT from localStorage.
 * - On 401 responses, clears auth state and redirects to /login.
 * - Drop-in replacement for `fetch()` on protected API routes.
 */

import { API_BASE_URL } from "./api-config";

/**
 * Clear all auth data from localStorage and redirect to login.
 * Uses a sessionStorage flag to prevent redirect loops.
 */
function forceLogout() {
  if (typeof window === "undefined") return;

  // Prevent infinite redirect loops
  if (sessionStorage.getItem("patchflow_logging_out")) return;
  sessionStorage.setItem("patchflow_logging_out", "1");

  localStorage.removeItem("patchflow_token");
  localStorage.removeItem("patchflow_user");

  // Small delay to let any in-flight requests settle
  setTimeout(() => {
    sessionStorage.removeItem("patchflow_logging_out");
    window.location.href = "/login?expired=1";
  }, 100);
}

/**
 * Wrapper around `fetch` that:
 *  1. Injects the `Authorization: Bearer <token>` header
 *  2. On 401, triggers a logout + redirect
 *
 * Usage:
 *   const res = await authFetch("/api/sites");
 *   const res = await authFetch("/api/billing/checkout", { method: "POST", body: ... });
 */
export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = localStorage.getItem("patchflow_token");

  // Build absolute URL if the path is relative
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    forceLogout();
  }

  return res;
}

/**
 * Check whether the stored JWT is still valid by calling a lightweight
 * backend endpoint. Returns true if valid, false if expired/missing.
 */
export async function isTokenValid(): Promise<boolean> {
  const token = localStorage.getItem("patchflow_token");
  if (!token) return false;

  try {
    // Use the subscription endpoint as a lightweight auth check —
    // it requires auth and returns fast
    const res = await fetch(`${API_BASE_URL}/api/billing/subscription`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    // Network error — don't force logout, might be temporary
    return true;
  }
}
