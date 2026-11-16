import React from "react";
import { Globe, LogIn } from "lucide-react";
import { SITE_CONFIG, hasTodoValue } from "../../content/site";
import { getPagePath, type Lang, type PageId } from "../routes";

interface LayoutProps {
  lang: Lang;
  page: PageId;
  onNavigate?: (path: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ lang, page, onNavigate, children }) => {
  const otherLang: Lang = lang === "en" ? "ta" : "en";
  const switchPath = getPagePath(page === "404" ? "home" : page, otherLang);
  const homePath = getPagePath("home", lang);
  const demoPath = getPagePath("book-demo", lang);
  const privacyPath = getPagePath("privacy", lang);
  const termsPath = getPagePath("terms", lang);

  const missingTodos = [
    hasTodoValue(SITE_CONFIG.siteUrl) && "siteUrl",
    hasTodoValue(SITE_CONFIG.whatsappNumber) && "whatsappNumber",
    hasTodoValue(SITE_CONFIG.contactPhone) && "contactPhone",
    hasTodoValue(SITE_CONFIG.contactEmail) && "contactEmail",
    hasTodoValue(SITE_CONFIG.address) && "address",
  ].filter(Boolean);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFBF7] text-[#0B1F3B]">
      {import.meta.env.DEV && missingTodos.length > 0 && (
        <div
          role="status"
          className="bg-amber-100 border-b border-amber-300 px-4 py-1.5 text-center text-xs font-semibold text-amber-950"
        >
          DEV TODO: Fill {missingTodos.join(", ")} in marketing/content/site.ts before production build.
        </div>
      )}

      <header className="border-b border-[#0B1F3B]/10 bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <a
            href={homePath}
            onClick={(e) => handleLinkClick(e, homePath)}
            className="flex items-center gap-2.5 font-display font-bold text-lg text-[#0B1F3B]"
          >
            <img
              src="/brand/mark-orange.svg"
              alt="ServeMyFood"
              width={32}
              height={32}
              className="h-8 w-8"
            />
            <span>{SITE_CONFIG.productName}</span>
          </a>

          <nav aria-label="Primary navigation" className="flex flex-wrap items-center gap-2 sm:gap-3">
            <a
              href={switchPath}
              onClick={(e) => handleLinkClick(e, switchPath)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0B1F3B]/20 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-[#0B1F3B] hover:bg-[#FFF3E0]"
            >
              <Globe className="h-4 w-4 text-[#FF6A00]" />
              <span>{lang === "en" ? "தமிழ்" : "English"}</span>
            </a>

            <a
              href={SITE_CONFIG.appUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0B1F3B]/20 px-3 py-2 text-xs sm:text-sm font-semibold text-[#0B1F3B] hover:bg-slate-100"
            >
              <LogIn className="h-4 w-4" />
              <span>{lang === "ta" ? "உள்நுழைக" : "Login"}</span>
            </a>

            <a
              href={demoPath}
              onClick={(e) => handleLinkClick(e, demoPath)}
              className="inline-flex items-center justify-center rounded-lg bg-[#FF6A00] px-4 py-2 text-xs sm:text-sm font-bold text-[#0B1F3B] hover:bg-[#e55f00]"
            >
              {lang === "ta" ? "டெமோ பதிவு" : "Book a demo"}
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#0B1F3B]/10 bg-[#0B1F3B] text-white mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="font-display font-bold text-base">{SITE_CONFIG.companyName}</div>
            <p className="mt-2 text-xs text-slate-300">{SITE_CONFIG.address}</p>
            <p className="mt-1 text-xs text-slate-300">{SITE_CONFIG.contactEmail}</p>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <span className="font-bold uppercase tracking-wider text-[#FF6A00]">
              {lang === "ta" ? "வணிக வகைகள்" : "Businesses"}
            </span>
            <a
              href={getPagePath("tea-shops", lang)}
              onClick={(e) => handleLinkClick(e, getPagePath("tea-shops", lang))}
              className="text-slate-200 hover:text-white underline-offset-4 hover:underline"
            >
              {lang === "ta" ? "தேநீர்க் கடை & பேக்கரி" : "Tea shops & bakeries"}
            </a>
            <a
              href={getPagePath("restaurants", lang)}
              onClick={(e) => handleLinkClick(e, getPagePath("restaurants", lang))}
              className="text-slate-200 hover:text-white underline-offset-4 hover:underline"
            >
              {lang === "ta" ? "உணவகம் & கஃபே" : "Restaurants & cafes"}
            </a>
            <a
              href={getPagePath("hotels", lang)}
              onClick={(e) => handleLinkClick(e, getPagePath("hotels", lang))}
              className="text-slate-200 hover:text-white underline-offset-4 hover:underline"
            >
              {lang === "ta" ? "ஹோட்டல் உணவகங்கள்" : "Hotels"}
            </a>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <span className="font-bold uppercase tracking-wider text-[#FF6A00]">
              {lang === "ta" ? "சட்ட விவரங்கள்" : "Legal & Language"}
            </span>
            <a
              href={privacyPath}
              onClick={(e) => handleLinkClick(e, privacyPath)}
              className="text-slate-200 hover:text-white underline-offset-4 hover:underline"
            >
              {lang === "ta" ? "தனியுரிமைக் கொள்கை" : "Privacy"}
            </a>
            <a
              href={termsPath}
              onClick={(e) => handleLinkClick(e, termsPath)}
              className="text-slate-200 hover:text-white underline-offset-4 hover:underline"
            >
              {lang === "ta" ? "விதிமுறைகள்" : "Terms"}
            </a>
            <a
              href={switchPath}
              onClick={(e) => handleLinkClick(e, switchPath)}
              className="text-slate-200 hover:text-white underline-offset-4 hover:underline"
            >
              {lang === "en" ? "தமிழில் பார்க்க" : "View in English"}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
