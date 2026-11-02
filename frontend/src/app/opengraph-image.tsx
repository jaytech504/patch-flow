import { OG_SIZE, renderShareImage } from "@/og/share-image";
import { OG_IMAGE_ALT } from "@/lib/seo";

export const alt = OG_IMAGE_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Root Open Graph share image (1200×630). Auto-injects og:image /
 * og:image:width / og:image:height / og:image:alt into every page's metadata.
 * Per-page overrides live alongside their route (e.g. src/app/docs/opengraph-image.tsx).
 */
export default function Image() {
  return renderShareImage();
}
