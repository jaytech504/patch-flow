import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Flame, BarChart3 } from "lucide-react";
import SeoLandingPage from "@/components/seo-landing-page";
import { pageMetadata } from "@/lib/seo";
import type { FaqItem } from "@/components/faq-section";

export const metadata: Metadata = pageMetadata({
  title: "API Chaos Testing & Chaos Engineering",
  description:
    "API chaos testing with 18+ failure modes: timeouts, 503s, malformed JSON, and database drops. Score reliability and open verified GitHub PRs. Start free.",
  path: "/chaos-testing",
});

const FAQS: FaqItem[] = [
  {
    question: "How is API chaos testing different from Netflix-style chaos engineering?",
    answer:
      "Classic chaos engineering often kills processes or partitions infrastructure in a live environment. PatchFlow chaos testing is request-scoped failure injection against your HTTP API: synthetic network, dependency, payload, and database faults applied to discovered endpoints, then scored and optionally patched via a draft GitHub PR.",
  },
  {
    question: "What are the 18+ chaos failure modes?",
    answer:
      "There are 18 deterministic modes in four categories: network (timeout, connection refused, DNS failure, slow 5s response, connection reset), dependency (500, 429, 503, 401, 404), data (malformed JSON, empty body, wrong content-type, truncated body, null required fields), and resource (database connection drop, query timeout, constraint violation).",
  },
  {
    question: "Does chaos testing change my production database?",
    answer:
      "Injection is aimed at how your handlers behave when dependencies misbehave. You should run scans against a staging or local API, not as a substitute for a change window on production data. PatchFlow opens draft PRs against your GitHub repository; it does not merge them.",
    link: { href: "/api-testing", label: "How test sessions are configured" },
  },
];

