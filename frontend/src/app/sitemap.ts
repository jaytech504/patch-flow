import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 86400; // Cache and revalidate once every 24 hours

/**
 * sitemap.xml — public, indexable routes only.
 *
 * Rules:
 * - All URLs use the canonical www host (https://www.patchflow.cloud), which
 *   is the value of SITE_URL after the env-var change to www.
 * - lastModified is a real date per page, not build-time new Date().
 *   Update the date here whenever the page content meaningfully changes.
 * - Authenticated app routes are excluded (also disallowed in robots.txt).
 * - When /blog, /about, /changelog are added, uncomment those entries.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // ── Core marketing pages ─────────────────────────────────────────────────
    {
      url: SITE_URL,
      lastModified: new Date("2026-11-12"), // bump when homepage copy changes
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/api-testing`,
      lastModified: new Date("2026-11-12"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/chaos-testing`,
      lastModified: new Date("2026-11-12"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/api-monitoring`,
      lastModified: new Date("2026-11-12"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/ai-bug-fixing`,
      lastModified: new Date("2026-11-12"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: new Date("2026-11-04"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/demo`,
      lastModified: new Date("2026-11-04"),
      changeFrequency: "monthly",
      priority: 0.8,
    },

    // ── Documentation ─────────────────────────────────────────────────────────
    {
      url: `${SITE_URL}/docs`,
      lastModified: new Date("2026-11-04"),
      changeFrequency: "monthly",
      priority: 0.9,
    },

    // ── Legal (bump only when content actually changes) ───────────────────────
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date("2026-11-02"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date("2026-11-02"),
      changeFrequency: "yearly",
      priority: 0.3,
    },

    // ── Uncomment when these pages are created ───────────────────────────────
    // { url: `${SITE_URL}/about`,     lastModified: new Date("YYYY-MM-DD"), changeFrequency: "monthly", priority: 0.6 },
    // { url: `${SITE_URL}/changelog`, lastModified: new Date("YYYY-MM-DD"), changeFrequency: "weekly",  priority: 0.5 },
    // Blog posts — add individually with their real publish dates:
    // { url: `${SITE_URL}/blog/self-healing-apis`, lastModified: new Date("YYYY-MM-DD"), changeFrequency: "yearly", priority: 0.7 },
  ];
}
