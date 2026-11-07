/**
 * SWR configuration for PatchFlow.
 *
 * All authenticated app pages use useSWR() with this fetcher so that:
 *  - Revisiting a page shows cached data instantly (stale-while-revalidate)
 *  - Data revalidates silently in the background
 *  - On-focus revalidation catches changes made in other tabs
 *  - Failed requests are retried with exponential backoff
 *
 * staleTime guide used here:
 *   - Dashboard / incidents / sites: 30s  (live-ish data, changes frequently)
 *   - Billing subscription:          60s  (changes only on checkout/webhook)
 *   - Session detail / report:        0s  (session in progress — always fresh)
 */

import { API_BASE_URL } from "./api-config";

/**
 * Authenticated SWR fetcher.
 * Prepends API_BASE_URL to relative paths, injects the JWT Bearer header,
 * and throws on non-2xx responses so SWR surfaces them as errors.
 */
export async function authFetcher<T>(path: string): Promise<T> {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("patchflow_token")
      : null;

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    // Let the app-layout's isTokenValid() redirect handle logout
    throw new Error("UNAUTHORIZED");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** SWR config presets for different data types. */
export const SWR_CONFIG = {
  /** Live-ish dashboard data — show stale instantly, revalidate every 30s */
  dashboard: {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5_000,
    refreshInterval: 30_000,
  },

  /** Billing — changes only on webhook; no auto-refresh needed */
  billing: {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 10_000,
    refreshInterval: 0,
  },

  /** Active session streaming — always fresh, no caching */
  liveSession: {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 0,
    refreshInterval: 0,
  },

  /** Completed report — immutable once generated */
  report: {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
    refreshInterval: 0,
  },
} as const;
