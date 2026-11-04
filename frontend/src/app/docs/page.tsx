import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { pageMetadata } from "@/lib/seo";
import { Badge } from "@/components/ui/badge";
import {
  Terminal,
  Zap,
  Shield,
  ArrowRight,
  Download,
} from "lucide-react";

export const metadata: Metadata = pageMetadata({
  title: "SDK Documentation",
  description:
    "Install the PatchFlow SDK in Node.js or Python to capture production errors and trigger auto-generated GitHub PR fixes.",
  path: "/docs",
});

const API_HOST = "https://api.patchflow.cloud";

// ── Code block component (server, no JS needed) ───────────────────────────────
function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <pre className="bg-[#111110] text-[#F8F8F2] text-[12px] sm:text-[13px] font-mono p-5 rounded-xl overflow-x-auto leading-relaxed whitespace-pre">
      <code className={`language-${lang}`}>{code}</code>
    </pre>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="apple-title-3 text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-[#FF5A1F]/15 selection:text-[#FF5A1F]">
      <Navbar variant="landing" />

      <div className="mx-auto max-w-7xl w-full px-6 py-12 md:py-20 flex flex-col lg:flex-row gap-12">
        {/* ── Sidebar TOC ──────────────────────────────────────────────── */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav aria-label="Documentation sections" className="sticky top-24 flex flex-col gap-1">
            {[
              { href: "#overview", label: "Overview" },
              { href: "#nodejs", label: "Node.js / Edge" },
              { href: "#python", label: "Python" },
              { href: "#springboot", label: "Spring Boot" },
              { href: "#config", label: "Config options" },
              { href: "#what-sdk-sends", label: "What the SDK sends" },
              { href: "#what-sdk-doesnt-send", label: "What it doesn't send" },
              { href: "#thresholds", label: "3-occurrence threshold" },
              { href: "#security", label: "Security" },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-[13px] text-text-secondary hover:text-foreground transition-colors py-1 pl-3 border-l-2 border-transparent hover:border-primary"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 space-y-14">
          {/* Header */}
          <div>
            <Badge
              variant="outline"
              className="mb-4 text-primary border-primary/30 uppercase tracking-widest text-xs px-3 py-1"
            >
              SDK Documentation
            </Badge>
            <h1 className="apple-display text-foreground mb-4">
              PatchFlow SDK
            </h1>
            <p className="apple-body text-text-secondary text-[16px] leading-relaxed max-w-2xl">
              Install the PatchFlow SDK in your backend to capture unhandled
              exceptions in production. When the same error occurs 3 or more
              times, PatchFlow automatically generates a compiler-verified
              GitHub Pull Request with a fix.
            </p>
            <p className="text-[13px] text-text-secondary mt-4">
              Need an API key?{" "}
              <Link href="/sites" className="text-primary font-semibold hover:underline">
                Connect a site from the dashboard
              </Link>{" "}
              — it is generated automatically.
            </p>
          </div>

          {/* Overview */}
          <Section id="overview" title="Overview">
            <p className="text-[15px] text-text-secondary leading-relaxed">
              PatchFlow is a{" "}
              <strong className="text-foreground">dual-engine reliability platform</strong>.
              Engine 1 (Chaos Testing) runs on-demand from the dashboard. Engine 2
              (Production Incident Auto-Patching) is powered by this SDK — it runs
              inside your app and monitors for real crashes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Terminal,
                  title: "Zero-config setup",
                  body: "One init() call installs ASGI/Express middleware automatically.",
                },
                {
                  icon: Zap,
                  title: "3-occurrence threshold",
                  body: "The fix pipeline only triggers once the same error has occurred 3× at the same location.",
                },
                {
                  icon: Shield,
                  title: "Fails silently",
                  body: "Short timeouts and non-blocking dispatches mean the SDK can never crash your app.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="p-5 bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl"
                >
                  <Icon className="h-5 w-5 text-primary mb-3" aria-hidden="true" />
                  <p className="font-semibold text-foreground text-[14px] mb-1">{title}</p>
                  <p className="text-[13px] text-text-secondary leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Node.js */}
          <Section id="nodejs" title="Node.js & Edge Runtime">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">JavaScript / TypeScript</Badge>
              <Badge variant="outline">Next.js · Express · Hono · NestJS</Badge>
            </div>

            <p className="text-[14px] text-text-secondary leading-relaxed">
              Download <code className="bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono text-[12px]">patchflow.js</code> and
              place it at the root of your project.
            </p>

            <a
              href="/sdk/patchflow.js"
              download="patchflow.js"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#111110] hover:bg-[#333] px-4 py-2.5 rounded-[10px] transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download patchflow.js
            </a>

            <h3 className="apple-headline text-foreground mt-2">Next.js (App Router)</h3>
            <CodeBlock lang="typescript" code={`// instrumentation.ts  (create this file at your project root)
import patchflow from './patchflow';

export async function register() {
  patchflow.init({
    apiKey: process.env.PATCHFLOW_API_KEY,
    host: process.env.PATCHFLOW_HOST || '${API_HOST}',
  });
}`} />

            <h3 className="apple-headline text-foreground mt-2">Express.js</h3>
            <CodeBlock lang="javascript" code={`const express = require('express');
const patchflow = require('./patchflow');

const app = express();

// Step 1 — init at the top of your entry file
patchflow.init({
  apiKey: process.env.PATCHFLOW_API_KEY,
  host: process.env.PATCHFLOW_HOST || '${API_HOST}',
});

// ... your routes ...

// Step 2 — error middleware at the bottom, AFTER all routes
app.use(patchflow.expressMiddleware());

app.listen(3000);`} />

            <h3 className="apple-headline text-foreground mt-2">Environment variables</h3>
            <CodeBlock lang="bash" code={`PATCHFLOW_API_KEY=pf_live_xxxxxxxxxxxx
PATCHFLOW_HOST=${API_HOST}   # optional — defaults to this value`} />
          </Section>

          {/* Python */}
          <Section id="python" title="Python (FastAPI, Flask, Django)">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="text-teal-700 border-teal-200 bg-teal-50">Python 3.8+</Badge>
              <Badge variant="outline">FastAPI · Flask · Django · Starlette</Badge>
            </div>

            <p className="text-[14px] text-text-secondary leading-relaxed">
              Download <code className="bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono text-[12px]">patchflow.py</code> and
              place it at the root of your project.
            </p>

            <a
              href="/sdk/patchflow.py"
              download="patchflow.py"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#111110] hover:bg-[#333] px-4 py-2.5 rounded-[10px] transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download patchflow.py
            </a>

            <h3 className="apple-headline text-foreground mt-2">FastAPI</h3>
            <CodeBlock lang="python" code={`import os
from fastapi import FastAPI
import patchflow

app = FastAPI()

# One call — ASGI middleware installed automatically
patchflow.init(
    api_key=os.environ["PATCHFLOW_API_KEY"],
    host=os.getenv("PATCHFLOW_HOST", "${API_HOST}"),
)

# Your routes stay exactly as they are`} />

            <h3 className="apple-headline text-foreground mt-2">Flask</h3>
            <CodeBlock lang="python" code={`import os
from flask import Flask
import patchflow

app = Flask(__name__)

patchflow.init(
    api_key=os.environ["PATCHFLOW_API_KEY"],
    host=os.getenv("PATCHFLOW_HOST", "${API_HOST}"),
    app=app,           # pass the Flask instance so error handlers are installed
)`} />

            <h3 className="apple-headline text-foreground mt-2">Environment variables</h3>
            <CodeBlock lang="bash" code={`PATCHFLOW_API_KEY=pf_live_xxxxxxxxxxxx
PATCHFLOW_HOST=${API_HOST}   # optional`} />
          </Section>

          {/* Spring Boot */}
          <Section id="springboot" title="Spring Boot (Java)">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50">Java 11+</Badge>
              <Badge variant="outline">Spring Boot 3+</Badge>
            </div>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              Download <code className="bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono text-[12px]">PatchFlowAdvice.java</code>,
              place it in the same package as your <code className="bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono text-[12px]">@SpringBootApplication</code> class,
              and update the <code className="bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono text-[12px]">package</code> declaration on line 1.
              No Maven or Gradle dependencies required — it uses the Java 11 built-in HttpClient.
            </p>
            <a
              href="/sdk/PatchFlowAdvice.java"
              download="PatchFlowAdvice.java"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#111110] hover:bg-[#333] px-4 py-2.5 rounded-[10px] transition-colors"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download PatchFlowAdvice.java
            </a>
            <CodeBlock lang="bash" code={`# Set before running your app:
export PATCHFLOW_API_KEY=pf_live_xxxxxxxxxxxx
export PATCHFLOW_HOST=${API_HOST}   # optional`} />
          </Section>

          {/* Config options */}
          <Section id="config" title="Configuration options">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] dark:border-white/[0.1]">
                    <th className="text-left py-2.5 pr-4 font-semibold text-foreground">Option</th>
                    <th className="text-left py-2.5 pr-4 font-semibold text-foreground">Env var</th>
                    <th className="text-left py-2.5 pr-4 font-semibold text-foreground">Default</th>
                    <th className="text-left py-2.5 font-semibold text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.06] text-text-secondary">
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-foreground">apiKey</td>
                    <td className="py-2.5 pr-4 font-mono">PATCHFLOW_API_KEY</td>
                    <td className="py-2.5 pr-4">—</td>
                    <td className="py-2.5">Required. Your site API key from the dashboard.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-foreground">host</td>
                    <td className="py-2.5 pr-4 font-mono">PATCHFLOW_HOST</td>
                    <td className="py-2.5 pr-4 font-mono text-[12px]">{API_HOST}</td>
                    <td className="py-2.5">PatchFlow API endpoint. Change only if self-hosting.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-foreground">environment</td>
                    <td className="py-2.5 pr-4 font-mono">PATCHFLOW_ENV</td>
                    <td className="py-2.5 pr-4 font-mono">production</td>
                    <td className="py-2.5">Tag errors by environment (production, staging, etc.).</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-foreground">debug</td>
                    <td className="py-2.5 pr-4">—</td>
                    <td className="py-2.5 pr-4 font-mono">false</td>
                    <td className="py-2.5">Print SDK activity to stdout. Disable in production.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          {/* What the SDK sends */}
          <Section id="what-sdk-sends" title="What the SDK sends">
            <p className="text-[14px] text-text-secondary leading-relaxed">
              On every captured exception, the SDK reports the following to
              <code className="bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono text-[12px] mx-1">POST {API_HOST}/api/sdk/errors</code>:
            </p>
            <ul className="space-y-2 text-[14px] text-text-secondary list-disc pl-5">
              <li><strong className="text-foreground">Error type</strong> — the exception class name (e.g. <code className="font-mono text-[12px]">ValueError</code>).</li>
              <li><strong className="text-foreground">Error message</strong> — truncated to 1,000 characters.</li>
              <li><strong className="text-foreground">Stack frames</strong> — file path, line number, function name. Internal library frames are filtered out.</li>
              <li><strong className="text-foreground">Endpoint + HTTP method</strong> — the route path and verb where the error occurred.</li>
              <li><strong className="text-foreground">HTTP status code</strong> — if available from the request context.</li>
              <li><strong className="text-foreground">Framework</strong> — detected automatically (nextjs, express, fastapi, flask, etc.).</li>
              <li><strong className="text-foreground">Environment</strong> — the value of <code className="font-mono text-[12px]">PATCHFLOW_ENV</code> or <code className="font-mono text-[12px]">NODE_ENV</code>.</li>
              <li><strong className="text-foreground">SDK version</strong>.</li>
            </ul>
            <p className="text-[13px] text-text-secondary leading-relaxed mt-2 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              All incoming error text is run through an automated PII redaction step on the PatchFlow backend
              before it is stored. Emails, IP addresses, passwords, tokens, and connection strings are stripped
              from error messages and stack frames.
            </p>
          </Section>

          {/* What the SDK doesn't send */}
          <Section id="what-sdk-doesnt-send" title="What the SDK does NOT send">
            <ul className="space-y-2 text-[14px] text-text-secondary list-disc pl-5">
              <li>Request bodies or POST payloads</li>
              <li>Request or response headers (including cookies, auth tokens, session IDs)</li>
              <li>Environment variables or process secrets</li>
              <li>Database query results or ORM objects</li>
              <li>Personally identifiable information about your end users</li>
              <li>Source code (the <em>fix pipeline</em> reads your repo via GitHub — the SDK itself never sends code)</li>
            </ul>
          </Section>

          {/* Threshold */}
          <Section id="thresholds" title="The 3-occurrence threshold">
            <p className="text-[14px] text-text-secondary leading-relaxed">
              PatchFlow waits until the <strong className="text-foreground">same error at the same file and line</strong> has
              been reported 3 or more times before triggering the fix pipeline. This prevents one-off glitches
              from generating noise. Occurrences are deduplicated by a stable fingerprint:{" "}
              <code className="bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono text-[12px]">hash(site_id + error_type + file + line)</code>.
            </p>
            <p className="text-[14px] text-text-secondary leading-relaxed">
              Once the threshold is reached and a fix pipeline completes, the incident is marked as{" "}
              <code className="bg-black/[0.04] dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono text-[12px]">pr_opened</code> and
              that fingerprint won&apos;t trigger another run until you close or merge the PR.
            </p>
          </Section>

          {/* Security */}
          <Section id="security" title="Security">
            <ul className="space-y-3 text-[14px] text-text-secondary list-disc pl-5">
              <li>All SDK traffic is sent over <strong className="text-foreground">HTTPS/TLS</strong> to <code className="font-mono text-[12px]">{API_HOST}</code>.</li>
              <li>API keys are stored <strong className="text-foreground">hashed (SHA-256)</strong> in the database — the plaintext is shown only once on creation.</li>
              <li>
                Sensitive files are <strong className="text-foreground">blocklisted</strong> and never auto-patched:
                auth, billing, payments, migrations, credentials, encryption, admin, and permission files.
              </li>
              <li>The SDK uses a <strong className="text-foreground">10-second timeout</strong> and fires asynchronously — it can never block a request or cause a timeout in your app.</li>
              <li>If PatchFlow is unreachable (cold start, outage), errors are silently discarded — your app is never affected.</li>
            </ul>
            <p className="text-[14px] text-text-secondary leading-relaxed mt-4">
              See the <Link href="/privacy#sdk-data" className="text-primary font-semibold hover:underline">Privacy Policy</Link> for
              the full data handling and retention details.
            </p>
          </Section>

          {/* CTA */}
          <div className="p-7 bg-primary/5 border border-primary/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div>
              <p className="font-semibold text-foreground text-[15px] mb-1">Ready to connect your first site?</p>
              <p className="text-[13px] text-text-secondary">Generate an API key in the dashboard and follow the steps above.</p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 shrink-0 text-[13px] font-semibold text-white bg-primary hover:bg-[#E04E16] px-5 py-2.5 rounded-xl transition-colors shadow-[0_2px_10px_rgba(255,90,31,0.3)] apple-press"
            >
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
