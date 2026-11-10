import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 86400; // Cache and revalidate once every 24 hours

/**
 * robots.txt
 *
 * Public content pages are allowed for all crawlers including AI agents.
 * Authenticated app routes, auth flows and the API namespace are disallowed.
 * Points standard crawlers at the sitemap, and AI crawlers at llms.txt.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Standard web crawlers — allow all public pages
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/incidents",
          "/sites",
          "/sessions",
          "/settings",
          "/api",
          "/auth",
          "/login",
        ],
      },
      {
        // AI crawlers — explicitly allowed on public pages
        // They will also find llms.txt for structured product context
        userAgent: ["GPTBot", "ClaudeBot", "GoogleOther", "Applebot"],
        allow: "/",
        disallow: [
          "/dashboard",
          "/incidents",
          "/sites",
          "/sessions",
          "/settings",
          "/api",
          "/auth",
          "/login",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