export default function ChaosTestingPage() {
  return (
    <SeoLandingPage
      path="/chaos-testing"
      badge="Chaos Engineering"
      h1="API Chaos Testing and Chaos Engineering for Backends"
      intro="Chaos engineering for APIs is not random traffic. It is a deliberate catalog of failures — hung sockets, 503s from an upstream, JSON that will not parse — applied so you can see whether each route fails safely. PatchFlow automates that catalog with 18 deterministic failure modes and a reliability score."
      capabilities={[
        {
          icon: Flame,
          title: "18 deterministic modes",
          body: "Network, dependency HTTP statuses, corrupt or empty payloads, and database faults — each with a stable id such as http_503 or db_timeout.",
        },
        {
          icon: BarChart3,
          title: "Reliability score 0–100",
          body: "AnalystAgent weights unhandled exceptions, leakage, and latency-style degradation into a posture score you can track across scans.",
        },
        {
          icon: Activity,
          title: "Same pipeline as production",
          body: "Findings can flow into FixAgent and a compiler-checked draft PR, the reactive engine used when the SDK sees a real crash.",
        },
      ]}
      related={[
        {
          href: "/api-testing",
          label: "Automated API testing",
          description: "Discovery from OpenAPI, Postman, and source, plus session limits.",
        },
        {
          href: "/ai-bug-fixing",
          label: "AI-powered bug fixing",
          description: "How FixAgent, ReviewAgent, and GitHubAgent turn a finding into a PR.",
        },
        {
          href: "/demo",
          label: "Live demo",
          description: "Watch ChaosAgent inject modes like db_connection_drop and malformed_json.",
        },
        {
          href: "/docs",
          label: "SDK documentation",
          description: "Monitor the failures chaos testing cannot invent in staging.",
        },
      ]}
      faqs={FAQS}
    >
      <section>
        <h2>Why API chaos testing exists</h2>
        <p>
          Unit tests mock the database as healthy. Integration tests often use a
          best-case network. The bugs that page you are the other cases: DNS
          for a billing service fails, Redis is slow, a partner API returns an
          HTML error page with a 200.{" "}
          <Link href="/">PatchFlow</Link> treats those as first-class tests —
          Engine 1 in the dual-engine design — so you inject them before
          customers do.
        </p>
      </section>

      <section>
        <h2>The 18 chaos failure modes</h2>
        <p>
          Every selected endpoint is exercised against the same library. Modes
          are grouped the way the injector is implemented:
        </p>
        <h3>Network</h3>
        <ul className="list-disc pl-5">
          <li>
            <code>http_timeout</code> — outbound HTTP hangs with no response
          </li>
          <li>
            <code>connection_refused</code> — upstream TCP refused
          </li>
          <li>
            <code>dns_failure</code> — hostname does not resolve
          </li>
          <li>
            <code>slow_response</code> — 5 second delay to probe client timeouts
          </li>
          <li>
            <code>connection_reset</code> — TCP reset mid-transfer
          </li>
        </ul>
        <h3>Dependency</h3>
        <ul className="list-disc pl-5">
          <li>
            <code>http_500</code>, <code>http_429</code>, <code>http_503</code>,{" "}
            <code>http_401</code>, <code>http_404</code> — upstream status
            codes your handler may not map to a clean client response
          </li>
        </ul>
        <h3>Data</h3>
        <ul className="list-disc pl-5">
          <li>
            <code>malformed_json</code>, <code>empty_response</code>,{" "}
            <code>wrong_content_type</code>, <code>partial_response</code>,{" "}
            <code>null_fields</code>
          </li>
        </ul>
        <h3>Resource</h3>
        <ul className="list-disc pl-5">
          <li>
            <code>db_connection_drop</code>, <code>db_timeout</code>,{" "}
            <code>db_constraint_violation</code>
          </li>
        </ul>
        <p>
          Team plans can add custom payload injection on top of this set. All
          listed modes are available on Hobby and Pro.
        </p>
      </section>

      <section>
        <h2>What a chaos scan actually runs</h2>
        <ol>
          <li>
            <strong>DiscoveryAgent</strong> catalogs endpoints from the spec,
            collection, repo, or manual list.
          </li>
          <li>
            <strong>ChaosAgent</strong> selects modes and injects them across
            those endpoints.
          </li>
          <li>
            <strong>AnalystAgent</strong> labels findings (for example,
            unhandled <code>SQLAlchemyError</code> on{" "}
            <code>GET /orders/{"{id}"}</code>) and computes the 0–100 score.
          </li>
          <li>
            Optionally <strong>FixAgent</strong>, <strong>ReviewAgent</strong>,
            and <strong>GitHubAgent</strong> open a consolidated draft PR with
            failure-mode notes in the description.
          </li>
        </ol>
        <p>
          You can replay the same sequence on the{" "}
          <Link href="/demo">live demo</Link>. Scan quota is counted per
          chaos session — 3 / month on Hobby, 30 on Pro, unlimited on Team.
        </p>
      </section>

      <section>
        <h2>Use cases</h2>
        <h3>Resilience review before a launch</h3>
        <p>
          Point the scanner at staging OpenAPI. Prioritize CRITICAL unhandled
          modes and leakage. Merge draft PRs that add explicit 503/404 handling
          rather than shipping bare <code>db.fetch</code> calls.
        </p>
        <h3>Regression after an incident</h3>
        <p>
          If production hit a truncated JSON body from a gateway, re-run{" "}
          <code>partial_response</code> and <code>malformed_json</code> on the
          same routes after the fix lands.
        </p>
        <h3>Teaching the team what “handled” means</h3>
        <p>
          A 200 with a hung worker is not success. The report distinguishes
          handled (correct error status, no leak), degraded (slow but 200),
          and unhandled (5xx plus exception text). That vocabulary is useful
          in code review even when you do not take the auto-generated patch.
        </p>
      </section>

      <section>
        <h2>Where chaos testing stops</h2>
        <p>
          Injection will not see a race that only appears under real user
          load, or a bug in a code path no spec lists. Pair it with{" "}
          <Link href="/api-monitoring">API monitoring</Link>: the SDK reports
          unhandled exceptions from live Node.js, Python, or Spring Boot apps,
          and after three matching occurrences can open the same style of
          draft PR. Chaos testing is the rehearsal; monitoring is the show.
        </p>
      </section>
    </SeoLandingPage>
  );
}
