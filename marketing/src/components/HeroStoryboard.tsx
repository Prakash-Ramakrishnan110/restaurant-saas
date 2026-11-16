import React from "react";
import type { Lang } from "../routes";

interface HeroStoryboardProps {
  lang: Lang;
  steps: readonly string[];
  activeStep?: number;
  onSelectStep?: (idx: number) => void;
  variant: "restaurant" | "counter" | "hotel";
}

export const HeroStoryboard: React.FC<HeroStoryboardProps> = ({
  lang,
  steps,
  activeStep = 0,
  onSelectStep,
  variant,
}) => {
  const sampleLabel = lang === "ta" ? "மாதிரி தரவு" : "Sample data";
  const screenItems =
    variant === "counter"
      ? [
          { title: lang === "ta" ? "2× தேநீர், 1× சமோசா" : "2× Chai, 1× Samosa", meta: "₹70" },
          { title: lang === "ta" ? "UPI / ரொக்கம்" : "UPI / Cash", meta: lang === "ta" ? "டோக்கன் 12" : "Token 12" },
          { title: lang === "ta" ? "தயார்: டோக்கன் 12" : "Ready: Token 12", meta: lang === "ta" ? "ஒலி அறிவிப்பு" : "Chime" },
          { title: lang === "ta" ? "வழங்கப்பட்டது" : "Collected", meta: lang === "ta" ? "டோக்கன் 12 முடிந்தது" : "Token 12 cleared" },
          { title: lang === "ta" ? "இன்றைய விற்பனை" : "Today's sales", meta: "₹8,470" },
        ]
      : [
          { title: lang === "ta" ? "மேஜை 4: 2× மசாலா தோசை" : "Table 4: 2× Masala Dosa", meta: lang === "ta" ? "2× காபி" : "2× Filter Coffee" },
          { title: lang === "ta" ? "சமையலறை: புதிய டிக்கெட்" : "Kitchen: New Ticket", meta: lang === "ta" ? "ஒலி அறிவிப்பு" : "Sound alert" },
          { title: lang === "ta" ? "தயார் & பரிமாறப்பட்டது" : "Ready & Served", meta: lang === "ta" ? "மேஜை 4" : "Table 4" },
          { title: lang === "ta" ? "மொத்தம் ₹280" : "Total ₹280", meta: lang === "ta" ? "ரொக்கம் செலுத்தப்பட்டது" : "Cash paid" },
          { title: lang === "ta" ? "இன்றைய விற்பனை" : "Today's sales", meta: "₹14,280" },
        ];

  return (
    <div
      className="relative rounded-2xl border-2 border-[#0B1F3B]/15 bg-[#0B1F3B] text-white p-4 sm:p-5 shadow-lg"
      data-testid="hero-storyboard"
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-[#FFB37A]">
          {variant === "counter"
            ? lang === "ta"
              ? "கவுண்டர் & டோக்கன்"
              : "Counter & Token"
            : variant === "hotel"
              ? lang === "ta"
                ? "ஹோட்டல் உணவகம்"
                : "Hotel Dining"
              : lang === "ta"
                ? "உணவக செயல்முறை"
                : "Restaurant Flow"}
        </span>
        <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white">
          {sampleLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {steps.map((caption, idx) => {
          const active = activeStep === idx;
          const card = screenItems[idx] || screenItems[0];
          const Tag = onSelectStep ? "button" : "div";
          return (
            <Tag
              key={idx}
              {...(onSelectStep ? { type: "button" as const, onClick: () => onSelectStep(idx) } : {})}
              className={`rounded-xl border p-2.5 text-left transition-colors ${
                active
                  ? "border-[#FF6A00] bg-white/15"
                  : "border-white/15 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className="text-[11px] font-bold text-[#FFB37A]">
                {idx + 1}. {card.meta}
              </div>
              <div className="mt-1 text-xs font-semibold text-white">{card.title}</div>
              <div className="mt-1.5 text-[11px] text-slate-200 leading-snug">{caption}</div>
            </Tag>
          );
        })}
      </div>
    </div>
  );
};
