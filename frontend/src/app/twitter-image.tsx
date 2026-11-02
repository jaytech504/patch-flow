import { OG_SIZE, renderShareImage } from "@/og/share-image";
import { OG_IMAGE_ALT } from "@/lib/seo";

export const alt = OG_IMAGE_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Root Twitter Card image (1200×630). Shares the same render as the OG image
 * so branding stays consistent across networks.
 */
export default function Image() {
  return renderShareImage();
}
