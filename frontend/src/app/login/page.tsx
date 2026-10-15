"use client";

import Link from "next/link";
import { Activity, ArrowLeft } from "lucide-react";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api-config";

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpiredDismissed, setSessionExpiredDismissed] = useState(false);
  const searchParams = useSearchParams();
  const sessionExpired = !sessionExpiredDismissed && searchParams.get("expired") === "1";

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("expired=")) {
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  const handleGitHubLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/github/login`);
      if (!response.ok) {
        throw new Error("Failed to get login URL from backend");
      }
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Backend did not return redirect URL");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAF9] dark:bg-[#0D0D0C] px-4 selection:bg-[#FF5A1F]/15 selection:text-[#FF5A1F]">
      <div className="w-full max-w-md bg-white/95 dark:bg-[#161615]/95 backdrop-blur-2xl rounded-3xl border border-black/[0.08] dark:border-white/[0.1] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.6)] flex flex-col items-center text-center">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 mb-8 apple-press group">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-b from-[#FF5A1F] to-[#E04E16] text-white shadow-[0_2px_8px_rgba(255,90,31,0.35)] transition-transform duration-200 group-hover:scale-105">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-[#111110] dark:text-[#F5F5F4]">
            PatchFlow
          </span>
        </Link>

        <h1 className="apple-title-2 text-foreground mb-2">Welcome back</h1>
        <p className="apple-body text-text-secondary mb-8 text-[14px]">
          Sign in with your GitHub account to access your repositories
        </p>

        {sessionExpired && (
          <div className="w-full p-3.5 mb-6 text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span>Your session has expired. Please sign in again.</span>
            </div>
            <button
              type="button"
              onClick={() => setSessionExpiredDismissed(true)}
              className="text-amber-700 hover:text-amber-900 dark:text-amber-400 text-sm font-bold px-1.5 apple-press-subtle"
              aria-label="Dismiss banner"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="w-full p-3.5 mb-6 text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl text-left shadow-2xs">
            Error: {error}
          </div>
        )}

        <button
          onClick={handleGitHubLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#24292e] hover:bg-[#1a1e22] dark:bg-white dark:hover:bg-neutral-100 dark:text-black text-white font-semibold py-3.5 px-4 shadow-[0_2px_10px_rgba(0,0,0,0.15)] apple-press disabled:opacity-50 cursor-pointer text-[14px] tracking-tight"
        >
          <svg className="h-5 w-5 fill-current" viewBox="0 0 16 16" version="1.1" aria-hidden="true">
            <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span>{loading ? "Redirecting..." : "Continue with GitHub"}</span>
        </button>

        <p className="text-[12px] text-muted-foreground mt-6 leading-relaxed">
          By continuing, you agree to our{" "}
          <Link href="#" className="underline hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="#" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>

        <div className="w-full border-t border-black/[0.06] dark:border-white/[0.08] my-6" />

        <Link
          href="/"
          className="text-[13px] font-semibold text-primary hover:text-[#E04E16] flex items-center gap-1.5 apple-press-subtle"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to home</span>
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF9] dark:bg-[#0D0D0C]">
        <div className="h-8 w-8 rounded-full border-[3px] border-primary border-r-transparent animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
