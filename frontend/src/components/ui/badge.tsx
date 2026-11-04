import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Table Status Badges
        available:
          "border-[#86EFAC] bg-[#DCFCE7] text-[#15803D]",
        occupied:
          "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]",
        reserved:
          "border-[#D8B4FE] bg-[#F3E8FF] text-[#7E22CE]",
        cleaning:
          "border-[#FDE68A] bg-[#FEF3C7] text-[#B45309]",
        blocked:
          "border-[#D1D5DB] bg-[#F3F4F6] text-[#374151]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
