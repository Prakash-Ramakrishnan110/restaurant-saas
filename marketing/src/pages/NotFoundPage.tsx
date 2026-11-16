import React from "react";
import { getPagePath, type Lang } from "../routes";

interface NotFoundPageProps {
  lang: Lang;
  onNavigate?: (path: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ lang, onNavigate }) => {
  const homePath = getPagePath("home", lang);
  return (
    <section className="py-20 mx-auto max-w-xl px-4 text-center space-y-4">
      <h1 className="text-4xl font-bold font-display text-[#0B1F3B]">404</h1>
      <p className="text-sm text-slate-700">
        {lang === "ta" ? "நீங்கள் தேடும் பக்கம் கிடைக்கவில்லை." : "The page you are looking for could not be found."}
      </p>
      <a
        href={homePath}
        onClick={(e) => {
          if (onNavigate && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            onNavigate(homePath);
          }
        }}
        className="inline-flex items-center justify-center rounded-xl bg-[#FF6A00] px-5 py-2.5 text-sm font-bold text-[#0B1F3B]"
      >
        {lang === "ta" ? "முகப்புக்குச் செல்லவும்" : "Go to home"}
      </a>
    </section>
  );
};
