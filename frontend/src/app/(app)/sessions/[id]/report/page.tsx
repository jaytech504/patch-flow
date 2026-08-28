"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, GitPullRequest, Copy, Check, ChevronDown,
  Loader2, FileCode2, AlertTriangle, ShieldAlert, Info,
  Lightbulb, XCircle, CheckCircle2, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL, WS_BASE_URL } from "@/lib/api-config";
import { authFetch } from "@/lib/auth-fetch";

// ── Types ────────────────────────────────────────────────────────────────────

interface Finding {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  evidence: string;
  affected_endpoints: string[];
  failure_modes: string[];
}

interface Fix {
  id: string;
  finding_title: string;
  affected_endpoints: string[];
  failure_modes: string[];
  severity: string;
  language: string;
  file_path: string;
  start_line: number | null;
  end_line: number | null;
  code_before: string;
  code_after: string;
  imports_needed: string[];
  unified_diff: string;
  explanation: string;
  status: string;
  fix_mode: "patch" | "recommendation";
  validation: Record<string, any>;
  review_status: string | null;
  review_issues: string[];
  skip_reason: string | null;
}

interface SkippedFix {
  finding_title: string;
  affected_endpoints: string[];
  file_path: string;
  status: string;
  skip_reason: string;
  review_issues: string[];
  validation: Record<string, any>;
}

