"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavbarProps {
  variant?: "landing" | "app";
}

export default function Navbar({ variant = "landing" }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-[box-shadow,background-color] duration-300",
        "bg-[#FAFAF9]/80 dark:bg-[#0D0D0C]/80 backdrop-blur-xl saturate-[180%]",
        "border-b border-black/[0.05] dark:border-white/[0.08]",
        scrolled
          ? "shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
          : "shadow-none"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        {/* Left: Brand with Apple-grade tactile downscale */}
        <Link
          href={variant === "app" ? "/dashboard" : "/"}
          className="flex items-center gap-2.5 font-bold text-foreground apple-press group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-b from-[#FF5A1F] to-[#E04E16] text-white shadow-[0_2px_8px_rgba(255,90,31,0.35)] transition-transform duration-200 group-hover:scale-105">
            <Activity className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-[17px] tracking-tight font-extrabold text-[#111110] dark:text-[#F5F5F4]">
            PatchFlow
          </span>
        </Link>

        {/* Center: Nav links with tactile press and optical tracking */}
        {variant === "landing" && (
          <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-full bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06]">
            <Link
              href="#features"
              className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-foreground/70 hover:text-foreground hover:bg-white/60 dark:hover:bg-white/10 transition-all apple-press-subtle"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-foreground/70 hover:text-foreground hover:bg-white/60 dark:hover:bg-white/10 transition-all apple-press-subtle"
            >
              How it works
            </Link>
            <Link
              href="/pricing"
              className="px-3.5 py-1.5 rounded-full text-[13px] font-medium text-foreground/70 hover:text-foreground hover:bg-white/60 dark:hover:bg-white/10 transition-all apple-press-subtle"
            >
              Pricing
            </Link>
          </nav>
        )}

        {/* Right side: Action CTA */}
        <div className="flex items-center gap-3">
          {variant === "landing" ? (
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "sm" }),
                "apple-press h-9 px-4 rounded-[10px] shadow-[0_2px_8px_rgba(255,90,31,0.25)] font-semibold text-[13px]"
              )}
            >
              Login with GitHub
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary border border-primary/20 apple-press">
                U
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
