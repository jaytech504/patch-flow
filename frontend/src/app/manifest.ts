import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo";

/**
 * Web App Manifest (served at /manifest.webmanifest).
 * Next.js auto-injects the matching <link rel="manifest"> tag.
 * Icons are generated from public/logo.png by scripts/gen-icons.mjs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — API Reliability Testing & Auto-Fix`,
    short_name: SITE_NAME,
    description:
      "Autonomous API reliability testing and self-healing fixes.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAF9",
    theme_color: "#FF5A1F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
