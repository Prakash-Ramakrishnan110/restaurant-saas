import React, { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { Lang } from "../routes";
import { HOME_COPY } from "../copy";
import { HeroStoryboard } from "./HeroStoryboard";
import { StoryIllustration } from "./StoryIllustrations";

interface HeroAnimationProps {
  lang: Lang;
  initialVariant?: "restaurant" | "counter" | "hotel";
  lockVariant?: boolean;
}

const STEP_DURATION_MS = 2400; // 5 steps * 2.4s = 12s loop

export const HeroAnimation: React.FC<HeroAnimationProps> = ({
  lang,
  initialVariant = "restaurant",
  lockVariant = false,
}) => {
  const [variant, setVariant] = useState<"restaurant" | "counter" | "hotel">(initialVariant);
  const [step, setStep] = useState<number>(0);
  const [paused, setPaused] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [inView, setInView] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const copy = HOME_COPY[lang];
  const steps =
    variant === "counter"
      ? lang === "ta"
        ? [
            "1. வாடிக்கையாளர் 2 தேநீர், 1 சமோசா ஆர்டர் செய்கிறார்.",
            "2. UPI அல்லது ரொக்கம் செலுத்துகிறார். டோக்கன் 12 வருகிறது.",
            "3. சமையலறையில் தயாரானதும் ஒலி அறிவிப்பு.",
            "4. வாடிக்கையாளர் டோக்கன் 12 பெற்றுக்கொள்கிறார்.",
            "5. உரிமையாளர் இன்றைய விற்பனையைப் பார்க்கிறார்.",
          ]
        : [
            "1. Tap 2 Chai and 1 Samosa at the counter.",
            "2. Customer pays via UPI or Cash. Token 12 appears.",
            "3. Kitchen marks it Ready with a sound alert.",
            "4. Customer collects when Token 12 is called.",
            "5. Owner sees today's sales rising.",
          ]
      : copy.steps;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || !inView) return;
    const timer = window.setInterval(() => {
      setStep((prev) => (prev + 1) % 5);
    }, STEP_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, inView]);

  if (reducedMotion) {
    return (
      <div ref={containerRef}>
        <HeroStoryboard
          lang={lang}
          steps={steps}
          activeStep={step}
          onSelectStep={(idx) => setStep(idx)}
          variant={variant}
        />
      </div>
    );
  }

  const sampleLabel = lang === "ta" ? "மாதிரி தரவு" : "Sample data";
  const progressPct = ((step + 1) / 5) * 100;

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border-2 border-[#0B1F3B]/15 bg-[#0B1F3B] text-white p-4 sm:p-5 shadow-xl"
      data-testid="hero-animation"
    >
      {/* Top Bar: Venue Switcher + Sample Data + Pause/Play */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/15">
        {!lockVariant ? (
          <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
            {(
              [
                { id: "counter", labelEn: "Tea shop", labelTa: "தேநீர்க் கடை" },
                { id: "restaurant", labelEn: "Restaurant", labelTa: "உணவகம்" },
                { id: "hotel", labelEn: "Hotel", labelTa: "ஹோட்டல்" },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setVariant(v.id);
                  setStep(0);
                }}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${
                  variant === v.id
                    ? "bg-[#FF6A00] text-[#0B1F3B]"
                    : "text-slate-200 hover:bg-white/10"
                }`}
              >
                {lang === "ta" ? v.labelTa : v.labelEn}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs font-bold uppercase tracking-wider text-[#FFB37A]">
            {variant === "counter"
              ? lang === "ta"
                ? "கவுண்டர் & டோக்கன்"
                : "Counter & Token"
              : lang === "ta"
                ? "நேரடி செயல்முறை"
                : "Live Workflow"}
          </span>
        )}

        <div className="flex items-center gap-2">
          <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-slate-100">
            {sampleLabel}
          </span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play animation" : "Pause animation"}
            className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-bold text-white hover:bg-white/25"
          >
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            <span>
              {paused ? (lang === "ta" ? "இயக்கு" : "Play") : lang === "ta" ? "நிறுத்து" : "Pause"}
            </span>
          </button>
        </div>
      </div>

      {/* Illustrated Story Stage */}
      <div className="mt-4 space-y-3">
        <StoryIllustration step={step} variant={variant} lang={lang} />

        {/* Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
          <div
            className="h-full bg-[#FF6A00] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* 5 Clickable Step Captions */}
      <div className="mt-3 grid grid-cols-1 gap-1.5">
        {steps.map((caption, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setStep(idx);
              setPaused(true);
            }}
            className={`text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
              step === idx
                ? "bg-[#FF6A00] text-[#0B1F3B] font-bold"
                : "bg-white/5 text-slate-200 hover:bg-white/15"
            }`}
          >
            {caption}
          </button>
        ))}
      </div>
    </div>
  );
};
