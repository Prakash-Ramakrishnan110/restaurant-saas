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

  // EGG — dark gold (#A16207) for WCAG ≥ 3:1 on white and dark backgrounds
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}
      style={{ color: "#A16207" }}
    >
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-sm"
        style={{
          border: "1px solid #A16207",
          backgroundColor: "rgba(161,98,7,0.08)",
        }}
        aria-hidden="true"
      >
        {/* Egg-shaped diamond marker */}
        <span
          style={{
            display: "block",
            width: 8,
            height: 8,
            borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
            backgroundColor: "#A16207",
          }}
        />
      </span>
      {showLabel && <span>Egg</span>}
    </span>
  );
};
