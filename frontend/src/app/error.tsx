"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error Caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] dark:bg-[#0D0D0C] p-6">
      <div className="max-w-md w-full bg-card rounded-2xl border border-[#E7E5E2] dark:border-[#262623] p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h2 className="text-xl font-bold text-[#111110] dark:text-[#F5F5F4] tracking-tight mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-[#6F6B66] dark:text-[#9C9891] mb-6 leading-relaxed">
          An unexpected error occurred while loading this page. You can try
          again, or head back home.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto bg-[#FF5A1F] hover:bg-[#E04D18] text-white gap-2 font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full border-[#E7E5E2] dark:border-[#262623] text-[#111110] dark:text-[#F5F5F4] hover:bg-[#F3F2F0] dark:hover:bg-[#1F1F1D] gap-2 font-medium"
            >
              <Home className="h-4 w-4" />
              Back to home
            </Button>
          </Link>
        </div>

        {error?.digest && (
          <p className="mt-6 text-[11px] font-mono text-[#A3A099] dark:text-[#78756F]">
            Reference: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
