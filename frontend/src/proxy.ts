import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (formerly "middleware" in Next.js < 16).
 *
 * Adds a `X-Robots-Tag: noindex, follow` header to authenticated app routes
 * and auth flows so they are never indexed, regardless of whether a page is a
 * server or client component. This is the single source of truth for noindex
 * on private routes and works alongside the disallow rules in robots.txt.
 */
export function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, follow");
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/incidents/:path*",
    "/sites/:path*",
    "/sessions/:path*",
    "/settings/:path*",
    "/auth/:path*",
    "/login",
  ],
};
