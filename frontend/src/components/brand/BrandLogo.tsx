import React from "react";

export interface BrandLogoProps {
  variant?: "full" | "icon";
  theme?: "light" | "dark" | "mono";
  className?: string;
  size?: number;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = "full",
  theme = "light",
  className = "",
  size = 36,
}) => {
  const isDark = theme === "dark";
  const isMono = theme === "mono";

  const textColor = isMono ? "currentColor" : isDark ? "#FFFFFF" : "#0B1F3B";
  const foodColor = isMono ? "currentColor" : "#FF6A00";
  const iconBg = isMono ? "currentColor" : "#FF6A00";
  const iconFg = isMono ? "var(--background, #FFFFFF)" : "#0B1F3B";

  const iconElement = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-label="ServeMyFood Logo"
      role="img"
    >
      <rect width="36" height="36" rx="8" fill={iconBg} />
      {/* Cloche Top Handle */}
      <circle cx="18" cy="11" r="2" fill={iconFg} />
      {/* Modern Food Cloche Dome */}
      <path d="M10 21C10 15.5 13.5 13 18 13C22.5 13 26 15.5 26 21H10Z" fill={iconFg} />
      {/* Serving Platter Base */}
      <rect x="7" y="22" width="22" height="2.5" rx="1.25" fill={iconFg} />
      {/* Warm Hospitality Accent */}
      <path
        d="M12 26.5C15 28 21 28 24 26.5"
        stroke={isMono ? iconFg : "#FFF3E0"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  if (variant === "icon") {
    return <div className={`inline-flex items-center ${className}`}>{iconElement}</div>;
  }

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {iconElement}
      <div className="flex flex-col">
        <span
          className="font-display font-bold tracking-tight text-xl leading-none"
          style={{ letterSpacing: "-0.03em" }}
        >
          <span style={{ color: textColor }}>ServeMy</span>
          <span style={{ color: foodColor }}>Food</span>
        </span>
        <span
          className="text-[10px] uppercase font-sans font-semibold tracking-wider opacity-70"
          style={{ color: textColor }}
        >
          By Fusion Engine
        </span>
      </div>
    </div>
  );
};
