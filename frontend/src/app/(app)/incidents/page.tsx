"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, GitPullRequest,
  XCircle, Clock, Loader2, ExternalLink, RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
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
    case "pr_opened":  return { label: "PR Opened",  icon: GitPullRequest, cls: "bg-[#F3E8FF] text-[#7E22CE]" };
    case "processing": return { label: "Processing", icon: Clock,          cls: "bg-[#FFF7ED] text-[#C2410C]" };
    case "skipped":    return { label: "Skipped",    icon: XCircle,        cls: "bg-[#F3F2F0] text-[#6F6B66]" };
    case "failed":     return { label: "Failed",     icon: XCircle,        cls: "bg-[#FEF2F2] text-[#DC2626]" };
    default:           return { label: "Received",   icon: Clock,          cls: "bg-[#EFF6FF] text-[#2563EB]" };
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
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
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("patchflow_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${API_BASE_URL}/api/incidents`, { headers });
      if (r.ok) setIncidents((await r.json()).incidents ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const total    = incidents.length;
  const prOpened = incidents.filter(i => i.status === "pr_opened").length;
  const skipped  = incidents.filter(i => i.status === "skipped").length;
  const failed   = incidents.filter(i => i.status === "failed").length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 w-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-[800] text-[#111110] tracking-tight">Incidents</h1>
          <p className="text-[14px] text-[#6F6B66] mt-0.5">
            Production errors captured by the PatchFlow SDK, with automated fix PRs.
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 text-[13px] font-[600] text-[#6F6B66] border border-[#E7E5E2] rounded-[8px] hover:bg-[#F3F2F0] transition-colors">
          <RefreshCw className="h-[14px] w-[14px]" />Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total",     value: total,    color: "text-[#111110]" },
          { label: "PR Opened", value: prOpened, color: "text-[#7E22CE]" },
          { label: "Skipped",   value: skipped,  color: "text-[#6F6B66]" },
          { label: "Failed",    value: failed,   color: "text-[#DC2626]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-[#E7E5E2] rounded-[12px] p-4">
            <p className="text-[11px] font-[600] text-[#A3A099] uppercase tracking-[0.04em] mb-1">{label}</p>
            <p className={cn("text-[28px] font-[800] leading-none", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-[#FF5A1F] animate-spin" />
        </div>
      ) : incidents.length === 0 ? (
        <div className="bg-white border border-[#E7E5E2] rounded-[14px] p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-[#D4D1CC] mx-auto mb-3" />
          <p className="text-[14px] font-[600] text-[#111110]">No incidents yet</p>
          <p className="text-[13px] text-[#6F6B66] mt-1">
            Connect a site and install the PatchFlow SDK to start capturing production errors.
          </p>
          <Link href="/sites"
            className="inline-flex items-center gap-1.5 mt-4 text-[13px] font-[600] text-[#FF5A1F] hover:underline">
            Connect a site →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {incidents.map((inc, i) => {
            const sm = statusMeta(inc.status);
            const Icon = sm.icon;
            const isOpen = expanded === inc.id;

            return (
              <motion.div key={inc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                className="bg-white border border-[#E7E5E2] rounded-[14px] overflow-hidden hover:border-[#D4D1CC] transition-colors">

                {/* Row */}
                <div onClick={() => setExpanded(isOpen ? null : inc.id)}
                  className="flex items-start gap-4 p-[16px_20px] cursor-pointer select-none">
                  <div className={cn("shrink-0 mt-0.5 p-1.5 rounded-[6px]", sm.cls)}>
                    <Icon className="h-[14px] w-[14px]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[14px] font-[600] text-[#111110] leading-snug truncate">
                        {inc.error_title || inc.error_type || "Unknown error"}
                      </p>
                      <span className="text-[11px] text-[#A3A099] shrink-0">{timeAgo(inc.created_at)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px] text-[#6F6B66]">
                      {inc.error_type   && <span className="font-mono">{inc.error_type}</span>}
                      {inc.environment  && <span className="bg-[#F3F2F0] px-[6px] py-[1px] rounded-[4px] font-[500]">{inc.environment}</span>}
                      {inc.event_count  > 0 && <span>{inc.event_count} occurrences</span>}
                    </div>
                    {inc.stack_file && (
                      <p className="mt-1 text-[11px] font-mono text-[#A3A099] truncate">
                        {inc.stack_file}{inc.stack_lineno ? `:${inc.stack_lineno}` : ""}
                        {inc.stack_function ? ` in ${inc.stack_function}` : ""}
                      </p>
                    )}
                  </div>

                  <span className={cn("shrink-0 text-[11px] font-[700] uppercase px-[8px] py-[3px] rounded-full", sm.cls)}>
                    {sm.label}
                  </span>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-[20px] pb-[20px] border-t border-[#F3F2F0] pt-[16px] flex flex-col gap-3">

                    {inc.pr_url && (
                      <div className="flex items-center gap-2 p-[10px_14px] bg-[#F3E8FF] border border-[#E9D5FF] rounded-[8px]">
                        <GitPullRequest className="h-[14px] w-[14px] text-[#7E22CE] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-[600] text-[#7E22CE]">Draft PR #{inc.pr_number} opened</p>
                          {inc.fix_summary && <p className="text-[12px] text-[#6F6B66] mt-0.5">{inc.fix_summary}</p>}
                        </div>
                        <a href={inc.pr_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-[12px] font-[600] text-[#7E22CE] hover:underline shrink-0">
                          View PR <ExternalLink className="h-[11px] w-[11px]" />
                        </a>
                      </div>
                    )}

                    {inc.skip_reason && (
                      <div className="flex items-start gap-2 p-[10px_14px] bg-[#F3F2F0] border border-[#E7E5E2] rounded-[8px]">
                        <XCircle className="h-[14px] w-[14px] text-[#6F6B66] shrink-0 mt-[1px]" />
                        <p className="text-[13px] text-[#6F6B66]">{inc.skip_reason}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-[#6F6B66]">
                      {inc.culprit      && <span>Culprit: <span className="font-mono">{inc.culprit}</span></span>}
                      {inc.github_repo  && <span>Repo: <span className="font-mono">{inc.github_repo}</span></span>}
                      {inc.processed_at && <span>Processed: {timeAgo(inc.processed_at)}</span>}
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
