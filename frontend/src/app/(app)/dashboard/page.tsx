"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, CheckCircle2, XCircle, Activity, AlertTriangle,
  GitPullRequest, Gauge, Globe, Clock, ShieldCheck, ArrowRight,
  Radio, Terminal, ExternalLink, RefreshCw, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";
import { authFetch } from "@/lib/auth-fetch";
import { appleSprings } from "@/lib/springs";

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

export default function DashboardPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sites, setSites] = useState<MonitoredSite[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "incidents" | "sites">("overview");
  const [retryingSessionId, setRetryingSessionId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryErrorSessionId, setRetryErrorSessionId] = useState<string | null>(null);
  const router = useRouter();

  const loadData = async () => {
    setLoading(true);

    try {
      const [sessRes, sitesRes, incRes] = await Promise.allSettled([
        authFetch("/api/sessions"),
        authFetch("/api/sites"),
        authFetch("/api/incidents"),
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
    if (resilienceScore < 70 && resilienceScore >= 40) scoreColor = "#FF5A1F";
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
        <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
          <CheckCircle2 className="h-3 w-3" />
          <span>Complete</span>
        </div>
      );
    }
    if (s === "failed") {
      return (
        <div className="flex items-center gap-1.5 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
          <XCircle className="h-3 w-3" />
          <span>Failed</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>
    );
  };

  const retrySession = async (sessionId: string) => {
    if (retryingSessionId) return;
    setRetryingSessionId(sessionId);
    setRetryError(null);
    setRetryErrorSessionId(null);

    try {
      const response = await authFetch(`/api/sessions/${sessionId}/retry`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || "Unable to restart this chaos scan.");
      }
      router.push(`/sessions/${sessionId}`);
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : "Unable to restart this chaos scan.");
      setRetryErrorSessionId(sessionId);
    } finally {
      setRetryingSessionId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 w-full flex flex-col min-h-screen">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-black/[0.05] dark:border-white/[0.07] mb-7 gap-4">
        <div>
          <h1 className="apple-title-2 text-foreground">
            System Overview
          </h1>
          <p className="apple-body text-text-secondary text-[13px] mt-1">
            Autonomous failure testing, live site telemetry, and auto-generated PRs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            title="Refresh dashboard"
            className="p-2.5 text-[#6F6B66] hover:text-[#111110] dark:text-[#9C9891] dark:hover:text-white border border-black/[0.08] dark:border-white/[0.1] rounded-[10px] bg-white/70 dark:bg-white/[0.04] hover:bg-black/[0.03] transition-colors apple-press"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-[#FF5A1F]")} />
          </button>

          <Link
            href="/sites"
            className="bg-white/80 dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.1] text-foreground font-semibold text-[13px] rounded-[10px] px-3.5 py-2 flex items-center gap-1.5 apple-press shadow-2xs"
          >
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span>Monitored Sites</span>
          </Link>

          <Link
            href="/sessions/new"
            className="bg-primary hover:bg-[#E04E16] text-white font-semibold text-[13px] rounded-[10px] px-4 py-2 flex items-center gap-1.5 shadow-[0_2px_8px_rgba(255,90,31,0.3)] apple-press"
          >
            <Plus className="h-4 w-4" />
            <span>New Chaos Test</span>
          </Link>
        </div>
      </div>

      {/* ── Top Metric Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Monitored Sites */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...appleSprings.default, delay: 0.0 }}
          className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Globe className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20">
              {stats.activeSdkSites} Active SDK
            </span>
          </div>
          <div>
            <span className="text-[28px] font-extrabold text-foreground leading-none tracking-tight block mb-1">
              {stats.activeSites}
            </span>
            <span className="text-[13px] text-text-secondary font-medium">Monitored Sites</span>
          </div>
        </motion.div>

        {/* Card 2: Incident PRs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...appleSprings.default, delay: 0.05 }}
          className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <GitPullRequest className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/20">
              {stats.totalIncidents} captured
            </span>
          </div>
          <div>
            <span className="text-[28px] font-extrabold text-purple-600 dark:text-purple-400 leading-none tracking-tight block mb-1">
              {stats.prsOpened}
            </span>
            <span className="text-[13px] text-text-secondary font-medium">Incident Fix PRs Opened</span>
          </div>
        </motion.div>

        {/* Card 3: Chaos Tests & Fixes */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...appleSprings.default, delay: 0.1 }}
          className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
              {stats.totalFixes} patches
            </span>
          </div>
          <div>
            <span className="text-[28px] font-extrabold text-foreground leading-none tracking-tight block mb-1">
              {stats.totalTests}
            </span>
            <span className="text-[13px] text-text-secondary font-medium">Chaos Tests Executed</span>
          </div>
        </motion.div>

        {/* Card 4: Global Resilience Score */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...appleSprings.default, delay: 0.15 }}
          className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.03)] flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
              System Health
            </span>
          </div>
          <div>
            <span className="text-[28px] font-extrabold leading-none tracking-tight block mb-1" style={{ color: stats.scoreColor }}>
              {stats.resilienceScore}%
            </span>
            <span className="text-[13px] text-text-secondary font-medium">Resilience Index</span>
          </div>
        </motion.div>
      </div>

      {/* ── Segmented Navigation Tabs ───────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/[0.04] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06] mb-6 w-fit">
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
                "relative flex items-center gap-2 px-3.5 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors apple-press-subtle cursor-pointer",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.div
                  layoutId="active-dashboard-tab"
                  transition={appleSprings.snappy}
                  className="absolute inset-0 rounded-[8px] bg-white dark:bg-[#1E1E1C] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_1px_rgba(0,0,0,0.04)] -z-1"
                />
              )}
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Panels ──────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-6">
              <div className="h-5 w-48 bg-black/[0.05] dark:bg-white/[0.05] animate-pulse rounded-md mb-3" />
              <div className="h-4 w-72 bg-black/[0.05] dark:bg-white/[0.05] animate-pulse rounded-md mb-4" />
              <div className="h-8 w-full bg-black/[0.05] dark:bg-white/[0.05] animate-pulse rounded-md" />
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
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
                    <h2 className="apple-headline text-foreground">Active Monitored Sites</h2>
                  </div>
                  <Link href="/sites" className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1 apple-press-subtle">
                    Manage sites <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {sites.length === 0 ? (
                  <div className="bg-card border border-dashed border-black/[0.1] dark:border-white/[0.1] rounded-2xl p-6 text-center">
                    <p className="text-[13px] text-text-secondary mb-3">No sites currently connected to the Agent SDK.</p>
                    <Link href="/sites" className="text-[12px] font-semibold bg-black/[0.05] dark:bg-white/[0.08] text-foreground px-3.5 py-1.5 rounded-[8px] hover:bg-black/[0.08] transition-colors apple-press inline-block">
                      Connect your first site
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {sites.slice(0, 3).map((site) => (
                      <Link
                        key={site.id}
                        href="/sites"
                        className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-4.5 hover:shadow-md transition-all apple-press-subtle flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[14px] font-bold text-foreground truncate">{site.name}</span>
                            <span
                              className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                                site.sdk_status === "active"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground border-transparent"
                              )}
                            >
                              {site.sdk_status === "active" ? "SDK Active" : "No SDK"}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-text-secondary truncate mb-2">
                            {site.github_repo || site.url || "No repo linked"}
                          </p>
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-2.5 border-t border-black/[0.04] dark:border-white/[0.06]">
                          <span className="uppercase text-[10px] font-bold tracking-wide">{site.framework || "app"}</span>
                          <span>Seen {timeAgo(site.sdk_last_seen)}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Section: Recent Incidents */}
              <div>
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <h2 className="apple-headline text-foreground">Recent Production Errors & Fixes</h2>
                  </div>
                  <Link href="/incidents" className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1 apple-press-subtle">
                    View all incidents <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {incidents.length === 0 ? (
                  <div className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-6 text-center">
                    <p className="text-[13px] text-text-secondary">No production errors captured yet. Your active sites are running cleanly.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {incidents.slice(0, 3).map((inc) => {
                      const meta = getIncidentStatusMeta(inc.status);
                      const StatusIcon = meta.icon;
                      return (
                        <div
                          key={inc.id}
                          className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[14px] font-bold text-foreground truncate">{inc.error_title}</span>
                              <span className={cn("text-[11px] font-semibold border px-2 py-0.5 rounded-full flex items-center gap-1", meta.cls)}>
                                <StatusIcon className="h-3 w-3" />
                                {meta.label}
                              </span>
                            </div>
                            <div className="text-[12px] font-mono text-text-secondary truncate">
                              {inc.stack_file}:{inc.stack_lineno || "?"} • {inc.event_count} occurrence{inc.event_count !== 1 ? "s" : ""}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {inc.pr_url ? (
                              <a
                                href={inc.pr_url}
                                target="_blank"
                                rel="noreferrer"
                                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold text-[12px] px-3.5 py-1.5 rounded-[8px] border border-purple-500/20 flex items-center gap-1.5 apple-press"
                              >
                                <GitPullRequest className="h-3.5 w-3.5" />
                                <span>PR #{inc.pr_number || "Draft"}</span>
                                <ExternalLink className="h-3 w-3 opacity-60" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">{timeAgo(inc.created_at)}</span>
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
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <h2 className="apple-headline text-foreground">Recent Chaos Scans</h2>
                  </div>
                  <Link href="/sessions/new" className="text-[12px] font-semibold text-primary hover:underline flex items-center gap-1 apple-press-subtle">
                    New scan <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                {sessions.length === 0 ? (
                  <div className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-6 text-center">
                    <p className="text-[13px] text-text-secondary mb-3">No chaos test sessions run yet.</p>
                    <Link href="/sessions/new" className="text-[12px] font-semibold bg-primary text-white px-3.5 py-1.5 rounded-[8px] apple-press inline-block">
                      Start your first test
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {sessions.slice(0, 3).map((s) => {
                      const isRunning = !["complete", "completed", "failed"].includes(s.status.toLowerCase());
                      const linkTarget = isRunning ? `/sessions/${s.id}` : `/sessions/${s.id}/report`;
                      const isFailed = s.status.toLowerCase() === "failed";
                      const isRetrying = retryingSessionId === s.id;
                      return (
                        <div
                          key={s.id}
                          className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-4.5 transition-all shadow-2xs hover:shadow-md block apple-press-subtle"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <Link href={linkTarget} className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[15px] font-bold text-foreground">{s.appName}</span>
                              {getStatusBadge(s.status)}
                            </Link>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[12px] text-muted-foreground">{s.date}</span>
                              {isFailed && (
                                <button
                                  type="button"
                                  onClick={() => retrySession(s.id)}
                                  disabled={isRetrying}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-[#E04E16] disabled:opacity-50 cursor-pointer apple-press"
                                >
                                  <RefreshCw className={cn("h-3 w-3", isRetrying && "animate-spin")} />
                                  {isRetrying ? "Retrying…" : "Retry scan"}
                                </button>
                              )}
                            </div>
                          </div>
                          <Link href={linkTarget} className="block">
                            <div className="text-[12px] font-mono text-text-secondary truncate mb-3">{s.appUrl}</div>
                            <div className="flex items-center gap-6 text-[12px]">
                              <div>
                                <span className="text-muted-foreground mr-1.5">Endpoints:</span>
                                <span className="font-bold text-foreground">{s.endpointsTested}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground mr-1.5">Failures:</span>
                                <span className={cn("font-bold", s.failuresFound > 0 ? "text-red-500" : "text-foreground")}>
                                  {s.failuresFound}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground mr-1.5">Patches:</span>
                                <span className={cn("font-bold", s.fixesGenerated > 0 ? "text-emerald-500" : "text-foreground")}>
                                  {s.fixesGenerated}
                                </span>
                              </div>
                            </div>
                          </Link>
                          {retryError && retryErrorSessionId === s.id && (
                            <p role="alert" className="mt-2 text-[11px] font-medium text-red-500">{retryError}</p>
                          )}
                        </div>
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
                <div className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-12 text-center">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="apple-title-3 text-foreground mb-1">No Incidents Recorded</h3>
                  <p className="apple-body text-text-secondary text-[13px]">When errors occur on monitored sites, they will appear here with auto-fix PRs.</p>
                </div>
              ) : (
                incidents.map((inc) => {
                  const meta = getIncidentStatusMeta(inc.status);
                  const StatusIcon = meta.icon;
                  return (
                    <div key={inc.id} className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-5 flex flex-col gap-3 shadow-2xs">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[16px] font-bold text-foreground">{inc.error_title}</span>
                            <span className={cn("text-[11px] font-semibold border px-2.5 py-0.5 rounded-full flex items-center gap-1", meta.cls)}>
                              <StatusIcon className="h-3 w-3" />
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-[12px] font-mono text-text-secondary">
                            {inc.stack_file}:{inc.stack_lineno || "?"} • {inc.environment}
                          </p>
                        </div>

                        {inc.pr_url && (
                          <a
                            href={inc.pr_url}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold text-[12px] px-3.5 py-2 rounded-[8px] border border-purple-500/20 flex items-center gap-1.5 apple-press shrink-0"
                          >
                            <GitPullRequest className="h-4 w-4" />
                            <span>View PR #{inc.pr_number || "Draft"}</span>
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        )}
                      </div>

                      {inc.fix_summary && (
                        <div className="bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.07] rounded-xl p-3 text-[12px] text-text-secondary">
                          <span className="font-bold text-foreground">Fix Summary: </span>
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
                <div className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-12 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="apple-title-3 text-foreground mb-1">No Tests Run Yet</h3>
                  <p className="apple-body text-text-secondary text-[13px] mb-4">Run an autonomous chaos test against any API endpoint.</p>
                  <Link href="/sessions/new" className="bg-primary text-white text-[13px] font-semibold px-4 py-2 rounded-[10px] apple-press inline-block shadow-xs">
                    Run New Test
                  </Link>
                </div>
              ) : (
                sessions.map((s) => {
                  const isRunning = !["complete", "completed", "failed"].includes(s.status.toLowerCase());
                  const linkTarget = isRunning ? `/sessions/${s.id}` : `/sessions/${s.id}/report`;
                  const isFailed = s.status.toLowerCase() === "failed";
                  const isRetrying = retryingSessionId === s.id;
                  return (
                    <div
                      key={s.id}
                      className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-5 transition-all shadow-2xs hover:shadow-md block apple-press-subtle"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Link href={linkTarget} className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[16px] font-bold text-foreground">{s.appName}</span>
                          {getStatusBadge(s.status)}
                        </Link>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[13px] text-muted-foreground">{s.date}</span>
                          {isFailed && (
                            <button
                              type="button"
                              onClick={() => retrySession(s.id)}
                              disabled={isRetrying}
                              className="inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:text-[#E04E16] disabled:opacity-50 cursor-pointer apple-press"
                            >
                              <RefreshCw className={cn("h-3 w-3", isRetrying && "animate-spin")} />
                              {isRetrying ? "Retrying…" : "Retry scan"}
                            </button>
                          )}
                        </div>
                      </div>
                      <Link href={linkTarget} className="block">
                        <p className="text-[13px] font-mono text-text-secondary truncate mb-4">{s.appUrl}</p>
                        <div className="flex items-center gap-8">
                          <div>
                            <div className="apple-caption text-muted-foreground mb-0.5">Endpoints</div>
                            <div className="text-[18px] font-extrabold text-foreground">{s.endpointsTested}</div>
                          </div>
                          <div>
                            <div className="apple-caption text-muted-foreground mb-0.5">Failures</div>
                            <div className={cn("text-[18px] font-extrabold", s.failuresFound > 0 ? "text-red-500" : "text-foreground")}>
                              {s.failuresFound}
                            </div>
                          </div>
                          <div>
                            <div className="apple-caption text-muted-foreground mb-0.5">Patches</div>
                            <div className={cn("text-[18px] font-extrabold", s.fixesGenerated > 0 ? "text-emerald-500" : "text-foreground")}>
                              {s.fixesGenerated}
                            </div>
                          </div>
                        </div>
                      </Link>
                      {retryError && retryErrorSessionId === s.id && (
                        <p role="alert" className="mt-2 text-[12px] font-medium text-red-500">{retryError}</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* 4. SITES TAB */}
          {activeTab === "sites" && (
            <div className="flex flex-col gap-3.5">
              {sites.length === 0 ? (
                <div className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-12 text-center">
                  <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <h3 className="apple-title-3 text-foreground mb-1">No Sites Registered</h3>
                  <p className="apple-body text-text-secondary text-[13px] mb-4">Connect a website or API with the PatchFlow Agent SDK.</p>
                  <Link href="/sites" className="bg-primary text-white text-[13px] font-semibold px-4 py-2 rounded-[10px] apple-press inline-block shadow-xs">
                    Add Monitored Site
                  </Link>
                </div>
              ) : (
                sites.map((site) => (
                  <div key={site.id} className="bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl p-5 flex items-center justify-between shadow-2xs">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[16px] font-bold text-foreground">{site.name}</span>
                        <span
                          className={cn(
                            "text-[11px] font-semibold px-2.5 py-0.5 rounded-full border",
                            site.sdk_status === "active"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground border-transparent"
                          )}
                        >
                          {site.sdk_status === "active" ? "SDK Active" : "Not Installed"}
                        </span>
                      </div>
                      <p className="text-[12px] font-mono text-text-secondary">
                        {site.github_repo ? `Repo: ${site.github_repo}` : "No repository attached"} • Framework: {site.framework || "auto"}
                      </p>
                    </div>

                    <Link
                      href="/sites"
                      className="bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] border border-black/[0.06] dark:border-white/[0.08] text-foreground text-[12px] font-semibold px-3.5 py-1.5 rounded-[8px] apple-press"
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
