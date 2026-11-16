import React from "react";
import { SITE_CONFIG } from "../../content/site";
import type { Lang, PageId } from "../routes";

interface LayoutProps {
  lang: Lang;
  page: PageId;
  onNavigate?: (path: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ page, onNavigate, children }) => {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0B1F3B] font-sans">
      {/* 1. Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-[#E6E1D8] bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-[1120px] px-3 sm:px-6 h-20 flex items-center justify-between gap-2 sm:gap-3">
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, "/")}
            className="inline-flex items-center min-h-[48px] shrink-0"
          >
            <img
              src="/brand/logo-horizontal-light.svg"
              alt="ServeMyFood"
              width={168}
              height={36}
              className="h-6 sm:h-9 w-auto"
            />
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-6 text-[15px] font-medium text-[#0B1F3B]"
          >
            <a
              href={page === "home" ? "#how-it-works" : "/#how-it-works"}
              className="inline-flex items-center min-h-[48px] px-2 hover:text-[#FF6A00] transition-colors"
            >
              How it works
            </a>
            <a
              href={page === "home" ? "#who-it-is-for" : "/#who-it-is-for"}
              className="inline-flex items-center min-h-[48px] px-2 hover:text-[#FF6A00] transition-colors"
            >
              Who it is for
            </a>
            <a
              href={page === "home" ? "#faq" : "/#faq"}
              className="inline-flex items-center min-h-[48px] px-2 hover:text-[#FF6A00] transition-colors"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <a
              href={SITE_CONFIG.appUrl}
              className="inline-flex items-center justify-center h-[48px] sm:h-[52px] px-3 sm:px-5 rounded-[12px] border border-[#0B1F3B]/20 bg-white text-[13px] sm:text-[15px] font-semibold text-[#0B1F3B] hover:bg-[#FFF3E0]/50 transition-colors"
            >
              Login
            </a>
            <a
              href="#book-demo-band"
              className="inline-flex items-center justify-center h-[48px] sm:h-[52px] px-3 sm:px-5 rounded-[12px] bg-[#FF6A00] text-[13px] sm:text-[15px] font-semibold text-[#0B1F3B] hover:bg-[#e55f00] transition-colors"
            >
              Book a demo
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* 8. Footer */}
      <footer className="border-t border-[#E6E1D8] bg-white text-[#0B1F3B]">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-6 py-12 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="font-display font-semibold text-[18px]">{SITE_CONFIG.companyName}</div>
            <p className="text-[15px] text-[#0B1F3B]/80">
              {SITE_CONFIG.contactEmail} • {SITE_CONFIG.address}
            </p>
          </div>

          <div className="flex items-center gap-4 text-[15px] font-medium">
            <a
              href={SITE_CONFIG.appUrl}
              className="inline-flex items-center min-h-[48px] px-2 hover:underline underline-offset-4"
            >
              Login
            </a>
            <a
              href="/privacy/"
              onClick={(e) => handleLinkClick(e, "/privacy/")}
              className="inline-flex items-center min-h-[48px] px-2 hover:underline underline-offset-4"
            >
              Privacy
            </a>
            <a
              href="/terms/"
              onClick={(e) => handleLinkClick(e, "/terms/")}
              className="inline-flex items-center min-h-[48px] px-2 hover:underline underline-offset-4"
            >
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
