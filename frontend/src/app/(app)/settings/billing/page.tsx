"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api-config";
import { authFetch } from "@/lib/auth-fetch";
import {
  CreditCard,
  Zap,
  Check,
  Shield,
  Flame,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Server,
  Activity,
  X,
} from "lucide-react";

interface SubscriptionData {
  tier: string;
  tier_name: string;
  status: string;
  limits: {
    max_monitored_sites: number;
    max_monthly_auto_fixes: number;
    max_monthly_chaos_scans: number;
    auto_fixes_enabled: boolean;
    compiler_build_check: boolean;
    ai_priority: string;
  };
  usage: {
    monitored_sites_count: number;
    monthly_incident_fixes_used: number;
    monthly_chaos_scans_used: number;
  };
  renews_at: string | null;
  ends_at: string | null;
  has_active_subscription: boolean;
}

export default function BillingSettingsPage() {
  const [subData, setSubData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchSubscription();
    if (searchParams.get("checkout") === "success") {
      setSuccessMessage("Thank you! Your subscription is now active.");
      // Clean query parameter from the URL so page refreshes don't re-trigger banner
      if (typeof window !== "undefined") {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [searchParams]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await authFetch("/api/billing/subscription");
      if (res.ok) {
        const data = await res.json();
        setSubData(data);
      }
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: "pro" | "team") => {
    try {
      setActionLoading(tier);
      const res = await authFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          billing_cycle: billingCycle,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        }
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to start checkout session.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to initialize checkout.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setActionLoading("portal");
      const res = await authFetch("/api/billing/portal", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.portal_url) {
          window.open(data.portal_url, "_blank");
        }
      } else {
        const err = await res.json();
        alert(err.detail || "Customer portal is only available for active subscriptions.");
      }
    } catch (err) {
      console.error("Portal error:", err);
      alert("Could not open billing portal.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const currentTier = (subData?.tier || "free").toLowerCase();

  return (
    <div className="space-y-10 max-w-6xl mx-auto py-4">
      {/* Header */}
      <div>
        <h1 className="apple-title-2 text-foreground">
          Billing & Subscription
        </h1>
        <p className="apple-body text-text-secondary text-[13px] mt-1">
          Manage your plan, track monthly usage quotas, and download invoices.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[13px] font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Check className="h-5 w-5 text-emerald-500 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/20 transition-colors apple-press-subtle"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Current Plan Overview Card */}
      <div className="p-6 md:p-8 rounded-2xl bg-card border border-black/[0.06] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-black/[0.05] dark:border-white/[0.06]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_2px_8px_rgba(255,90,31,0.12)]">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="apple-title-3 text-foreground">
                  {subData?.tier_name || "Hobby (Free)"}
                </h2>
                <Badge
                  variant={currentTier !== "free" ? "default" : "secondary"}
                  className="uppercase text-[10px] tracking-wider font-bold"
                >
                  {subData?.status === "active" ? "Active" : currentTier === "free" ? "Free Plan" : subData?.status}
                </Badge>
              </div>
              <p className="text-[12px] text-text-secondary mt-1">
                {currentTier === "free"
                  ? "Real-time error monitoring & email alerts. Upgrade to unlock autonomous fixes."
                  : subData?.renews_at
                  ? `Renews on ${new Date(subData.renews_at).toLocaleDateString()}`
                  : "Active subscription"}
              </p>
            </div>
          </div>

          {subData?.has_active_subscription && (
            <Button
              variant="outline"
              onClick={handleOpenPortal}
              disabled={actionLoading === "portal"}
              className="flex items-center gap-2"
            >
              <span>Manage Billing & Invoices</span>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Usage Progress Meters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-6">
          {/* 1. Monitored Sites */}
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary mb-2.5">
              <span>Monitored Sites (SDK)</span>
              <span>
                {subData?.usage?.monitored_sites_count ?? 0} /{" "}
                {subData?.limits?.max_monitored_sites !== undefined && subData.limits.max_monitored_sites < 1000
                  ? subData.limits.max_monitored_sites
                  : (currentTier === "free" ? 1 : currentTier === "pro" ? 5 : "∞")}
              </span>
            </div>
            <div className="w-full bg-black/[0.06] dark:bg-white/[0.08] rounded-full h-[6px] overflow-hidden">
              <div
                className="bg-primary h-[6px] rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    ((subData?.usage?.monitored_sites_count ?? 0) /
                      (subData?.limits?.max_monitored_sites || (currentTier === "free" ? 1 : 5))) *
                      100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* 2. Monthly Live SDK Auto-Patches */}
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary mb-2.5">
              <span>Live SDK Auto-Patches</span>
              <span>
                {currentTier === "free"
                  ? "Locked on Free"
                  : `${subData?.usage?.monthly_incident_fixes_used ?? 0} / ${
                      subData?.limits?.max_monthly_auto_fixes !== undefined && subData.limits.max_monthly_auto_fixes < 1000
                        ? subData.limits.max_monthly_auto_fixes
                        : (currentTier === "pro" ? 100 : "∞")
                    }`}
              </span>
            </div>
            <div className="w-full bg-black/[0.06] dark:bg-white/[0.08] rounded-full h-[6px] overflow-hidden">
              <div
                className={cn(
                  "h-[6px] rounded-full transition-all",
                  currentTier === "free" ? "bg-muted-foreground/30" : "bg-emerald-500"
                )}
                style={{
                  width: `${
                    currentTier === "free"
                      ? 0
                      : Math.min(
                          ((subData?.usage?.monthly_incident_fixes_used ?? 0) /
                            (subData?.limits?.max_monthly_auto_fixes || 100)) *
                            100,
                          100
                        )
                  }%`,
                }}
              />
            </div>
          </div>

          {/* 3. Monthly Chaos Scans */}
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center justify-between text-[11px] font-semibold text-text-secondary mb-2.5">
              <span>Chaos Scans (with Auto-PRs)</span>
              <span>
                {subData?.usage?.monthly_chaos_scans_used ?? 0} /{" "}
                {subData?.limits?.max_monthly_chaos_scans !== undefined && subData.limits.max_monthly_chaos_scans < 1000
                  ? subData.limits.max_monthly_chaos_scans
                  : (currentTier === "free" ? 3 : currentTier === "pro" ? 30 : "∞")}
              </span>
            </div>
            <div className="w-full bg-black/[0.06] dark:bg-white/[0.08] rounded-full h-[6px] overflow-hidden">
              <div
                className="bg-primary h-[6px] rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    ((subData?.usage?.monthly_chaos_scans_used ?? 0) /
                      (subData?.limits?.max_monthly_chaos_scans || (currentTier === "free" ? 3 : 30))) *
                      100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade / Change Plan Section */}
      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="apple-title-3 text-foreground">Available Plans</h3>
            <p className="apple-body text-text-secondary text-[13px]">
              Upgrade to unlock autonomous fixes, compiler build checks, and higher quotas.
            </p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-card shadow-2xs">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all apple-press-subtle",
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground shadow-[0_1px_4px_rgba(255,90,31,0.3)]"
                  : "text-text-secondary hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={cn(
                "px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all flex items-center gap-1.5 apple-press-subtle",
                billingCycle === "annual"
                  ? "bg-primary text-primary-foreground shadow-[0_1px_4px_rgba(255,90,31,0.3)]"
                  : "text-text-secondary hover:text-foreground"
              )}
            >
              <span>Annual</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded">
                -20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          {/* Free Tier */}
          <div
            className={cn(
              "flex flex-col p-6 rounded-2xl border bg-card transition-all",
              currentTier === "free" ? "border-black/[0.1] dark:border-white/[0.12] ring-1 ring-black/[0.06] dark:ring-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.04)]" : "border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.1] dark:hover:border-white/[0.12]"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="apple-headline text-foreground">Hobby</h4>
              {currentTier === "free" && (
                <Badge variant="outline" className="text-xs">Current Plan</Badge>
              )}
            </div>
            <div className="text-[28px] font-[800] text-foreground tracking-tight mb-4">$0 <span className="text-[12px] font-normal text-text-secondary">/ month</span></div>
            <p className="text-[12px] text-text-secondary mb-6">Real-time error logs & email alerts for 1 site.</p>
            <ul className="space-y-2.5 text-[12px] text-text-secondary mb-6 flex-1">
              <li className="flex items-center gap-2 text-foreground font-[500]"><Check className="h-3.5 w-3.5 text-emerald-500" /> 1 Monitored Site</li>
              <li className="flex items-center gap-2 text-foreground font-[500]"><Check className="h-3.5 w-3.5 text-emerald-500" /> Real-time Email Alerts</li>
              <li className="flex items-center gap-2 text-foreground font-[500]"><Check className="h-3.5 w-3.5 text-emerald-500" /> 3 Chaos Scans / mo (All 18 modes)</li>
              <li className="flex items-center gap-2 text-muted-foreground/60 line-through"><span>✕ Autonomous Fixes & PRs</span></li>
              <li className="flex items-center gap-2 text-muted-foreground/60 line-through"><span>✕ Compiler Build Checks</span></li>
            </ul>
            <Button variant="outline" disabled={currentTier === "free"} className="w-full">
              {currentTier === "free" ? "Current Plan" : "Downgrade"}
            </Button>
          </div>

          {/* Pro Tier ($14/mo) */}
          <div
            className={cn(
              "flex flex-col p-6 rounded-2xl border bg-card relative transition-all",
              currentTier === "pro"
                ? "border-primary ring-2 ring-primary/30 shadow-[0_4px_24px_rgba(255,90,31,0.12)]"
                : "border-primary/40 hover:border-primary shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_20px_rgba(255,90,31,0.1)]"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="apple-headline text-foreground">Developer Pro</h4>
              <Badge className="bg-primary text-primary-foreground text-[10px] uppercase font-bold">
                {currentTier === "pro" ? "Current Plan" : "Recommended"}
              </Badge>
            </div>
            <div className="text-[28px] font-[800] text-foreground tracking-tight mb-1">
              {billingCycle === "monthly" ? "$14" : "$11"}
              <span className="text-[12px] font-normal text-text-secondary"> / month</span>
            </div>
            {billingCycle === "annual" && (
              <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-[600] mb-3">
                billed $132/year (Save $36)
              </div>
            )}
            <p className="text-[12px] text-text-secondary mb-6">Autonomous GitHub fixes & compiler verification.</p>
            <ul className="space-y-2.5 text-[12px] text-foreground font-[500] mb-6 flex-1">
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> 5 Monitored Sites</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> 100 Auto-Patches / mo</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Pre-Merge Build Verification (tsc)</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> 30 Chaos Scans / mo</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Priority Gemma AI Fast-Lane</li>
            </ul>
            <Button
              onClick={() => handleUpgrade("pro")}
              disabled={currentTier === "pro" || actionLoading === "pro"}
              className="w-full font-semibold apple-press rounded-xl shadow-[0_2px_8px_rgba(255,90,31,0.2)]"
            >
              {actionLoading === "pro" ? "Redirecting..." : currentTier === "pro" ? "Current Plan" : "Upgrade to Pro ($14/mo)"}
            </Button>
          </div>

          {/* Team Tier ($42/mo) */}
          <div
            className={cn(
              "flex flex-col p-6 rounded-2xl border bg-card transition-all",
              currentTier === "team" ? "border-primary ring-2 ring-primary/30 shadow-[0_4px_24px_rgba(255,90,31,0.12)]" : "border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.1] dark:hover:border-white/[0.12] shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="apple-headline text-foreground">Team & Business</h4>
              {currentTier === "team" && (
                <Badge variant="default" className="text-[10px]">Current Plan</Badge>
              )}
            </div>
            <div className="text-[28px] font-[800] text-foreground tracking-tight mb-1">
              {billingCycle === "monthly" ? "$42" : "$34"}
              <span className="text-[12px] font-normal text-text-secondary"> / month</span>
            </div>
            {billingCycle === "annual" && (
              <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-[600] mb-3">
                billed $408/year (Save $96)
              </div>
            )}
            <p className="text-[12px] text-text-secondary mb-6">Unlimited sites and dedicated AI queue for teams.</p>
            <ul className="space-y-2.5 text-[12px] text-foreground font-[500] mb-6 flex-1">
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Unlimited Monitored Sites</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Unlimited Auto-Patches</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Unlimited Chaos Scans</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> Dedicated Real-Time AI Queue</li>
              <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-500" /> 1-on-1 Dedicated Support</li>
            </ul>
            <Button
              onClick={() => handleUpgrade("team")}
              disabled={currentTier === "team" || actionLoading === "team"}
              variant={currentTier === "team" ? "outline" : "default"}
              className="w-full font-semibold apple-press rounded-xl"
            >
              {actionLoading === "team" ? "Redirecting..." : currentTier === "team" ? "Current Plan" : "Upgrade to Team ($42/mo)"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
