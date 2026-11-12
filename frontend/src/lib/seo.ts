import type { Metadata } from "next";

/**
 * Canonical production origin for PatchFlow.
 *
 * Render redirects the apex (patchflow.cloud) to www.patchflow.cloud, so
 * www is the canonical host. All sitemap URLs, canonical tags, Open Graph
 * urls, and JSON-LD must use this value.
 *
 * Override at build/deploy time with the NEXT_PUBLIC_SITE_URL env var.
 * Set it to https://www.patchflow.cloud on the Render frontend service.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.patchflow.cloud").replace(/\/+$/, "");

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
  /**
   * When true, `title` is used as the full document title (skips the
   * "%s — PatchFlow" template). Use for the homepage brand title.
   */
  absoluteTitle?: boolean;
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
  absoluteTitle,
}: PageMetadataOptions): Metadata {
  const canonicalUrl = path === "/" ? SITE_URL : `${SITE_URL}${path}`;
  const meta: Metadata = {
    description,
    alternates: { canonical: path },
    robots: noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      url: canonicalUrl,
      description,
      images: [
        { url: ogImage, width: 1200, height: 630, alt: OG_IMAGE_ALT, type: "image/png" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      description,
    },
  };
  if (title) {
    const resolvedTitle = absoluteTitle ? title : `${title} — ${SITE_NAME}`;
    meta.title = absoluteTitle ? { absolute: title } : title;
    meta.openGraph = { ...meta.openGraph, title: resolvedTitle };
    meta.twitter = { ...meta.twitter, title: resolvedTitle };
  }
  return meta;
}
