/**
 * API configuration — centralises the backend URL so it is set once and
 * reused everywhere (fetch calls, WebSocket URLs, SDK setup snippets).
 *
 * REQUIRED in production:
 *   NEXT_PUBLIC_API_URL=https://api.patchflow.cloud
 *
 * The fallback is http://localhost:8000 for local development only.
 * A plain http:// URL will be blocked by the browser on any HTTPS page
 * (mixed content), so the env var MUST be set on Render before deploying.
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
).replace(/\/+$/, ""); // strip any trailing slash so paths concat cleanly

/**
 * Derive the WebSocket base URL from the API base URL.
 * http:// → ws://   |   https:// → wss://
 */
export const WS_BASE_URL = API_BASE_URL.replace(/^https/, "wss").replace(/^http/, "ws");
