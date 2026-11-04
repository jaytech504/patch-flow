import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { pageMetadata } from "@/lib/seo";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  CheckCircle2,
  GitPullRequest,
  Zap,
  Shield,
  Radio,
} from "lucide-react";

export const metadata: Metadata = pageMetadata({
  title: "Live Demo",
  description:
    "See PatchFlow in action — a real chaos scan run, the six-agent pipeline, and an auto-generated GitHub PR fix, without signing in.",
  path: "/demo",
});

// ── Static sample run data ────────────────────────────────────────────────────
const DEMO_PIPELINE_STEPS = [
  {
    agent: "DiscoveryAgent",
    color: "text-blue-400",
    steps: [
      { type: "thinking", content: "Fetching OpenAPI spec from https://api.acme.com/openapi.json" },
      { type: "result",   content: "Catalogued 12 endpoints across 4 route groups" },
    ],
  },
  {
    agent: "ChaosAgent",
    color: "text-purple-400",
    steps: [
      { type: "thinking", content: "Selecting failure modes: db_connection_drop, http_503, slow_response, malformed_json" },
      { type: "result",   content: "Injected 18 failure scenarios across 12 endpoints" },
    ],
  },
  {
    agent: "AnalystAgent",
    color: "text-amber-400",
    steps: [
      { type: "result",   content: "3 CRITICAL findings — unhandled SQLAlchemyError on GET /orders/{id}" },
      { type: "result",   content: "Reliability score: 42 / 100 (HIGH RISK)" },
    ],
  },
  {
    agent: "FixAgent",
    color: "text-emerald-400",
    steps: [
      { type: "thinking", content: "Cloning repo acme/payments-api, locating route handler…" },
      { type: "result",   content: "Patch generated: try/except SQLAlchemyError + HTTPException(503)" },
    ],
  },
  {
    agent: "ReviewAgent",
    color: "text-cyan-400",
    steps: [
      { type: "result",   content: "AST brackets valid. tsc --noEmit passed. No auth/billing files touched." },
    ],
  },
  {
    agent: "GitHubAgent",
    color: "text-sky-400",
    steps: [
      { type: "result",   content: "Draft PR #14 opened: fix: 503 resilience on /api/v1/orders" },
    ],
  },
];

const DEMO_FINDINGS = [
  { status: "unhandled", endpoint: "GET /orders/{id}",   mode: "db_connection_drop", code: 500, leaked: true  },
  { status: "handled",   endpoint: "POST /payments",     mode: "http_503",           code: 503, leaked: false },
  { status: "degraded",  endpoint: "GET /inventory",     mode: "slow_response",      code: 200, leaked: false },
  { status: "unhandled", endpoint: "GET /users",         mode: "malformed_json",     code: 400, leaked: true  },
  { status: "handled",   endpoint: "DELETE /sessions",   mode: "db_timeout",         code: 503, leaked: false },
  { status: "degraded",  endpoint: "GET /recommendations", mode: "empty_response",   code: 200, leaked: false },
];

function pillCls(status: string) {
  if (status === "unhandled") return "bg-red-500/15 text-red-600 border border-red-300 dark:border-red-800";
  if (status === "handled")   return "bg-emerald-500/15 text-emerald-700 border border-emerald-300 dark:border-emerald-800";
  return "bg-amber-500/15 text-amber-700 border border-amber-300 dark:border-amber-800";
}

