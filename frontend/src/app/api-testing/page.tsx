import type { Metadata } from "next";
import Link from "next/link";
import { GitPullRequest, Search, Shield } from "lucide-react";
import SeoLandingPage from "@/components/seo-landing-page";
import { pageMetadata } from "@/lib/seo";
import type { FaqItem } from "@/components/faq-section";

export const metadata: Metadata = pageMetadata({
  title: "Automated API Testing Tools",
  description:
    "Test APIs automatically from OpenAPI, Postman, or source. PatchFlow discovers endpoints, injects 18+ failure modes, and opens verified GitHub PRs. Start free.",
  path: "/api-testing",
});

const FAQS: FaqItem[] = [
  {
    question: "How does PatchFlow discover API endpoints to test?",
    answer:
      "A chaos session can start from a live OpenAPI or Swagger URL, an uploaded OpenAPI 3.0+ JSON or YAML file, a Postman v2.1 collection, routes detected in a cloned repository, or manually entered paths and HTTP methods. After discovery you select up to 10 endpoints per session.",
    link: { href: "/demo", label: "See a sample scan" },
  },
  {
    question: "Is this functional API testing or load testing?",
    answer:
      "PatchFlow is a reliability and failure-injection test, not a load generator. It exercises each selected endpoint against synthetic failure modes (timeouts, dependency errors, malformed payloads, database faults) and scores how the handler responds. It does not replace unit tests, contract tests, or k6-style load tests.",
  },
  {
    question: "What happens after an automated API test finds a fragile handler?",
    answer:
      "AnalystAgent assigns a 0–100 reliability score and severity. FixAgent locates the route handler, ReviewAgent checks syntax and runs compile checks where possible, and GitHubAgent opens a draft pull request with the resilience patch. You review and merge; nothing is merged automatically.",
    link: { href: "/ai-bug-fixing", label: "How AI bug fixing works" },
  },
];

