import Link from "next/link";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Home, Search, ArrowRight } from "lucide-react";

/**
 * Custom 404 page.
 *
 * Renders within the root layout and provides clear navigation back home and
 * to other public pages. Kept as a server component so it is fast and static.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans selection:bg-[#FF5A1F]/15 selection:text-[#FF5A1F]">
      <Navbar variant="landing" />

      <main className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="text-center max-w-lg">
          <div className="mx-auto mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
            <Search className="h-7 w-7" aria-hidden="true" />
          </div>

          <p className="apple-caption text-primary mb-3">404 · Page not found</p>
          <h1 className="apple-display text-foreground mb-4">
            This page took a different route.
          </h1>
          <p className="apple-body text-text-secondary text-[15px] leading-relaxed mb-9 max-w-md mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
            Let&apos;s get you back on track.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/"
              className={cn(
                buttonVariants({ size: "lg" }),
                "w-full sm:w-auto h-12 px-8 font-semibold shadow-[0_2px_12px_rgba(255,90,31,0.3)] flex items-center justify-center gap-2 apple-press"
              )}
            >
              <Home className="h-4.5 w-4.5" />
              <span>Back to home</span>
            </Link>
            <Link
              href="/pricing"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full sm:w-auto h-12 px-8 font-medium text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.05] apple-press"
              )}
            >
              View pricing
            </Link>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-text-secondary">
            <span className="opacity-70">Or try:</span>
            <Link href="/login" className="font-semibold text-foreground hover:text-primary inline-flex items-center gap-1 apple-press-subtle">
              Sign in <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link href="/privacy" className="font-semibold text-foreground hover:text-primary apple-press-subtle">
              Privacy
            </Link>
            <Link href="/terms" className="font-semibold text-foreground hover:text-primary apple-press-subtle">
              Terms
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