interface PullRequest {
  id: string;
  number: string;
  title: string;
  fileChanged: string;
  status: "Open" | "Merged" | "Closed";
  url: string;
  branch: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function severityMeta(score: number) {
  if (score > 60) return { label: "HIGH RISK",     bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", color: "#DC2626" };
  if (score >= 30) return { label: "MODERATE RISK", bg: "bg-[#FFEDE3]", text: "text-[#E04E16]", color: "#E04E16" };
  return                   { label: "LOW RISK",     bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", color: "#16A34A" };
}

function findingBadge(sev: string) {
  switch (sev) {
    case "CRITICAL": return "bg-[#FEF2F2] text-[#DC2626]";
    case "HIGH":     return "bg-[#FFEDE3] text-[#E04E16]";
    case "MEDIUM":   return "bg-[#FFFBEB] text-[#D97706]";
    default:         return "bg-[#EFF6FF] text-[#2563EB]";
  }
}

function statusMeta(status: string, fixMode: string) {
  if (fixMode === "recommendation") return { label: "Recommendation", icon: Lightbulb,   cls: "bg-[#EFF6FF] text-[#2563EB]" };
  switch (status) {
    case "validated":         return { label: "Validated",       icon: CheckCircle2, cls: "bg-[#F0FDF4] text-[#16A34A]" };
    case "draft_pr_opened":   return { label: "PR Opened",       icon: GitPullRequest,cls: "bg-[#F3E8FF] text-[#7E22CE]" };
    case "validation_failed": return { label: "Validation Failed",icon: XCircle,     cls: "bg-[#FEF2F2] text-[#DC2626]" };
    case "needs_review":      return { label: "Needs Review",    icon: Clock,        cls: "bg-[#FFFBEB] text-[#D97706]" };
    case "pr_skipped":        return { label: "PR Skipped",      icon: XCircle,      cls: "bg-[#F3F2F0] text-[#6F6B66]" };
    default:                  return { label: "Generated",       icon: FileCode2,    cls: "bg-[#F3F2F0] text-[#6F6B66]" };
  }
}

// Parse a unified diff string into typed hunks for rendering
interface DiffLine { type: "add" | "remove" | "context" | "header"; text: string; }
function parseDiff(raw: string): DiffLine[] {
  if (!raw) return [];
  return raw.split("\n").map((line) => {
    if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("@@")) return { type: "header", text: line };
    if (line.startsWith("+")) return { type: "add",     text: line.slice(1) };
    if (line.startsWith("-")) return { type: "remove",  text: line.slice(1) };
    return { type: "context", text: line.startsWith(" ") ? line.slice(1) : line };
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DiffViewer({ raw }: { raw: string }) {
  const lines = parseDiff(raw);
  if (!lines.length) return null;
  return (
    <div className="rounded-[10px] border border-[#E7E5E2] overflow-hidden text-[12px] font-mono leading-relaxed">
      {lines.map((l, i) => {
        if (l.type === "header") return (
          <div key={i} className="px-4 py-[3px] bg-[#F3F2F0] text-[#6F6B66] text-[11px] select-none">{l.text}</div>
        );
        const bg =
          l.type === "add"    ? "bg-[#F0FDF4] text-green-900" :
          l.type === "remove" ? "bg-[#FEF2F2] text-red-900"   :
                                "bg-white text-[#374151]";
        const prefix =
          l.type === "add"    ? <span className="select-none text-green-600 mr-2 w-3 inline-block">+</span> :
          l.type === "remove" ? <span className="select-none text-red-500  mr-2 w-3 inline-block">-</span> :
                                <span className="select-none text-[#D1D5DB] mr-2 w-3 inline-block"> </span>;
        return (
          <div key={i} className={cn("px-4 py-[2px] whitespace-pre-wrap break-all", bg)}>
            {prefix}{l.text}
          </div>
        );
      })}
    </div>
  );
}

function ImportsBlock({ imports }: { imports: string[] }) {
  if (!imports.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-[700] text-[#A3A099] uppercase tracking-[0.04em]">Imports needed</span>
      <pre className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-[10px_14px] text-[12px] font-mono text-[#374151] overflow-x-auto">
        {imports.join("\n")}
      </pre>
    </div>
  );
}

function CopyButton({ id, text, copiedId, onCopy }: { id: string; text: string; copiedId: string | null; onCopy: (id: string, text: string) => void }) {
  const copied = copiedId === id;
  return (
    <button
      onClick={() => onCopy(id, text)}
      className={cn("text-[12px] flex items-center gap-1.5 transition-colors", copied ? "text-[#16A34A]" : "text-[#6F6B66] hover:text-[#111110]")}
    >
      {copied ? <><span>Copied</span><Check className="h-[12px] w-[12px]" /></> : <><Copy className="h-[12px] w-[12px]" /><span>Copy</span></>}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SessionReportPage() {
  const params = useParams();
  const sessionId = params?.id || "mock-id";

  const [loading, setLoading]         = useState(true);
  const [riskScore, setRiskScore]     = useState(0);
  const [summary, setSummary]         = useState("");
  const [findings, setFindings]       = useState<Finding[]>([]);
  const [fixes, setFixes]             = useState<Fix[]>([]);
  const [skippedFixes, setSkippedFixes] = useState<SkippedFix[]>([]);
  const [prs, setPrs]                 = useState<PullRequest[]>([]);
  const [hasRepo, setHasRepo]         = useState(true);

  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});
  const [expandedFixes, setExpandedFixes]       = useState<Record<string, boolean>>({});
  const [expandedSkipped, setExpandedSkipped]   = useState(false);
  const [fixView, setFixView]         = useState<Record<string, "diff" | "split">>({}); // per-fix view mode
  const [copiedId, setCopiedId]       = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("risk-score");

  const wsRef = useRef<WebSocket | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const idRes = await authFetch(`/api/reports/session/${sessionId}`);
        if (!idRes.ok) throw new Error("Report not found");
        const { report_id } = await idRes.json();

        const repRes = await authFetch(`/api/reports/${report_id}`);
        if (!repRes.ok) throw new Error("Failed to load report");
        const d = await repRes.json();

        setRiskScore(d.risk_score ?? 0);
        setSummary(d.summary ?? "");

        // Findings — normalise field names from backend
        const rawFindings: Finding[] = (d.all_findings ?? []).map((f: any, i: number) => ({
          id: f.id ?? `finding-${i}`,
          severity: (f.severity ?? "MEDIUM").toUpperCase(),
          title: f.title ?? "Unnamed finding",
          evidence: f.evidence ?? f.description ?? f.explanation ?? "",
          affected_endpoints: Array.isArray(f.affected_endpoints) ? f.affected_endpoints : (Array.isArray(f.endpoints) ? f.endpoints : []),
          failure_modes: Array.isArray(f.failure_modes) ? f.failure_modes : (Array.isArray(f.failures) ? f.failures : []),
        }));
        setFindings(rawFindings);
        if (rawFindings.length > 0) setExpandedFindings({ [rawFindings[0].id]: true });

        // Fixes from normalised API
        const rawFixes: Fix[] = (d.fixes ?? []).map((f: any, i: number) => ({
          id: `fix-${i}`,
          finding_title: f.finding_title ?? "",
          affected_endpoints: f.affected_endpoints ?? [],
          failure_modes: f.failure_modes ?? [],
          severity: f.severity ?? "",
          language: f.language ?? "python",
          file_path: f.file_path ?? "",
          start_line: f.start_line ?? null,
          end_line: f.end_line ?? null,
          code_before: f.code_before ?? "",
          code_after: f.code_after ?? "",
          imports_needed: f.imports_needed ?? [],
          unified_diff: f.unified_diff ?? "",
          explanation: f.explanation ?? "",
          status: f.status ?? "generated",
          fix_mode: f.fix_mode ?? "patch",
          validation: f.validation ?? {},
          review_status: f.review_status ?? null,
          review_issues: f.review_issues ?? [],
          skip_reason: f.skip_reason ?? null,
        }));
        setFixes(rawFixes);
        // Default: open first fix
        if (rawFixes.length > 0) setExpandedFixes({ [rawFixes[0].id]: true });
        // Default view mode per fix: diff when available, split otherwise
        const defaultViews: Record<string, "diff" | "split"> = {};
        rawFixes.forEach((f) => { defaultViews[f.id] = f.unified_diff ? "diff" : "split"; });
        setFixView(defaultViews);

        // Skipped fixes
        setSkippedFixes(d.skipped_fixes ?? []);

        // PRs + repo presence
        const sRes = await authFetch(`/api/sessions/${sessionId}`);
        if (sRes.ok) {
          const sd = await sRes.json();
          setHasRepo(!!sd.github_repo);
          if (Array.isArray(sd.pull_requests)) {
            setPrs(sd.pull_requests.map((pr: any, i: number) => ({
              id: pr.id ?? `pr-${i}`,
              number: pr.pr_number ? `#${pr.pr_number}` : "",
              title: pr.pr_title ?? "",
              fileChanged: pr.files_changed?.[0] ?? "",
              status: pr.status === "merged" ? "Merged" : pr.status === "closed" ? "Closed" : "Open",
              url: pr.pr_url ?? "#",
              branch: pr.branch_name ?? "",
            })));
          }
        }
      } catch (err) {
        console.error("Report load failed:", err);
      } finally {
        setLoading(false);
      }

      // WebSocket for live PR status updates
      const ws = new WebSocket(`${WS_BASE_URL}/ws/${sessionId}`);
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "pr_status_updated") {
            const { pr_number, status } = msg.payload;
            setPrs((prev) => prev.map((pr) =>
              pr.number === `#${pr_number}` || pr.number === String(pr_number)
                ? { ...pr, status: status === "merged" ? "Merged" : status === "closed" ? "Closed" : "Open" }
                : pr
            ));
          }
        } catch {}
      };
    };

    load();
    return () => { wsRef.current?.close(); };
  }, [sessionId]);

