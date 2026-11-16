import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, Bell, Check, Utensils, Receipt, TrendingUp } from "lucide-react";
import type { Lang } from "../routes";
import { HOME_COPY } from "../copy";
import { HeroStoryboard } from "./HeroStoryboard";

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
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF6A00]">
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
            <span>{paused ? (lang === "ta" ? "இயக்கு" : "Play") : lang === "ta" ? "நிறுத்து" : "Pause"}</span>
          </button>
        </div>
      </div>

      {/* Animated Drawn Screen Stage (fixed height to avoid layout shift) */}
      <div className="mt-4 min-h-[210px] rounded-xl bg-white text-[#0B1F3B] p-4 flex flex-col justify-between">
        {variant === "counter" ? (
          <div key={`counter-${step}`} className="animate-step-in space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {step < 2
                  ? lang === "ta"
                    ? "கவுண்டர் POS"
                    : "Counter POS"
                  : step < 4
                    ? lang === "ta"
                      ? "டோக்கன் பலகை"
                      : "Token Queue"
                    : lang === "ta"
                      ? "உரிமையாளர் திரை"
                      : "Owner Screen"}
              </span>
              <span className="rounded-full bg-[#FFF3E0] px-2.5 py-0.5 text-xs font-bold text-[#0B1F3B]">
                {lang === "ta" ? "டோக்கன் #12" : "Token #12"}
              </span>
            </div>

            {step === 0 && (
              <div className="space-y-2">
                <div className="flex justify-between rounded-lg border border-slate-200 p-2.5 text-sm font-bold">
                  <span>2× {lang === "ta" ? "தேநீர்" : "Chai"}</span>
                  <span>₹40</span>
                </div>
                <div className="flex justify-between rounded-lg border border-slate-200 p-2.5 text-sm font-bold">
                  <span>1× {lang === "ta" ? "சமோசா" : "Samosa"}</span>
                  <span>₹30</span>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="rounded-xl bg-[#FFF3E0] p-4 text-center space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  {lang === "ta" ? "UPI / ரொக்கம் பெறப்பட்டது" : "UPI / Cash Paid — ₹70"}
                </div>
                <div className="text-2xl font-extrabold font-display text-[#0B1F3B]">
                  {lang === "ta" ? "டோக்கன் 12 வழங்கப்பட்டது" : "Token 12 Issued"}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="rounded-xl border-2 border-[#FF6A00] bg-orange-50 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold">Token #12 — 2× Chai, 1× Samosa</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {lang === "ta" ? "சமையலறை தயார் செய்தது" : "Kitchen marked Ready"}
                  </div>
                </div>
                <Bell className="h-6 w-6 text-[#FF6A00]" />
              </div>
            )}

            {step === 3 && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
                <Check className="h-6 w-6 text-emerald-700 shrink-0" />
                <div>
                  <div className="text-sm font-extrabold text-emerald-950">
                    {lang === "ta" ? "டோக்கன் 12 வழங்கப்பட்டது" : "Token 12 Collected"}
                  </div>
                  <div className="text-xs text-emerald-800">
                    {lang === "ta" ? "வரிசையில் இருந்து நீக்கப்பட்டது" : "Cleared from pickup board"}
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="rounded-xl bg-[#0B1F3B] text-white p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-300">
                    {lang === "ta" ? "இன்றைய மொத்த விற்பனை" : "Today's Counter Sales"}
                  </div>
                  <div className="text-2xl font-extrabold font-display text-[#FF6A00] mt-1">
                    ₹8,470
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-[#FF6A00]" />
              </div>
            )}
          </div>
        ) : (
          <div key={`rest-${step}`} className="animate-step-in space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {step === 0
                  ? lang === "ta"
                    ? "பணியாளர் போன்"
                    : "Waiter Phone"
                  : step === 1
                    ? lang === "ta"
                      ? "சமையலறை திரை"
                      : "Kitchen Screen"
                    : step === 2
                      ? lang === "ta"
                        ? "பரிமாறும் நிலை"
                        : "Ready to Serve"
                      : step === 3
                        ? lang === "ta"
                          ? "கேஷியர் திரை"
                          : "Cashier Screen"
                        : lang === "ta"
                          ? "உரிமையாளர் போன்"
                          : "Owner Phone"}
              </span>
              <span className="rounded-full bg-[#FFF3E0] px-2.5 py-0.5 text-xs font-bold text-[#0B1F3B]">
                {lang === "ta" ? "மேஜை 4" : "Table 4"}
              </span>
            </div>

            {step === 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm font-bold">
                  <span className="flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-[#FF6A00]" />
                    2× {lang === "ta" ? "மசாலா தோசை" : "Masala Dosa"}
                  </span>
                  <span>₹180</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-sm font-bold">
                  <span>2× {lang === "ta" ? "பில்டர் காபி" : "Filter Coffee"}</span>
                  <span>₹100</span>
                </div>
                <div className="rounded-lg bg-[#FF6A00] text-[#0B1F3B] text-center py-1.5 text-xs font-extrabold">
                  {lang === "ta" ? "சமையலறைக்கு அனுப்பு →" : "Send to Kitchen →"}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="rounded-xl border-2 border-[#FF6A00] bg-orange-50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm">Table 4 — New Ticket</span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0B1F3B]">
                    <Bell className="h-4 w-4 text-[#FF6A00]" />
                    {lang === "ta" ? "ஒலி அறிவிப்பு" : "Chime"}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-700">
                  2× Masala Dosa • 2× Filter Coffee
                </div>
                <div className="rounded-md bg-emerald-600 text-white text-center py-1 text-xs font-bold">
                  {lang === "ta" ? "தயார் எனக் குறி" : "Mark Ready"}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-emerald-950">
                    {lang === "ta" ? "மேஜை 4 — தயார்!" : "Table 4 — Ready!"}
                  </div>
                  <div className="text-xs text-emerald-800 mt-0.5">
                    {lang === "ta" ? "பணியாளர் பரிமாறினார்" : "Waiter marked Served"}
                  </div>
                </div>
                <Check className="h-7 w-7 text-emerald-700" />
              </div>
            )}

            {step === 3 && (
              <div className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">
                    {lang === "ta" ? "மொத்த தொகை" : "Bill Total (No tax line)"}
                  </div>
                  <div className="text-2xl font-extrabold font-display text-[#0B1F3B]">₹280</div>
                  <div className="text-xs font-bold text-emerald-700 mt-0.5">
                    {lang === "ta" ? "ரொக்கம் பெறப்பட்டது" : "Cash Paid"}
                  </div>
                </div>
                <Receipt className="h-8 w-8 text-[#FF6A00]" />
              </div>
            )}

            {step === 4 && (
              <div className="rounded-xl bg-[#0B1F3B] text-white p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-300">
                    {lang === "ta" ? "இன்றைய மொத்த விற்பனை" : "Today's Total Sales"}
                  </div>
                  <div className="text-2xl font-extrabold font-display text-[#FF6A00] mt-1">
                    ₹14,280
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-[#FF6A00]" />
              </div>
            )}
          </div>
        )}

        {/* Progress Bar */}
        <div className="mt-4 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
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
