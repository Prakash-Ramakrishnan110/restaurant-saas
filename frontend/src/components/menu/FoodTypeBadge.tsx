import React from "react";

export type FoodType = "VEG" | "NON_VEG" | "EGG";

interface FoodTypeBadgeProps {
  type: FoodType;
  showLabel?: boolean;
  className?: string;
}

export const FoodTypeBadge: React.FC<FoodTypeBadgeProps> = ({
  type,
  showLabel = true,
  className = "",
}) => {
  if (type === "VEG") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 ${className}`}
      >
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-sm border border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
          aria-hidden="true"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-600" />
        </span>
        {showLabel && <span>Veg</span>}
      </span>
    );
  }

  if (type === "NON_VEG") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 ${className}`}
      >
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-sm border border-red-700 bg-red-50 dark:bg-red-950/40"
          aria-hidden="true"
        >
          <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-red-700" />
        </span>
        {showLabel && <span>Non-Veg</span>}
      </span>
    );
  }

  // EGG
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 ${className}`}
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-sm border border-amber-600 bg-amber-50 dark:bg-amber-950/40"
        aria-hidden="true"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
      </span>
      {showLabel && <span>Contains Egg</span>}
    </span>
  );
};