  // ── Scroll spy ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const ids = ["risk-score", "findings", "fixes", "pull-requests", "skipped"];
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActiveSection(e.target.id); }),
      { rootMargin: "-20% 0px -60% 0px", threshold: 0.1 }
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [loading, findings.length, fixes.length, prs.length, skippedFixes.length]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleFinding = (id: string) => setExpandedFindings((p) => ({ ...p, [id]: !p[id] }));
  const toggleFix     = (id: string) => setExpandedFixes((p)   => ({ ...p, [id]: !p[id] }));
  const handleCopy    = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 120, behavior: "smooth" });
  };

  // ── Finding → fix linkage ─────────────────────────────────────────────────
  // For each finding, collect fixes that reference it by title or by matching endpoint
  function fixesForFinding(finding: Finding): Fix[] {
    return fixes.filter((fx) => {
      if (fx.finding_title && finding.title && fx.finding_title.toLowerCase() === finding.title.toLowerCase()) return true;
      return finding.affected_endpoints.some((ep) => fx.affected_endpoints.includes(ep));
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const sev     = severityMeta(riskScore);
  const navItems = [
    { id: "risk-score",    label: "Overview" },
    { id: "findings",      label: `Findings (${findings.length})` },
    { id: "fixes",         label: `Fixes (${fixes.length})` },
    { id: "pull-requests", label: `PRs (${prs.length})` },
    ...(skippedFixes.length > 0 ? [{ id: "skipped", label: `Skipped (${skippedFixes.length})` }] : []),
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 flex-1 min-h-[calc(100vh-4rem)] bg-[#FAFAF9]">
        <Loader2 className="h-8 w-8 text-[#FF5A1F] animate-spin" />
        <p className="text-[14px] text-[#A3A099] font-[500]">Fetching reliability report…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF9] w-full">
      <div className="mx-auto max-w-5xl px-6 py-12 w-full flex flex-col">

        {/* Header */}
        <div className="pb-6 border-b border-[#E7E5E2] flex flex-col gap-3">
          <Link href="/dashboard" className="text-[13px] text-[#6F6B66] hover:text-[#111110] transition-colors flex items-center gap-1.5 w-fit">
            <ArrowLeft className="h-[14px] w-[14px]" /><span>Dashboard</span>
          </Link>
          <div>
            <h1 className="text-[32px] font-[800] text-[#111110] leading-tight">Reliability Report</h1>
            <p className="text-[14px] text-[#6F6B66] mt-1">{findings.length} findings · {fixes.length} fixes generated</p>
          </div>
        </div>

        {/* Sticky nav */}
        <div className="sticky top-0 z-40 bg-[#FAFAF9]/90 backdrop-blur-md border-b border-[#E7E5E2] flex items-center gap-5 pt-1 mb-8 overflow-x-auto">
          {navItems.map(({ id, label }) => (
            <button key={id} onClick={() => scrollTo(id)}
              className={cn("py-[12px] text-[13px] font-[500] border-b-[2px] transition-colors whitespace-nowrap",
                activeSection === id ? "text-[#111110] border-[#FF5A1F]" : "text-[#6F6B66] border-transparent hover:text-[#111110]")}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-[40px]">

          {/* ── 1. Risk Score ─────────────────────────────────────────────── */}
          <motion.section id="risk-score" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }} className="scroll-mt-[120px]">
            <div className="bg-white border border-[#E7E5E2] rounded-[14px] p-[22px] flex flex-col sm:flex-row gap-[20px]">
              <div className="flex flex-col flex-shrink-0 gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-[40px] font-[800] leading-none" style={{ color: sev.color }}>{riskScore}</span>
                  <span className="text-[16px] font-[600] text-[#A3A099]">/100</span>
                </div>
                <span className={cn("text-[11px] font-[700] uppercase tracking-[0.04em] px-[10px] py-[4px] rounded-full self-start", sev.bg, sev.text)}>
                  {sev.label}
                </span>
              </div>
              <div className="flex-1 flex flex-col gap-3 justify-center">
                <p className="text-[14px] text-[#111110] leading-relaxed">{summary || "No summary available."}</p>
                {!hasRepo && (
                  <div className="flex items-start gap-2 p-[10px_14px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[8px] text-[13px] text-[#1D4ED8]">
                    <Info className="h-[15px] w-[15px] shrink-0 mt-[1px]" />
                    <span>No repository was connected — fixes are <strong>recommendations</strong> showing the correct pattern to apply, not committed code changes.</span>
                  </div>
                )}
              </div>
            </div>
          </motion.section>

          {/* ── 2. Findings ───────────────────────────────────────────────── */}
          <motion.section id="findings" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }} className="scroll-mt-[120px] flex flex-col gap-4">
            <h2 className="text-[18px] font-[700] text-[#111110] tracking-tight">Findings</h2>
            {findings.length === 0 && <p className="text-[14px] text-[#A3A099]">No findings recorded.</p>}
            <div className="flex flex-col gap-3">
              {findings.map((f, i) => {
                const isOpen    = !!expandedFindings[f.id];
                const linked    = fixesForFinding(f);
                return (
                  <motion.div key={f.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.3 }}
                    className="bg-white border border-[#E7E5E2] rounded-[14px] overflow-hidden hover:border-[#D4D1CC] transition-colors">
                    <div onClick={() => toggleFinding(f.id)} className="flex items-center justify-between p-[18px_20px] cursor-pointer select-none">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("text-[11px] font-[700] uppercase px-[10px] py-[4px] rounded-full shrink-0", findingBadge(f.severity))}>{f.severity}</span>
                        <span className="font-[600] text-[15px] text-[#111110] truncate">{f.title}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        {linked.length > 0 && (
                          <span className="text-[11px] font-[600] text-[#6F6B66] bg-[#F3F2F0] px-[8px] py-[3px] rounded-full">{linked.length} fix{linked.length > 1 ? "es" : ""}</span>
                        )}
                        <ChevronDown className={cn("h-[18px] w-[18px] text-[#A3A099] transition-transform duration-300", isOpen && "rotate-180")} />
                      </div>
                    </div>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                          <div className="px-[20px] pb-[20px] flex flex-col gap-4 border-t border-[#F3F2F0] pt-[16px]">
                            {f.evidence && <p className="text-[14px] text-[#6F6B66] leading-relaxed">{f.evidence}</p>}
                            {f.affected_endpoints.length > 0 && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-[700] text-[#A3A099] uppercase tracking-[0.04em]">Affected Endpoints</span>
                                <div className="flex flex-wrap gap-2">
                                  {f.affected_endpoints.map((ep) => (
                                    <span key={ep} className="bg-[#F8FAFC] border border-[#E2E8F0] text-[12px] font-mono px-[8px] py-[2px] rounded-[6px] text-[#111110]">{ep}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {f.failure_modes.length > 0 && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-[700] text-[#A3A099] uppercase tracking-[0.04em]">Failure Modes</span>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#6F6B66]">
                                  {f.failure_modes.map((m, mi) => (
                                    <span key={m}>{m}{mi < f.failure_modes.length - 1 && <span className="ml-3 text-[#D4D1CC]">·</span>}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {linked.length > 0 && (
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-[700] text-[#A3A099] uppercase tracking-[0.04em]">Related Fixes</span>
                                <div className="flex flex-col gap-1">
                                  {linked.map((fx) => {
                                    const sm = statusMeta(fx.status, fx.fix_mode);
                                    const Icon = sm.icon;
                                    return (
                                      <button key={fx.id} onClick={(e) => { e.stopPropagation(); setExpandedFixes((p) => ({ ...p, [fx.id]: true })); scrollTo("fixes"); }}
                                        className="flex items-center gap-2 text-[13px] text-[#2563EB] hover:text-[#1D4ED8] transition-colors text-left">
                                        <Icon className="h-[13px] w-[13px] shrink-0" />
                                        <span className="underline underline-offset-2">{fx.finding_title || fx.affected_endpoints.join(", ")}</span>
                                        <span className={cn("text-[11px] font-[600] px-[7px] py-[2px] rounded-full", sm.cls)}>{sm.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* ── 3. Fixes ──────────────────────────────────────────────────── */}
          <motion.section id="fixes" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }} className="scroll-mt-[120px] flex flex-col gap-4">
            <h2 className="text-[18px] font-[700] text-[#111110] tracking-tight">Fixes</h2>
            {fixes.length === 0 && <p className="text-[14px] text-[#A3A099]">No fixes generated.</p>}
            <div className="flex flex-col gap-4">
              {fixes.map((fix, i) => {
                const isOpen = !!expandedFixes[fix.id];
                const sm     = statusMeta(fix.status, fix.fix_mode);
                const Icon   = sm.icon;
                const view   = fixView[fix.id] ?? (fix.unified_diff ? "diff" : "split");
                const isRec  = fix.fix_mode === "recommendation";

                return (
                  <motion.div key={fix.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.3 }}
                    className="bg-white border border-[#E7E5E2] rounded-[14px] overflow-hidden hover:border-[#D4D1CC] transition-colors">

                    {/* Fix header row */}
                    <div onClick={() => toggleFix(fix.id)} className="flex items-center justify-between p-[18px_20px] cursor-pointer select-none">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn("text-[11px] font-[700] uppercase px-[10px] py-[4px] rounded-full shrink-0", findingBadge(fix.severity))}>{fix.severity || "—"}</span>
                        <span className="font-[600] text-[15px] text-[#111110] truncate">{fix.finding_title || fix.affected_endpoints.join(", ") || "Fix"}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className={cn("flex items-center gap-1 text-[11px] font-[600] px-[8px] py-[3px] rounded-full", sm.cls)}>
                          <Icon className="h-[11px] w-[11px]" />{sm.label}
                        </span>
                        <ChevronDown className={cn("h-[18px] w-[18px] text-[#A3A099] transition-transform duration-300", isOpen && "rotate-180")} />
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                          <div className="px-[20px] pb-[24px] flex flex-col gap-5 border-t border-[#F3F2F0] pt-[18px]">

                            {/* Recommendation banner */}
                            {isRec && (
                              <div className="flex items-start gap-2 p-[10px_14px] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[8px] text-[13px] text-[#1D4ED8]">
                                <Lightbulb className="h-[15px] w-[15px] shrink-0 mt-[1px]" />
                                <span>No repository was connected. This is a framework-specific recommendation — copy the pattern into your codebase and adapt the function names.</span>
                              </div>
                            )}

                            {/* Meta row: file location, affected endpoints */}
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[#6F6B66]">
                              {fix.file_path && (
                                <div className="flex items-center gap-1.5">
                                  <FileCode2 className="h-[13px] w-[13px] shrink-0" />
                                  <span className="font-mono">{fix.file_path}{fix.start_line ? `:${fix.start_line}–${fix.end_line}` : ""}</span>
                                </div>
                              )}
                              {fix.affected_endpoints.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {fix.affected_endpoints.map((ep) => (
                                    <span key={ep} className="font-mono bg-[#F8FAFC] border border-[#E2E8F0] px-[7px] py-[1px] rounded-[5px] text-[#374151]">{ep}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Explanation */}
                            {fix.explanation && (
                              <p className="text-[14px] text-[#6F6B66] leading-relaxed">{fix.explanation}</p>
                            )}

                            {/* Imports */}
                            <ImportsBlock imports={fix.imports_needed} />

                            {/* View toggle + code */}
                            {(fix.code_before || fix.code_after || fix.unified_diff) && (
                              <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-[700] text-[#A3A099] uppercase tracking-[0.04em]">Code Change</span>
                                  <div className="flex items-center gap-1 bg-[#F3F2F0] rounded-[6px] p-[2px]">
                                    {fix.unified_diff && (
                                      <button onClick={() => setFixView((p) => ({ ...p, [fix.id]: "diff" }))}
                                        className={cn("text-[11px] font-[600] px-[8px] py-[3px] rounded-[5px] transition-colors", view === "diff" ? "bg-white text-[#111110] shadow-sm" : "text-[#6F6B66] hover:text-[#111110]")}>
                                        Diff
                                      </button>
                                    )}
                                    <button onClick={() => setFixView((p) => ({ ...p, [fix.id]: "split" }))}
                                      className={cn("text-[11px] font-[600] px-[8px] py-[3px] rounded-[5px] transition-colors", view === "split" ? "bg-white text-[#111110] shadow-sm" : "text-[#6F6B66] hover:text-[#111110]")}>
                                      Before / After
                                    </button>
                                  </div>
                                </div>

                                {view === "diff" && fix.unified_diff ? (
                                  <DiffViewer raw={fix.unified_diff} />
                                ) : (
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px]">
                                    {fix.code_before && (
                                      <div className="flex flex-col gap-2">
                                        <span className="text-[11px] font-[700] text-[#A3A099] uppercase tracking-[0.04em]">Before</span>
                                        <pre className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] p-[14px] font-mono text-[12px] leading-relaxed text-red-900 overflow-auto max-h-[280px]">
                                          <code>{fix.code_before}</code>
                                        </pre>
                                      </div>
                                    )}
                                    {fix.code_after && (
                                      <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between h-[20px]">
                                          <span className="text-[11px] font-[700] text-[#A3A099] uppercase tracking-[0.04em]">After</span>
                                          <CopyButton id={fix.id} text={fix.code_after} copiedId={copiedId} onCopy={handleCopy} />
                                        </div>
                                        <pre className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[10px] p-[14px] font-mono text-[12px] leading-relaxed text-green-900 overflow-auto max-h-[280px]">
                                          <code>{fix.code_after}</code>
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {view === "diff" && (
                                  <div className="flex justify-end">
                                    <CopyButton id={`${fix.id}-after`} text={fix.code_after} copiedId={copiedId} onCopy={handleCopy} />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Review issues (if any) */}
                            {fix.review_issues.length > 0 && (
                              <div className="flex flex-col gap-1.5 p-[10px_14px] bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px]">
                                <span className="text-[11px] font-[700] text-[#D97706] uppercase tracking-[0.04em]">Review Notes</span>
                                <ul className="list-disc list-inside text-[13px] text-[#92400E] space-y-0.5">
                                  {fix.review_issues.map((issue, ri) => <li key={ri}>{issue}</li>)}
                                </ul>
                              </div>
                            )}

                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* ── 4. Pull Requests ──────────────────────────────────────────── */}
          <motion.section id="pull-requests" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }} className="scroll-mt-[120px] flex flex-col gap-4">
            <h2 className="text-[18px] font-[700] text-[#111110] tracking-tight">Pull Requests</h2>
            {prs.length === 0 ? (
              <p className="text-[14px] text-[#A3A099]">
                {hasRepo ? "No pull requests opened yet." : "No repository was connected — PRs are not available for this scan."}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {prs.map((pr, i) => {
                  const badge = pr.status === "Merged" ? "bg-[#F3E8FF] text-[#7E22CE]" : pr.status === "Open" ? "bg-[#FFEDE3] text-[#E04E16]" : "bg-[#F3F2F0] text-[#6F6B66]";
                  return (
                    <motion.div key={pr.id} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.3 }}
                      className="bg-white border border-[#E7E5E2] rounded-[14px] p-[20px] hover:border-[#D4D1CC] transition-colors flex flex-col gap-3">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <GitPullRequest className={cn("h-[16px] w-[16px] shrink-0", pr.status === "Merged" ? "text-[#7E22CE]" : "text-[#111110]")} />
                          <span className="text-[15px] font-[600] text-[#111110] truncate">{pr.number} {pr.title}</span>
                        </div>
                        <span className={cn("text-[11px] font-[700] uppercase px-[10px] py-[4px] rounded-full shrink-0", badge)}>{pr.status}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-y-2 text-[13px] text-[#A3A099]">
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          {pr.fileChanged && <span>File: <span className="font-mono text-[#6F6B66]">{pr.fileChanged}</span></span>}
                          {pr.branch     && <span>Branch: <span className="font-mono text-[#6F6B66]">{pr.branch}</span></span>}
                        </div>
                        {pr.url && pr.url !== "#" && (
                          <a href={pr.url} target="_blank" rel="noreferrer" className="text-[13px] text-[#E04E16] hover:text-[#FF5A1F] transition-colors shrink-0">
                            View on GitHub →
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.section>

          {/* ── 5. Skipped Fixes ("Why no PR?") ───────────────────────────── */}
          {skippedFixes.length > 0 && (
            <motion.section id="skipped" initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }} className="scroll-mt-[120px] flex flex-col gap-4">
              <button onClick={() => setExpandedSkipped((p) => !p)}
                className="flex items-center justify-between w-full text-left group">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-[16px] w-[16px] text-[#D97706]" />
                  <h2 className="text-[18px] font-[700] text-[#111110] tracking-tight">Why no PR? ({skippedFixes.length})</h2>
                </div>
                <ChevronDown className={cn("h-[18px] w-[18px] text-[#A3A099] transition-transform duration-300", expandedSkipped && "rotate-180")} />
              </button>
              <p className="text-[14px] text-[#6F6B66] -mt-2">
                These fixes were blocked before reaching a pull request. Each entry explains why.
              </p>
              <AnimatePresence initial={false}>
                {expandedSkipped && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                    <div className="flex flex-col gap-3 pt-1">
                      {skippedFixes.map((sf, i) => {
                        const statusLabel =
                          sf.status === "validation_failed" ? "Validation Failed" :
                          sf.status === "needs_review"      ? "Needs Review"      : "PR Skipped";
                        const statusCls =
                          sf.status === "validation_failed" ? "bg-[#FEF2F2] text-[#DC2626]" :
                          sf.status === "needs_review"      ? "bg-[#FFFBEB] text-[#D97706]" : "bg-[#F3F2F0] text-[#6F6B66]";
                        return (
                          <div key={i} className="bg-white border border-[#E7E5E2] rounded-[12px] p-[16px_20px] flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="font-[600] text-[14px] text-[#111110] truncate">{sf.finding_title || "Unnamed fix"}</span>
                                {sf.file_path && <span className="font-mono text-[12px] text-[#6F6B66]">{sf.file_path}</span>}
                              </div>
                              <span className={cn("text-[11px] font-[700] uppercase px-[8px] py-[3px] rounded-full shrink-0", statusCls)}>{statusLabel}</span>
                            </div>
                            {sf.affected_endpoints.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {sf.affected_endpoints.map((ep) => (
                                  <span key={ep} className="font-mono text-[12px] bg-[#F8FAFC] border border-[#E2E8F0] px-[7px] py-[1px] rounded-[5px] text-[#374151]">{ep}</span>
                                ))}
                              </div>
                            )}
                            {sf.skip_reason && (
                              <div className="flex items-start gap-2 text-[13px] text-[#6F6B66]">
                                <ShieldAlert className="h-[14px] w-[14px] shrink-0 mt-[1px] text-[#D97706]" />
                                <span>{sf.skip_reason}</span>
                              </div>
                            )}
                            {sf.review_issues.length > 0 && (
                              <ul className="list-disc list-inside text-[13px] text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px] p-[8px_12px] space-y-0.5">
                                {sf.review_issues.map((issue, ri) => <li key={ri}>{issue}</li>)}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )}

        </div>
      </div>
    </div>
  );
}
