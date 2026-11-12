import type { Metadata } from "next";
import Link from "next/link";
import { Radio, Shield, Bug } from "lucide-react";
import SeoLandingPage from "@/components/seo-landing-page";
import { pageMetadata } from "@/lib/seo";
import type { FaqItem } from "@/components/faq-section";

export const metadata: Metadata = pageMetadata({
  title: "API Monitoring & Error Detection",
  description:
    "API monitoring that detects production crashes via a Node.js, Python, or Java SDK. Recurring errors can become compiler-verified GitHub draft PRs. Start free.",
  path: "/api-monitoring",
});

const FAQS: FaqItem[] = [
  {
    question: "What does the PatchFlow SDK send from production?",
    answer:
      "Error type, a message truncated to 1,000 characters, stack frames (file, line, function), endpoint, HTTP method, status code if known, detected framework, environment tag, and SDK version. It does not send request bodies, headers, cookies, env vars, or source code. The backend also redacts emails, IPs, passwords, tokens, and connection strings.",
    link: { href: "/docs#what-sdk-sends", label: "Full SDK data list" },
  },
  {
    question: "Will the monitoring SDK slow down or crash my API?",
    answer:
      "Dispatch is asynchronous with a 10-second timeout. If PatchFlow is unreachable, the error is discarded. The SDK is designed to fail silently so it cannot take down the host application.",
    link: { href: "/docs#security", label: "SDK security notes" },
  },
  {
    question: "Does Hobby include auto-fix for monitored sites?",
    answer:
      "Hobby includes 1 monitored site, real-time error logs, email alerts, and 7-day retention. Live SDK auto-patches (draft GitHub PRs from production crashes) start on Developer Pro. Chaos scans with auto-PRs are available on Hobby within the monthly scan limit.",
    link: { href: "/pricing", label: "Compare plans" },
  },
];

export default function ApiMonitoringPage() {
  return (
    <SeoLandingPage
      path="/api-monitoring"
      badge="Production Monitoring"
      h1="API Monitoring and Production Error Detection"
      intro="Synthetic tests miss the path only a real customer hits. PatchFlow API monitoring installs a small SDK in your backend, captures unhandled exceptions, groups repeats at the same file and line, and — on paid auto-patch plans — opens a draft GitHub pull request after the same crash happens three times."
      capabilities={[
        {
          icon: Radio,
          title: "Crash ingestion",
          body: "Node.js / Edge, Python, and Spring Boot SDKs hook unhandled errors without sending bodies, headers, or cookies.",
        },
        {
          icon: Bug,
          title: "Dedup and threshold",
          body: "Fingerprints hash site, error type, file, and line. The fix pipeline waits for 3 occurrences at that location (configurable per account).",
        },
        {
          icon: Shield,
          title: "Alerts without merging",
          body: "Email incident alerts on Hobby. Auto-generated PRs stay drafts. Auth and billing files stay on the patch blocklist.",
        },
      ]}
      related={[
        {
          href: "/docs",
          label: "SDK documentation",
          description: "Install steps for Next.js, Express, FastAPI, Flask, Django, and Spring Boot.",
        },
        {
          href: "/ai-bug-fixing",
          label: "AI-powered bug fixing",
          description: "What happens after the 3-occurrence threshold is crossed.",
        },
        {
          href: "/chaos-testing",
          label: "API chaos testing",
          description: "Find the same classes of failure before they reach production.",
        },
        {
          href: "/pricing",
          label: "Pricing",
          description: "Site limits, log retention, and where auto-patching is included.",
        },
      ]}
      faqs={FAQS}
    >
      <section>
        <h2>Production error detection, not a second APM</h2>
        <p>
          PatchFlow monitoring is Engine 2 of the{" "}
          <Link href="/">dual-engine platform</Link>: reactive capture of
          crashes that already escaped. It is not a metrics or tracing suite.
          There is no request-rate dashboard in the SDK path. The product
          question is narrower — did this unhandled exception happen enough
          times at the same location to deserve a patch?
        </p>
        <p>
          That keeps the payload small. The SDK posts to{" "}
          <code>https://api.patchflow.cloud/api/sdk/errors</code> over HTTPS
          with only error metadata. Source is read later through GitHub when a
          fix run starts, not from the live request.
        </p>
      </section>

      <section>
        <h2>How monitoring is installed</h2>
        <p>
          Connect GitHub, add a site in the dashboard, and copy the API key
          shown once (stored hashed as SHA-256). Then:
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Node.js / Edge</strong> — <code>patchflow.js</code> via{" "}
            <code>instrumentation.ts</code> on Next.js App Router, or{" "}
            <code>expressMiddleware()</code> after all Express routes. Also
            documented for Hono and NestJS.
          </li>
          <li>
            <strong>Python</strong> — <code>patchflow.init()</code> on FastAPI
            / Starlette (ASGI middleware), Flask (<code>app=</code> instance),
            and Django.
          </li>
          <li>
            <strong>Spring Boot</strong> — drop in{" "}
            <code>PatchFlowAdvice.java</code> (Java 11 HttpClient, no extra
            Maven/Gradle dependency).
          </li>
        </ul>
        <p>
          Optional config: <code>PATCHFLOW_HOST</code>,{" "}
          <code>PATCHFLOW_ENV</code> (defaults to <code>production</code>),
          and a debug flag for local stdout. Copy-paste examples live in the{" "}
          <Link href="/docs">SDK docs</Link>.
        </p>
      </section>

      <section>
        <h2>From error to incident</h2>
        <p>
          Occurrences are grouped by{" "}
          <code>hash(site_id + error_type + file + line)</code>. Until the
          same fingerprint is seen three times, PatchFlow records the crash
          and can email you, but it does not start FixAgent. After a pipeline
          completes, the incident is marked <code>pr_opened</code> and that
          fingerprint will not start another run until you close or merge the
          PR.
        </p>
        <p>
          Hobby retains logs for 7 days; Pro 30; Team 90. Site counts: 1 on
          Hobby, 5 on Pro, unlimited on Team.
        </p>
      </section>

      <section>
        <h2>Use cases</h2>
        <h3>A FastAPI route that only 500s for one tenant</h3>
        <p>
          Staging never sent <code>null</code> in a required nested field.
          Production did. The SDK reports <code>ValueError</code> (or
          <code>SQLAlchemyError</code>) with the route and stack. After three
          hits, Pro can open a draft PR with a 404/503 handler instead of an
          uncaught exception.
        </p>
        <h3>Express middleware you forgot to register</h3>
        <p>
          Unhandled promise rejections still reach the SDK. You get the file
          and line even when the process did not have a dedicated error
          middleware — useful when the test suite never triggered that branch.
        </p>
        <h3>Complement to chaos scans</h3>
        <p>
          Run <Link href="/chaos-testing">chaos testing</Link> on OpenAPI
          before deploy, then leave the SDK on in production for everything
          the 18 modes did not encode. Both sides can produce the same kind of
          draft PR.
        </p>
      </section>

      <section>
        <h2>Privacy and safety</h2>
        <p>
          No request bodies, headers, or cookies leave the app. PII redaction
          runs on ingest. Auto-patch skips auth, billing, payment, credential,
          encryption, migration, admin, and permission files. Pull requests
          are drafts. The SDK cannot block a request if PatchFlow is down.
          Retention and deletion are described in the{" "}
          <Link href="/privacy#sdk-data">privacy policy</Link>.
        </p>
      </section>
    </SeoLandingPage>
  );
}
