import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Play } from "lucide-react";
import { HOME_COPY, VENUE_PAGE_COPY } from "../copy";
import { getPagePath, type Lang } from "../routes";
import { DeviceFrame } from "../components/DeviceFrame";
import { VideoSection } from "../components/VideoSection";

interface VenuePageProps {
  venue: "tea-shops" | "restaurants" | "hotels";
  lang: Lang;
  onNavigate?: (path: string) => void;
}

export const VenuePage: React.FC<VenuePageProps> = ({ venue, lang, onNavigate }) => {
  const data = VENUE_PAGE_COPY[venue][lang];
  const homeCopy = HOME_COPY[lang];
  const isTa = lang === "ta";
  const [clipHPlaying, setClipHPlaying] = useState(false);
  const clipHRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!clipHPlaying || !clipHRef.current) return;
    clipHRef.current.load();
    clipHRef.current.play().catch(() => {});
  }, [clipHPlaying]);

  const shotSrc =
    venue === "tea-shops"
      ? "/shots/tea-counters.webp"
      : venue === "hotels"
        ? "/shots/hotel-areas.webp"
        : "/shots/waiter-order.webp";

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
            <h1
              className={`text-2xl sm:text-4xl font-bold font-display text-[#0B1F3B] break-words ${
                isTa ? "leading-[1.28]" : "leading-tight"
              }`}
            >
              {data.h1}
            </h1>
            <p className="text-base text-slate-800 leading-relaxed">{data.sub}</p>
            {data.noteSoon && (
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-[#0B1F3B]">
                <Clock className="h-4 w-4 text-[#0B1F3B]" aria-hidden="true" />
                <span>{data.noteSoon}</span>
              </div>
            )}
            <div className="pt-1">
              <a
                href={demoPath}
                onClick={(e) => handleLinkClick(e, demoPath)}
                className="inline-flex items-center justify-center min-h-[48px] rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-[#0B1F3B] shadow-sm hover:bg-[#e55f00]"
              >
                {homeCopy.ctaPrimary}
              </a>
            </div>
          </div>

          <div className="lg:col-span-6 min-w-0">
            <DeviceFrame kind="laptop" src={shotSrc} alt={data.h1} eager />
          </div>
        </div>
      </section>

      <section className="py-12 mx-auto max-w-5xl px-4 sm:px-6 space-y-6">
        <h2 className="text-2xl font-bold font-display text-[#0B1F3B]">
          {isTa ? "நீங்கள் பெறும் வசதிகள்" : "What your team gets"}
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

      {/* Stage 4.3: Real Token TV Page & Recorded Clip H on Tea Shop Page (strictly zero word "table") */}
      {venue === "tea-shops" && (
        <section
          data-testid="tea-shop-token-tv-section"
          className="bg-[#FFF3E0]/55 border-t border-[#0B1F3B]/10 py-12 sm:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
            <div className="space-y-2 max-w-3xl">
              <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#0B1F3B]">
                {isTa
                  ? "சமையலறை தயார் எனத் தட்டியதும் டிவியில் டோக்கன் எண் தோன்றும்"
                  : "Live Token TV: kitchen taps Ready and the number appears on screen"}
              </h2>
              <p className="text-sm sm:text-base text-slate-800 leading-relaxed">
                {isTa
                  ? "கவுண்டரில் கூட்ட நெரிசலைக் குறைக்க எந்த டிவி உலாவியிலும் டோக்கன் திரையைத் திறந்து ஒலி மற்றும் குரல் அழைப்புடன் எண்களைக் காட்டலாம்."
                  : "Open the Token TV link in any TV web browser behind your counter. When the cook taps Ready, the token number lights up with a chime and voice callout."}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-2">
                <DeviceFrame
                  kind="laptop"
                  src="/shots/token-tv-live.webp"
                  alt={
                    isTa
                      ? "ServeMyFood நேரலை டோக்கன் டிவி திரை"
                      : "ServeMyFood live Token TV display showing Now Calling and Preparing queues"
                  }
                />
                <p className="text-xs font-medium text-slate-700">
                  {isTa
                    ? "உண்மையான Token TV திரை — வாடிக்கையாளர் பெயர் அல்லது தனிப்பட்ட தகவல் எதுவும் காட்டப்படாது."
                    : "Real Token TV screen from the app — shows only token numbers, zero personal details."}
                </p>
              </div>

              <div className="lg:col-span-6 space-y-2">
                <div className="rounded-2xl border border-[#0B1F3B]/20 bg-[#0B1F3B] p-2 sm:p-3 shadow-xl">
                  <div className="flex items-center justify-between px-2 pb-2 text-[11px] font-semibold text-white/80">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                      <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                      <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                    </div>
                    <span>
                      {isTa ? "கிளிப் H · சமையலறை → டோக்கன் டிவி" : "Clip H · Kitchen → Token TV"}
                    </span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden bg-[#0B1F3B]">
                    <video
                      ref={clipHRef}
                      data-testid="clip-h-video"
                      className="w-full aspect-[16/10] object-cover bg-[#0B1F3B]"
                      poster="/video/token-tv-poster.webp"
                      preload="none"
                      muted
                      playsInline
                      controls={clipHPlaying}
                    >
                      {clipHPlaying && (
                        <>
                          <source src="/video/token-tv-clip-h.webm" type="video/webm" />
                          <source src="/video/token-tv-clip-h.mp4" type="video/mp4" />
                        </>
                      )}
                      <track
                        kind="captions"
                        src="/video/captions-en.vtt"
                        srcLang="en"
                        label="English"
                        default={!isTa}
                      />
                      <track
                        kind="captions"
                        src="/video/captions-ta.vtt"
                        srcLang="ta"
                        label="தமிழ்"
                        default={isTa}
                      />
                    </video>

                    {!clipHPlaying && (
                      <div className="absolute inset-0 flex items-end justify-end p-2.5 sm:p-3 bg-gradient-to-t from-[#0B1F3B]/75 via-transparent to-transparent">
                        <button
                          type="button"
                          data-testid="play-clip-h-btn"
                          onClick={() => setClipHPlaying(true)}
                          className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-[#FF6A00] px-4 py-2 text-xs sm:text-sm font-bold text-[#0B1F3B] shadow-lg hover:bg-[#e55f00]"
                        >
                          <Play className="h-4 w-4 shrink-0" />
                          <span>
                            {isTa ? "டோக்கன் டிவி பதிவைப் பார்க்க" : "Watch kitchen-to-TV clip"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-700">
                  {isTa
                    ? "நேரடிப் பதிவு: சமையல்காரர் தயார் எனத் தட்டியவுடன் டோக்கன் டிவியில் அழைப்பு தோன்றுகிறது."
                    : "Recorded clip: cook taps Mark Ready on the kitchen screen and the token updates on the TV."}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <VideoSection lang={lang} variant={venue === "tea-shops" ? "counter" : "restaurant"} />

      <section className="bg-[#0B1F3B] py-12 sm:py-16 text-white">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-bold font-display text-white">
              {isTa
                ? "உங்கள் மெனுவுடன் நேரலை டெமோ பார்க்கத் தயாரா?"
                : "See ServeMyFood live with your own menu"}
            </h2>
            <p className="text-sm sm:text-base text-white/85">
              {isTa
                ? "உங்கள் போன், டேப்லெட் மற்றும் டிவி திரையில் எப்படி இயங்கும் என்பதை 15 நிமிடத்தில் காட்டுகிறோம்."
                : "Book a 15-minute live walkthrough in Tamil or English using devices you already own."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href={demoPath}
              onClick={(e) => handleLinkClick(e, demoPath)}
              className="inline-flex w-full sm:w-auto items-center justify-center min-h-[48px] rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-[#0B1F3B] hover:bg-[#e55f00]"
            >
              {homeCopy.ctaPrimary}
            </a>
            <a
              href={getPagePath("hardware", lang)}
              onClick={(e) => handleLinkClick(e, getPagePath("hardware", lang))}
              className="inline-flex w-full sm:w-auto items-center justify-center min-h-[48px] rounded-xl border border-white/35 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              {isTa ? "சாதன வழிகாட்டி" : "See hardware guide"}
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
