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

  const textColor = isMono
    ? "currentColor"
    : isDark
    ? "#FFFFFF"
    : "#0B1F3B";

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
      aria-label="ServeMyFood Icon"
    >
      <rect width="36" height="36" rx="8" fill={iconBg} />
      {/* Cloche Dome */}
      <path
        d="M8 24h20c-0.7-6.2-5.1-11-11-11S8.7 17.8 8 24z"
        fill={iconFg}
      />
      {/* Cloche Knob */}
      <circle cx="17" cy="10.8" r="2.2" fill={iconFg} />
      {/* Tray Base */}
      <rect x="6" y="25.5" width="22" height="2.5" rx="1.25" fill={iconFg} />
      {/* Steam Accent */}
      <path
        d="M21 9.5c1.2-1.2 2.4 0 3.6-1.2"
        stroke="#FFF3E0"
        strokeWidth="1.5"
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
