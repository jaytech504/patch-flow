/**
 * API configuration — centralises the backend URL so it can be set
 * via the NEXT_PUBLIC_API_URL build-time env var for production.
 *
 * Development default: http://localhost:8000
 * Production example:  http://your-server-ip  (set at `npm run build` time)
 */

const rawUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_BASE_URL = rawUrl.replace(/\/+$/, "");

/**
 * Derive the WebSocket base URL from the API base URL.
 * http:// → ws://   |   https:// → wss://
 */
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
