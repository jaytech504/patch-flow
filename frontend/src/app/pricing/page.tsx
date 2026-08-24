"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Zap, Sparkles, Shield, Flame, ArrowRight, HelpCircle } from "lucide-react";

interface PlanFeature {
  title: string;
  included: boolean;
  footnote?: string;
}

interface PricingPlan {
  id: string;
  name: string;
  badge: string;
  priceMonthly: string;
  priceAnnual: string;
  periodAnnual?: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  popular: boolean;
  features: PlanFeature[];
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const plans: PricingPlan[] = [
    {
      id: "free",
      name: "Hobby",
      badge: "Free Forever",
      priceMonthly: "$0",
      priceAnnual: "$0",
      description: "Essential real-time error logging and email incident alerts for side projects.",
      buttonText: "Start Free",
      buttonHref: "/login",
      popular: false,
      features: [
        { title: "1 Monitored Site (SDK)", included: true },
        { title: "Real-Time Crash Ingestion", included: true },
        { title: "Email Incident Alerts", included: true },
        { title: "3 Chaos Scans / month", included: true },
        { title: "All 18 Chaos Failure Modes", included: true },
        { title: "7-Day Log Retention", included: true },
        { title: "Autonomous Fixes & Draft PRs", included: false, footnote: "Alerts only — upgrade for auto-patches" },
        { title: "Pre-Merge Build Verification", included: false },
        { title: "Priority AI Queue", included: false },
      ],
    },
    {
      id: "pro",
      name: "Developer Pro",
      badge: "Most Popular",
      priceMonthly: "$14",
      priceAnnual: "$11",
      periodAnnual: "billed $132/year",
      description: "Autonomous code fixes, pre-merge compiler build validation, and 5 monitored sites.",
      buttonText: "Upgrade to Pro",
      buttonHref: "/login",
      popular: true,
      features: [
        { title: "5 Monitored Sites (SDK)", included: true },
        { title: "100 Autonomous Fixes / month", included: true },
        { title: "Pre-Merge Build Checks (tsc / node)", included: true },
        { title: "Ready-to-Merge GitHub Draft PRs", included: true },
        { title: "Real-Time Email Incident Alerts", included: true },
        { title: "30 Chaos Scans / month", included: true },
        { title: "All 18 Chaos Failure Modes", included: true },
        { title: "30-Day Log Retention", included: true },
        { title: "Priority Gemma AI Fast-Lane", included: true },
      ],
    },
    {
      id: "team",
      name: "Team & Business",
      badge: "Scale & Teams",
      priceMonthly: "$42",
      priceAnnual: "$34",
      periodAnnual: "billed $408/year",
      description: "Unlimited sites, unlimited auto-patches, and dedicated AI throughput for teams.",
      buttonText: "Upgrade to Team",
      buttonHref: "/login",
      popular: false,
      features: [
        { title: "Unlimited Monitored Sites", included: true },
        { title: "Unlimited Autonomous Fixes", included: true },
        { title: "Pre-Merge Build & Custom CI Checks", included: true },
        { title: "Unlimited Chaos Scans", included: true },
        { title: "Custom Payload Injection Modes", included: true },
        { title: "Real-Time Email & Webhook Alerts", included: true },
        { title: "90-Day Log Retention", included: true },
        { title: "Dedicated Real-Time AI Queue", included: true },
        { title: "Priority 1-on-1 Support", included: true },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans">
      <Navbar variant="landing" />

      <main className="flex-1">
        {/* Header */}
        <section className="mx-auto max-w-7xl px-6 pt-12 pb-16 md:pt-16 md:pb-24 text-center">
          <Badge variant="outline" className="mb-4 text-primary border-primary/30 uppercase tracking-widest text-xs px-3 py-1">
            Simple, Transparent Pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-6">
            Invest in reliability. <br />
            <span className="text-primary">Eliminate production firefighting.</span>
          </h1>
          <p className="text-lg md:text-xl text-text-secondary font-medium max-w-2xl mx-auto mb-10">
            Start free with real-time error alerts. Upgrade to unlock autonomous, compiler-verified GitHub Pull Requests.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center gap-3 p-1.5 rounded-full border border-border bg-card shadow-sm">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-semibold transition-all",
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-text-secondary hover:text-foreground"
              )}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2",
                billingCycle === "annual"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-text-secondary hover:text-foreground"
              )}
            >
              <span>Annual Billing</span>
              <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs px-2 py-0.5 rounded-full font-bold uppercase">
                Save 20%
              </span>
            </button>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="mx-auto max-w-7xl px-6 pb-24 md:pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan) => {
              const price = billingCycle === "monthly" ? plan.priceMonthly : plan.priceAnnual;
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "flex flex-col p-8 md:p-10 rounded-2xl bg-card border transition-all duration-300 relative",
                    plan.popular
                      ? "border-primary shadow-xl ring-1 ring-primary/30 lg:-translate-y-2"
                      : "border-border shadow-sm hover:shadow-md"
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-sm">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h3>
                    <p className="text-sm text-text-secondary font-medium min-h-[40px]">{plan.description}</p>
                  </div>

                  <div className="mb-8 flex items-baseline gap-2">
                    <span className="text-5xl font-extrabold text-foreground tracking-tight">{price}</span>
                    <span className="text-sm font-semibold text-text-secondary">/ month</span>
                  </div>

                  {billingCycle === "annual" && plan.periodAnnual && (
                    <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold -mt-6 mb-6">
                      {plan.periodAnnual}
                    </div>
                  )}

                  <Link
                    href={plan.buttonHref}
                    className={cn(
                      buttonVariants({
                        variant: plan.popular ? "default" : "outline",
                        size: "lg",
                      }),
                      "w-full h-12 font-semibold mb-8 justify-center shadow-sm"
                    )}
                  >
                    <span>{plan.buttonText}</span>
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Link>

                  <div className="border-t border-border pt-6 mt-auto">
                    <div className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-4">
                      What's Included:
                    </div>
                    <ul className="space-y-3.5">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm">
                          {feat.included ? (
                            <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          ) : (
                            <span className="h-4 w-4 text-text-secondary/40 shrink-0 mt-0.5 text-center font-mono">✕</span>
                          )}
                          <div className="flex flex-col">
                            <span
                              className={cn(
                                "font-medium",
                                feat.included ? "text-foreground" : "text-text-secondary/60 line-through"
                              )}
                            >
                              {feat.title}
                            </span>
                            {feat.footnote && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                {feat.footnote}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="border-t border-border bg-muted/40 py-24 md:py-32">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground text-center mb-16">
              Frequently Asked Questions
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 bg-card border border-border rounded-xl">
                <h4 className="font-bold text-foreground text-base mb-2">How does the Free tier work?</h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  On the Free tier, you can connect 1 site and run 3 chaos scans/month. When production errors occur, you receive real-time dashboard logs and email alerts. Auto-patching and PR creation unlock when you upgrade to Pro ($14/mo).
                </p>
              </div>

              <div className="p-6 bg-card border border-border rounded-xl">
                <h4 className="font-bold text-foreground text-base mb-2">What payment methods are supported?</h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  We process payments securely via Lemon Squeezy (Merchant of Record). We accept Visa, Mastercard, American Express, Apple Pay, Google Pay, and PayPal worldwide with automatic sales tax handling.
                </p>
              </div>

              <div className="p-6 bg-card border border-border rounded-xl">
                <h4 className="font-bold text-foreground text-base mb-2">What is Pre-Merge Build Verification?</h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Before opening a PR, ReviewAgent physically executes the TypeScript compiler (<code className="font-mono text-xs">tsc --noEmit</code>) or Node runtime checks directly on the cloned repo to guarantee the patch compiles without errors.
                </p>
              </div>

              <div className="p-6 bg-card border border-border rounded-xl">
                <h4 className="font-bold text-foreground text-base mb-2">Can I cancel anytime?</h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Yes, you can upgrade, downgrade, or cancel your subscription at any time with 1-click inside your Customer Billing Portal. You will retain access until the end of your billing cycle.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
