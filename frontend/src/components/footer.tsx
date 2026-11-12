import Link from "next/link";
import { Activity } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-black/[0.06] dark:border-white/[0.08] bg-[#FAFAF9] dark:bg-[#0D0D0C]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Column 1: Brand — spans 2 col-units on lg */}
          <div className="lg:col-span-2 flex flex-col gap-3.5">
            <Link href="/" className="flex items-center gap-2.5 font-bold text-foreground apple-press group w-fit">
              <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-b from-[#FF5A1F] to-[#E04E16] text-white shadow-sm">
                <Activity className="h-4 w-4 text-white" aria-hidden="true" />
              </div>
              <span className="text-[16px] tracking-tight font-extrabold text-[#111110] dark:text-[#F5F5F4]">
                PatchFlow
              </span>
            </Link>
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-sm">
              Autonomous API chaos testing, real-time production crash capture,
              and compiler-verified GitHub PR auto-fixes.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-3 mt-1">
              <a
                href="https://github.com/jaytech504/patch-flow"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="PatchFlow on GitHub"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {/* GitHub icon */}
                <svg className="h-4.5 w-4.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </a>
            </div>
            <p className="text-[12px] text-muted-foreground/80 mt-1">
              &copy; {currentYear} PatchFlow. All rights reserved.
            </p>
          </div>

          {/* Column 2: Product */}
          <div className="flex flex-col gap-3">
            <h4 className="apple-caption text-foreground/80">Product</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/demo" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Live Demo
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Pricing &amp; Plans
                </Link>
              </li>
              <li>
                <Link href="/#features" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/api-testing" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  API Testing
                </Link>
              </li>
              <li>
                <Link href="/chaos-testing" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Chaos Testing
                </Link>
              </li>
              <li>
                <Link href="/api-monitoring" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  API Monitoring
                </Link>
              </li>
              <li>
                <Link href="/ai-bug-fixing" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  AI Bug Fixing
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Developer Console
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Developers */}
          <div className="flex flex-col gap-3">
            <h4 className="apple-caption text-foreground/80">Developers</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/docs" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/docs#nodejs" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Node.js SDK
                </Link>
              </li>
              <li>
                <Link href="/docs#python" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Python SDK
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/jaytech504/patch-flow"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Company + Legal */}
          <div className="flex flex-col gap-3">
            <h4 className="apple-caption text-foreground/80">Company</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/privacy" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a href="mailto:support.patchflow@gmail.com" className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block">
                  Contact
                </a>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </footer>
  );
}
