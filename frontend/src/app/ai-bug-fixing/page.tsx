import type { Metadata } from "next";
import Link from "next/link";
import { GitPullRequest, Sparkles, Shield } from "lucide-react";
import SeoLandingPage from "@/components/seo-landing-page";
import { pageMetadata } from "@/lib/seo";
import type { FaqItem } from "@/components/faq-section";

export const metadata: Metadata = pageMetadata({
  title: "AI-Powered Bug Fixing",
  description:
    "AI-powered bug fixing that turns recurring API crashes into compiler-verified GitHub draft PRs. You review and merge every patch. Start free with PatchFlow.",
  path: "/ai-bug-fixing",
});

const FAQS: FaqItem[] = [
  {
    question: "Does PatchFlow merge pull requests automatically?",
    answer:
      "No. GitHubAgent opens a draft pull request. You review, run your own tests, and merge. Pre-merge build checks (where the plan includes them) add a verification badge; they do not merge the branch.",
  },
  {
    question: "What does “compiler-verified” mean here?",
    answer:
      "ReviewAgent checks AST structure (brackets and syntax) and, on plans that include it, runs language tooling such as the TypeScript compiler (tsc) and Node checks before the PR is opened. The intent is to avoid hallucinated imports and broken syntax — not to prove your full production test suite passed.",
    link: { href: "/docs", label: "SDK and pipeline context" },
  },
  {
    question: "Is repository code used to train models?",
    answer:
      "PatchFlow clones the repo temporarily to generate and verify a fix, then removes that clone when the run finishes. The privacy policy states code is not kept as a permanent copy and is not used to train AI models.",
    link: { href: "/privacy#repository-access", label: "Repository access policy" },
  },
];

export default function AiBugFixingPage() {
  return (
    <SeoLandingPage
      path="/ai-bug-fixing"
      badge="Automated Fixes"
      h1="AI-Powered Bug Fixing for Production APIs"
      intro="Most error trackers stop at a stack trace. PatchFlow’s AI-powered bug fixing continues to a draft GitHub pull request: clone the repo, locate the route handler, write a framework-aware error path, check that it parses, and leave the merge decision to you."
      capabilities={[
        {
          icon: Sparkles,
          title: "FixAgent",
          body: "Uses the stack or chaos finding to find the handler and generate an AST-oriented patch with the right framework imports.",
        },
        {
          icon: Shield,
          title: "ReviewAgent",
          body: "Senior-style pass over the diff: syntax/AST checks and, on Pro and Team, pre-merge build verification before push.",
        },
        {
          icon: GitPullRequest,
          title: "GitHubAgent",
          body: "Opens a draft PR on a consolidated branch with failure-mode context. Auth, billing, and credential files are never patched.",
        },
      ]}
      related={[
        {
          href: "/api-monitoring",
          label: "API monitoring",
          description: "How production crashes reach the 3-occurrence threshold.",
        },
        {
          href: "/chaos-testing",
          label: "API chaos testing",
          description: "How synthetic failures feed the same fix pipeline before deploy.",
        },
        {
          href: "/demo",
          label: "Live demo",
          description: "A sample PR: FastAPI HTTPException(503) around a SQLAlchemy fetch.",
        },
        {
          href: "/docs",
          label: "SDK documentation",
          description: "What the SDK sends so FixAgent has a stack to work from.",
        },
      ]}
      faqs={FAQS}
    >
      <section>
        <h2>Automated issue resolution without auto-merge</h2>
        <p>
          “AI bug fixing” in PatchFlow means a scripted agent pipeline, not a
          chatbot in your IDE. Two product events can start it: a{" "}
          <Link href="/chaos-testing">chaos scan</Link> finding, or a
          production fingerprint that crossed the threshold from the{" "}
          <Link href="/api-monitoring">monitoring SDK</Link>. Both end at a
          draft PR. Automated resolution covers the patch proposal; you still
          own the merge.
        </p>
      </section>

      <section>
        <h2>The six-agent pipeline</h2>
        <p>
          On a chaos run the sequence is DiscoveryAgent → ChaosAgent →
          AnalystAgent → FixAgent → ReviewAgent → GitHubAgent. Production
          incidents skip discovery and injection; ingest and dedup replace
          those steps, then the same three agents write the PR.
        </p>
        <h3>FixAgent</h3>
        <p>
          Clones the connected GitHub repository, locates the route handler
          from the stack or endpoint, and writes a surgical change —
          typically try/except or equivalent, status-correct responses, and
          imports such as FastAPI <code>HTTPException</code>, Django{" "}
          <code>JsonResponse</code>, or Spring <code>ResponseEntity</code>.
        </p>
        <h3>ReviewAgent</h3>
        <p>
          Checks that the patch is structurally valid. On Developer Pro and
          Team, pre-merge build checks (TypeScript <code>tsc</code>, Node)
          run so obviously broken code is less likely to land in the PR.
          Hobby chaos scans can still open PRs; live SDK auto-patches and
          those build checks are Pro/Team features.
        </p>
        <h3>GitHubAgent</h3>
        <p>
          Pushes a consolidated branch and opens a draft pull request. The
          demo title shape is{" "}
          <code>fix: 503 resilience on /api/v1/orders</code>. GitHub scopes
          requested at login are <code>repo</code>, <code>read:user</code>,
          and <code>user:email</code>. Revoke anytime in GitHub settings.
        </p>
      </section>

      <section>
        <h2>Guardrails</h2>
        <ul className="list-disc pl-5">
          <li>
            Blocklist: auth, billing, payments, migrations, credentials,
            encryption, admin, and permission files are not auto-patched.
          </li>
          <li>
            Temporary clone only; not used to train models (see{" "}
            <Link href="/privacy#repository-access">privacy</Link>).
          </li>
          <li>
            Three-occurrence gate on SDK incidents, configurable per account,
            so a one-off glitch does not open a PR.
          </li>
          <li>
            After <code>pr_opened</code>, the same fingerprint waits until
            you close or merge before another run.
          </li>
        </ul>
      </section>

      <section>
        <h2>Use cases</h2>
        <h3>Unhandled database errors on a read path</h3>
        <p>
          Chaos mode <code>db_connection_drop</code> or a live{" "}
          <code>SQLAlchemyError</code> both map to “this GET returns 500”.
          The generated patch wraps the fetch, logs the error, and raises
          503 or 404 — the pattern shown on the homepage and demo diffs.
        </p>
        <h3>Malformed JSON from a dependency</h3>
        <p>
          If the handler assumes <code>response.json()</code> always works,
          <code>malformed_json</code> in a scan (or a real parse exception
          in production) is a candidate for an explicit 502/503 path instead
          of an uncaught exception.
        </p>
        <h3>Night-shift noise reduction</h3>
        <p>
          Email alerts still fire. The difference versus a tracker-only
          workflow is that the on-call engineer can open a PR that already
          names the endpoint and failure mode, then reject or amend it.
          PatchFlow does not claim it replaces review.
        </p>
      </section>

      <section>
        <h2>What it will not do</h2>
        <p>
          It will not invent product features, migrate schemas, or touch
          blocklisted security code. It will not run your full CI unless you
          add that in GitHub after the draft exists. Team plans mention
          custom CI checks in addition to the built-in compiler pass. For
          quota: Pro includes 100 live SDK auto-patches per month; Team is
          unlimited. Start from <Link href="/login">GitHub login</Link> or
          the <Link href="/demo">demo</Link> if you want to see a completed
          run first.
        </p>
      </section>
    </SeoLandingPage>
  );
}
