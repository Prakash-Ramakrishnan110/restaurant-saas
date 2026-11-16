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
        className={`rounded-[24px] border-[4px] border-[#0B1F3B] bg-[#0B1F3B] p-1.5 overflow-hidden ${className}`}
      >
        <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
        <div className="overflow-hidden rounded-[18px] bg-white aspect-[9/16]">
          <img
            src={src}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover object-left-top"
          />
        </div>
      </div>
    );
  }

  if (kind === "tablet") {
    return (
      <div
        className={`rounded-[20px] border-[4px] border-[#0B1F3B] bg-[#0B1F3B] p-2 overflow-hidden ${className}`}
      >
        <div className="overflow-hidden rounded-[12px] bg-white aspect-[16/10]">
          <img
            src={src}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-contain bg-white"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="rounded-t-[16px] border-[4px] border-[#0B1F3B] bg-[#0B1F3B] p-2 overflow-hidden">
        <div className="overflow-hidden rounded-[10px] bg-white aspect-[16/10]">
          <img
            src={src}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-contain bg-white"
          />
        </div>
      </div>
      <div className="mx-auto h-2.5 w-full rounded-b-[10px] bg-[#0B1F3B]" aria-hidden="true" />
    </div>
  );
};
