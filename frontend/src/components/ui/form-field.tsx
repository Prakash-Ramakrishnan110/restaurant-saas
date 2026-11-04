import * as React from "react";
import { cn } from "../../lib/utils";

export interface FormFieldProps {
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    error?: boolean;
  }) => React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  description,
  error,
  required = false,
  className,
  children,
}) => {
  const descId = description ? `${id}-desc` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5 w-full text-left", className)}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      {description && (
        <p id={descId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}

      <div>{children({ id, "aria-describedby": describedBy, error: Boolean(error) })}</div>

      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
