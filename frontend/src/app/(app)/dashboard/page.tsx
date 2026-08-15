"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus, CheckCircle2, XCircle, Activity, AlertTriangle,
  GitPullRequest, Gauge, Globe, Clock, ShieldCheck, ArrowRight,
  Radio, Terminal, ExternalLink, RefreshCw, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Session {
  id: string;
  appName: string;
  appUrl: string;
  status: string;
  endpointsTested: number;
  failuresFound: number;
  fixesGenerated: number;
  date: string;
  createdAtRaw?: string;
}

interface MonitoredSite {
  id: string;
  name: string;
  url: string | null;
  github_repo: string | null;
  framework: string | null;
  active: boolean;
  sdk_status: "not_installed" | "active" | "error";
  sdk_last_seen: string | null;
  created_at: string;
}

interface Incident {
  id: string;
  site_id: string | null;
  error_title: string;
  error_type: string;
  culprit: string;
  stack_file: string;
  stack_lineno: number | null;
  environment: string;
  event_count: number;
  status: string;
  pr_url: string | null;
  pr_number: number | null;
  github_repo: string | null;
  fix_summary: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function getIncidentStatusMeta(status: string) {
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

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "incidents" | "sites">("overview");

  const loadData = async () => {
    setLoading(true);
    const token = localStorage.getItem("patchflow_token");
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const [sessRes, sitesRes, incRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/api/sessions`, { headers }),
        fetch(`${API_BASE_URL}/api/sites`, { headers }),
        fetch(`${API_BASE_URL}/api/incidents`, { headers }),
      ]);

      if (sessRes.status === "fulfilled" && sessRes.value.ok) {
        const data = await sessRes.value.json();
        setSessions(
          data.map((s: any) => ({
            id: s.id,
            appName: s.target_name || "My API",
            appUrl: s.target_url || "",
            status: s.status,
            endpointsTested: s.endpoints_found || 0,
            failuresFound: s.failures_injected || 0,
            fixesGenerated: s.fixes_generated || 0,
            date: s.created_at ? new Date(s.created_at).toLocaleDateString() : "unknown",
            createdAtRaw: s.created_at,
          }))
        );
      }

      if (sitesRes.status === "fulfilled" && sitesRes.value.ok) {
        const data = await sitesRes.value.json();
        setSites(data.sites || []);
      }

      if (incRes.status === "fulfilled" && incRes.value.ok) {
        const data = await incRes.value.json();
        setIncidents(data.incidents || []);
      }
    } catch (err) {
      console.warn("Could not fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ── Aggregated Stats ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalTests = sessions.length;
    const totalFailures = sessions.reduce((sum, s) => sum + s.failuresFound, 0);
    const totalFixes = sessions.reduce((sum, s) => sum + s.fixesGenerated, 0);
    const totalEndpoints = sessions.reduce((sum, s) => sum + s.endpointsTested, 0);

    const activeSites = sites.filter((s) => s.active).length;
    const activeSdkSites = sites.filter((s) => s.sdk_status === "active").length;

    const totalIncidents = incidents.length;
    const prsOpened = incidents.filter((i) => i.status === "pr_opened").length;

    // Resilience score: combined reliability from test sessions & incident resolutions
    const chaosRisk = totalEndpoints > 0
      ? Math.min(100, Math.round((totalFailures / totalEndpoints) * 100))
      : 0;

    const resilienceScore = Math.max(0, 100 - chaosRisk);

    let scoreColor = "#16A34A";
    if (resilienceScore < 70 && resilienceScore >= 40) scoreColor = "#E04E16";
    else if (resilienceScore < 40) scoreColor = "#DC2626";

    return {
      totalTests,
      totalFailures,
      totalFixes,
      activeSites,
      activeSdkSites,
      totalIncidents,
      prsOpened,
      resilienceScore,
      scoreColor,
    };
  }, [sessions, sites, incidents]);

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "complete" || s === "completed") {
      return (
        <div className="flex items-center gap-1.5 bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7] text-[11px] font-[600] px-[9px] py-[3px] rounded-full">
          <CheckCircle2 className="h-3 w-3" />
          <span>Complete</span>
        </div>
      );
    }
    if (s === "failed") {
      return (
        <div className="flex items-center gap-1.5 bg-[#FEF2F2] text-[#DC2626] border border-[#FEE2E2] text-[11px] font-[600] px-[9px] py-[3px] rounded-full">
          <XCircle className="h-3 w-3" />
          <span>Failed</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 bg-[#FFEDE3] text-[#E04E16] border border-[#FFD8C7] text-[11px] font-[600] px-[9px] py-[3px] rounded-full">
        <div className="h-1.5 w-1.5 rounded-full bg-[#E04E16] animate-pulse" />
        <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 w-full flex flex-col min-h-screen">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E7E5E2] mb-[28px] gap-4">
        <div>
          <h1 className="text-[28px] font-[800] text-[#111110] tracking-tight leading-tight">
            System Overview
          </h1>
          <p className="text-[14px] text-[#6F6B66] mt-1">
            Autonomous failure testing, live site telemetry, and auto-generated PRs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            title="Refresh dashboard"
            className="p-2.5 text-[#6F6B66] hover:text-[#111110] border border-[#E7E5E2] rounded-[10px] hover:bg-[#F3F2F0] transition-colors"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-[#FF5A1F]")} />
          </button>

          <Link
            href="/sites"
            className="bg-white hover:bg-[#F8FAFC] border border-[#E7E5E2] text-[#111110] font-[600] text-[13px] rounded-[10px] px-[14px] py-[10px] flex items-center gap-1.5 transition-colors"
          >
            <Globe className="h-4 w-4 text-[#6F6B66]" />
            <span>Monitored Sites</span>
          </Link>

          <Link
            href="/sessions/new"
            className="bg-[#FF5A1F] hover:bg-[#E04E16] text-white font-[600] text-[13px] rounded-[10px] px-[16px] py-[10px] flex items-center gap-1.5 transition-all hover:shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Chaos Test</span>
          </Link>
        </div>
      </div>

      {/* ── Top Metric Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[32px]">
        {/* Card 1: Monitored Sites */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.0 }}
          className="bg-white border border-[#E7E5E2] rounded-[14px] p-[20px] hover:border-[#D4D1CC] transition-colors flex flex-col"
        >
          <div className="flex items-center justify-between mb-3">
            <Globe className="h-[18px] w-[18px] text-[#2563EB]" />
            <span className="text-[11px] font-[600] bg-[#EFF6FF] text-[#2563EB] px-2 py-0.5 rounded-full">
              {stats.activeSdkSites} Active SDK
            </span>
          </div>
          <span className="text-[26px] font-[800] text-[#111110] leading-none mb-1">
            {stats.activeSites}
          </span>
          <span className="text-[13px] text-[#6F6B66]">Monitored Sites</span>
        </motion.div>

        {/* Card 2: Incident PRs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="bg-white border border-[#E7E5E2] rounded-[14px] p-[20px] hover:border-[#D4D1CC] transition-colors flex flex-col"
        >
          <div className="flex items-center justify-between mb-3">
            <GitPullRequest className="h-[18px] w-[18px] text-[#7E22CE]" />
            <span className="text-[11px] font-[600] bg-[#F3E8FF] text-[#7E22CE] px-2 py-0.5 rounded-full">
              {stats.totalIncidents} captured
            </span>
          </div>
          <span className="text-[26px] font-[800] text-[#7E22CE] leading-none mb-1">
            {stats.prsOpened}
          </span>
          <span className="text-[13px] text-[#6F6B66]">Incident Fix PRs Opened</span>
        </motion.div>

        {/* Card 3: Chaos Tests & Fixes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="bg-white border border-[#E7E5E2] rounded-[14px] p-[20px] hover:border-[#D4D1CC] transition-colors flex flex-col"
        >
          <div className="flex items-center justify-between mb-3">
            <Activity className="h-[18px] w-[18px] text-[#FF5A1F]" />
            <span className="text-[11px] font-[600] bg-[#FFF1EC] text-[#FF5A1F] px-2 py-0.5 rounded-full">
              {stats.totalFixes} patches
            </span>
          </div>
          <span className="text-[26px] font-[800] text-[#111110] leading-none mb-1">
            {stats.totalTests}
          </span>
          <span className="text-[13px] text-[#6F6B66]">Chaos Tests Executed</span>
        </motion.div>

        {/* Card 4: Global Resilience Score */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
          className="bg-white border border-[#E7E5E2] rounded-[14px] p-[20px] hover:border-[#D4D1CC] transition-colors flex flex-col"
        >
          <div className="flex items-center justify-between mb-3">
            <ShieldCheck className="h-[18px] w-[18px] text-[#16A34A]" />
            <span className="text-[11px] font-[600] bg-[#F0FDF4] text-[#16A34A] px-2 py-0.5 rounded-full">
              Health
            </span>
          </div>
          <span className="text-[26px] font-[800] leading-none mb-1" style={{ color: stats.scoreColor }}>
            {stats.resilienceScore}%
          </span>
          <span className="text-[13px] text-[#6F6B66]">Resilience Index</span>
        </motion.div>
      </div>

      {/* ── Main Content Tabs ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[#E7E5E2] mb-6">
        {[
          { id: "overview", label: "Unified View", icon: Layers },
          { id: "incidents", label: `Incidents (${incidents.length})`, icon: AlertTriangle },
          { id: "sessions", label: `Chaos Scans (${sessions.length})`, icon: Activity },
          { id: "sites", label: `Sites (${sites.length})`, icon: Globe },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-[600] border-b-2 -mb-[1px] transition-colors",
                active
                  ? "border-[#FF5A1F] text-[#FF5A1F]"
                  : "border-transparent text-[#6F6B66] hover:text-[#111110] hover:border-[#D4D1CC]"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Panels ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-[#E7E5E2] rounded-[16px] p-6">
              <div className="h-5 w-48 bg-[#F3F2F0] animate-pulse rounded mb-3" />
              <div className="h-4 w-72 bg-[#F3F2F0] animate-pulse rounded mb-4" />
              <div className="h-8 w-full bg-[#F3F2F0] animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div>
          {/* 1. UNIFIED OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-8">
              {/* Section: Live Monitored Sites */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-[#16A34A] animate-pulse" />
                    <h2 className="text-[16px] font-[700] text-[#111110]">Active Monitored Sites</h2>
                  </div>
                  <Link href="/sites" className="text-[12px] font-[600] text-[#FF5A1F] hover:underline flex items-center gap-1">
                    Manage sites <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {sites.length === 0 ? (
                  <div className="bg-white border border-dashed border-[#E7E5E2] rounded-[14px] p-6 text-center">
                    <p className="text-[13px] text-[#6F6B66] mb-3">No sites currently connected to the Agent SDK.</p>
                    <Link href="/sites" className="text-[12px] font-[600] bg-[#F3F2F0] text-[#111110] px-3 py-1.5 rounded-[8px] hover:bg-[#E7E5E2] transition-colors">
                      Connect your first site
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {sites.slice(0, 3).map((site) => (
                      <Link
                        key={site.id}
                        href="/sites"
                        className="bg-white border border-[#E7E5E2] hover:border-[#D4D1CC] rounded-[12px] p-4 transition-all hover:shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-[700] text-[#111110] truncate">{site.name}</span>
                            <span
                              className={cn(
                                "text-[10px] font-[600] px-2 py-0.5 rounded-full",
                                site.sdk_status === "active"
                                  ? "bg-[#F0FDF4] text-[#16A34A]"
                                  : "bg-[#F3F2F0] text-[#A3A099]"
                              )}
                            >
                              {site.sdk_status === "active" ? "SDK Active" : "No SDK"}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-[#6F6B66] truncate mb-2">
                            {site.github_repo || site.url || "No repo linked"}
                          </p>
                        </div>
                        <div className="text-[11px] text-[#A3A099] flex items-center justify-between pt-2 border-t border-[#F3F2F0]">
                          <span className="uppercase text-[10px] font-[600]">{site.framework || "app"}</span>
                          <span>Seen {timeAgo(site.sdk_last_seen)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Section: Recent Incidents */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
                    <h2 className="text-[16px] font-[700] text-[#111110]">Recent Production Errors & Fixes</h2>
                  </div>
                  <Link href="/incidents" className="text-[12px] font-[600] text-[#FF5A1F] hover:underline flex items-center gap-1">
                    View all incidents <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {incidents.length === 0 ? (
                  <div className="bg-white border border-[#E7E5E2] rounded-[14px] p-6 text-center">
                    <p className="text-[13px] text-[#6F6B66]">No production errors captured yet. Your active sites are running cleanly.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {incidents.slice(0, 3).map((inc) => {
                      const meta = getIncidentStatusMeta(inc.status);
                      const StatusIcon = meta.icon;
                      return (
                        <div
                          key={inc.id}
                          className="bg-white border border-[#E7E5E2] rounded-[12px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[14px] font-[700] text-[#111110] truncate">{inc.error_title}</span>
                              <span className={cn("text-[11px] font-[600] border px-2 py-0.5 rounded-full flex items-center gap-1", meta.cls)}>
                                <StatusIcon className="h-3 w-3" />
                                {meta.label}
                              </span>
                            </div>
                            <div className="text-[12px] font-mono text-[#6F6B66] truncate">
                              {inc.stack_file}:{inc.stack_lineno || "?"} • {inc.event_count} occurrence{inc.event_count !== 1 ? "s" : ""}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {inc.pr_url ? (
                              <a
                                href={inc.pr_url}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-[#F3E8FF] hover:bg-[#E9D5FF] text-[#7E22CE] font-[600] text-[12px] px-3 py-1.5 rounded-[8px] flex items-center gap-1 transition-colors"
                              >
                                <GitPullRequest className="h-3.5 w-3.5" />
                                <span>PR #{inc.pr_number || "Draft"}</span>
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-[#A3A099]">{timeAgo(inc.created_at)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section: Recent Chaos Sessions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#FF5A1F]" />
                    <h2 className="text-[16px] font-[700] text-[#111110]">Recent Chaos Scans</h2>
                  </div>
                  <Link href="/sessions/new" className="text-[12px] font-[600] text-[#FF5A1F] hover:underline flex items-center gap-1">
                    New scan <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {sessions.length === 0 ? (
                  <div className="bg-white border border-[#E7E5E2] rounded-[14px] p-6 text-center">
                    <p className="text-[13px] text-[#6F6B66] mb-3">No chaos test sessions run yet.</p>
                    <Link href="/sessions/new" className="text-[12px] font-[600] bg-[#FF5A1F] text-white px-3 py-1.5 rounded-[8px] hover:bg-[#E04E16] transition-colors">
                      Start your first test
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {sessions.slice(0, 3).map((s) => {
                      const isRunning = !["complete", "completed", "failed"].includes(s.status.toLowerCase());
                      const linkTarget = isRunning ? `/sessions/${s.id}` : `/sessions/${s.id}/report`;
                      return (
                        <Link
                          key={s.id}
                          href={linkTarget}
                          className="bg-white border border-[#E7E5E2] hover:border-[#D4D1CC] rounded-[14px] p-4 transition-all hover:shadow-xs block"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[15px] font-[700] text-[#111110]">{s.appName}</span>
                              {getStatusBadge(s.status)}
                            </div>
                            <span className="text-[12px] text-[#A3A099]">{s.date}</span>
                          </div>
                          <div className="text-[12px] font-mono text-[#6F6B66] truncate mb-3">{s.appUrl}</div>
                          <div className="flex items-center gap-6 text-[12px]">
                            <div>
                              <span className="text-[#A3A099] mr-1.5">Endpoints:</span>
                              <span className="font-[700] text-[#111110]">{s.endpointsTested}</span>
                            </div>
                            <div>
                              <span className="text-[#A3A099] mr-1.5">Failures:</span>
                              <span className={cn("font-[700]", s.failuresFound > 0 ? "text-[#DC2626]" : "text-[#111110]")}>
                                {s.failuresFound}
                              </span>
                            </div>
                            <div>
                              <span className="text-[#A3A099] mr-1.5">Patches:</span>
                              <span className={cn("font-[700]", s.fixesGenerated > 0 ? "text-[#16A34A]" : "text-[#111110]")}>
                                {s.fixesGenerated}
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. INCIDENTS TAB */}
          {activeTab === "incidents" && (
            <div className="flex flex-col gap-3">
              {incidents.length === 0 ? (
                <div className="bg-white border border-[#E7E5E2] rounded-[16px] p-12 text-center">
                  <AlertTriangle className="h-8 w-8 text-[#A3A099] mx-auto mb-3" />
                  <h3 className="text-[16px] font-[700] text-[#111110] mb-1">No Incidents Recorded</h3>
                  <p className="text-[13px] text-[#6F6B66]">When errors occur on monitored sites, they will appear here with auto-fix PRs.</p>
                </div>
              ) : (
                incidents.map((inc) => {
                  const meta = getIncidentStatusMeta(inc.status);
                  const StatusIcon = meta.icon;
                  return (
                    <div key={inc.id} className="bg-white border border-[#E7E5E2] rounded-[14px] p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[16px] font-[700] text-[#111110]">{inc.error_title}</span>
                            <span className={cn("text-[11px] font-[600] border px-2 py-0.5 rounded-full flex items-center gap-1", meta.cls)}>
                              <StatusIcon className="h-3 w-3" />
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-[12px] font-mono text-[#6F6B66]">
                            {inc.stack_file}:{inc.stack_lineno || "?"} • {inc.environment}
                          </p>
                        </div>

                        {inc.pr_url && (
                          <a
                            href={inc.pr_url}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-[#F3E8FF] hover:bg-[#E9D5FF] text-[#7E22CE] font-[600] text-[12px] px-3.5 py-2 rounded-[8px] flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            <GitPullRequest className="h-4 w-4" />
                            <span>View PR #{inc.pr_number || "Draft"}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        )}
                      </div>

                      {inc.fix_summary && (
                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-3 text-[12px] text-[#475569]">
                          <span className="font-[600] text-[#1E293B]">Fix Summary: </span>
                          {inc.fix_summary}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 3. CHAOS SCANS TAB */}
          {activeTab === "sessions" && (
            <div className="flex flex-col gap-3.5">
              {sessions.length === 0 ? (
                <div className="bg-white border border-[#E7E5E2] rounded-[16px] p-12 text-center">
                  <Activity className="h-8 w-8 text-[#A3A099] mx-auto mb-3" />
                  <h3 className="text-[16px] font-[700] text-[#111110] mb-1">No Tests Run Yet</h3>
                  <p className="text-[13px] text-[#6F6B66] mb-4">Run an autonomous chaos test against any API endpoint.</p>
                  <Link href="/sessions/new" className="bg-[#FF5A1F] text-white text-[13px] font-[600] px-4 py-2 rounded-[8px]">
                    Run New Test
                  </Link>
                </div>
              ) : (
                sessions.map((s) => {
                  const isRunning = !["complete", "completed", "failed"].includes(s.status.toLowerCase());
                  const linkTarget = isRunning ? `/sessions/${s.id}` : `/sessions/${s.id}/report`;
                  return (
                    <Link
                      key={s.id}
                      href={linkTarget}
                      className="bg-white border border-[#E7E5E2] hover:border-[#D4D1CC] rounded-[14px] p-5 transition-all hover:shadow-xs block"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[16px] font-[700] text-[#111110]">{s.appName}</span>
                          {getStatusBadge(s.status)}
                        </div>
                        <span className="text-[13px] text-[#A3A099]">{s.date}</span>
                      </div>
                      <p className="text-[13px] font-mono text-[#6F6B66] truncate mb-4">{s.appUrl}</p>
                      <div className="flex items-center gap-8">
                        <div>
                          <div className="text-[11px] text-[#A3A099] uppercase tracking-wider mb-0.5">Endpoints</div>
                          <div className="text-[18px] font-[700] text-[#111110]">{s.endpointsTested}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#A3A099] uppercase tracking-wider mb-0.5">Failures</div>
                          <div className={cn("text-[18px] font-[700]", s.failuresFound > 0 ? "text-[#DC2626]" : "text-[#111110]")}>
                            {s.failuresFound}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#A3A099] uppercase tracking-wider mb-0.5">Patches</div>
                          <div className={cn("text-[18px] font-[700]", s.fixesGenerated > 0 ? "text-[#16A34A]" : "text-[#111110]")}>
                            {s.fixesGenerated}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          )}

          {/* 4. SITES TAB */}
          {activeTab === "sites" && (
            <div className="flex flex-col gap-3.5">
              {sites.length === 0 ? (
                <div className="bg-white border border-[#E7E5E2] rounded-[16px] p-12 text-center">
                  <Globe className="h-8 w-8 text-[#A3A099] mx-auto mb-3" />
                  <h3 className="text-[16px] font-[700] text-[#111110] mb-1">No Sites Registered</h3>
                  <p className="text-[13px] text-[#6F6B66] mb-4">Connect a website or API with the PatchFlow Agent SDK.</p>
                  <Link href="/sites" className="bg-[#FF5A1F] text-white text-[13px] font-[600] px-4 py-2 rounded-[8px]">
                    Add Monitored Site
                  </Link>
                </div>
              ) : (
                sites.map((site) => (
                  <div key={site.id} className="bg-white border border-[#E7E5E2] rounded-[14px] p-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[16px] font-[700] text-[#111110]">{site.name}</span>
                        <span
                          className={cn(
                            "text-[11px] font-[600] px-2 py-0.5 rounded-full",
                            site.sdk_status === "active" ? "bg-[#F0FDF4] text-[#16A34A]" : "bg-[#F3F2F0] text-[#A3A099]"
                          )}
                        >
                          {site.sdk_status === "active" ? "SDK Active" : "Not Installed"}
                        </span>
                      </div>
                      <p className="text-[12px] font-mono text-[#6F6B66]">
                        {site.github_repo ? `Repo: ${site.github_repo}` : "No repository attached"} • Framework: {site.framework || "auto"}
                      </p>
                    </div>

                    <Link
                      href="/sites"
                      className="bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#1E293B] text-[12px] font-[600] px-3 py-1.5 rounded-[8px] transition-colors"
                    >
                      Manage
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
