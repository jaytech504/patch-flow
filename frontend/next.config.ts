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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://plausible.io",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://avatars.githubusercontent.com https://www.sideprojectors.com",
              "font-src 'self'",
              `connect-src 'self' https://api.patchflow.cloud wss://api.patchflow.cloud https://plausible.io`,
              "frame-src 'none'",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // NOTE: No redirects block here. Render handles www ↔ apex routing
  // at the CDN level. Adding a Next.js redirect on top causes an infinite
  // redirect loop (Render apex→www, Next.js www→apex, repeat).
};

export default nextConfig;
