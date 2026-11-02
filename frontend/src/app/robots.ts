import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt
 *
 * Public content pages are allowed; authenticated app routes, auth flows and
 * the API namespace are disallowed. Points crawlers at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
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
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
