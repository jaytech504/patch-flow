import type { Metadata, Viewport } from "next";
import "./globals.css";
import CookieConsent from "@/components/cookie-consent";
import AnalyticsLoader from "@/components/analytics-loader";
import SiteSchema from "@/components/site-schema";
import { SITE_URL, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PatchFlow – API Testing, Monitoring & AI-Powered Bug Fixes",
    template: "%s — PatchFlow",
  },
  description:
    "Test APIs with 18+ chaos failure modes, detect production crashes, and generate verified GitHub pull requests with AI-powered fixes. Start free with PatchFlow.",
  // Google Search Console verification — set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in Render
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && {
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      // Bing Webmaster uses a different meta name — injected below via alternates
    },
  }),
  // og:title / og:description inherit from each page's title/description.
  // og:image is provided by src/app/opengraph-image.tsx.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
  },
  // twitter:image is provided by src/app/twitter-image.tsx.
  twitter: {
    card: "summary_large_image",
  },
  // Bing Webmaster Tools verification
  other: {
    ...(process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION && {
      "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION,
    }),
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
        <SiteSchema />
        {children}
        <CookieConsent />
        <AnalyticsLoader />
      </body>
    </html>
  );
}
