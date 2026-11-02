import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

/**
 * Shared chrome for public legal pages (Privacy Policy, Terms of Service).
 *
 * These are server-rendered, fully indexable pages that reuse the landing
 * navbar + footer so visitors can always navigate back home.
 */
export default function LegalPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-[#FF5A1F]/15 selection:text-[#FF5A1F]">
      <Navbar variant="landing" />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-16 md:py-24">
          <header className="mb-12">
            <h1 className="apple-display text-foreground mb-3">{title}</h1>
            {subtitle && (
              <p className="apple-footnote text-text-secondary font-medium tracking-wide uppercase">
                {subtitle}
              </p>
            )}
          </header>

          <div className="space-y-10 text-[15px] leading-relaxed text-text-secondary [&_h2]:apple-title-3 [&_h2]:text-foreground [&_h2]:mb-4 [&_h2]:scroll-mt-20 [&_h3]:apple-headline [&_h3]:text-foreground [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:marker:text-primary/60 [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-primary [&_strong]:text-foreground [&_strong]:font-semibold [&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-black/[0.04] dark:[&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
