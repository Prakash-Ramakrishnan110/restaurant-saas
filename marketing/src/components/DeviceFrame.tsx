import React from "react";

interface DeviceFrameProps {
  kind: "phone" | "tablet" | "laptop";
  src: string;
  alt: string;
  eager?: boolean;
  className?: string;
}

export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  kind,
  src,
  alt,
  eager = false,
  className = "",
}) => {
  if (kind === "phone") {
    return (
      <div
        className={`rounded-[26px] border border-[#0B1F3B]/15 bg-[#0B1F3B] p-2 shadow-[0_24px_50px_-12px_rgba(11,31,59,0.35)] overflow-hidden ${className}`}
      >
        <div className="mx-auto mb-1.5 h-1 w-9 rounded-full bg-white/25" aria-hidden="true" />
        <div className="overflow-hidden rounded-[18px] bg-white aspect-[9/15]">
          <img
            src={src}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover object-top"
          />
        </div>
      </div>
    );
  }

  if (kind === "tablet") {
    return (
      <div
        className={`rounded-[20px] border border-[#0B1F3B]/15 bg-[#0B1F3B] p-2.5 shadow-[0_24px_60px_-15px_rgba(11,31,59,0.22)] overflow-hidden ${className}`}
      >
        <div className="flex items-center gap-1.5 px-2 pb-2" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-white/25" />
          <span className="h-2 w-2 rounded-full bg-white/25" />
          <span className="h-2 w-2 rounded-full bg-white/25" />
        </div>
        <div className="overflow-hidden rounded-[12px] bg-white aspect-[16/10]">
          <img
            src={src}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover object-top"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="rounded-t-[18px] border border-[#0B1F3B]/15 bg-[#0B1F3B] p-2.5 shadow-[0_24px_60px_-15px_rgba(11,31,59,0.22)] overflow-hidden">
        <div className="flex items-center gap-1.5 px-2 pb-2" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-white/25" />
          <span className="h-2 w-2 rounded-full bg-white/25" />
          <span className="h-2 w-2 rounded-full bg-white/25" />
        </div>
        <div className="overflow-hidden rounded-[10px] bg-white aspect-[16/10]">
          <img
            src={src}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover object-top"
          />
        </div>
      </div>
      <div
        className="mx-auto h-3 w-full rounded-b-[12px] bg-gradient-to-b from-[#1E3A5F] to-[#0B1F3B]"
        aria-hidden="true"
      />
    </div>
  );
};
