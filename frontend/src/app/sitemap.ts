import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * sitemap.xml — public, indexable routes only.
 *
 * Rules:
 * - Authenticated app routes are excluded (also disallowed in robots.txt).
 * - Legal pages use static lastModified dates — they rarely change and a
 *   dynamic new Date() would claim freshness every deploy.
 * - When /blog, /about, /changelog are added, uncomment those entries.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    // ── Core marketing pages ─────────────────────────────────────────────────
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/demo`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },

    // ── Documentation ─────────────────────────────────────────────────────────
    {
      url: `${SITE_URL}/docs`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },

    // ── Legal (static dates — only bump when content actually changes) ────────
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
    // { url: `${SITE_URL}/about`,     lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // { url: `${SITE_URL}/changelog`, lastModified: now, changeFrequency: "weekly",  priority: 0.5 },
    // Blog posts — add individually with their real publish dates:
    // { url: `${SITE_URL}/blog/self-healing-apis`, lastModified: new Date("2026-11-10"), changeFrequency: "yearly", priority: 0.7 },
  ];
}
