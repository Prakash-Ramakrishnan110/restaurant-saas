import React from "react";
import { HardwareSection } from "../components/HardwareSection";
import { getPagePath, type Lang } from "../routes";

interface HardwarePageProps {
  lang: Lang;
  onNavigate?: (path: string) => void;
}

const SETUP_STEPS = {
  en: [
    {
      num: "1",
      title: "Sign in on your phone or laptop",
      desc: "Open Chrome or Edge on any Android phone, tablet, or laptop over your shop Wi-Fi or 4G.",
    },
    {
      num: "2",
      title: "Open Token TV in any TV browser",
      desc: "Copy the branch display link from Settings and open it fullscreen on a TV browser for live token callouts.",
    },
    {
      num: "3",
      title: "Print slips from the browser when needed",
      desc: "Use standard 58mm or 80mm browser printing at the counter, or run completely paperless with screens.",
    },
  ],
  ta: [
    {
      num: "1",
      title: "போன் அல்லது லேப்டாப்பில் உள்நுழையுங்கள்",
      desc: "கடை Wi-Fi அல்லது 4G இணைப்பில் எந்த Android போன், டேப்லெட் அல்லது லேப்டாப் உலாவியிலும் திறக்கலாம்.",
    },
    {
      num: "2",
      title: "டிவி உலாவியில் டோக்கன் திரையைத் திறக்கவும்",
      desc: "அமைப்புகளில் உள்ள டோக்கன் டிவி இணைப்பை எந்த டிவி உலாவியிலும் முழுத்திரையில் திறந்து எண்களைக் காட்டலாம்.",
    },
    {
      num: "3",
      title: "தேவைப்படும்போது உலாவி வழி அச்சு",
      desc: "கவுண்டரில் 58mm அல்லது 80mm தாள் அளவில் அச்சிடலாம், அல்லது காகிதமின்றி திரைகளிலேயே இயக்கலாம்.",
    },
  ],
} as const;

export const HardwarePage: React.FC<HardwarePageProps> = ({ lang, onNavigate }) => {
  const isTa = lang === "ta";
  const demoPath = getPagePath("book-demo", lang);
  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <div>
      <HardwareSection lang={lang} isFullPage onNavigate={onNavigate} />

      <section className="bg-[#FFF3E0] py-12 lg:py-16 border-t border-[#E6E1D8]">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 space-y-8">
          <div className="space-y-2 max-w-[65ch]">
            <h2 className="font-display font-semibold text-[24px] lg:text-[30px] text-[#0B1F3B]">
              {isTa ? "3 எளிய படிகளில் சாதன அமைப்பு" : "Set up your screens in 3 simple steps"}
            </h2>
            <p className="text-[16px] leading-[1.6] text-[#0B1F3B]/85">
              {isTa
                ? "தனிப்பட்ட மென்பொருள் நிறுவல் எதுவும் தேவையில்லை."
                : "No custom device installers required — everything runs in standard web browsers."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SETUP_STEPS[lang].map((st) => (
              <div
                key={st.num}
                className="rounded-[16px] border border-[#E6E1D8] bg-white p-6 space-y-2.5"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0B1F3B] text-sm font-bold text-white"
                >
                  {st.num}
                </span>
                <h3 className="font-display font-semibold text-[18px] text-[#0B1F3B]">{st.title}</h3>
                <p className="text-[14px] leading-[1.6] text-[#0B1F3B]/80">{st.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-[16px] border border-[#E6E1D8] bg-white p-6 space-y-2.5">
              <h2 className="font-display font-semibold text-[20px] text-[#0B1F3B]">
                {isTa ? "உலாவி வழி ரசீது மற்றும் டோக்கன் அச்சு" : "Browser receipt and token slip printing"}
              </h2>
              <p className="text-[15px] leading-[1.6] text-[#0B1F3B]/80">
                {isTa
                  ? "58mm மற்றும் 80mm தெர்மல் தாள் அளவுகளுக்கு ஏற்ற தெளிவான அச்சு வடிவமைப்பு உள்ளது. டெமோ ரசீதுகளில் DEMO RECEIPT என தெளிவாகக் குறிப்பிடப்பட்டிருக்கும்."
                  : "ServeMyFood formats clean 58mm and 80mm slips through your device's standard browser print dialog. Receipts in demo mode are clearly labelled DEMO RECEIPT."}
              </p>
            </div>

            <div className="rounded-[16px] border border-[#E6E1D8] bg-white p-6 space-y-2.5">
              <h2 className="font-display font-semibold text-[20px] text-[#0B1F3B]">
                {isTa ? "ஒலி மற்றும் திரை விழிப்பு நிலை" : "Sound chimes and keep-awake screens"}
              </h2>
              <p className="text-[15px] leading-[1.6] text-[#0B1F3B]/80">
                {isTa
                  ? "சமையலறை மற்றும் டோக்கன் டிவி திரைகள் உறங்காமல் இருக்க திரை விழிப்பு வசதி மற்றும் தமிழ்/ஆங்கில குரல் அறிவிப்புகள் உள்ளன."
                  : "Kitchen and Token TV screens support browser screen wake lock plus distinct chimes and voice callouts in English or Tamil."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0B1F3B] py-12 sm:py-16 text-white">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-[58ch]">
            <h2 className="font-display font-semibold text-[24px] lg:text-[30px] text-white">
              {isTa
                ? "உங்கள் தற்போதைய போன் அல்லது டிவியில் சோதித்துப் பாருங்கள்"
                : "Test ServeMyFood on your existing phone or TV"}
            </h2>
            <p className="text-[15px] sm:text-[16px] text-white/85">
              {isTa
                ? "நேரலை டெமோவில் உங்கள் கடைக்கு ஏற்ற திரை அமைப்பைக் காட்டுகிறோம்."
                : "Book a free demo and we will walk through the exact setup for your counter or dining room."}
            </p>
          </div>
          <a
            href={demoPath}
            onClick={(e) => handleNav(e, demoPath)}
            className="inline-flex w-full sm:w-auto items-center justify-center min-h-[52px] px-6 rounded-[12px] bg-[#FF6A00] text-[15px] font-semibold text-[#0B1F3B] hover:bg-[#e55f00] transition-colors shrink-0"
          >
            {isTa ? "இலவச டெமோ பதிவு" : "Book a free demo"}
          </a>
        </div>
      </section>
    </div>
  );
};
