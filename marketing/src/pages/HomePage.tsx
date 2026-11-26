import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, MessageCircle, Pause, Play } from "lucide-react";
import { SITE_CONFIG, getWhatsAppHref, hasTodoValue } from "../../content/site";
import { ComparisonSection } from "../components/ComparisonSection";
import { DemoForm } from "../components/DemoForm";
import { HardwareSection } from "../components/HardwareSection";
import {
  StepKitchenIllustration,
  StepOrderIllustration,
  StepPaySalesIllustration,
  StepTokenTvIllustration,
  VenueDiningIllustration,
  VenueHotelIllustration,
  VenueTeaIllustration,
} from "../components/MinimalIllustrations";
import { getPagePath, type Lang } from "../routes";

interface HomePageProps {
  lang?: Lang;
  onNavigate?: (path: string) => void;
}

const FLOW_STEPS = {
  en: [
    {
      id: "order",
      title: "1. Take orders",
      desc: "Tap dishes in Tamil or English on a phone or counter screen.",
      Illustration: StepOrderIllustration,
    },
    {
      id: "kitchen",
      title: "2. Kitchen alert",
      desc: "Every order lands on the kitchen screen at once with a chime.",
      Illustration: StepKitchenIllustration,
    },
    {
      id: "tv",
      title: "3. Token TV & serve",
      desc: "Waiters get a ready chime, or Token TV calls out the number.",
      Illustration: StepTokenTvIllustration,
    },
    {
      id: "pay",
      title: "4. Pay & daily sales",
      desc: "Record cash, UPI or card and check today's total on your phone.",
      Illustration: StepPaySalesIllustration,
    },
  ],
  ta: [
    {
      id: "order",
      title: "1. ஆர்டர் எடுங்கள்",
      desc: "தமிழ் அல்லது ஆங்கிலத்தில் போன் அல்லது கவுண்டரில் தட்டுங்கள்.",
      Illustration: StepOrderIllustration,
    },
    {
      id: "kitchen",
      title: "2. சமையலறை ஒலி",
      desc: "புதிய ஆர்டர்கள் ஒலி அறிவிப்புடன் உடனே சமையலறைக்குச் செல்லும்.",
      Illustration: StepKitchenIllustration,
    },
    {
      id: "tv",
      title: "3. டோக்கன் டிவி",
      desc: "உணவு தயாரானதும் பணியாளர் போன் அல்லது டிவியில் எண் அழைக்கும்.",
      Illustration: StepTokenTvIllustration,
    },
    {
      id: "pay",
      title: "4. பில் & விற்பனை",
      desc: "ரொக்கம், UPI கணக்கை முடித்து இன்றைய விற்பனையைப் பாருங்கள்.",
      Illustration: StepPaySalesIllustration,
    },
  ],
} as const;

const VENUES = {
  en: [
    {
      id: "tea" as const,
      targetPage: "tea-shops" as const,
      title: "Tea shop & bakery",
      desc: "Fast counter billing, token numbers, and live Token TV callouts.",
      Illustration: VenueTeaIllustration,
    },
    {
      id: "restaurant" as const,
      targetPage: "restaurants" as const,
      title: "Cafe & restaurant",
      desc: "Waiter phone orders, kitchen chime alerts, and one-tap sold-out.",
      Illustration: VenueDiningIllustration,
    },
    {
      id: "hotel" as const,
      targetPage: "hotels" as const,
      title: "Hotel restaurant",
      desc: "Multiple dining areas, staff logins, and branch sales in one place.",
      Illustration: VenueHotelIllustration,
    },
  ],
  ta: [
    {
      id: "tea" as const,
      targetPage: "tea-shops" as const,
      title: "தேநீர்க் கடை & பேக்கரி",
      desc: "விரைவான கவுண்டர் பில்லிங் மற்றும் டிவி டோக்கன் அழைப்பு.",
      Illustration: VenueTeaIllustration,
    },
    {
      id: "restaurant" as const,
      targetPage: "restaurants" as const,
      title: "கஃபே & உணவகம்",
      desc: "பணியாளர் போன் ஆர்டர், சமையலறை ஒலி மற்றும் எளிய பில்லிங்.",
      Illustration: VenueDiningIllustration,
    },
    {
      id: "hotel" as const,
      targetPage: "hotels" as const,
      title: "ஹோட்டல் உணவகம்",
      desc: "பல பிரிவுகள், தனி பணியாளர் உள்நுழைவு மற்றும் கிளை விற்பனை.",
      Illustration: VenueHotelIllustration,
    },
  ],
} as const;

