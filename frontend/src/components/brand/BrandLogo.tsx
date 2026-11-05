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

  // Invariant: wordmark is "ServeMy" (Navy #0B1F3B on light, White #FFFFFF on dark) + "Food" (Orange #FF6A00)
  const textColor = isMono ? "currentColor" : isDark ? "#FFFFFF" : "#0B1F3B";
  const foodColor = isMono ? "currentColor" : "#FF6A00";

  // Mark rules: mark-orange.svg on light backgrounds, mark-white.svg on dark backgrounds
  const markSrc = isMono
    ? "/brand/svg/mark-navy.svg"
    : isDark
      ? "/brand/svg/mark-white.svg"
      : "/brand/svg/mark-orange.svg";

  const iconElement = (
    <img
      src={markSrc}
      width={size}
      height={size}
      alt="ServeMyFood"
      className="shrink-0 object-contain"
      data-testid="brand-logo-mark"
    />
  );

  if (variant === "icon") {
    return (
      <div
        className={`inline-flex items-center justify-center ${className}`}
        aria-label="ServeMyFood"
      >
        {iconElement}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 select-none ${className}`}
      aria-label="ServeMyFood"
    >
      {iconElement}
      <div className="flex flex-col">
        <span
          className="font-bold tracking-tight text-xl leading-none font-display font-['Poppins',sans-serif]"
          style={{ letterSpacing: "-0.03em" }}
        >
          <span style={{ color: textColor }} data-testid="wordmark-servemy">
            ServeMy
          </span>
          <span style={{ color: foodColor }} data-testid="wordmark-food">
            Food
          </span>
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
