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

export const OG_IMAGE_ALT =
  "PatchFlow — autonomous API reliability and self-healing platform that turns production crashes into compiler-verified GitHub pull requests.";
const DEFAULT_OG_IMAGE = "/opengraph-image";

interface PageMetadataOptions {
  /** Page name only — the "— PatchFlow" suffix is added by the title template. */
  title?: string;
  /** Unique description, kept under 160 characters. */
  description: string;
  /** Canonical path for this page, e.g. "/pricing". Resolved against metadataBase. */
  path: string;
  /** When true, emits noindex,follow (auth-only pages). */
  noindex?: boolean;
  /** Override the OG/Twitter share image path (defaults to the root share image). */
  ogImage?: string;
}

/**
 * Build per-page Metadata with a unique title, description, canonical URL and
 * an explicit Open Graph image.
 *
 * The share image is referenced explicitly (rather than relying solely on the
 * opengraph-image file convention) because defining any openGraph field on a
 * route suppresses the convention's auto-injected og:image. Referencing it
 * here guarantees every public page emits og:image + og:url.
 */
export function pageMetadata({
  title,
  description,
  path,
  noindex,
  ogImage = DEFAULT_OG_IMAGE,
}: PageMetadataOptions): Metadata {
  const meta: Metadata = {
    description,
    alternates: { canonical: path },
    openGraph: {
      url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
      images: [
        { url: ogImage, width: 1200, height: 630, alt: OG_IMAGE_ALT, type: "image/png" },
      ],
    },
  };
  if (title) meta.title = title;
  if (noindex) meta.robots = { index: false, follow: true };
  return meta;
}
