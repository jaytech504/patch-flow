"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, GitPullRequest, Search,
  XCircle, Clock, Loader2, ExternalLink, RefreshCw,
  Radio, CheckCircle2, ChevronDown,
  Zap, ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";
import { appleSprings } from "@/lib/springs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Incident {
  id: string;
  site_id: string | null;
  error_title: string;
  error_type: string;
  culprit: string;
  stack_file: string;
  stack_lineno: number | null;
  stack_function: string;
  environment: string;
  event_count: number;
  user_count: number;
  status: string;
  skip_reason: string | null;
  pr_url: string | null;
  pr_number: number | null;
  github_repo: string | null;
  fix_summary: string | null;
  created_at: string;
  processed_at: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusMeta(status: string) {
  switch (status) {
    case "pr_opened":
      return { label: "PR Opened", icon: GitPullRequest, cls: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20" };
    case "processing":
      return { label: "Patching", icon: Clock, cls: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20" };
    case "skipped":
      return { label: "Skipped", icon: XCircle, cls: "bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground border-black/[0.06]" };
    case "failed":
      return { label: "Failed", icon: XCircle, cls: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" };
    default:
      return { label: "Received", icon: Clock, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
  }
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff) || diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [liveMode, setLiveMode] = useState(true);
  const previousPrCountRef = useRef<number | null>(null);
  const [newPrToast, setNewPrToast] = useState<string | null>(null);

  const fetchIncidents = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const r = await authFetch("/api/incidents");
      if (r.ok) {
        const data = await r.json();
        const incoming: Incident[] = data.incidents ?? [];

        // Check if new PRs were opened to show live toast
        const prCount = incoming.filter((i) => i.status === "pr_opened").length;
        if (previousPrCountRef.current !== null && prCount > previousPrCountRef.current) {
          const latestPr = incoming.find((i) => i.status === "pr_opened");
          if (latestPr) {
            setNewPrToast(`New Draft PR opened: ${latestPr.error_title}`);
            setTimeout(() => setNewPrToast(null), 5000);
          }
        }
        previousPrCountRef.current = prCount;
        setIncidents(incoming);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchIncidents();
  }, []);

  // Live polling interval: every 4s if items are in processing, 10s otherwise
  useEffect(() => {
    if (!liveMode) return;

    const hasProcessing = incidents.some((i) => i.status === "processing" || i.status === "received");
    const intervalMs = hasProcessing ? 4000 : 10000;

    const interval = setInterval(() => {
      fetchIncidents(true);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [liveMode, incidents]);

  // Filtered list
  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      const matchesStatus = statusFilter === "all" || i.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (i.error_title && i.error_title.toLowerCase().includes(q)) ||
        (i.error_type && i.error_type.toLowerCase().includes(q)) ||
        (i.stack_file && i.stack_file.toLowerCase().includes(q)) ||
        (i.github_repo && i.github_repo.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [incidents, statusFilter, searchQuery]);

  const total = incidents.length;
  const prOpened = incidents.filter((i) => i.status === "pr_opened").length;
  const inProgress = incidents.filter((i) => i.status === "processing" || i.status === "received").length;
  const skipped = incidents.filter((i) => i.status === "skipped").length;
  const failed = incidents.filter((i) => i.status === "failed").length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 w-full relative">
      {/* Toast Notification with Apple Physics */}
      <AnimatePresence>
        {newPrToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={appleSprings.sheet}
            className="fixed top-6 right-6 z-50 bg-[#161615]/95 dark:bg-white/95 text-white dark:text-black px-4.5 py-3.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex items-center gap-3.5 border border-white/10 dark:border-black/10 backdrop-blur-xl"
          >
            <div className="h-8 w-8 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
              <GitPullRequest className="h-4.5 w-4.5 text-purple-400 dark:text-purple-600" />
            </div>
            <div>
              <p className="text-[13px] font-bold">Automated PR Created!</p>
              <p className="text-[12px] opacity-75 truncate max-w-xs">{newPrToast}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-black/[0.05] dark:border-white/[0.07] mb-7 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="apple-title-2 text-foreground">Production Incidents</h1>
            {liveMode && (
              <span className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <p className="apple-body text-text-secondary text-[13px] mt-1">
            Real-time errors intercepted by PatchFlow SDK with automated code patches & PRs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setLiveMode((p) => !p)}
            className={cn(
              "px-3 py-1.5 text-[12px] font-semibold border rounded-[10px] transition-colors flex items-center gap-1.5 apple-press cursor-pointer shadow-2xs",
              liveMode
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-card text-muted-foreground border-black/[0.08] dark:border-white/[0.1]"
            )}
            title={liveMode ? "Auto-refresh is active" : "Auto-refresh paused"}
          >
            <Radio className={cn("h-3.5 w-3.5", liveMode && "animate-pulse")} />
            <span>{liveMode ? "Live Sync" : "Sync Paused"}</span>
          </button>

          <button
            onClick={() => fetchIncidents(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-foreground bg-card border border-black/[0.08] dark:border-white/[0.1] rounded-[10px] hover:bg-black/[0.03] transition-colors apple-press cursor-pointer shadow-2xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-primary")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-7">
        {[
          { label: "Total Incidents", value: total, color: "text-foreground", bg: "bg-card" },
          { label: "PRs Opened", value: prOpened, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/[0.03]" },
          { label: "Patching Now", value: inProgress, color: "text-[#FF5A1F]", bg: inProgress > 0 ? "bg-orange-500/[0.04]" : "bg-card" },
          { label: "Skipped / Filtered", value: skipped + failed, color: "text-text-secondary", bg: "bg-card" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-4.5 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.02)]", bg)}>
            <p className="apple-caption text-text-secondary mb-1.5">{label}</p>
            <p className={cn("text-[26px] font-extrabold leading-none tracking-tight", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by error type, file, or repository..."
            className="w-full pl-9 pr-4 py-2 text-[13px] bg-card border border-black/[0.08] dark:border-white/[0.1] rounded-xl focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all text-foreground shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "pr_opened", label: "PR Opened" },
            { id: "processing", label: "Patching" },
            { id: "skipped", label: "Skipped" },
            { id: "failed", label: "Failed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "px-3 py-1.5 text-[12px] font-semibold rounded-[8px] transition-colors whitespace-nowrap apple-press-subtle cursor-pointer",
                statusFilter === tab.id
                  ? "bg-foreground text-background shadow-xs"
                  : "bg-card border border-black/[0.06] dark:border-white/[0.08] text-muted-foreground hover:text-foreground hover:bg-black/[0.02]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Incident List */}
      {loading ? (
        <div className="flex flex-col gap-3 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-5">
              <div className="h-4 w-48 bg-black/[0.05] dark:bg-white/[0.05] animate-pulse rounded mb-2" />
              <div className="h-3 w-64 bg-black/[0.05] dark:bg-white/[0.05] animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-12 text-center shadow-xs">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="apple-title-3 text-foreground">
            {searchQuery || statusFilter !== "all" ? "No matching incidents found" : "All Systems Operational"}
          </p>
          <p className="apple-body text-text-secondary text-[13px] mt-1.5 max-w-md mx-auto leading-relaxed">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search query or status filter."
              : "PatchFlow is actively listening for production errors in real time. When an issue occurs in your app, it will be captured here and an automated fix PR will be created."}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <Link
                href="/sites"
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-foreground bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] px-3.5 py-2 rounded-[10px] transition-colors apple-press"
              >
                View Monitored Sites
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((inc, i) => {
            const sm = statusMeta(inc.status);
            const StatusIcon = sm.icon;
            const isOpen = expanded === inc.id;

            return (
              <motion.div
                key={inc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02, ...appleSprings.default }}
                className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl overflow-hidden hover:shadow-md transition-shadow shadow-2xs"
              >
                {/* Main Row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : inc.id)}
                  className="flex items-start gap-4 p-4.5 cursor-pointer select-none apple-press-subtle"
                >
                  <div className={cn("shrink-0 mt-0.5 p-2 rounded-xl border", sm.cls)}>
                    <StatusIcon className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-bold text-foreground leading-snug truncate">
                        {inc.error_title || inc.error_type || "Unknown error"}
                      </p>
                      <span className="text-[12px] text-muted-foreground shrink-0">{timeAgo(inc.created_at)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px] text-text-secondary">
                      {inc.error_type && (
                        <span className="font-mono bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.07] px-2 py-0.5 rounded-md font-medium text-foreground/80">
                          {inc.error_type}
                        </span>
                      )}
                      {inc.environment && (
                        <span className="bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-wide">
                          {inc.environment}
                        </span>
                      )}
                      {inc.event_count > 0 && <span>{inc.event_count} occurrence{inc.event_count !== 1 ? "s" : ""}</span>}
                    </div>

                    {inc.stack_file && (
                      <p className="mt-1.5 text-[11px] font-mono text-muted-foreground truncate">
                        {inc.stack_file}:{inc.stack_lineno || "?"}
                        {inc.stack_function ? ` in ${inc.stack_function}()` : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full border", sm.cls)}>
                      {sm.label}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={appleSprings.snappy}
                    >
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  </div>
                </div>

                {/* Expanded Detail Panel with Apple Springs */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={appleSprings.default}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-black/[0.05] dark:border-white/[0.07] pt-4 flex flex-col gap-3.5 bg-black/[0.015] dark:bg-white/[0.015]">
                        {inc.pr_url && (
                          <div className="flex items-center justify-between p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <GitPullRequest className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                              <div className="truncate">
                                <p className="text-[13px] font-bold text-purple-700 dark:text-purple-300">Draft PR #{inc.pr_number} Opened</p>
                                {inc.fix_summary && <p className="text-[12px] text-text-secondary truncate">{inc.fix_summary}</p>}
                              </div>
                            </div>
                            <a
                              href={inc.pr_url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-semibold px-3 py-1.5 rounded-[8px] flex items-center gap-1.5 transition-colors shrink-0 ml-3 apple-press shadow-xs"
                            >
                              <span>Review on GitHub</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        )}

                        {inc.skip_reason && (
                          <div className={cn(
                            "flex items-start justify-between gap-3 p-3.5 rounded-xl border",
                            inc.skip_reason.includes("Free tier") || inc.skip_reason.includes("Upgrade")
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300"
                              : "bg-card border-black/[0.06] dark:border-white/[0.08] text-foreground"
                          )}>
                            <div className="flex items-start gap-2.5">
                              {inc.skip_reason.includes("Free tier") || inc.skip_reason.includes("Upgrade") ? (
                                <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                              )}
                              <div>
                                <p className="text-[12px] font-bold">
                                  {inc.skip_reason.includes("Free tier") ? "Auto-Patching Locked (Free Plan)" : "Auto-Patching Skipped"}
                                </p>
                                <p className="text-[12px] opacity-80 mt-0.5">{inc.skip_reason}</p>
                              </div>
                            </div>

                            {(inc.skip_reason.includes("Free tier") || inc.skip_reason.includes("Upgrade")) && (
                              <Link
                                href="/settings/billing"
                                onClick={(e) => e.stopPropagation()}
                                className="bg-primary hover:bg-[#E04E16] text-white text-[11px] font-bold px-3 py-1.5 rounded-[8px] shrink-0 flex items-center gap-1 transition-colors apple-press shadow-2xs"
                              >
                                <span>Upgrade to Pro ($14/mo)</span>
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[12px] bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-xl p-3.5 shadow-2xs">
                          <div>
                            <span className="apple-caption text-muted-foreground block text-[10px] mb-0.5">Culprit Endpoint</span>
                            <span className="font-mono text-foreground font-semibold truncate block">{inc.culprit || "handler"}</span>
                          </div>
                          <div>
                            <span className="apple-caption text-muted-foreground block text-[10px] mb-0.5">GitHub Repo</span>
                            <span className="font-mono text-foreground font-semibold truncate block">{inc.github_repo || "None"}</span>
                          </div>
                          <div>
                            <span className="apple-caption text-muted-foreground block text-[10px] mb-0.5">Last Processed</span>
                            <span className="text-foreground font-semibold">{timeAgo(inc.processed_at)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
