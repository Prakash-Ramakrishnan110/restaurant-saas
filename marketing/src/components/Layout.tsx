import React, { useEffect, useState } from "react";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { SITE_CONFIG, getWhatsAppHref } from "../../content/site";
import type { Lang, PageId } from "../routes";

interface LayoutProps {
  lang: Lang;
  page: PageId;
  onNavigate?: (path: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ page, onNavigate, children }) => {
  const [scrolled, setScrolled] = useState(false);

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
    <div className="min-h-screen flex flex-col bg-white text-[#0B1F3B] font-sans">
      {/* 1. Sticky Header (shrinks to 64px on scroll) */}
      <header className="sticky top-0 z-30 border-b border-[#E6E1D8] bg-white/95 backdrop-blur">
        <div
          className={`mx-auto max-w-[1120px] px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 transition-all ${
            scrolled ? "h-16" : "h-20"
          }`}
        >
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
              href={page === "home" ? "#book-demo" : "/book-demo/"}
              onClick={(e) => {
                if (page !== "home") handleLinkClick(e, "/book-demo/");
              }}
              className="inline-flex items-center justify-center h-[48px] sm:h-[52px] px-3 sm:px-5 rounded-[12px] bg-[#FF6A00] text-[13px] sm:text-[15px] font-semibold text-[#0B1F3B] hover:bg-[#e55f00] transition-colors"
            >
              Book a demo
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#E6E1D8] bg-white text-[#0B1F3B]">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-[#E6E1D8]">
            {/* Brand Column */}
            <div className="md:col-span-5 space-y-4">
              <a
                href="/"
                onClick={(e) => handleLinkClick(e, "/")}
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
              <p className="text-[15px] leading-[1.6] text-[#0B1F3B]/80 max-w-[38ch]">
                Simple orders, kitchen screen, billing and daily sales for tea shops, cafes,
                restaurants and hotels.
              </p>
              <p className="text-[14px] font-semibold text-[#0B1F3B]">{SITE_CONFIG.companyName}</p>
            </div>

            {/* Product Links */}
            <div className="md:col-span-3 space-y-2">
              <h2 className="font-display font-semibold text-[15px] text-[#0B1F3B] pb-1">
                Product
              </h2>
              <ul className="space-y-0.5 text-[15px]">
                <li>
                  <a
                    href={page === "home" ? "#how-it-works" : "/#how-it-works"}
                    className="inline-flex items-center min-h-[48px] text-[#0B1F3B]/85 hover:text-[#FF6A00] transition-colors"
                  >
                    How it works
                  </a>
                </li>
                <li>
                  <a
                    href={page === "home" ? "#who-it-is-for" : "/#who-it-is-for"}
                    className="inline-flex items-center min-h-[48px] text-[#0B1F3B]/85 hover:text-[#FF6A00] transition-colors"
                  >
                    Who it is for
                  </a>
                </li>
                <li>
                  <a
                    href={page === "home" ? "#faq" : "/#faq"}
                    className="inline-flex items-center min-h-[48px] text-[#0B1F3B]/85 hover:text-[#FF6A00] transition-colors"
                  >
                    FAQ
                  </a>
                </li>
                <li>
                  <a
                    href={SITE_CONFIG.appUrl}
                    className="inline-flex items-center min-h-[48px] text-[#0B1F3B]/85 hover:text-[#FF6A00] transition-colors"
                  >
                    Staff Login
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact & WhatsApp */}
            <div className="md:col-span-4 space-y-3">
              <h2 className="font-display font-semibold text-[15px] text-[#0B1F3B] pb-1">
                Contact &amp; Demo
              </h2>
              <div className="flex flex-col items-start gap-2.5">
                <a
                  href={getWhatsAppHref(
                    "Hi ServeMyFood team, I would like a quick demo for my restaurant."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 min-h-[48px] px-4 rounded-[12px] bg-[#FF6A00] text-[15px] font-semibold text-[#0B1F3B] hover:bg-[#e55f00] transition-colors"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  <span>WhatsApp: {SITE_CONFIG.contactPhone}</span>
                </a>

                <a
                  href={`tel:${SITE_CONFIG.contactPhone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex items-center gap-2 min-h-[48px] text-[15px] font-medium text-[#0B1F3B]/85 hover:text-[#0B1F3B] transition-colors"
                >
                  <Phone className="h-4 w-4 text-[#0B1F3B]" aria-hidden="true" />
                  <span>Call: {SITE_CONFIG.contactPhone}</span>
                </a>

                <a
                  href={`mailto:${SITE_CONFIG.contactEmail}`}
                  className="inline-flex items-center gap-2 min-h-[48px] text-[15px] font-medium text-[#0B1F3B]/85 hover:text-[#0B1F3B] transition-colors break-all"
                >
                  <Mail className="h-4 w-4 shrink-0 text-[#0B1F3B]" aria-hidden="true" />
                  <span>{SITE_CONFIG.contactEmail}</span>
                </a>

                <p className="inline-flex items-center gap-2 text-[14px] text-[#0B1F3B]/80 pt-1">
                  <MapPin className="h-4 w-4 shrink-0 text-[#0B1F3B]" aria-hidden="true" />
                  <span>{SITE_CONFIG.address}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Legal Row */}
          <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[14px] text-[#0B1F3B]/80">
            <p>© {new Date().getFullYear()} {SITE_CONFIG.companyName}. All rights reserved.</p>
            <div className="flex items-center gap-4 font-medium text-[#0B1F3B]">
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
        </div>
      </footer>
    </div>
  );
};
