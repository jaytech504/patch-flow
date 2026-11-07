import { cn } from "@/lib/utils";

/**
 * Skeleton — a shimmer placeholder for loading states.
 *
 * Uses a CSS background-position animation so it works without any JS
 * and respects prefers-reduced-motion automatically via globals.css.
 *
 * Usage:
 *   <Skeleton className="h-8 w-32 rounded-xl" />
 *   <Skeleton className="h-4 w-full rounded" />
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        // Base
        "relative overflow-hidden rounded-md bg-black/[0.06] dark:bg-white/[0.06]",
        // Shimmer — a wide gradient that slides left→right
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 dark:before:via-white/[0.08] before:to-transparent",
        "before:animate-shimmer",
        className
      )}
    />
  );
}
