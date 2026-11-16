import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Clock,
  Coffee,
  Utensils,
  Hotel,
  ShoppingBag,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { FEATURE_CLAIMS } from "../../content/claims";
import { PRICING_CONFIG } from "../../content/pricing";
import { HOME_COPY, VENUE_CARDS } from "../copy";
import { getPagePath, type Lang } from "../routes";
import { HeroStoryboard } from "../components/HeroStoryboard";
import { VideoSection } from "../components/VideoSection";

const LazyHeroAnimation = React.lazy(() =>
  import("../components/HeroAnimation").then((m) => ({ default: m.HeroAnimation }))
);

interface HomePageProps {
  lang: Lang;
  onNavigate?: (path: string) => void;
}

const getVenueIcon = (id: string) => {
  if (id === "tea-shop" || id === "cafe") return <Coffee className="h-5 w-5 text-[#FF6A00]" />;
  if (id === "hotel") return <Hotel className="h-5 w-5 text-[#FF6A00]" />;
  if (id === "bakery" || id === "food-court")
    return <ShoppingBag className="h-5 w-5 text-[#FF6A00]" />;
  return <Utensils className="h-5 w-5 text-[#FF6A00]" />;
};

export const HomePage: React.FC<HomePageProps> = ({ lang, onNavigate }) => {
  const copy = HOME_COPY[lang];
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const liveClaims = FEATURE_CLAIMS.filter((c) => c.status === "LIVE");
  const soonClaims = FEATURE_CLAIMS.filter((c) => c.status === "SOON");
  const demoPath = getPagePath("book-demo", lang);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <div>
      {/* 2. Hero */}
      <section className="bg-gradient-to-b from-[#FFF3E0] via-[#FFF8EE] to-[#FFFBF7] border-b border-[#0B1F3B]/10 py-12 sm:py-20 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 min-w-0 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#FF6A00]/40 bg-white px-3.5 py-1 text-xs font-bold text-[#0B1F3B] shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-[#FF6A00]" />
              <span>
                {lang === "ta"
                  ? "தமிழ் & ஆங்கிலம் • உணவகங்களுக்கான எளிய அமைப்பு"
                  : "English & தமிழ் • Built for Indian Food Businesses"}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-[#0B1F3B] leading-[1.15] break-words">
              {copy.h1}
            </h1>
            <p className="text-base sm:text-lg text-slate-700 leading-relaxed">{copy.sub}</p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={demoPath}
                onClick={(e) => handleLinkClick(e, demoPath)}
                className="inline-flex items-center justify-center rounded-xl bg-[#FF6A00] px-6 py-3.5 text-sm font-bold text-[#0B1F3B] shadow-md hover:bg-[#e55f00] transition-colors"
              >
                {copy.ctaPrimary}
              </a>
              <a
                href="#demo-video"
                className="inline-flex items-center justify-center rounded-xl border border-[#0B1F3B]/25 bg-white px-6 py-3.5 text-sm font-bold text-[#0B1F3B] hover:bg-slate-50 transition-colors"
              >
                {copy.ctaSecondary}
              </a>
            </div>
          </div>

          <div className="lg:col-span-6 min-w-0">
            {clientReady ? (
              <React.Suspense
                fallback={
                  <HeroStoryboard lang={lang} steps={copy.steps} variant="restaurant" />
                }
              >
                <LazyHeroAnimation lang={lang} initialVariant="restaurant" />
              </React.Suspense>
            ) : (
              <HeroStoryboard lang={lang} steps={copy.steps} variant="restaurant" />
            )}
          </div>
        </div>
      </section>

      {/* 3. How it works */}
      <section id="how-it-works" className="py-16 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl space-y-2 mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#0B1F3B]">
            {copy.stepsTitle}
          </h2>
          <p className="text-sm sm:text-base text-slate-700">{copy.stepsSub}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {copy.steps.map((step, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[#0B1F3B]/15 bg-white p-5 shadow-sm hover:border-[#FF6A00] transition-colors space-y-3"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FF6A00] text-xs font-extrabold text-[#0B1F3B]">
                {idx + 1}
              </span>
              <p className="text-sm font-semibold text-[#0B1F3B] leading-snug">{step}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-[#FF6A00]/30 bg-[#FFF3E0]/70 px-5 py-3.5 text-xs sm:text-sm font-bold text-[#0B1F3B]">
          {copy.counterStory}
        </div>
      </section>

      {/* 4. Built for your business */}
      <section id="businesses" className="py-16 border-t border-[#0B1F3B]/10 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl space-y-2 mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#0B1F3B]">
              {copy.venuesTitle}
            </h2>
            <p className="text-sm sm:text-base text-slate-700">{copy.venuesSub}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {VENUE_CARDS.map((card) => {
              const targetHref = getPagePath(card.targetPage, lang);
              return (
                <a
                  key={card.id}
                  href={targetHref}
                  onClick={(e) => handleLinkClick(e, targetHref)}
                  className="group rounded-2xl border border-[#0B1F3B]/15 bg-[#FFFBF7] p-5 hover:border-[#FF6A00] hover:shadow-md transition-all flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF3E0] border border-[#FF6A00]/20">
                      {getVenueIcon(card.id)}
                    </div>
                    <h3 className="font-display font-bold text-base text-[#0B1F3B]">
                      {lang === "ta" ? card.nameTa : card.nameEn}
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {lang === "ta" ? card.oneLinerTa : card.oneLinerEn}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0B1F3B] group-hover:text-[#0B1F3B]">
                    <span>{lang === "ta" ? "மேலும் பார்க்க" : "See details"}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Problems we solve (2-column split, no repetitive boxes) */}
      <section className="py-16 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#0B1F3B]">
              {copy.problemsTitle}
            </h2>
            <p className="text-sm sm:text-base text-slate-700 leading-relaxed">{copy.problemsSub}</p>
            <a
              href={demoPath}
              onClick={(e) => handleLinkClick(e, demoPath)}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0B1F3B] underline underline-offset-4 hover:text-[#FF6A00]"
            >
              <span>{copy.ctaPrimary}</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="lg:col-span-8 divide-y divide-[#0B1F3B]/10 rounded-2xl border border-[#0B1F3B]/15 bg-white shadow-sm">
            {copy.problems.map((p, idx) => (
              <div key={idx} className="p-5 flex items-start gap-4">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0B1F3B] text-xs font-extrabold text-white mt-0.5">
                  0{idx + 1}
                </span>
                <div>
                  <h3 className="font-display font-bold text-base text-[#0B1F3B]">{p.title}</h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-700 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. Features: LIVE + SOON */}
      <section id="features" className="py-16 border-t border-[#0B1F3B]/10 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-12">
          <div>
            <div className="max-w-2xl space-y-2 mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#0B1F3B]">
                {copy.featuresLiveTitle}
              </h2>
              <p className="text-sm sm:text-base text-slate-700">{copy.featuresLiveSub}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {liveClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="rounded-2xl border border-[#0B1F3B]/15 bg-[#FFFBF7] p-5 space-y-2.5 hover:border-emerald-600/40 transition-colors"
                >
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  <h3 className="font-display font-bold text-sm text-[#0B1F3B]">
                    {lang === "ta" ? claim.titleTa : claim.titleEn}
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {lang === "ta" ? claim.descTa : claim.descEn}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-[#0B1F3B]/20 bg-slate-50 p-6 sm:p-8">
            <div className="max-w-2xl space-y-1 mb-6">
              <h2 className="text-lg font-bold font-display text-[#0B1F3B]">
                {copy.featuresSoonTitle}
              </h2>
              <p className="text-xs sm:text-sm text-slate-700">{copy.featuresSoonSub}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {soonClaims.map((claim) => (
                <div
                  key={claim.id}
                  className="rounded-xl border border-slate-200 bg-white/90 p-4 space-y-2"
                >
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-[#0B1F3B]">
                    <Clock className="h-3 w-3" />
                    <span>{copy.comingSoonBadge}</span>
                  </span>
                  <h3 className="font-display font-bold text-sm text-[#0B1F3B]">
                    {lang === "ta" ? claim.titleTa : claim.titleEn}
                  </h3>
                  <p className="text-xs text-slate-700">
                    {lang === "ta" ? claim.descTa : claim.descEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Trust (honest version) */}
      <section className="py-16 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl border border-[#0B1F3B]/15 bg-gradient-to-br from-[#0B1F3B] to-[#14305A] text-white p-7 sm:p-10 space-y-6 shadow-lg">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-[#FF6A00] shrink-0" />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-display">{copy.trustTitle}</h2>
              <p className="text-xs sm:text-sm text-slate-200">{copy.trustSub}</p>
            </div>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {copy.trustPoints.map((pt, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#FF6A00] shrink-0 mt-0.5" />
                <span className="text-slate-100">{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 8. Video section */}
      <VideoSection lang={lang} variant="restaurant" />

      {/* 9. Pricing */}
      <section className="py-16 border-t border-[#0B1F3B]/10 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#0B1F3B]">
            {lang === "ta" ? PRICING_CONFIG.headlineTa : PRICING_CONFIG.headlineEn}
          </h2>
          <p className="text-sm sm:text-base text-slate-700 max-w-2xl mx-auto">
            {lang === "ta" ? PRICING_CONFIG.subtextTa : PRICING_CONFIG.subtextEn}
          </p>
          {PRICING_CONFIG.mode === "listed" && PRICING_CONFIG.plans.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
              {PRICING_CONFIG.plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-[#0B1F3B]/15 p-4">
                  <div className="font-display font-bold text-base">
                    {lang === "ta" ? plan.nameTa : plan.nameEn}
                  </div>
                  <div className="text-2xl font-bold text-[#0B1F3B] mt-1">
                    ₹{plan.yearlyPriceInr.toLocaleString("en-IN")}/yr
                  </div>
                  <p className="text-xs text-slate-700 mt-1.5">
                    {lang === "ta" ? plan.summaryTa : plan.summaryEn}
                  </p>
                </div>
              ))}
            </div>
          )}
          <div className="pt-2">
            <a
              href={demoPath}
              onClick={(e) => handleLinkClick(e, demoPath)}
              className="inline-flex items-center justify-center rounded-xl bg-[#FF6A00] px-6 py-3.5 text-sm font-bold text-[#0B1F3B] shadow-sm hover:bg-[#e55f00]"
            >
              {copy.ctaPrimary}
            </a>
          </div>
        </div>
      </section>

      {/* 10. FAQ Accordion */}
      <section id="faq" className="py-16 mx-auto max-w-4xl px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#0B1F3B] mb-6">
          {copy.faqTitle}
        </h2>
        <div className="space-y-3">
          {copy.faq.map((item, idx) => (
            <details
              key={idx}
              open={idx === 0}
              className="group rounded-xl border border-[#0B1F3B]/15 bg-white p-4 shadow-xs"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-display font-bold text-sm sm:text-base text-[#0B1F3B]">
                <span>{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 11. Book a demo band */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-2xl bg-gradient-to-r from-[#FFF3E0] to-[#FFE7C2] border border-[#FF6A00]/40 p-7 sm:p-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold font-display text-[#0B1F3B]">
              {copy.demoBandTitle}
            </h2>
            <p className="text-sm text-slate-800">{copy.demoBandSub}</p>
          </div>
          <a
            href={demoPath}
            onClick={(e) => handleLinkClick(e, demoPath)}
            className="inline-flex items-center justify-center rounded-xl bg-[#FF6A00] px-6 py-3.5 text-sm font-bold text-[#0B1F3B] hover:bg-[#e55f00] shrink-0 shadow-sm"
          >
            {copy.ctaPrimary}
          </a>
        </div>
      </section>
    </div>
  );
};
