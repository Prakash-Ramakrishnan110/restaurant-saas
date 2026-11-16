import React, { useEffect, useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { HOME_COPY, VENUE_PAGE_COPY } from "../copy";
import { getPagePath, type Lang } from "../routes";
import { HeroStoryboard } from "../components/HeroStoryboard";
import { VideoSection } from "../components/VideoSection";

const LazyHeroAnimation = React.lazy(() =>
  import("../components/HeroAnimation").then((m) => ({ default: m.HeroAnimation }))
);

interface VenuePageProps {
  venue: "tea-shops" | "restaurants" | "hotels";
  lang: Lang;
  onNavigate?: (path: string) => void;
}

export const VenuePage: React.FC<VenuePageProps> = ({ venue, lang, onNavigate }) => {
  const data = VENUE_PAGE_COPY[venue][lang];
  const homeCopy = HOME_COPY[lang];
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const steps =
    venue === "tea-shops"
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
      : homeCopy.steps;

  const demoPath = getPagePath("book-demo", lang);
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <div>
      <section className="bg-[#FFF3E0] border-b border-[#0B1F3B]/10 py-10 sm:py-16 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 min-w-0 space-y-5">
            <h1 className="text-2xl sm:text-4xl font-bold font-display text-[#0B1F3B] leading-tight break-words">
              {data.h1}
            </h1>
            <p className="text-base text-slate-800 leading-relaxed">{data.sub}</p>
            {data.noteSoon && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-[#0B1F3B]">
                <Clock className="h-4 w-4 text-[#FF6A00]" />
                <span>{data.noteSoon}</span>
              </div>
            )}
            <div className="pt-1">
              <a
                href={demoPath}
                onClick={(e) => handleLinkClick(e, demoPath)}
                className="inline-flex items-center justify-center rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-[#0B1F3B] shadow-sm hover:bg-[#e55f00]"
              >
                {homeCopy.ctaPrimary}
              </a>
            </div>
          </div>

          <div className="lg:col-span-6 min-w-0">
            {clientReady ? (
              <React.Suspense
                fallback={
                  <HeroStoryboard lang={lang} steps={steps} variant={data.storyType} />
                }
              >
                <LazyHeroAnimation lang={lang} initialVariant={data.storyType} lockVariant />
              </React.Suspense>
            ) : (
              <HeroStoryboard lang={lang} steps={steps} variant={data.storyType} />
            )}
          </div>
        </div>
      </section>

      <section className="py-12 mx-auto max-w-5xl px-4 sm:px-6 space-y-6">
        <h2 className="text-2xl font-bold font-display text-[#0B1F3B]">
          {lang === "ta" ? "நீங்கள் பெறும் வசதிகள்" : "What your team gets"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.highlights.map((item, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[#0B1F3B]/15 bg-white p-4 flex items-start gap-3"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
              <span className="text-sm font-medium text-[#0B1F3B]">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <VideoSection lang={lang} variant={venue === "tea-shops" ? "counter" : "restaurant"} />
    </div>
  );
};
