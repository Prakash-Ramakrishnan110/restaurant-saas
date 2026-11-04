import * as React from "react";
import { CheckCircle2, Users, Calendar, Sparkles, Ban } from "lucide-react";
import { cn } from "../../lib/utils";

export type TableStatusType = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "BLOCKED";

export interface StatusBadgeProps {
  status: TableStatusType | string;
  label?: string;
  className?: string;
}

const statusConfig: Record<
  TableStatusType,
  { label: string; icon: React.ComponentType<{ className?: string }>; classes: string }
> = {
  AVAILABLE: {
    label: "Available",
    icon: CheckCircle2,
    classes:
      "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800",
  },
  OCCUPIED: {
    label: "Occupied",
    icon: Users,
    classes:
      "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  },
  RESERVED: {
    label: "Reserved",
    icon: Calendar,
    classes:
      "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800",
  },
  CLEANING: {
    label: "Cleaning",
    icon: Sparkles,
    classes:
      "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800",
  },
  BLOCKED: {
    label: "Blocked",
    icon: Ban,
    classes:
      "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700",
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className }) => {
  const normalized =
    (status.toUpperCase() as TableStatusType) in statusConfig
      ? (status.toUpperCase() as TableStatusType)
      : "AVAILABLE";
  const config = statusConfig[normalized];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors",
        config.classes,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label || config.label}</span>
    </span>
  );
};