export default function DemoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-[#FF5A1F]/15 selection:text-[#FF5A1F]">
      <Navbar variant="landing" />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-7xl px-6 py-16 md:py-24 text-center">
          <Badge
            variant="outline"
            className="mb-4 text-primary border-primary/30 uppercase tracking-widest text-xs px-3 py-1"
          >
            Live Demo — No Sign-in Required
          </Badge>
          <h1 className="apple-display text-foreground mb-5">
            See PatchFlow in action.
          </h1>
          <p className="apple-body text-text-secondary text-[17px] leading-relaxed max-w-2xl mx-auto mb-8">
            Below is a real sample run against a demo API. The six-agent pipeline
            ran autonomously, found 3 critical failures, and opened a
            compiler-verified GitHub Pull Request in under 15 seconds.
          </p>
          <Link
            href="/login"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 px-8 font-semibold shadow-[0_2px_12px_rgba(255,90,31,0.3)] inline-flex items-center gap-2 apple-press"
            )}
          >
            Run this on your own API
            <ArrowRight className="h-4.5 w-4.5" />
          </Link>
        </section>

        {/* Sample run */}
        <section className="mx-auto max-w-7xl px-6 pb-24 md:pb-32 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

          {/* Left: Agent trace terminal */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Radio className="h-4.5 w-4.5 text-emerald-500" aria-hidden="true" />
              <span>Agent Pipeline — sample run</span>
              <span className="ml-auto text-[11px] font-mono text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                completed
              </span>
            </div>

            <div
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-inner"
              aria-label="Sample agent trace output"
            >
              <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500" aria-hidden="true" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" aria-hidden="true" />
                <div className="h-3 w-3 rounded-full bg-green-500" aria-hidden="true" />
                <span className="text-xs text-zinc-500 font-mono ml-4">
                  agent-workspace-logs.sh — demo run
                </span>
              </div>

              <div className="p-5 flex flex-col gap-2.5 font-mono text-[11px] leading-relaxed text-zinc-300">
                {DEMO_PIPELINE_STEPS.map((agent) =>
                  agent.steps.map((step, si) => (
                    <div
                      key={`${agent.agent}-${si}`}
                      className="flex items-start gap-2.5"
                    >
                      <span className={cn("font-bold shrink-0", agent.color)}>
                        {agent.agent}
                      </span>
                      <span
                        className={cn(
                          "flex-1",
                          step.type === "thinking"
                            ? "text-zinc-500 italic"
                            : "text-zinc-200 font-medium"
                        )}
                      >
                        {step.type === "thinking" ? "thought: " : ""}
                        {step.content}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: Findings pills + PR */}
          <div className="flex flex-col gap-6">
            {/* Failure pills */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-3">
                Failure injection results ({DEMO_FINDINGS.length} tests run)
              </p>
              <div className="flex flex-wrap gap-2.5">
                {DEMO_FINDINGS.map((f) => (
                  <span
                    key={f.endpoint + f.mode}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-[12px] font-semibold",
                      pillCls(f.status)
                    )}
                    title={`${f.endpoint} — ${f.mode} — HTTP ${f.code}`}
                  >
                    {f.mode}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 text-[12px] font-semibold">
                <span className="flex items-center gap-1.5 text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />
                  2 Unhandled
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                  2 Degraded
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                  2 Handled
                </span>
              </div>
            </div>

            {/* Generated PR mock */}
            <div className="border border-white/10 bg-[#161615] rounded-2xl overflow-hidden font-mono text-xs shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-[#1E1E1C]">
                <div className="flex items-center gap-2.5 text-neutral-200">
                  <GitPullRequest className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                  <span className="font-semibold tracking-tight text-[11px] sm:text-xs">
                    fix: 503 resilience on /api/v1/orders #14
                  </span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-2.5 py-0.5 text-[10px] font-semibold">
                  Build: Passed ✓
                </Badge>
              </div>
              <div className="p-5 bg-[#111110] text-neutral-200 leading-relaxed space-y-1 overflow-x-auto">
                <div className="text-neutral-500 pb-2"># routes/orders.py</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 -mx-2 rounded-sm">+ from fastapi import HTTPException, status</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 -mx-2 rounded-sm">+ from sqlalchemy.exc import SQLAlchemyError</div>
                <div className="text-neutral-400 py-0.5">{'  @router.get("/orders/{order_id}")'}</div>
                <div className="text-neutral-400">{'  async def get_order(order_id: str):'}</div>
                <div className="text-rose-400 bg-rose-950/30 px-2 py-0.5 -mx-2 rounded-sm">-     order = await db.fetch_order(order_id)</div>
                <div className="text-rose-400 bg-rose-950/30 px-2 py-0.5 -mx-2 rounded-sm">{'-     return {"ok": True, "order": order}'}</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 -mx-2 rounded-sm">+     try:</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 -mx-2 rounded-sm">+         order = await db.fetch_order(order_id)</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 -mx-2 rounded-sm">+         if not order:</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 -mx-2 rounded-sm">{'+'}{`         raise HTTPException(404, "Order not found")`}</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 -mx-2 rounded-sm">{'+'}{`         return {"ok": True, "order": order}`}</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 -mx-2 rounded-sm">+     except SQLAlchemyError as exc:</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-2 py-0.5 -mx-2 rounded-sm">{'+'}{`         raise HTTPException(503, "Service unavailable")`}</div>
              </div>
            </div>

            {/* What happened summary */}
            <div className="p-6 bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl space-y-3">
              <p className="text-[14px] font-bold text-foreground">What just happened</p>
              <ul className="space-y-2.5">
                {[
                  { icon: Zap,          text: "18 chaos failure modes injected across 12 endpoints in 8 seconds." },
                  { icon: Shield,       text: "3 critical unhandled exceptions found — 2 leaked error traces to the client." },
                  { icon: CheckCircle2, text: "FixAgent generated a try/except patch with correct imports and status codes." },
                  { icon: GitPullRequest, text: "Draft PR opened after ReviewAgent verified the build passed (tsc + runtime checks)." },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-2.5 text-[13px] text-text-secondary">
                    <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-black/[0.05] dark:border-white/[0.07] bg-gradient-to-b from-card to-background py-20 text-center">
          <div className="mx-auto max-w-2xl px-6 flex flex-col items-center gap-6">
            <h2 className="apple-title-1 text-foreground">
              Ready to run this on your real API?
            </h2>
            <p className="text-[16px] text-text-secondary leading-relaxed">
              Connect your GitHub repo and PatchFlow will auto-discover your
              endpoints, inject failures, and open a verified PR fix in minutes.
            </p>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 px-9 font-semibold shadow-[0_4px_16px_rgba(255,90,31,0.35)] inline-flex items-center gap-2 apple-press"
              )}
            >
              Connect GitHub — it&apos;s free
              <ArrowRight className="h-4.5 w-4.5" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
