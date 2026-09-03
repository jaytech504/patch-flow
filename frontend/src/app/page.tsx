import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Zap,
  GitPullRequest,
  Search,
  BarChart3,
  Lock,
  ArrowRight,
  Terminal,
  Activity,
  CheckCircle2,
  Radio,
  Cpu,
  Bug,
  Sparkles,
  Flame,
  FileCode2,
  Layers,
  Server,
  RefreshCw,
  Check,
} from "lucide-react";
import { TerminalAnimation } from "@/components/terminal-animation";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <Navbar variant="landing" />

      <main className="flex-1">
        {/* 1. Hero Section */}
        <section className="mx-auto max-w-7xl px-6 pt-4 pb-14 md:pt-6 md:pb-20 lg:pt-8 lg:pb-24 animate-fade-in-up">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="flex flex-col gap-6 max-w-2xl">

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.1]">
                Autonomous API Resilience. <br />
                <span className="text-primary">From Chaos to Merged PRs.</span>
              </h1>

              <p className="text-lg md:text-xl text-text-secondary leading-relaxed font-medium">
                The dual-engine reliability platform for backend APIs and microservices. Proactively stress-test endpoints with 18+ chaos failure modes and monitor production crashes in real-time. PatchFlow autonomously writes, compiler-verifies, and opens GitHub Pull Requests in minutes.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "w-full sm:w-auto h-12 px-8 font-semibold shadow-sm hover:shadow-md transition-shadow flex items-center justify-center gap-2"
                  )}
                >
                  <span>Connect Your Repository</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#dual-engine"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-full sm:w-auto h-12 px-8 font-medium bg-card border-border-strong text-foreground hover:bg-muted transition-colors"
                  )}
                >
                  How It Works
                </Link>
              </div>

              <div className="flex items-center gap-6 text-xs text-text-secondary font-mono pt-2">
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span>FastAPI, Django, Express & Spring Boot</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span>Autonomous GitHub PRs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span>Zero-Config SDK</span>
                </div>
              </div>
            </div>

            <div className="w-full relative animate-fade-in animate-delay-200">
              <TerminalAnimation />
            </div>
          </div>
        </section>

        {/* Framework & Integration Cloud */}
        <section className="border-y border-border bg-muted/60 py-10">
          <div className="mx-auto max-w-7xl px-6 flex flex-col items-center">
            <p className="text-xs font-semibold text-text-secondary mb-6 uppercase tracking-widest">
              Purpose-Built for Modern Backend Frameworks
            </p>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-14 text-foreground/75 font-semibold text-sm md:text-base">
              <div className="flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /> FastAPI (Python)</div>
              <div className="flex items-center gap-2"><Server className="h-4 w-4 text-primary" /> Django & DRF</div>
              <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Express.js (Node.js)</div>
              <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Spring Boot (Java)</div>
              <div className="flex items-center gap-2"><Flame className="h-4 w-4 text-primary" /> Flask</div>
              <div className="flex items-center gap-2"><GitPullRequest className="h-4 w-4 text-primary" /> GitHub Pull Requests</div>
            </div>
          </div>
        </section>

        {/* 2. Dual Engine Section */}
        <section id="dual-engine" className="mx-auto max-w-7xl px-6 py-28 md:py-36">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30 uppercase tracking-widest text-xs px-3 py-1">
              Dual-Engine Platform
            </Badge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-6">
              Total reliability from pre-deploy to production.
            </h2>
            <p className="text-lg md:text-xl text-text-secondary font-medium">
              PatchFlow protects your software with proactive chaos engineering before deployment and reactive incident auto-patching in production.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Engine 1: Proactive Chaos Testing */}
            <div className="relative flex flex-col p-8 md:p-10 bg-card border border-border-strong rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-primary">Engine 01 • Proactive</span>
                    <h3 className="text-2xl font-bold text-foreground tracking-tight">Autonomous Chaos Testing</h3>
                  </div>
                </div>
                <div className="w-3 h-3 rounded-full bg-primary"></div>
              </div>

              <p className="text-base text-text-secondary leading-relaxed font-medium mb-8">
                Stress-test your backend APIs before shipping. PatchFlow automatically discovers endpoints from OpenAPI specs, Postman collections, or repo source code, injects 18+ aggressive failure modes, and opens consolidated Pull Requests with resilient error handling.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-foreground">Auto-discovery from OpenAPI URL, Postman collection, or repository files</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-foreground">18 synthetic failure modes across latency, socket timeouts, and DB drops</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-foreground">Reliability score (0-100) with security leakage and exception audits</span>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                <span className="text-xs font-mono text-text-secondary">Scan Modes: OpenAPI, Custom, Manual</span>
                <Link href="/sessions/new" className="text-sm font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Launch Chaos Test <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Engine 2: Real-time Incident Auto-Patching */}
            <div className="relative flex flex-col p-8 md:p-10 bg-card border border-border-strong rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 group">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                    <Flame className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-semibold uppercase tracking-wider text-red-500">Engine 02 • Reactive</span>
                    <h3 className="text-2xl font-bold text-foreground tracking-tight">Production Incident Auto-Patching</h3>
                  </div>
                </div>
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              </div>

              <p className="text-base text-text-secondary leading-relaxed font-medium mb-8">
                Install our lightweight SDK in your Node.js or Python backend. When an unhandled crash or exception reaches threshold limits, PatchFlow activates AI agents to clone your repo, generate a surgical fix, and open a ready-to-merge GitHub Pull Request.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-foreground">Zero-config SDK with automatic stack frame extraction and deduplication</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-foreground">AI agents generate AST-compliant error handlers & framework imports</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-sm font-medium text-foreground">Pre-merge build verification with Python, Node, and TypeScript checks</span>
                </div>
              </div>

              <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                <span className="text-xs font-mono text-text-secondary">Latency to Draft PR: &lt; 15 seconds</span>
                <Link href="/sites" className="text-sm font-semibold text-primary inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  View Monitored Sites <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Autonomous Pipeline Steps */}
        <section id="pipeline" className="border-t border-border bg-card py-28 md:py-36">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <Badge variant="outline" className="mb-4 text-primary border-primary/30 uppercase tracking-widest text-xs px-3 py-1">
                Autonomous Pipeline
              </Badge>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-6">
                From failure injection to merged PR.
              </h2>
              <p className="text-lg text-text-secondary font-medium">
                Here is what happens behind the scenes in the seconds following a detected API failure.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              {/* Step 1 */}
              <div className="flex flex-col p-6 bg-background border border-border rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-mono mb-5">
                  01
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">Discovery & Failure Injection</h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Discovers backend endpoints from OpenAPI or collections and injects aggressive synthetic failure modes into the API.
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col p-6 bg-background border border-border rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-mono mb-5">
                  02
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">FixAgent (Gemma AI)</h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  FixAgent clones the repo, programmatically locates the route handler, and generates a framework-tailored resilience patch.
                </p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col p-6 bg-background border border-border rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-mono mb-5">
                  03
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">Review & Build Verification</h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  ReviewAgent performs senior code review, verifies AST brackets, and runs compile checks before pushing changes.
                </p>
              </div>

              {/* Step 4 */}
              <div className="flex flex-col p-6 bg-background border border-border rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold font-mono mb-5">
                  04
                </div>
                <h4 className="text-lg font-bold text-foreground mb-2">GitHubAgent Draft PR</h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Opens a Pull Request with a consolidated branch, detailed failure mode descriptions, and verified diffs ready to merge.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Live PR & Diff Showcase */}
        <section className="bg-[#0c0c0b] text-white py-28 md:py-36 border-t border-white/10">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-6 uppercase tracking-widest text-xs px-3 py-1">
                  Compiler & Build Verified
                </Badge>
                <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6 text-white leading-tight">
                  High-quality patches you can merge with confidence.
                </h2>
                <p className="text-lg text-neutral-400 font-medium mb-8 leading-relaxed">
                  No hallucinated imports or broken syntax. Every fix is applied directly to a clean clone of your codebase and tested against the language runtime before creating the PR.
                </p>
                <ul className="flex flex-col gap-4">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-base font-medium text-neutral-200">Auto-imports missing symbols (<code className="text-primary font-mono text-xs">HTTPException</code>, <code className="text-primary font-mono text-xs">JsonResponse</code>, <code className="text-primary font-mono text-xs">ResponseEntity</code>)</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-base font-medium text-neutral-200">Pre-merge build verification badge on every pull request</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-base font-medium text-neutral-200">Safety guardrails blocklist sensitive auth & billing files</span>
                  </li>
                </ul>
              </div>

              {/* Code diff mock */}
              <div className="w-full border border-white/15 bg-[#141413] rounded-xl shadow-2xl overflow-hidden font-mono text-xs sm:text-sm">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1e1e1d]">
                  <div className="flex items-center gap-2 text-neutral-200">
                    <GitPullRequest className="h-4 w-4 text-emerald-400" />
                    <span className="font-medium">fix: 503 resilience on /api/v1/orders #14</span>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded px-2 py-0.5 text-xs font-semibold">
                    Build: Passed
                  </Badge>
                </div>
                <div className="p-6 bg-[#0c0c0b] text-neutral-200 leading-relaxed overflow-x-auto space-y-1">
                  <div className="text-neutral-500 pb-2">{"# routes/orders.py"}</div>
                  <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 -mx-2">{"+ from fastapi import HTTPException, status"}</div>
                  <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 -mx-2">{"+ from sqlalchemy.exc import SQLAlchemyError"}</div>
                  <div className="text-neutral-400 py-1">{'  @router.get("/orders/{order_id}")'}</div>
                  <div className="text-neutral-400">{'  async def get_order(order_id: str):'}</div>
                  <div className="text-rose-400 bg-rose-950/20 px-2 py-0.5 -mx-2">{"-     order = await db.fetch_order(order_id)"}</div>
                  <div className="text-rose-400 bg-rose-950/20 px-2 py-0.5 -mx-2">{'-     return {"ok": True, "order": order}'}</div>
                  <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 -mx-2">{"+     try:"}</div>
                  <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 -mx-2">{"+         order = await db.fetch_order(order_id)"}</div>
                  <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 -mx-2">{"+         if not order:"}</div>
                  <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 -mx-2">{'+             raise HTTPException(status_code=404, detail="Order not found")'}</div>
                  <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 -mx-2">{'+         return {"ok": True, "order": order}'}</div>
                  <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 -mx-2">{"+     except SQLAlchemyError as exc:"}</div>
                  <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 -mx-2">{'+         logger.error(f"Database error fetching order {order_id}: {exc}")'}</div>
                  <div className="text-emerald-400 bg-emerald-950/20 px-2 py-0.5 -mx-2">{'+         raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service unavailable")'}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Features Grid */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-28 md:py-36">
          <div className="max-w-3xl mb-20">
            <Badge variant="outline" className="mb-4 text-primary border-primary/30 uppercase tracking-widest text-xs px-3 py-1">
              Core Capabilities
            </Badge>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-6">
              Engineered for developer peace of mind.
            </h2>
            <p className="text-lg md:text-xl text-text-secondary font-medium">
              A complete toolkit designed to eliminate emergency debugging sessions and maintain 99.99% uptime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex flex-col p-8 bg-card border border-border hover:border-border-strong rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
              <Radio className="h-6 w-6 text-primary mb-5" />
              <h3 className="text-xl font-bold text-foreground mb-2.5 tracking-tight">Real-Time Crash Ingestion</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Lightweight SDK for Node and Python catches unhandled exceptions, groups identical occurrences, and triggers auto-patching thresholds.
              </p>
            </div>

            <div className="flex flex-col p-8 bg-card border border-border hover:border-border-strong rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
              <Sparkles className="h-6 w-6 text-primary mb-5" />
              <h3 className="text-xl font-bold text-foreground mb-2.5 tracking-tight">Gemma AI Fix Generation</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Specialized code models analyze the exact stack trace, parse surrounding AST context, and write production-grade error handling.
              </p>
            </div>

            <div className="flex flex-col p-8 bg-card border border-border hover:border-border-strong rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
              <Shield className="h-6 w-6 text-primary mb-5" />
              <h3 className="text-xl font-bold text-foreground mb-2.5 tracking-tight">Pre-Merge Build Checks</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Runs real TypeScript compiler (<code className="font-mono text-xs">tsc</code>) and Node checks before PR creation so broken code never lands.
              </p>
            </div>

            <div className="flex flex-col p-8 bg-card border border-border hover:border-border-strong rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
              <Flame className="h-6 w-6 text-primary mb-5" />
              <h3 className="text-xl font-bold text-foreground mb-2.5 tracking-tight">18+ Chaos Failure Modes</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Injects network latency, corrupt payloads, database disconnects, and memory pressure to uncover silent failure modes.
              </p>
            </div>

            <div className="flex flex-col p-8 bg-card border border-border hover:border-border-strong rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
              <BarChart3 className="h-6 w-6 text-primary mb-5" />
              <h3 className="text-xl font-bold text-foreground mb-2.5 tracking-tight">Reliability Posture Score</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Actionable 0-100 reliability metrics with categorized breakdowns of security leakage, unhandled exceptions, and latency anomalies.
              </p>
            </div>

            <div className="flex flex-col p-8 bg-card border border-border hover:border-border-strong rounded-xl transition-all duration-200 shadow-sm hover:shadow-md">
              <Lock className="h-6 w-6 text-primary mb-5" />
              <h3 className="text-xl font-bold text-foreground mb-2.5 tracking-tight">Enterprise Safety Guardrails</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Automated blocklist protects payment and authentication routes. All error payloads are sanitized to prevent credential leakage.
              </p>
            </div>
          </div>
        </section>

        {/* 6. CTA Section */}
        <section className="border-t border-border bg-gradient-to-b from-card to-background py-28 md:py-36 text-center">
          <div className="mx-auto max-w-3xl px-6 flex flex-col items-center gap-8">
            <Badge variant="outline" className="text-primary border-primary/30 uppercase tracking-widest text-xs px-3 py-1">
              Start Free Today
            </Badge>
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
              Stop firefighting bugs at 2 AM.
            </h2>
            <p className="text-lg md:text-xl text-text-secondary font-medium">
              Put your API reliability and production incident response on autopilot. Connect your GitHub repository and protect your users in under 60 seconds.
            </p>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-14 px-10 text-lg font-bold shadow-md hover:shadow-xl transition-all group flex items-center gap-2"
              )}
            >
              <span>Get Started with PatchFlow</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
