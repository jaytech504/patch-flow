import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * A single FAQ entry.
 * `answer` is plain text so it can be reused verbatim in FAQPage JSON-LD.
 * `link` is an optional "learn more" call-to-action rendered in the card only
 * (it is intentionally excluded from the structured data).
 */
export interface FaqItem {
  question: string;
  answer: string;
  link?: { href: string; label: string };
}

/**
 * FAQ section with FAQPage structured-data (JSON-LD) for rich results.
 *
 * Renders as a server component so the questions and answers are fully
 * crawlable static content, with the schema injected alongside.
 */
export function FaqSection({
  title,
  subtitle,
  items,
  badge = "FAQ",
}: {
  title: string;
  subtitle?: string;
  items: FaqItem[];
  badge?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section className="border-t border-black/[0.05] dark:border-white/[0.07] bg-black/[0.01] dark:bg-white/[0.01] py-24 md:py-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge
            variant="outline"
            className="mb-4 text-primary border-primary/30 uppercase tracking-widest text-xs px-3 py-1"
          >
            {badge}
          </Badge>
          <h2 className="apple-title-1 text-foreground mb-4">{title}</h2>
          {subtitle && (
            <p className="text-[17px] text-text-secondary leading-relaxed font-normal">
              {subtitle}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {items.map((item) => (
            <div
              key={item.question}
              className="p-7 bg-card border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.02)]"
            >
              <h3 className="apple-headline text-foreground mb-2.5">
                {item.question}
              </h3>
              <p className="apple-body text-text-secondary text-[13px] leading-relaxed">
                {item.answer}
              </p>
              {item.link && (
                <Link
                  href={item.link.href}
                  className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary hover:text-[#E04E16] apple-press-subtle"
                >
                  {item.link.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
