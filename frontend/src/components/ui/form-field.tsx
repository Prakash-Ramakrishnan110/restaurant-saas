import * as React from "react";
import { cn } from "../../lib/utils";

export interface FormFieldProps {
  id?: string;
  label: string;
  description?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children:
    | React.ReactNode
    | ((props: { id: string; "aria-describedby"?: string; error?: boolean }) => React.ReactNode);
}

export const FormField: React.FC<FormFieldProps> = ({
  id = "",
  label,
  description,
  helperText,
  error,
  required = false,
  className,
  children,
}) => {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
  const descText = description || helperText;
  const descId = descText ? `${fieldId}-desc` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5 w-full text-left", className)}>
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      {descText && (
        <p id={descId} className="text-xs text-muted-foreground">
          {descText}
        </p>
      )}

      <div>
        {typeof children === "function"
          ? children({ id: fieldId, "aria-describedby": describedBy, error: Boolean(error) })
          : children}
      </div>

      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
