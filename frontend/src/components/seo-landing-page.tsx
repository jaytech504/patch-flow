import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { FaqSection, type FaqItem } from "@/components/faq-section";
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/seo";

export interface SeoLandingRelatedLink {
  href: string;
  label: string;
  description: string;
}

export interface SeoLandingCapability {
  title: string;
  body: string;
  icon: LucideIcon;
}

/**
 * Shared chrome for public SEO landing pages: navbar, hero, CTA, related
 * links, optional FAQ, JSON-LD breadcrumbs, and footer.
 */
export default function SeoLandingPage({
  path,
  badge,
  h1,
  intro,
  capabilities,
  related,
  faqs,
  children,
}: {
  path: string;
  badge: string;
  h1: string;
  intro: string;
  capabilities: SeoLandingCapability[];
  related: SeoLandingRelatedLink[];
  faqs: FaqItem[];
  children: React.ReactNode;
}) {
  const pageUrl = `${SITE_URL}${path}`;
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: h1,
        item: pageUrl,
      },
    ],
  };
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: h1,
    url: pageUrl,
    isPartOf: { "@type": "WebSite", name: "PatchFlow", url: SITE_URL },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-[#FF5A1F]/15 selection:text-[#FF5A1F]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPage) }}
      />
      <Navbar variant="landing" />

      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-6 pt-14 pb-12 md:pt-20 md:pb-16">
          <div className="max-w-3xl">
            <Badge
              variant="outline"
              className="mb-5 text-primary border-primary/30 uppercase tracking-widest text-xs px-3 py-1"
            >
              {badge}
            </Badge>
            <h1 className="apple-display text-foreground mb-6">{h1}</h1>
            <p className="apple-body text-text-secondary text-[16px] sm:text-[17px] leading-relaxed max-w-2xl">
              {intro}
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3.5 pt-8">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "w-full sm:w-auto h-12 px-8 font-semibold shadow-[0_2px_12px_rgba(255,90,31,0.3)] flex items-center justify-center gap-2 apple-press text-[15px]"
                )}
              >
                <span>Connect GitHub</span>
                <ArrowRight className="h-4.5 w-4.5" />
              </Link>
              <Link
                href="/demo"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full sm:w-auto h-12 px-8 font-medium text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.05] apple-press text-[15px]"
                )}
              >
                Try the demo
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {capabilities.map(({ title, body, icon: Icon }) => (
              <div
                key={title}
                className="flex flex-col p-7 bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.02)]"
              >
                <Icon className="h-6 w-6 text-primary mb-4" aria-hidden="true" />
                <p className="apple-title-3 text-foreground mb-2">{title}</p>
                <p className="apple-body text-text-secondary text-[13px] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <article className="mx-auto max-w-3xl px-6 py-16 md:py-24 space-y-16 text-[15px] leading-relaxed text-text-secondary [&_h2]:apple-title-3 [&_h2]:text-foreground [&_h2]:mb-4 [&_h2]:scroll-mt-20 [&_h3]:apple-headline [&_h3]:text-foreground [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:space-y-2 [&_ol]:mb-4 [&_ol]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:marker:text-primary/60 [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-primary [&_strong]:text-foreground [&_strong]:font-semibold [&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-black/[0.04] dark:[&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
          {children}
        </article>

        <section className="mx-auto max-w-7xl px-6 pb-8">
          <h2 className="apple-title-3 text-foreground mb-6">Related PatchFlow pages</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group p-5 bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl hover:border-primary/30 transition-colors apple-press-subtle"
              >
                <p className="font-semibold text-foreground text-[14px] mb-1 inline-flex items-center gap-1.5">
                  {link.label}
                  <ArrowRight className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                <p className="text-[13px] text-text-secondary leading-relaxed">{link.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <FaqSection
          title="Questions developers ask"
          subtitle="Straight answers about how this part of PatchFlow actually works."
          items={faqs}
        />

        <section className="border-t border-black/[0.05] dark:border-white/[0.07] bg-gradient-to-b from-card to-background py-24 md:py-32 text-center">
          <div className="mx-auto max-w-3xl px-6 flex flex-col items-center gap-7">
            <Badge
              variant="outline"
              className="text-primary border-primary/30 uppercase tracking-widest text-xs px-3 py-1"
            >
              Start Free Today
            </Badge>
            <h2 className="apple-display text-foreground">See it on your own API.</h2>
            <p className="text-[17px] text-text-secondary leading-relaxed font-normal max-w-xl">
              Connect a GitHub repository to run a chaos scan, install the SDK for production
              errors, or walk through a sample run on the live demo — no account required.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3.5">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-13 px-9 text-[16px] font-bold shadow-[0_4px_16px_rgba(255,90,31,0.35)] apple-press flex items-center gap-2"
                )}
              >
                <span>Get started with PatchFlow</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/demo"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-13 px-9 text-[16px] font-medium"
                )}
              >
                Open the demo
              </Link>
            </div>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-text-secondary pt-2">
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Hobby plan is free
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Draft PRs only — nothing auto-merges
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                FastAPI, Django, Express, Spring Boot, Flask
              </li>
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
