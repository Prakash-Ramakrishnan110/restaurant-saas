import React, { useState } from "react";
import { Play, FileText } from "lucide-react";
import type { Lang } from "../routes";
import { HOME_COPY } from "../copy";

interface VideoSectionProps {
  lang: Lang;
  variant?: "restaurant" | "counter";
}

export const VideoSection: React.FC<VideoSectionProps> = ({ lang, variant = "restaurant" }) => {
  const copy = HOME_COPY[lang];
  const [activated, setActivated] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const mp4Src = variant === "counter" ? "/video/teashop-demo.mp4" : "/video/restaurant-demo.mp4";
  const webmSrc = variant === "counter" ? "/video/teashop-demo.webm" : "/video/restaurant-demo.webm";

  return (
    <section id="demo-video" className="py-12 border-t border-[#0B1F3B]/10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 space-y-5">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold font-display text-[#0B1F3B]">
            {copy.videoTitle}
          </h2>
          <p className="text-sm text-slate-700">{copy.videoSub}</p>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-[#0B1F3B]/15 bg-[#0B1F3B] shadow-md">
          <video
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
            <div className="absolute inset-0 flex items-center justify-center bg-[#0B1F3B]/35">
              <button
                type="button"
                onClick={() => setActivated(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FF6A00] px-5 py-3 text-sm font-bold text-[#0B1F3B] shadow-lg hover:bg-[#e55f00]"
              >
                <Play className="h-4 w-4" />
                <span>{copy.videoPlay}</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-start gap-3">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1F3B] underline underline-offset-4"
          >
            <FileText className="h-4 w-4 text-[#FF6A00]" />
            <span>{copy.videoTranscriptToggle}</span>
          </button>

          {showTranscript && (
            <div className="w-full rounded-xl border border-[#0B1F3B]/15 bg-white p-4 text-xs text-slate-700 space-y-1.5">
              {copy.steps.map((step, i) => (
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
