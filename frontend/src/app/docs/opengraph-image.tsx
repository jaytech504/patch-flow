import { OG_SIZE, renderShareImage } from "@/og/share-image";
import { OG_IMAGE_ALT } from "@/lib/seo";

export const alt = OG_IMAGE_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Per-page OG image override for /docs.
 * Uses the shared renderer with docs-specific copy.
 */
export default function Image() {
  return renderShareImage({
    title: "PatchFlow SDK Docs",
    subtitle:
      "Install in Node.js or Python to capture production errors and trigger auto-generated GitHub PR fixes.",
    badge: "SDK Documentation",
  });
}
