import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Images ───────────────────────────────────────────────────────────────────
  images: {
    // Allow optimization of remote images (GitHub avatars, SideProjectors badge)
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "www.sideprojectors.com" },
    ],
    // Use modern formats by default for smaller payloads
    formats: ["image/avif", "image/webp"],
  },

  // ── Security headers on every response ───────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Stop MIME-sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer: full URL on same origin, only origin on cross-origin
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permissions: restrict camera/mic/geolocation
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // HSTS: 1 year, include subdomains (only active over HTTPS; ignored locally)
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Content Security Policy
          // Note: adjust script-src if you add additional third-party scripts
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js requires 'unsafe-inline' and 'unsafe-eval' in dev;
              // in production only inline styles for Tailwind, plus Plausible
              "script-src 'self' 'unsafe-inline' https://plausible.io",
              "style-src 'self' 'unsafe-inline'",
              // Images: self + GitHub avatars + SideProjectors badge + data URIs
              "img-src 'self' data: https://avatars.githubusercontent.com https://www.sideprojectors.com",
              // Fonts from self only (system fonts, no external font CDN)
              "font-src 'self'",
              // API calls go to the backend subdomain
              `connect-src 'self' https://api.patchflow.cloud wss://api.patchflow.cloud https://plausible.io`,
              // Frames: none
              "frame-src 'none'",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // ── Redirects: HTTP → HTTPS is handled by Render, but keep www → apex here
  async redirects() {
    return [
      {
        source: "/(.*)",
        has: [{ type: "host", value: "www.patchflow.cloud" }],
        destination: "https://patchflow.cloud/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
