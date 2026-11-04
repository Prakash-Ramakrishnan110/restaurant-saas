import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionDisabled = false,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-border bg-card/50",
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FF6A00]/10 text-[#FF6A00] mb-4">
        <Icon className="h-8 w-8 stroke-[1.5]" />
      </div>
      <h3 className="text-lg font-bold text-foreground font-heading">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <div className="mt-6">
          <Button type="button" onClick={onAction} disabled={actionDisabled}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