const FAQ_ITEMS = {
  en: [
    {
      q: "What devices do I need?",
      a: "Any Android phone, tablet, laptop, or TV with a web browser. No special billing machine is needed to start.",
    },
    {
      q: "Does it work on regular 4G mobile data?",
      a: "Yes. It is light on data and works over shop Wi-Fi or 4G so screens stay synced live.",
    },
    {
      q: "Can my staff use it in Tamil?",
      a: "Yes. Every screen and menu item supports Tamil and English.",
    },
    {
      q: "What is not ready yet?",
      a: "Demo receipts are labelled DEMO RECEIPT. Online UPI payments, staff attendance, and hotel room charges are Coming soon.",
    },
  ],
  ta: [
    {
      q: "எந்த சாதனங்கள் தேவை?",
      a: "இணைய உலாவி உள்ள எந்த Android போன், டேப்லெட், லேப்டாப் அல்லது டிவியிலும் இயங்கும்.",
    },
    {
      q: "சாதாரண 4G இணைப்பில் இயங்குமா?",
      a: "ஆம். கடை Wi-Fi அல்லது சாதாரண 4G இணைப்பில் திரைகள் நேரலையில் இயங்கும்.",
    },
    {
      q: "பணியாளர்கள் தமிழில் பயன்படுத்தலாமா?",
      a: "ஆம். அனைத்து திரைகளும் உணவுப் பெயர்களும் தமிழ் மற்றும் ஆங்கிலத்தில் உள்ளன.",
    },
    {
      q: "இன்னும் தயாராகாத வசதிகள் எவை?",
      a: "டெமோ ரசீதுகளில் DEMO RECEIPT என இருக்கும். ஆன்லைன் UPI, பணியாளர் வருகை, அறை கணக்கு விரைவில் வரும்.",
    },
  ],
} as const;

