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
      {/* Chef Hat (Toque) Crown Outline */}
      <path
        d="M11 18.5C9.5 18.5 8.5 17 9 15C9.5 13 11.5 13 12.5 14C13 11.5 16 10 18 10C20 10 23 11.5 23.5 14C24.5 13 26.5 13 27 15C27.5 17 26.5 18.5 25 18.5"
        stroke={iconFg}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Hat Base Band */}
      <path
        d="M11.5 19H24.5V22C24.5 22.5 24 23 23.5 23H12.5C12 23 11.5 22.5 11.5 22V19Z"
        fill={iconFg}
      />
      {/* Crossed Fork and Spoon inside Chef's Hat */}
      <path
        d="M14 28L17 23.5M13 27.5L14 26"
        stroke={iconFg}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M22 28L19 23.5M21.5 27.5C22.3 26.7 22.3 25.5 21.5 24.7"
        stroke={iconFg}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Dynamic Service Swoosh under hat */}
      <path
        d="M7 29.5C13 32.5 23 32.5 29 28.5"
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
