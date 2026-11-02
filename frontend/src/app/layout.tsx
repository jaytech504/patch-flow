import type { Metadata, Viewport } from "next";
import "./globals.css";
import CookieConsent from "@/components/cookie-consent";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PatchFlow — API Reliability Testing & Auto-Fix",
    template: "%s — PatchFlow",
  },
  description:
    "PatchFlow stress-tests APIs with chaos failure modes, monitors production crashes, and opens compiler-verified GitHub PRs with production-ready fixes.",
  // og:title / og:description inherit from each page's title/description.
  // og:image is provided by src/app/opengraph-image.tsx.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
  },
  // twitter:image is provided by src/app/twitter-image.tsx.
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0D0C" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
