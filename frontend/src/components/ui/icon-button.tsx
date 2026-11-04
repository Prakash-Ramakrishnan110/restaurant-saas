import * as React from "react";
import { cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string;
  tooltip?: string;
  variant?: "ghost" | "outline" | "default" | "destructive";
  size?: "sm" | "md" | "lg";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      "aria-label": ariaLabel,
      tooltip,
      variant = "ghost",
      size = "md",
      children,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-8 w-8 min-h-[32px] min-w-[32px] p-1.5",
      md: "h-10 w-10 min-h-[44px] min-w-[44px] p-2",
      lg: "h-12 w-12 min-h-[48px] min-w-[48px] p-3",
    }[size];

    const variantClasses = {
      ghost: "hover:bg-accent hover:text-accent-foreground text-foreground",
      outline:
        "border border-input bg-background hover:bg-accent hover:text-accent-foreground text-foreground",
      default: "bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    }[variant];

    const btn = (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6A00] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          sizeClasses,
          variantClasses,
          className
        )}
        {...props}
      >
        {children}
      </button>
    );

    if (tooltip) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{btn}</TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return btn;
  }
);
IconButton.displayName = "IconButton";
