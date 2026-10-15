import Link from "next/link";
import { Activity } from "lucide-react";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-black/[0.06] dark:border-white/[0.08] bg-[#FAFAF9] dark:bg-[#0D0D0C]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Column 1: Brand */}
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-2.5 font-bold text-foreground apple-press group w-fit">
              <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-b from-[#FF5A1F] to-[#E04E16] text-white shadow-sm">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <span className="text-[16px] tracking-tight font-extrabold text-[#111110] dark:text-[#F5F5F4]">
                PatchFlow
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-sm">
              Autonomous dual-engine API reliability testing, real-time crash capture, and compiler-verified pull requests.
            </p>
            <p className="text-[12px] text-muted-foreground/80 mt-2">
              &copy; {currentYear} PatchFlow, Inc. All rights reserved.
            </p>
          </div>

          {/* Column 2: Product */}
          <div className="flex flex-col gap-3">
            <h4 className="apple-caption text-foreground/80">Product</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link
                  href="#features"
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block"
                >
                  Chaos Simulation Engine
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block"
                >
                  Pricing & Plans
                </Link>
              </li>
              <li>
                <Link
                  href="#how-it-works"
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block"
                >
                  Pre-Merge Build Verification
                </Link>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block"
                >
                  Developer Console
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div className="flex flex-col gap-3">
            <h4 className="apple-caption text-foreground/80">Ecosystem</h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block"
                >
                  GitHub Repository
                </a>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block"
                >
                  Python & Node SDKs
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block"
                >
                  Security & Architecture
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-[13px] text-muted-foreground hover:text-foreground transition-colors apple-press-subtle inline-block"
                >
                  Documentation
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