export const HomePage: React.FC<HomePageProps> = ({ lang = "en", onNavigate }) => {
  const isTa = lang === "ta";
  const flowSteps = FLOW_STEPS[lang];
  const venues = VENUES[lang];
  const faqItems = FAQ_ITEMS[lang];

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [videoPaused, setVideoPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const heroWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !mounted || reducedMotion) return;
    if (videoPaused) {
      v.pause();
    } else {
      v.play().catch(() => {});
    }
  }, [videoPaused, mounted, reducedMotion]);

  useEffect(() => {
    const el = heroWrapRef.current;
    const v = videoRef.current;
    if (!el || !v || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          v.pause();
        } else if (!videoPaused && !reducedMotion) {
          v.play().catch(() => {});
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [videoPaused, reducedMotion]);

  const whatsappHref = getWhatsAppHref(
    "Hi ServeMyFood team, I would like a quick demo for my restaurant."
  );

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      onNavigate(path);
    }
  };

  return (
    <div>
      {/* 1. HERO (Exact Navy #0B1F3B — kept as requested by owner) */}
      <section
        className="relative bg-[#0B1F3B] lg:min-h-[calc(100vh-80px)] lg:max-h-[840px] flex items-center py-6 sm:py-8 lg:py-12 overflow-x-hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle at 72% 48%, rgba(255, 243, 224, 0.08), transparent 58%), radial-gradient(rgba(255, 243, 224, 0.08) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 24px 24px",
        }}
      >
        <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          <div className="lg:col-span-5 space-y-3.5 lg:space-y-5 text-left">
            {isTa ? (
              <h1 className="font-display font-semibold text-[clamp(25px,3vw,40px)] leading-[1.28] text-white">
                ஆர்டர் எடுங்கள். சமையலறையை இயக்குங்கள். பணம் பெறுங்கள். இன்றைய விற்பனையைப்
                பாருங்கள்.
              </h1>
            ) : (
              <h1 className="font-display font-semibold text-[clamp(30px,3.6vw,48px)] leading-[1.1] text-white">
                <span className="block whitespace-nowrap">Take orders.</span>
                <span className="block whitespace-nowrap">Run the kitchen.</span>
                <span className="block whitespace-nowrap">Get paid.</span>
                <span className="block whitespace-nowrap">See today&apos;s sales.</span>
              </h1>
            )}

            <p className="text-[15px] sm:text-[17px] lg:text-[19px] leading-[1.5] lg:leading-[1.55] text-white/90 max-w-[38ch] lg:max-w-[42ch]">
              {isTa
                ? "தேநீர்க் கடை, கஃபே, உணவகம், ஹோட்டல் அனைத்திற்கும் ஒரே எளிய அமைப்பு. போன், டேப்லெட் அல்லது கணினியில் இயங்கும்."
                : "One simple system for tea shops, cafes, restaurants and hotels. Works on a phone, tablet or computer."}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 lg:gap-3 pt-0.5">
              <a
                href="#book-demo"
                className="inline-flex items-center justify-center min-h-[48px] lg:min-h-[52px] px-5 sm:px-6 rounded-[12px] bg-[#FF6A00] text-[15px] sm:text-[16px] font-semibold text-[#0B1F3B] hover:-translate-y-0.5 transition-transform"
              >
                {isTa ? "இலவச டெமோ பதிவு" : "Book a free demo"}
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center min-h-[48px] lg:min-h-[52px] px-5 sm:px-6 rounded-[12px] border border-white/40 bg-transparent text-[15px] sm:text-[16px] font-semibold text-white hover:bg-white/10 transition-colors"
              >
                {isTa ? "எப்படி இயங்கும் எனப் பார்க்க" : "See how it works"}
              </a>
            </div>
          </div>

          <div ref={heroWrapRef} className="lg:col-span-7 space-y-3">
            {reducedMotion ? (
              <div
                data-testid="hero-storyboard"
                className="rounded-[18px] border border-white/20 bg-[#0B1F3B]/90 p-5 space-y-3 text-white shadow-xl"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                  {isTa ? "4 படிகள் சுருக்கம் (மாதிரி தரவு)" : "How it works (Sample data)"}
                </p>
                <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[14px]">
                  {flowSteps.map((st) => (
                    <li
                      key={st.id}
                      className="rounded-[12px] border border-white/15 bg-white/5 px-3.5 py-2.5"
                    >
                      <strong className="block text-white">{st.title}</strong>
                      <span className="text-white/80 text-[13px]">{st.desc}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-[18px] border border-white/15 bg-[#0B1F3B] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.6)] aspect-[1280/566]">
                <img
                  src="/video/hero-demo.webp"
                  alt="ServeMyFood order, kitchen, dashboard and receipt walkthrough"
                  width={1280}
                  height={566}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  loop
                  preload="none"
                  poster="/video/hero-demo.webp"
                  className="relative h-full w-full object-cover"
                >
                  {mounted && (
                    <>
                      <source src="/video/hero-demo.webm" type="video/webm" />
                      <source src="/video/hero-demo.mp4" type="video/mp4" />
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
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] sm:text-[14px] text-white/85">
                {isTa
                  ? "மாதிரி தரவு · ஆன்லைன் UPI கட்டணம்: விரைவில்"
                  : "Sample data · Online UPI payments: Coming soon"}
              </p>

              {!reducedMotion && (
                <button
                  type="button"
                  aria-pressed={videoPaused}
                  aria-label={
                    isTa
                      ? videoPaused
                        ? "இயக்கு — Play animation"
                        : "நிறுத்து — Pause animation"
                      : videoPaused
                        ? "Play — Play animation"
                        : "Pause — Pause animation"
                  }
                  onClick={() => setVideoPaused((p) => !p)}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-[12px] border border-white/30 bg-white/10 text-[14px] font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  {videoPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  <span>{videoPaused ? (isTa ? "இயக்கு" : "Play") : isTa ? "நிறுத்து" : "Pause"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. MINIMAL ILLUSTRATED 4-STEP FLOW */}
      <section id="how-it-works" className="bg-white py-12 lg:py-16">
        <div className="mx-auto max-w-[1080px] px-5 sm:px-8 space-y-8">
          <div className="space-y-1.5 max-w-[56ch]">
            <h2 className="font-display font-semibold text-[24px] leading-[1.25] lg:text-[32px] text-[#0B1F3B]">
              {isTa ? "எப்படி இயங்குகிறது" : "How it works in 4 simple steps"}
            </h2>
            <p className="text-[15px] sm:text-[16px] text-[#0B1F3B]/80">
              {isTa
                ? "ஆர்டர் முதல் இன்றைய விற்பனை வரை ஒரே எளிய ஓட்டம்."
                : "From taking an order to closing today's cash and UPI count."}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {flowSteps.map((step) => {
              const Illustration = step.Illustration;
              return (
                <article
                  key={step.id}
                  className="rounded-[14px] border border-[#E6E1D8] bg-[#FFF3E0]/25 p-5 space-y-3"
                >
                  <Illustration />
                  <h3 className="font-display font-semibold text-[17px] text-[#0B1F3B]">
                    {step.title}
                  </h3>
                  <p className="text-[14px] leading-[1.55] text-[#0B1F3B]/80">{step.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. MINIMAL COMPARISON: PAPER SLIPS & WHATSAPP VS SERVEMYFOOD */}
      <ComparisonSection lang={lang} />

      {/* 4. MINIMAL ILLUSTRATED VENUES */}
      <section id="who-it-is-for" className="bg-white py-12 lg:py-16 border-b border-[#E6E1D8]">
        <div className="mx-auto max-w-[1080px] px-5 sm:px-8 space-y-8">
          <div className="space-y-1.5 max-w-[56ch]">
            <h2 className="font-display font-semibold text-[24px] leading-[1.25] lg:text-[32px] text-[#0B1F3B]">
              {isTa ? "உங்கள் கடைக்கு ஏற்ற அமைப்பு" : "Built for your shop"}
            </h2>
            <p className="text-[15px] sm:text-[16px] text-[#0B1F3B]/80">
              {isTa
                ? "உங்கள் கவுண்டர் அல்லது உணவகத்திற்கு ஏற்ப இன்றே தொடங்குங்கள்."
                : "Pick your format to see how it fits your daily work."}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {venues.map((venue) => {
              const venueHref = getPagePath(venue.targetPage, lang);
              const Illustration = venue.Illustration;
              return (
                <article
                  key={venue.id}
                  className="rounded-[14px] border border-[#E6E1D8] bg-white p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <Illustration />
                    <h3 className="font-display font-semibold text-[18px] text-[#0B1F3B]">
                      {venue.title}
                    </h3>
                    <p className="text-[14px] leading-[1.55] text-[#0B1F3B]/80">{venue.desc}</p>
                  </div>
                  <a
                    href={venueHref}
                    onClick={(e) => handleLinkClick(e, venueHref)}
                    className="inline-flex items-center gap-1.5 min-h-[48px] text-[14px] font-semibold text-[#0B1F3B] underline decoration-[#FF6A00] decoration-2 underline-offset-4"
                  >
                    <span>{isTa ? `${venue.title} பார்க்க` : `See ${venue.title.toLowerCase()}`}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. MINIMAL HARDWARE SECTION */}
      <HardwareSection lang={lang} onNavigate={onNavigate} />

      {/* 6. MINIMAL FAQ (4 essential questions) */}
      <section id="faq" className="bg-[#FFF3E0]/70 border-t border-[#E6E1D8] py-12 lg:py-16">
        <div className="mx-auto max-w-[1080px] px-5 sm:px-8 space-y-6">
          <h2 className="font-display font-semibold text-[24px] leading-[1.25] lg:text-[32px] text-[#0B1F3B]">
            {isTa ? "பொதுவான கேள்விகள்" : "Common questions"}
          </h2>

          <div className="divide-y divide-[#E6E1D8] rounded-[14px] border border-[#E6E1D8] bg-white">
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    id={`faq-btn-${idx}`}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${idx}`}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full min-h-[52px] px-5 py-3.5 flex items-center justify-between gap-4 text-left font-display font-semibold text-[16px] text-[#0B1F3B]"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div
                      id={`faq-panel-${idx}`}
                      role="region"
                      aria-labelledby={`faq-btn-${idx}`}
                      className="px-5 pb-4 text-[14px] sm:text-[15px] leading-[1.55] text-[#0B1F3B]/80 max-w-[66ch]"
                    >
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. BOOK A DEMO */}
      <section id="book-demo" className="bg-[#0B1F3B] py-12 lg:py-16 text-white">
        <div className="mx-auto max-w-[1080px] px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="font-display font-semibold text-[24px] leading-[1.25] lg:text-[32px] text-white">
              {isTa ? "உங்கள் கடையிலேயே பாருங்கள்" : "See ServeMyFood in your shop"}
            </h2>
            <p className="text-[15px] sm:text-[16px] leading-[1.55] text-white/85">
              {isTa
                ? "உங்கள் பெயர் மற்றும் தொலைபேசி எண்ணைப் பகிருங்கள். நேரலை டெமோ காட்டுகிறோம்."
                : "Share your name and mobile number. We will show you the waiter, kitchen, Token TV, and cashier screens live."}
            </p>

            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-[12px] bg-[#FF6A00] text-[15px] font-semibold text-[#0B1F3B] hover:-translate-y-0.5 transition-transform"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span>{isTa ? "வாட்ஸ்அப்பில் உரையாட" : "Chat on WhatsApp"}</span>
            </a>

            {!hasTodoValue(SITE_CONFIG.contactPhone) && (
              <p className="text-[14px] text-white/80">
                {isTa ? "தொலைபேசி" : "Phone"}: {SITE_CONFIG.contactPhone}
              </p>
            )}
          </div>

          <div className="lg:col-span-7">
            <DemoForm lang={lang} hideQuickLinks onNavigate={onNavigate} />
          </div>
        </div>
      </section>
    </div>
  );
};
