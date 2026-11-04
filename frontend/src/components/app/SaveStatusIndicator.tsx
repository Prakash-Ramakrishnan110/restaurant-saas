import * as React from "react";
import { Check, CloudUpload, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

export interface SaveStatusIndicatorProps {
  status: SaveStatus;
  errorMessage?: string;
  className?: string;
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  status,
  errorMessage,
  className,
}) => {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium transition-all",
        className
      )}
      role="status"
    >
      {status === "unsaved" && (
        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Unsaved changes
        </span>
      )}

      {status === "saving" && (
        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <CloudUpload className="h-3.5 w-3.5 animate-bounce" />
          Saving...
        </span>
      )}

      {status === "saved" && (
        <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
          All changes saved
        </span>
      )}

      {status === "error" && (
        <span className="flex items-center gap-1.5 text-destructive font-semibold">
          <AlertCircle className="h-3.5 w-3.5" />
          {errorMessage || "Failed to save"}
        </span>
      )}

      {status === "idle" && null}
    </div>
  );
};
