import { SITE_URL } from "@/lib/seo";

/**
 * Site-wide structured data injected once in the root layout.
 *
 * Three schemas:
 * 1. WebSite  — enables sitelinks search box in Google, signals brand/domain
 * 2. Organization — links the brand to GitHub and other social profiles
 * 3. SoftwareApplication — tells Google this is a developer tool with pricing
 *
 * Rendered as a server component (no "use client") so crawlers see it in the
 * initial HTML of every page.
 */
export default function SiteSchema() {
  const webSite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PatchFlow",
    url: SITE_URL,
    description:
      "Autonomous API reliability platform — chaos testing, production error monitoring, and compiler-verified GitHub PR auto-fixes.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/docs?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PatchFlow",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/icon.png`,
      width: 32,
      height: 32,
    },
    sameAs: [
      "https://github.com/jaytech504/patch-flow",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      email: "support.patchflow@gmail.com",
      contactType: "customer support",
    },
  };

  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "PatchFlow",
    url: SITE_URL,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description:
      "PatchFlow injects 18+ chaos failure modes into backend APIs, monitors production errors via a lightweight SDK, and automatically opens compiler-verified GitHub Pull Requests with fixes when the same error occurs 3 or more times.",
    featureList: [
      "API chaos testing with 18+ failure modes",
      "Production error monitoring via SDK",
      "Automatic GitHub Pull Request generation",
      "Pre-merge build verification",
      "AST-aware code patching",
      "Supports FastAPI, Express, Django, Flask, Spring Boot",
    ],
    offers: [
      {
        "@type": "Offer",
        name: "Hobby",
        price: "0",
        priceCurrency: "USD",
        description: "Free forever — 1 monitored site, real-time error logs, 3 chaos scans/month.",
      },
      {
        "@type": "Offer",
        name: "Developer Pro",
        price: "14",
        priceCurrency: "USD",
        description: "5 monitored sites, 100 auto-patches/month, pre-merge build checks.",
      },
      {
        "@type": "Offer",
        name: "Team & Business",
        price: "42",
        priceCurrency: "USD",
        description: "Unlimited sites, unlimited auto-patches, dedicated AI queue.",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSite) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApp) }}
      />
    </>
  );
}
