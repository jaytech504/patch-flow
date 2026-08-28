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
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9] p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-[#E7E5E2] p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h2 className="text-xl font-bold text-[#111110] tracking-tight mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-[#6F6B66] mb-6 leading-relaxed">
          An unexpected error occurred while loading this view. You can try refreshing the view or return to the dashboard.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => reset()}
            className="w-full sm:w-auto bg-[#FF5A1F] hover:bg-[#E04D18] text-white gap-2 font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full border-[#E7E5E2] text-[#111110] hover:bg-[#F3F2F0] gap-2 font-medium"
            >
              <Home className="h-4 w-4" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