export default function ApiTestingPage() {
  return (
    <SeoLandingPage
      path="/api-testing"
      badge="API Testing"
      h1="Automated API Testing Tools for Backend Services"
      intro="Most API test suites check the happy path. Production still fails when a dependency times out, a payload is truncated, or the database drops mid-query. PatchFlow is an automated API testing tool that discovers your endpoints, injects those failures, and turns the findings into draft GitHub pull requests you can review."
      capabilities={[
        {
          icon: Search,
          title: "Endpoint discovery",
          body: "OpenAPI URL, uploaded spec, Postman collection, repository route analysis, or manual GET/POST/PUT/DELETE entry.",
        },
        {
          icon: Shield,
          title: "Failure-aware tests",
          body: "Each selected endpoint is exercised against 18+ chaos failure modes spanning network, dependency, data, and database faults.",
        },
        {
          icon: GitPullRequest,
          title: "Fixes, not just reports",
          body: "Fragile handlers can go through the same FixAgent → ReviewAgent → GitHubAgent pipeline used for production crashes.",
        },
      ]}
      related={[
        {
          href: "/chaos-testing",
          label: "API chaos testing",
          description: "The 18 failure modes, scoring, and how injection actually runs.",
        },
        {
          href: "/demo",
          label: "Live demo",
          description: "Walk through a sample scan and generated pull request without signing in.",
        },
        {
          href: "/docs",
          label: "SDK documentation",
          description: "Pair pre-deploy tests with production error capture in Node.js, Python, or Java.",
        },
        {
          href: "/pricing",
          label: "Pricing",
          description: "Hobby includes 3 chaos scans per month. Pro and Team raise the scan limits.",
        },
        {
          href: "/api-monitoring",
          label: "API monitoring",
          description: "Catch the failures that only appear after you ship.",
        },
      ]}
      faqs={FAQS}
    >
      <section>
        <h2>What automated API testing means in PatchFlow</h2>
        <p>
          PatchFlow&apos;s testing engine is the proactive half of a{" "}
          <Link href="/">dual-engine reliability platform</Link>. You point a chaos
          session at a running API (or a spec that describes it). DiscoveryAgent
          catalogs routes. ChaosAgent then calls those routes while injecting
          synthetic faults. AnalystAgent classifies the responses: handled,
          degraded, or unhandled — including whether stack traces or connection
          strings leaked in the body.
        </p>
        <p>
          That is different from asserting status codes against a fixture. The
          goal is to answer: if this handler&apos;s upstream hangs, returns HTML
          instead of JSON, or loses its database socket, does the API fail
          closed with a correct status, or does it 500 and dump internals?
        </p>
      </section>

      <section>
        <h2>How a test session is set up</h2>
        <p>Scan modes shown in the product are OpenAPI, custom, and manual:</p>
        <ul className="list-disc pl-5">
          <li>
            <strong>OpenAPI / Swagger URL</strong> — fetch a live{" "}
            <code>openapi.json</code> or Swagger document from a running service.
          </li>
          <li>
            <strong>File upload</strong> — OpenAPI 3.0+ or Swagger JSON/YAML.
          </li>
          <li>
            <strong>Postman collections</strong> — v2.1 JSON exports.
          </li>
          <li>
            <strong>Repository analysis</strong> — detect routes from cloned
            source after GitHub is connected.
          </li>
          <li>
            <strong>Manual entry</strong> — path, parameters, and method when
            you do not have a spec.
          </li>
        </ul>
        <p>
          Sessions are quota-limited. The Hobby plan includes 3 chaos scans per
          month with all failure modes; Pro includes 30; Team is unlimited. A
          session can select at most 10 endpoints. Details are on the{" "}
          <Link href="/pricing">pricing page</Link>.
        </p>
      </section>

      <section>
        <h2>What the report contains</h2>
        <p>
          After injection, you get a reliability score from 0–100, severity
          labels (CRITICAL, HIGH, MEDIUM, LOW), and a leakage audit for stack
          traces, SQL error strings, database URLs, and filesystem paths in
          responses. The{" "}
          <Link href="/demo">demo</Link> shows this shape: endpoint, failure
          mode id (for example <code>db_connection_drop</code>), HTTP status,
          and whether data leaked.
        </p>
        <p>
          When auto-fix runs for a finding, the pull request describes the
          failure modes that triggered the patch and includes the diff against
          a fresh clone — not a paste into a chat window.
        </p>
      </section>

      <section>
        <h2>Practical use cases</h2>
        <h3>Before you ship a payments or orders API</h3>
        <p>
          Run the OpenAPI spec for <code>GET /orders/{"{id}"}</code> and{" "}
          <code>POST /payments</code>. If SQLAlchemy (or the equivalent) is
          unhandled, a database drop becomes a 500 with a leaked exception.
          PatchFlow can open a draft PR that adds framework-native error
          handling — <code>HTTPException</code> on FastAPI,{" "}
          <code>JsonResponse</code> on Django, <code>ResponseEntity</code> on
          Spring Boot.
        </p>
        <h3>When the spec is the source of truth</h3>
        <p>
          Teams that already maintain OpenAPI or Postman collections can test
          the documented surface without writing a separate chaos harness.
          Discovery follows the spec you already use for clients.
        </p>
        <h3>When production still surprises you</h3>
        <p>
          Pre-deploy API testing does not replace{" "}
          <Link href="/api-monitoring">production monitoring</Link>. The SDK
          captures unhandled exceptions that no synthetic mode modeled. Both
          engines share the same GitHub PR pipeline.
        </p>
      </section>

      <section>
        <h2>Frameworks and integrations</h2>
        <p>
          Chaos testing is HTTP-level: any backend that exposes the selected
          routes can be scanned. Generated patches are tailored for the
          frameworks PatchFlow is built around: FastAPI, Django / DRF, Flask,
          Express.js, and Spring Boot. Auth is GitHub OAuth. Fixes are always
          draft pull requests. Sensitive paths (auth, billing, payments,
          credentials, migrations, admin) are blocklisted from auto-patching.
        </p>
        <p>
          For production capture after tests pass, install the{" "}
          <Link href="/docs">Node.js, Python, or Spring Boot SDK</Link>. Hobby
          includes crash logs and email alerts; live SDK auto-patches require
          Pro or Team.
        </p>
      </section>
    </SeoLandingPage>
  );
}
