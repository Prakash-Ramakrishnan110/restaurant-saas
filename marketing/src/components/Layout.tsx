import React, { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { SITE_CONFIG } from "../../content/site";
import { getPagePath, type Lang, type PageId } from "../routes";

interface LayoutProps {
  lang: Lang;
  page: PageId;
  onNavigate?: (path: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ lang, page, onNavigate, children }) => {
  const [scrolled, setScrolled] = useState(false);
  const isTa = lang === "ta";
  const homePath = getPagePath("home", lang);
  const hardwarePath = getPagePath("hardware", lang);
  const demoPath = getPagePath("book-demo", lang);
  const privacyPath = getPagePath("privacy", lang);
  const termsPath = getPagePath("terms", lang);
  const alternateLangPath = getPagePath(page === "404" ? "home" : page, isTa ? "en" : "ta");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0B1F3B] font-sans overflow-x-clip">
      {/* 1. Sticky Header (shrinks to 64px on scroll) */}
      <header className="sticky top-0 z-30 border-b border-[#E6E1D8] bg-white/95 backdrop-blur">
        <div
          className={`mx-auto max-w-[1160px] px-2.5 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-3 transition-all ${
            scrolled ? "h-16" : "h-20"
          }`}
        >
          <a
            href={homePath}
            aria-label="ServeMyFood Home"
            onClick={(e) => handleLinkClick(e, homePath)}
            className="inline-flex items-center min-h-[48px] shrink-0"
          >
            <img
              src="/brand/logo-horizontal-light.svg"
              alt="ServeMyFood"
              width={168}
              height={36}
              className="h-6 min-[380px]:h-7 sm:h-9 w-auto"
            />
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-5 text-[15px] font-medium text-[#0B1F3B]"
          >
            <a
              href={page === "home" ? "#how-it-works" : `${homePath}#how-it-works`}
              className="inline-flex items-center min-h-[48px] px-2 text-[#0B1F3B] hover:underline decoration-[#FF6A00] decoration-2 underline-offset-8 transition-colors"
            >
              {isTa ? "எப்படி இயங்கும்" : "How it works"}
            </a>
            <a
              href={page === "home" ? "#comparison" : `${homePath}#comparison`}
              className="inline-flex items-center min-h-[48px] px-2 text-[#0B1F3B] hover:underline decoration-[#FF6A00] decoration-2 underline-offset-8 transition-colors"
            >
              {isTa ? "ஒப்பீடு" : "Why ServeMyFood"}
            </a>
            <a
              href={hardwarePath}
              onClick={(e) => handleLinkClick(e, hardwarePath)}
              aria-current={page === "hardware" ? "page" : undefined}
              className={`inline-flex items-center min-h-[48px] px-2 text-[#0B1F3B] transition-colors ${
                page === "hardware"
                  ? "font-bold underline decoration-[#FF6A00] decoration-2 underline-offset-8"
                  : "hover:underline decoration-[#FF6A00] decoration-2 underline-offset-8"
              }`}
            >
              {isTa ? "சாதனங்கள்" : "Hardware"}
            </a>
            <a
              href={page === "home" ? "#faq" : `${homePath}#faq`}
              className="inline-flex items-center min-h-[48px] px-2 text-[#0B1F3B] hover:underline decoration-[#FF6A00] decoration-2 underline-offset-8 transition-colors"
            >
              {isTa ? "கேள்விகள்" : "FAQ"}
            </a>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
            <a
              href={alternateLangPath}
              onClick={(e) => handleLinkClick(e, alternateLangPath)}
              aria-label={isTa ? "EN — Switch to English" : "தமிழ் — Switch to Tamil"}
              className="inline-flex items-center justify-center gap-1 h-[48px] sm:h-[50px] px-2 sm:px-3.5 rounded-[12px] border border-[#0B1F3B]/20 bg-[#FFF3E0]/60 text-[12px] sm:text-[14px] font-semibold text-[#0B1F3B] hover:bg-[#FFF3E0] transition-colors"
            >
              <Globe className="h-3.5 w-3.5 shrink-0 hidden sm:inline" aria-hidden="true" />
              <span>{isTa ? "EN" : "தமிழ்"}</span>
            </a>
            <a
              href={SITE_CONFIG.appUrl}
              className="inline-flex items-center justify-center h-[48px] sm:h-[50px] px-2.5 sm:px-4 rounded-[12px] border border-[#0B1F3B]/20 bg-white text-[12px] sm:text-[15px] font-semibold text-[#0B1F3B] hover:bg-[#FFF3E0]/50 transition-colors"
            >
              {isTa ? "உள்நுழைவு" : "Login"}
            </a>
            <a
              href={page === "home" ? "#book-demo" : demoPath}
              onClick={(e) => {
                if (page !== "home") handleLinkClick(e, demoPath);
              }}
              className="inline-flex items-center justify-center h-[48px] sm:h-[50px] px-2.5 sm:px-5 rounded-[12px] bg-[#FF6A00] text-[12px] sm:text-[15px] font-semibold text-[#0B1F3B] hover:bg-[#e55f00] transition-colors whitespace-nowrap"
            >
              <span className="sm:hidden">{isTa ? "டெமோ" : "Demo"}</span>
              <span className="hidden sm:inline">{isTa ? "டெமோ பதிவு" : "Book a demo"}</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#E6E1D8] bg-white text-[#0B1F3B]">
        <div className="mx-auto max-w-[1160px] px-5 sm:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b border-[#E6E1D8]">
            <div className="space-y-2">
              <a
                href={homePath}
                aria-label="ServeMyFood Home"
                onClick={(e) => handleLinkClick(e, homePath)}
                className="inline-flex items-center min-h-[48px]"
              >
                <img
                  src="/brand/logo-horizontal-light.svg"
                  alt="ServeMyFood"
                  width={168}
                  height={36}
                  className="h-8 w-auto"
                />
              </a>
              <p className="text-[14px] leading-[1.6] text-[#0B1F3B]/75 max-w-[44ch]">
                {isTa
                  ? "தேநீர்க் கடை, கஃபே, உணவகம் மற்றும் ஹோட்டல்களுக்கான எளிய ஆர்டர், சமையலறை திரை மற்றும் விற்பனை கணக்கு."
                  : "Simple orders, kitchen screen, billing and daily sales for tea shops, cafes, restaurants and hotels."}
              </p>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[14px] text-[#0B1F3B]/75">
            <p>
              © {new Date().getFullYear()} ServeMyFood.{" "}
              {isTa ? "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை." : "All rights reserved."}
            </p>
            <div className="flex flex-wrap items-center gap-6">
              <a
                href={privacyPath}
                onClick={(e) => handleLinkClick(e, privacyPath)}
                className="inline-flex items-center min-h-[48px] hover:text-[#0B1F3B] underline-offset-4 hover:underline"
              >
                {isTa ? "தனியுரிமைக் கொள்கை" : "Privacy"}
              </a>
              <a
                href={termsPath}
                onClick={(e) => handleLinkClick(e, termsPath)}
                className="inline-flex items-center min-h-[48px] hover:text-[#0B1F3B] underline-offset-4 hover:underline"
              >
                {isTa ? "விதிமுறைகள்" : "Terms"}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
