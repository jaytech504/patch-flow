import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap outline-none select-none touch-manipulation cursor-pointer transition-[background-color,border-color,box-shadow] duration-150 active:scale-[0.972] active:transition-transform active:duration-100 ease-out focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[#E04E16] shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.22)] border border-[#E04E16]/30",
        outline:
          "border border-black/[0.09] dark:border-white/[0.12] bg-white/80 dark:bg-white/[0.04] backdrop-blur-md hover:bg-black/[0.03] dark:hover:bg-white/[0.08] text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
        secondary:
          "bg-[#F3F4F6] dark:bg-[#1F1F1D] text-secondary-foreground hover:bg-[#EBECEE] dark:hover:bg-[#282825] border border-black/[0.04] dark:border-white/[0.06]",
        ghost:
          "hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-foreground border border-transparent",
        destructive:
          "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/15 border border-red-500/20 shadow-xs",
        link: "text-primary underline-offset-4 hover:underline border border-transparent",
      },
      size: {
        default:
          "h-9 gap-1.5 px-3.5 rounded-[10px] text-[13px] font-semibold tracking-tight",
        xs: "h-6.5 gap-1 rounded-[7px] px-2 text-[11px] font-medium tracking-normal [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[8px] px-3 text-[12px] font-medium tracking-tight [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 rounded-[12px] px-5 text-[14px] font-semibold tracking-tight shadow-sm",
        icon: "size-9 rounded-[10px]",
        "icon-xs": "size-6.5 rounded-[7px] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[8px] [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-11 rounded-[12px] [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
