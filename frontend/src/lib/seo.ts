import type { Metadata } from "next";

/**
 * Canonical production origin for PatchFlow.
 *
 * Override at build/deploy time with the NEXT_PUBLIC_SITE_URL env var (set it
 * to the final custom domain, e.g. https://patchflow.dev). Defaults to the
 * domain inferred from the product email (alerts@patchflow.dev).
 *
 * Used for metadataBase, sitemap.xml, robots.txt, canonical URLs and Open
 * Graph URLs so they all share one source of truth.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://patchflow.dev").replace(/\/+$/, "");

export const SITE_NAME = "PatchFlow";
export const SITE_TAGLINE = "API Reliability Testing & Auto-Fix";

interface PageMetadataOptions {
  /** Page name only — the "— PatchFlow" suffix is added by the title template. */
  title?: string;
  /** Unique description, kept under 160 characters. */
  description: string;
  /** Canonical path for this page, e.g. "/pricing". Resolved against metadataBase. */
  path: string;
  /** When true, emits noindex,follow (auth-only pages). */
  noindex?: boolean;
}

/**
 * Build per-page Metadata with a unique title, description and canonical URL.
 * Open Graph / Twitter images are layered on in the Social & Branding section.
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex,
}: PageMetadataOptions): Metadata {
  const meta: Metadata = {
    description,
    alternates: { canonical: path },
  };
  if (title) meta.title = title;
  if (noindex) meta.robots = { index: false, follow: true };
  return meta;
}
