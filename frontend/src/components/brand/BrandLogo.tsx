import React from "react";

export interface BrandLogoProps {
  variant?: "full" | "icon";
  theme?: "light" | "dark" | "mono" | "auto";
  className?: string;
  size?: number;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = "full",
  theme = "auto",
  className = "",
  size = 36,
}) => {
  const isForcedDark = theme === "dark";
  const isForcedLight = theme === "light";
  const isMono = theme === "mono";

  // Mark elements: handles both programmatic theme props and DOM .dark class
  const iconElement = isMono ? (
    <img
      src="/brand/svg/mark-navy.svg"
      width={size}
      height={size}
      alt="ServeMyFood"
      className="shrink-0 object-contain"
      data-testid="brand-logo-mark"
    />
  ) : isForcedDark ? (
    <img
      src="/brand/svg/mark-white.svg"
      width={size}
      height={size}
      alt="ServeMyFood"
      className="shrink-0 object-contain"
      data-testid="brand-logo-mark"
    />
  ) : (
    <>
      <img
        src="/brand/svg/mark-orange.svg"
        width={size}
        height={size}
        alt="ServeMyFood"
        className="dark:hidden shrink-0 object-contain"
        data-testid="brand-logo-mark"
      />
      <img
        src="/brand/svg/mark-white.svg"
        width={size}
        height={size}
        alt="ServeMyFood"
        className="hidden dark:block shrink-0 object-contain"
        data-testid="brand-logo-mark-dark"
      />
    </>
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

  // Wordmark colors:
  // "ServeMy" MUST be Navy #0B1F3B on light and White #FFFFFF on dark backgrounds.
  // Using Tailwind classes (text-[#0B1F3B] dark:text-white) guarantees contrast >= 14:1 in dark mode!
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
          <span
            className={
              isMono
                ? "text-current"
                : isForcedDark
                  ? "text-white"
                  : isForcedLight
                    ? "text-[#0B1F3B] dark:text-white"
                    : "text-[#0B1F3B] dark:text-white"
            }
            data-testid="wordmark-servemy"
          >
            ServeMy
          </span>
          <span
            className={isMono ? "text-current" : "text-[#FF6A00]"}
            data-testid="wordmark-food"
          >
            Food
          </span>
        </span>
        <span
          className={
            isMono
              ? "text-[10px] uppercase font-sans font-semibold tracking-wider opacity-70 text-current"
              : isForcedDark
                ? "text-[10px] uppercase font-sans font-semibold tracking-wider text-white/70"
                : "text-[10px] uppercase font-sans font-semibold tracking-wider text-[#0B1F3B]/70 dark:text-white/70"
          }
        >
          By Fusion Engine
        </span>
      </div>
    </div>
  );
};

export default BrandLogo;
