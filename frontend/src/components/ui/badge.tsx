import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-primary/40 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary border border-primary/25 shadow-2xs [a]:hover:bg-primary/20",
        secondary:
          "bg-black/[0.04] dark:bg-white/[0.06] text-foreground/80 border border-black/[0.06] dark:border-white/[0.08] [a]:hover:bg-black/[0.08]",
        destructive:
          "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 [a]:hover:bg-red-500/20",
        outline:
          "border border-black/[0.1] dark:border-white/[0.12] text-foreground/80 bg-white/60 dark:bg-white/[0.02] backdrop-blur-xs [a]:hover:bg-black/[0.04]",
        ghost:
          "hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 [a]:hover:bg-emerald-500/20",
        warning:
          "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 [a]:hover:bg-amber-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
