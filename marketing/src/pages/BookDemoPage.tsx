import React from "react";
import { DemoForm } from "../components/DemoForm";
import type { Lang } from "../routes";

interface BookDemoPageProps {
  lang: Lang;
  onNavigate?: (path: string) => void;
}

export const BookDemoPage: React.FC<BookDemoPageProps> = ({ lang, onNavigate }) => {
  return (
    <section className="py-12 mx-auto max-w-3xl px-4 sm:px-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold font-display text-[#0B1F3B]">
          {lang === "ta" ? "இலவச டெமோ பதிவு செய்யுங்கள்" : "Book a free demo"}
        </h1>
        <p className="text-sm sm:text-base text-slate-700">
          {lang === "ta"
            ? "உங்கள் கடை விவரங்களைப் பகிருங்கள். தமிழ் அல்லது ஆங்கிலத்தில் நேரடி டெமோ காட்டுவோம்."
            : "Share your shop details below. We will walk you through ServeMyFood live in Tamil or English."}
        </p>
      </div>

      <DemoForm lang={lang} onNavigate={onNavigate} />
    </section>
  );
};
