import React, { useEffect, useRef, useState } from "react";
import { Play, FileText } from "lucide-react";
import type { Lang } from "../routes";
import { HOME_COPY } from "../copy";

interface VideoSectionProps {
  lang: Lang;
  variant?: "restaurant" | "counter";
}

const COUNTER_TRANSCRIPT = {
  en: [
    "Cashier taps snacks and tea at the counter and issues a sequential token number.",
    "Kitchen screen shows the counter ticket immediately with a chime.",
    "Cook taps Mark Ready when the order is prepared.",
    "Token number lights up on the Token TV screen for pickup.",
    "Owner checks total cash and UPI collection from any phone.",
  ],
  ta: [
    "கவுண்டரில் தேநீர் மற்றும் சிற்றுண்டி ஆர்டர் எடுத்து டோக்கன் எண் வழங்கப்படுகிறது.",
    "சமையலறை திரையில் ஒலி அறிவிப்புடன் ஆர்டர் உடனே தோன்றும்.",
    "உணவு தயாரானதும் சமையல்காரர் தயார் எனக் குறிக்கிறார்.",
    "டோக்கன் டிவி திரையில் தயாரான எண் பெரிதாகத் தோன்றும்.",
    "உரிமையாளர் இன்றைய ரொக்கம் மற்றும் UPI கணக்கை போனில் பார்க்கிறார்.",
  ],
} as const;

export const VideoSection: React.FC<VideoSectionProps> = ({ lang, variant = "restaurant" }) => {
  const copy = HOME_COPY[lang];
  const isTa = lang === "ta";
  const [activated, setActivated] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!activated || !videoRef.current) return;
    videoRef.current.load();
    videoRef.current.play().catch(() => {});
  }, [activated]);

  const mp4Src = variant === "counter" ? "/video/teashop-demo.mp4" : "/video/restaurant-demo.mp4";
  const webmSrc = variant === "counter" ? "/video/teashop-demo.webm" : "/video/restaurant-demo.webm";
  const transcriptLines = variant === "counter" ? COUNTER_TRANSCRIPT[lang] : copy.steps;

  return (
    <section id="demo-video" className="py-12 border-t border-[#0B1F3B]/10 bg-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-5">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#0B1F3B]">
            {variant === "counter"
              ? isTa
                ? "கவுண்டர் மற்றும் டோக்கன் செயல்முறை வீடியோ"
                : "Counter & token walkthrough video"
              : copy.videoTitle}
          </h2>
          <p className="text-sm text-slate-700">{copy.videoSub}</p>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-[#0B1F3B]/15 bg-[#0B1F3B] shadow-md">
          <video
            ref={videoRef}
            className="w-full aspect-video bg-[#0B1F3B]"
            poster="/video/demo-poster.svg"
            preload="none"
            muted
            playsInline
            controls={activated}
          >
            {activated && (
              <>
                <source src={webmSrc} type="video/webm" />
                <source src={mp4Src} type="video/mp4" />
              </>
            )}
            <track
              kind="captions"
              src="/video/captions-en.vtt"
              srcLang="en"
              label="English"
              default={lang === "en"}
            />
            <track
              kind="captions"
              src="/video/captions-ta.vtt"
              srcLang="ta"
              label="தமிழ்"
              default={lang === "ta"}
            />
          </video>

          {!activated && (
            <div className="absolute inset-0 flex items-end justify-center pb-3 sm:pb-6 bg-gradient-to-t from-[#0B1F3B]/80 via-[#0B1F3B]/15 to-transparent px-3">
              <button
                type="button"
                onClick={() => setActivated(true)}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-[#FF6A00] px-5 py-2.5 text-sm font-bold text-[#0B1F3B] shadow-lg hover:bg-[#e55f00]"
              >
                <Play className="h-4 w-4 shrink-0" />
                <span>{copy.videoPlay}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-start gap-3">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className="inline-flex items-center gap-1.5 min-h-[48px] px-2 text-xs font-bold text-[#0B1F3B] underline underline-offset-4"
          >
            <FileText className="h-4 w-4 text-[#0B1F3B]" />
            <span>{copy.videoTranscriptToggle}</span>
          </button>

          {showTranscript && (
            <div className="w-full rounded-xl border border-[#0B1F3B]/15 bg-white p-4 text-xs text-slate-700 space-y-1.5">
              {transcriptLines.map((step, i) => (
                <p key={i}>
                  <strong>{i + 1}.</strong> {step}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
