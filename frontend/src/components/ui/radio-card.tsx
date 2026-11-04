import * as React from "react";
import { cn } from "../../lib/utils";

export interface RadioCardProps {
  id: string;
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: string;
  badge?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const RadioCard: React.FC<RadioCardProps> = ({
  id,
  name,
  value,
  checked,
  onChange,
  title,
  description,
  badge,
  icon,
  disabled = false,
  className,
}) => {
  return (
    <label
      htmlFor={id}
      className={cn(
        "relative flex cursor-pointer rounded-lg border-2 p-4 transition-all focus-within:ring-2 focus-within:ring-[#FF6A00] focus-within:ring-offset-2 min-h-[56px] select-none",
        checked
          ? "border-[#FF6A00] bg-[#FF6A00]/5 dark:bg-[#FF6A00]/10"
          : "border-border hover:border-muted-foreground/30 bg-card",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input
        type="radio"
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon && <div className="mt-0.5 text-[#FF6A00] shrink-0">{icon}</div>}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-sm">{title}</span>
              {badge && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                  {badge}
                </span>
              )}
            </div>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        <div
          className={cn(
            "h-4 w-4 rounded-full border border-primary shrink-0 flex items-center justify-center mt-0.5",
            checked ? "border-[#FF6A00] bg-[#FF6A00]" : "border-muted-foreground"
          )}
        >
          {checked && <div className="h-1.5 w-1.5 rounded-full bg-[#0B1F3B]" />}
        </div>
      </div>
    </label>
  );
};
