import type { Metadata } from "next";
import "./globals.css";
import CookieConsent from "@/components/cookie-consent";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "PatchFlow — API Reliability Testing & Auto-Fix",
    template: "%s — PatchFlow",
  },
  description:
    "PatchFlow stress-tests APIs with chaos failure modes, monitors production crashes, and opens compiler-verified GitHub PRs with production-ready fixes.",
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
