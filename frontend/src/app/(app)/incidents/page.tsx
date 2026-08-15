"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle, GitPullRequest, Search,
  XCircle, Clock, Loader2, ExternalLink, RefreshCw,
  Radio, CheckCircle2, ChevronRight, ChevronDown, Filter
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";

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
      return { label: "PR Opened", icon: GitPullRequest, cls: "bg-[#F3E8FF] text-[#7E22CE] border-[#E9D5FF]" };
    case "processing":
      return { label: "Patching", icon: Clock, cls: "bg-[#FFF7ED] text-[#C2410C] border-[#FFEDD5]" };
    case "skipped":
      return { label: "Skipped", icon: XCircle, cls: "bg-[#F3F2F0] text-[#6F6B66] border-[#E7E5E2]" };
    case "failed":
      return { label: "Failed", icon: XCircle, cls: "bg-[#FEF2F2] text-[#DC2626] border-[#FEE2E2]" };
    default:
      return { label: "Received", icon: Clock, cls: "bg-[#EFF6FF] text-[#2563EB] border-[#DBEAFE]" };
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
      const token = localStorage.getItem("patchflow_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${API_BASE_URL}/api/incidents`, { headers });
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
    <div className="mx-auto max-w-4xl px-6 py-10 w-full relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {newPrToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 right-6 z-50 bg-[#111110] text-white px-4 py-3 rounded-[12px] shadow-xl flex items-center gap-3 border border-[#333]"
          >
            <GitPullRequest className="h-5 w-5 text-[#A855F7] shrink-0" />
            <div>
              <p className="text-[13px] font-[700] text-white">Automated PR Created!</p>
              <p className="text-[12px] text-[#A3A099] truncate max-w-xs">{newPrToast}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E7E5E2] mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-[800] text-[#111110] tracking-tight">Production Incidents</h1>
            {liveMode && (
              <span className="flex items-center gap-1.5 bg-[#F0FDF4] border border-[#DCFCE7] text-[#16A34A] text-[11px] font-[700] px-2.5 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <p className="text-[14px] text-[#6F6B66] mt-1">
            Real-time errors intercepted by PatchFlow SDK with automated code patches & PRs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setLiveMode((p) => !p)}
            className={cn(
              "px-3 py-2 text-[12px] font-[600] border rounded-[8px] transition-colors flex items-center gap-1.5",
              liveMode ? "bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]" : "bg-white text-[#6F6B66] border-[#E7E5E2]"
            )}
            title={liveMode ? "Auto-refresh is active" : "Auto-refresh paused"}
          >
            <Radio className={cn("h-3.5 w-3.5", liveMode && "animate-pulse")} />
            <span>{liveMode ? "Live Sync" : "Sync Paused"}</span>
          </button>

          <button
            onClick={() => fetchIncidents(false)}
            className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-[600] text-[#6F6B66] bg-white border border-[#E7E5E2] rounded-[8px] hover:bg-[#F3F2F0] hover:text-[#111110] transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-[#FF5A1F]")} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total Incidents", value: total, color: "text-[#111110]", bg: "bg-white" },
          { label: "PRs Opened", value: prOpened, color: "text-[#7E22CE]", bg: "bg-[#FAF5FF]" },
          { label: "Patching Now", value: inProgress, color: "text-[#C2410C]", bg: inProgress > 0 ? "bg-[#FFF7ED]" : "bg-white" },
          { label: "Skipped / Filtered", value: skipped + failed, color: "text-[#6F6B66]", bg: "bg-white" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn("border border-[#E7E5E2] rounded-[14px] p-4", bg)}>
            <p className="text-[11px] font-[600] text-[#A3A099] uppercase tracking-[0.04em] mb-1">{label}</p>
            <p className={cn("text-[26px] font-[800] leading-none", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A3A099]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by error type, file, or repository..."
            className="w-full pl-9 pr-4 py-2 text-[13px] bg-white border border-[#E7E5E2] rounded-[10px] focus:outline-none focus:border-[#FF5A1F] transition-colors text-[#111110]"
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
                "px-3 py-1.5 text-[12px] font-[600] rounded-[8px] transition-colors whitespace-nowrap",
                statusFilter === tab.id
                  ? "bg-[#111110] text-white"
                  : "bg-white border border-[#E7E5E2] text-[#6F6B66] hover:bg-[#F3F2F0]"
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
            <div key={i} className="bg-white border border-[#E7E5E2] rounded-[14px] p-5">
              <div className="h-4 w-48 bg-[#F3F2F0] animate-pulse rounded mb-2" />
              <div className="h-3 w-64 bg-[#F3F2F0] animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E7E5E2] rounded-[16px] p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-[#D4D1CC] mx-auto mb-3" />
          <p className="text-[15px] font-[700] text-[#111110]">
            {searchQuery || statusFilter !== "all" ? "No matching incidents" : "No incidents captured yet"}
          </p>
          <p className="text-[13px] text-[#6F6B66] mt-1 max-w-md mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search query or status filter."
              : "Connect your site and deploy the PatchFlow SDK to start capturing live runtime errors."}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Link
              href="/sites"
              className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-[600] bg-[#FF5A1F] hover:bg-[#E04E16] text-white px-4 py-2 rounded-[8px] transition-colors"
            >
              Connect a Site →
            </Link>
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
                transition={{ delay: i * 0.02, duration: 0.2 }}
                className="bg-white border border-[#E7E5E2] rounded-[14px] overflow-hidden hover:border-[#D4D1CC] transition-colors shadow-2xs"
              >
                {/* Main Row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : inc.id)}
                  className="flex items-start gap-4 p-[16px_20px] cursor-pointer select-none"
                >
                  <div className={cn("shrink-0 mt-0.5 p-2 rounded-[8px] border", sm.cls)}>
                    <StatusIcon className="h-[15px] w-[15px]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-[700] text-[#111110] leading-snug truncate">
                        {inc.error_title || inc.error_type || "Unknown error"}
                      </p>
                      <span className="text-[12px] text-[#A3A099] shrink-0">{timeAgo(inc.created_at)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px] text-[#6F6B66]">
                      {inc.error_type && (
                        <span className="font-mono bg-[#F8FAFC] border border-[#E2E8F0] px-1.5 py-0.5 rounded text-[#334155] font-[500]">
                          {inc.error_type}
                        </span>
                      )}
                      {inc.environment && (
                        <span className="bg-[#F3F2F0] px-[6px] py-[1px] rounded-[4px] font-[500] uppercase text-[10px]">
                          {inc.environment}
                        </span>
                      )}
                      {inc.event_count > 0 && <span>{inc.event_count} occurrence{inc.event_count !== 1 ? "s" : ""}</span>}
                    </div>

                    {inc.stack_file && (
                      <p className="mt-1 text-[11px] font-mono text-[#A3A099] truncate">
                        {inc.stack_file}:{inc.stack_lineno || "?"}
                        {inc.stack_function ? ` in ${inc.stack_function}()` : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-[11px] font-[700] uppercase px-[9px] py-[3px] rounded-full border", sm.cls)}>
                      {sm.label}
                    </span>
                    <ChevronDown
                      className={cn("h-4 w-4 text-[#A3A099] transition-transform duration-200", isOpen && "rotate-180")}
                    />
                  </div>
                </div>

                {/* Expanded Detail Panel */}
                {isOpen && (
                  <div className="px-[20px] pb-[20px] border-t border-[#F3F2F0] pt-[16px] flex flex-col gap-3.5 bg-[#FAFAF9]/50">
                    {inc.pr_url && (
                      <div className="flex items-center justify-between p-[12px_16px] bg-[#F3E8FF]/60 border border-[#E9D5FF] rounded-[10px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <GitPullRequest className="h-[16px] w-[16px] text-[#7E22CE] shrink-0" />
                          <div className="truncate">
                            <p className="text-[13px] font-[700] text-[#7E22CE]">Draft PR #{inc.pr_number} Opened</p>
                            {inc.fix_summary && <p className="text-[12px] text-[#6F6B66] truncate">{inc.fix_summary}</p>}
                          </div>
                        </div>
                        <a
                          href={inc.pr_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="bg-[#7E22CE] hover:bg-[#6B21A8] text-white text-[12px] font-[600] px-3 py-1.5 rounded-[8px] flex items-center gap-1.5 transition-colors shrink-0 ml-3"
                        >
                          <span>Review on GitHub</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}

                    {inc.skip_reason && (
                      <div className="flex items-start gap-2.5 p-[12px_16px] bg-white border border-[#E7E5E2] rounded-[10px]">
                        <XCircle className="h-[15px] w-[15px] text-[#6F6B66] shrink-0 mt-[1px]" />
                        <div>
                          <p className="text-[12px] font-[600] text-[#111110]">Auto-Patching Skipped</p>
                          <p className="text-[12px] text-[#6F6B66] mt-0.5">{inc.skip_reason}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[12px] bg-white border border-[#E7E5E2] rounded-[10px] p-3">
                      <div>
                        <span className="text-[#A3A099] block text-[11px] uppercase">Culprit Endpoint</span>
                        <span className="font-mono text-[#111110] font-[500] truncate block">{inc.culprit || "handler"}</span>
                      </div>
                      <div>
                        <span className="text-[#A3A099] block text-[11px] uppercase">GitHub Repo</span>
                        <span className="font-mono text-[#111110] font-[500] truncate block">{inc.github_repo || "None"}</span>
                      </div>
                      <div>
                        <span className="text-[#A3A099] block text-[11px] uppercase">Last Processed</span>
                        <span className="text-[#111110] font-[500]">{timeAgo(inc.processed_at)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
