import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import path from "node:path";

export const OG_SIZE = { width: 1200, height: 630 } as const;

let _logoDataUrl: string | null = null;
function logoDataUrl(): string {
  if (_logoDataUrl) return _logoDataUrl;
  const buf = readFileSync(path.join(process.cwd(), "public/logo.png"));
  _logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  return _logoDataUrl;
}

export interface ShareImageOptions {
  title?: string;
  subtitle?: string;
  badge?: string;
}

/**
 * Render the 1200×630 social share image via next/og (Satori).
 * Reused by the root opengraph-image / twitter-image and by per-page
 * overrides (e.g. /docs) so the visual stays consistent.
 */
export function renderShareImage({
  title = "Autonomous API reliability & self-healing fixes.",
  subtitle = "Chaos-test APIs, monitor production crashes, and ship compiler-verified GitHub PRs automatically.",
  badge = "API Reliability & Self-Healing",
}: ShareImageOptions = {}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #0D0D0C 0%, #161615 55%, #2E1B13 100%)",
          padding: "80px 90px",
          color: "#F5F5F4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoDataUrl()}
            width={108}
            height={108}
            style={{ borderRadius: 26, objectFit: "contain" }}
            alt=""
          />
          <span
            style={{
              fontSize: 60,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "#F5F5F4",
            }}
          >
            PatchFlow
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 58,
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: "-0.02em",
              color: "#FFFFFF",
              maxWidth: 940,
            }}
          >
            {title}
          </div>
          <div
            style={{ fontSize: 28, color: "#9C9891", maxWidth: 880, lineHeight: 1.35 }}
          >
            {subtitle}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(255,90,31,0.16)",
              border: "1px solid rgba(255,90,31,0.4)",
              borderRadius: 999,
              padding: "12px 24px",
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#FF5A1F",
                display: "flex",
              }}
            />
            <span style={{ fontSize: 24, fontWeight: 600, color: "#FF7038" }}>
              {badge}
            </span>
          </div>
          <span style={{ fontSize: 24, color: "#6F6B66" }}>patchflow.dev</span>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
