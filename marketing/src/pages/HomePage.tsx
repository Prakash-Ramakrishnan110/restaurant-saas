import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clock, MessageCircle, Pause, Play } from "lucide-react";
import { FEATURE_CLAIMS } from "../../content/claims";
import { SITE_CONFIG, getWhatsAppHref, hasTodoValue } from "../../content/site";
import { DemoForm } from "../components/DemoForm";
import {
  StepScreenPreview,
  VenueMiniPreview,
} from "../components/LiveAppPreview";
import type { Lang } from "../routes";

interface HomePageProps {
  lang?: Lang;
  onNavigate?: (path: string) => void;
}

const STEPS = [
  {
    id: "order",
    label: "1. Order",
    title: "Take the order at the table or counter",
    desc: "Waiters tap dishes with photos and Tamil names, then send the order straight to the kitchen.",
  },
  {
    id: "kitchen",
    label: "2. Kitchen",
    title: "Kitchen gets the ticket with a sound alert",
    desc: "Cooks see every ticket in order with kitchen notes and a live timer, then tap Ready.",
  },
  {
    id: "serve",
    label: "3. Serve",
    title: "Waiter sees ready dishes immediately",
    desc: "Ready orders appear in one queue on the waiter's phone and clear in a single tap.",
  },
  {
    id: "pay",
    label: "4. Pay",
    title: "Settle the bill by cash, UPI or card",
    desc: "Cashiers pull up open bills, record payment, and print a clean receipt without guesswork.",
  },
  {
    id: "sales",
    label: "5. Sales",
    title: "Check today's sales anytime",
    desc: "Owners see live daily totals, cash vs UPI split, and bestselling items from any phone.",
  },
] as const;

const PROBLEMS = [
  {
    before: "Lost paper slips",
    after: "Every order goes straight from phone to kitchen screen with a sound chime.",
  },
  {
    before: "Dish finished, guest still orders",
    after: "Mark any dish sold out in one tap so staff stop taking orders for it right away.",
  },
  {
    before: "Where did today's money go?",
    after: "See cash, UPI and card totals on your phone at any time of day.",
  },
] as const;

const VENUES = [
  {
    id: "tea" as const,
    title: "Tea shop and bakery",
    subtitle: "Fast counter queues with token numbers",
    badge: null,
    outcomes: [
      "Take chai and snack orders in two taps",
      "Call out token numbers clearly on screen",
      "Check cash and UPI totals at closing time",
    ],
  },
  {
    id: "restaurant" as const,
    title: "Cafe and restaurant",
    subtitle: "Dining rooms, waiters and a busy kitchen",
    badge: null,
    outcomes: [
      "Send dining orders straight to the kitchen",
      "Hear a clear chime for every new ticket",
      "Mark sold-out dishes in one tap",
    ],
  },
  {
    id: "hotel" as const,
    title: "Hotel",
    subtitle: "Multiple dining areas and staff roles",
    badge: "Room service: Coming soon",
    outcomes: [
      "Separate logins for waiters, cooks and cashiers",
      "Manage multiple dining areas and branches",
      "One view of daily sales for the owner",
    ],
  },
] as const;

const FAQ_ITEMS = [
  {
    q: "What devices do I need?",
    a: "ServeMyFood runs in a web browser on any Android phone, tablet, or computer. You do not need special billing hardware to start.",
  },
  {
    q: "Does it work if my internet is slow?",
    a: "Yes, it is built to be light on mobile data and works on regular 4G connections. An active internet connection is required because orders sync live between screens.",
  },
  {
    q: "Do I need a kitchen printer?",
    a: "No. Your kitchen can use any spare tablet or phone as a live kitchen screen with a sound alert. Standard browser printing works for counter receipts.",
  },
  {
    q: "Can my staff use it in Tamil?",
    a: "Yes. Menu items can show both Tamil and English names, and each staff member can switch their screen between Tamil and English.",
  },
  {
    q: "How long does it take to start?",
    a: "Most shops add their menu, set up staff logins, and take their first live order on the same day after a short walkthrough.",
  },
  {
    q: "What is not ready yet?",
    a: "Tax invoices (GST), direct online guest UPI payments, and kitchen stock/inventory tracking are not ready yet and are marked Coming soon.",
  },
] as const;

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const [activeStep, setActiveStep] = useState(0);
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

  const currentStep = STEPS[activeStep] ?? STEPS[0];
  const liveClaims = FEATURE_CLAIMS.filter((c) => c.status === "LIVE");
  const soonClaims = FEATURE_CLAIMS.filter((c) => c.status === "SOON");
  const whatsappHref = getWhatsAppHref(
    "Hi ServeMyFood team, I would like a quick demo for my restaurant."
  );

  return (
    <div>
      {/* 1. HERO (Exact Navy #0B1F3B + 8% cream spotlight + faint dot grid) */}
      <section
        className="relative bg-[#0B1F3B] lg:min-h-[calc(100vh-80px)] lg:max-h-[840px] flex items-center py-5 sm:py-8 lg:py-12 overflow-x-hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle at 72% 48%, rgba(255, 243, 224, 0.08), transparent 58%), radial-gradient(rgba(255, 243, 224, 0.08) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 24px 24px",
        }}
      >
        <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-10 items-center">
          <div className="lg:col-span-5 space-y-3 lg:space-y-5 text-left">
            <h1 className="font-display font-semibold text-[clamp(30px,3.6vw,48px)] leading-[1.1] text-white">
              <span className="block whitespace-nowrap">Take orders.</span>
              <span className="block whitespace-nowrap">Run the kitchen.</span>
              <span className="block whitespace-nowrap">Get paid.</span>
              <span className="block whitespace-nowrap">See today&apos;s sales.</span>
            </h1>

            <p className="text-[15px] sm:text-[17px] lg:text-[19px] leading-[1.45] lg:leading-[1.55] text-white/90 max-w-[33ch] lg:max-w-[40ch]">
              One simple system for tea shops, cafes, restaurants and hotels. Works on a phone,
              tablet or computer.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 lg:gap-3 pt-0.5">
              <a
                href="#book-demo"
                className="inline-flex items-center justify-center h-[48px] lg:h-[52px] px-5 sm:px-6 rounded-[12px] bg-[#FF6A00] text-[15px] sm:text-[16px] font-semibold text-[#0B1F3B] hover:-translate-y-0.5 transition-transform"
              >
                Book a free demo
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center h-[48px] lg:h-[52px] px-5 sm:px-6 rounded-[12px] border border-white/40 bg-transparent text-[15px] sm:text-[16px] font-semibold text-white hover:bg-white/10 transition-colors"
              >
                See how it works
              </a>
            </div>
          </div>

          <div ref={heroWrapRef} className="lg:col-span-7 space-y-3">
            <div className="relative overflow-hidden rounded-[18px] border border-white/15 bg-[#0B1F3B] shadow-[0_24px_60px_-15px_rgba(0,0,0,0.6)] aspect-[1280/566]">
              <img
                src="/video/hero-demo.webp"
                alt="ServeMyFood order, kitchen, dashboard and receipt printer walkthrough"
                width={1280}
                height={566}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {mounted && !reducedMotion && (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  loop
                  preload="metadata"
                  poster="/video/hero-demo.webp"
                  className="relative h-full w-full object-cover"
                >
                  <source src="/video/hero-demo.webm" type="video/webm" />
                  <source src="/video/hero-demo.mp4" type="video/mp4" />
                </video>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] sm:text-[14px] text-white/85">
                Product preview · Customer QR ordering: Coming soon
              </p>

              <button
                type="button"
                aria-pressed={videoPaused}
                onClick={() => setVideoPaused((p) => !p)}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-[12px] border border-white/30 bg-white/10 text-[14px] font-semibold text-white hover:bg-white/20 transition-colors"
              >
                {videoPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                <span>{videoPaused ? "Play" : "Pause"}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FROM ORDER TO SALES IN 5 STEPS (White #FFFFFF) */}
      <section id="how-it-works" className="bg-white py-14 lg:py-24">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 space-y-8">
          <div className="space-y-2 max-w-[65ch]">
            <h2 className="font-display font-semibold text-[28px] leading-[1.2] lg:text-[36px] text-[#0B1F3B]">
              From order to sales in 5 steps
            </h2>
            <p className="text-[18px] leading-[1.6] text-[#0B1F3B]/80">
              Tap any step to see the screen your staff uses.
            </p>
          </div>

          <div
            className="grid grid-cols-2 sm:grid-cols-5 gap-2.5"
            role="tablist"
            aria-label="Order journey steps"
          >
            {STEPS.map((step, idx) => {
              const active = idx === activeStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveStep(idx)}
                  className={`min-h-[52px] px-3 rounded-[12px] text-[14px] font-semibold transition-colors ${
                    active
                      ? "bg-[#FF6A00] text-[#0B1F3B]"
                      : "bg-[#FFF3E0]/60 border border-[#E6E1D8] text-[#0B1F3B] hover:border-[#0B1F3B]/40"
                  }`}
                >
                  {step.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-[16px] border border-[#E6E1D8] bg-[#FFF3E0]/45 p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-3">
              <span className="inline-block text-[13px] font-semibold uppercase tracking-wide text-[#0B1F3B]/75">
                {currentStep.label}
              </span>
              <h3 className="font-display font-semibold text-[24px] leading-[1.25] text-[#0B1F3B]">
                {currentStep.title}
              </h3>
              <p className="text-[18px] leading-[1.6] text-[#0B1F3B]/80">{currentStep.desc}</p>
            </div>

            <div className="lg:col-span-7 flex justify-center">
              <StepScreenPreview stepIndex={activeStep} />
            </div>
          </div>
        </div>
      </section>

      {/* 3. EVERYDAY PROBLEMS SOLVED (Cream #FFF3E0) */}
      <section className="bg-[#FFF3E0] py-14 lg:py-24">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 space-y-8">
          <div className="space-y-2 max-w-[65ch]">
            <h2 className="font-display font-semibold text-[28px] leading-[1.2] lg:text-[36px] text-[#0B1F3B]">
              Stop losing orders and money to paper slips
            </h2>
            <p className="text-[18px] leading-[1.6] text-[#0B1F3B]/80">
              Three everyday headaches in small restaurants, fixed simply.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PROBLEMS.map((item) => (
              <article
                key={item.before}
                className="rounded-[16px] border border-[#E6E1D8] bg-white p-6 space-y-3"
              >
                <span className="inline-block rounded-full bg-[#FFF3E0] px-3 py-1 text-[12px] font-semibold text-[#0B1F3B]">
                  Common problem
                </span>
                <h3 className="font-display font-semibold text-[20px] text-[#0B1F3B]">
                  {item.before}
                </h3>
                <p className="text-[16px] leading-[1.6] text-[#0B1F3B]/80">{item.after}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. WHO IT IS FOR (White #FFFFFF) */}
      <section id="who-it-is-for" className="bg-white py-14 lg:py-24">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 space-y-8">
          <div className="space-y-2 max-w-[65ch]">
            <h2 className="font-display font-semibold text-[28px] leading-[1.2] lg:text-[36px] text-[#0B1F3B]">
              Built for small Indian restaurants
            </h2>
            <p className="text-[18px] leading-[1.6] text-[#0B1F3B]/80">
              Start with what fits your counter or dining room today.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {VENUES.map((venue) => (
              <article
                key={venue.id}
                className="rounded-[16px] border border-[#E6E1D8] bg-white p-6 space-y-5"
              >
                <VenueMiniPreview kind={venue.id} />

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display font-semibold text-[22px] text-[#0B1F3B]">
                      {venue.title}
                    </h3>
                    {venue.badge && (
                      <span className="inline-flex items-center rounded-full border border-[#E6E1D8] bg-[#FFF3E0] px-2.5 py-1 text-[12px] font-semibold text-[#0B1F3B]">
                        {venue.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] text-[#0B1F3B]/75">{venue.subtitle}</p>
                </div>

                <ul className="space-y-2.5">
                  {venue.outcomes.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-[15px] text-[#0B1F3B]">
                      <Check className="h-4 w-4 text-[#1D9E75] shrink-0 mt-1" aria-hidden="true" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. WORKS TODAY VS COMING SOON (Cream #FFF3E0) */}
      <section className="bg-[#FFF3E0] py-14 lg:py-24">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 space-y-8">
          <div className="space-y-2 max-w-[65ch]">
            <h2 className="font-display font-semibold text-[28px] leading-[1.2] lg:text-[36px] text-[#0B1F3B]">
              What works today and what&apos;s coming
            </h2>
            <p className="text-[18px] leading-[1.6] text-[#0B1F3B]/80">
              Only features live in the app today are listed on the left. Upcoming work is marked clearly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-[16px] border border-[#E6E1D8] bg-white p-6 lg:p-8 space-y-5">
              <span className="inline-flex items-center rounded-full bg-[#1D9E75]/15 px-3 py-1 text-[13px] font-semibold text-[#0B1F3B]">
                Works today
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {liveClaims.map((claim) => (
                  <div key={claim.id} className="flex items-start gap-2.5">
                    <Check className="h-5 w-5 text-[#1D9E75] shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <h3 className="font-semibold text-[15px] text-[#0B1F3B]">{claim.titleEn}</h3>
                      <p className="text-[14px] leading-[1.5] text-[#0B1F3B]/75">{claim.descEn}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 rounded-[16px] border border-[#E6E1D8] bg-white/80 p-6 lg:p-8 space-y-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E1D8] bg-[#FFF3E0] px-3 py-1 text-[13px] font-semibold text-[#0B1F3B]">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Coming soon
              </span>

              <div className="space-y-4">
                {soonClaims.map((claim) => (
                  <div key={claim.id} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[15px] text-[#0B1F3B]">{claim.titleEn}</h3>
                      <span className="rounded-full border border-[#E6E1D8] bg-[#FFF3E0] px-2 py-0.5 text-[11px] font-semibold text-[#0B1F3B]">
                        Coming soon
                      </span>
                    </div>
                    <p className="text-[14px] leading-[1.5] text-[#0B1F3B]/75">{claim.descEn}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ (White #FFFFFF) */}
      <section id="faq" className="bg-white py-14 lg:py-24">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 space-y-8">
          <div className="space-y-2 max-w-[65ch]">
            <h2 className="font-display font-semibold text-[28px] leading-[1.2] lg:text-[36px] text-[#0B1F3B]">
              Common questions
            </h2>
            <p className="text-[18px] leading-[1.6] text-[#0B1F3B]/80">
              Straight answers before you try it in your restaurant.
            </p>
          </div>

          <div className="space-y-3 max-w-[820px]">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={item.q}
                  className="rounded-[16px] border border-[#E6E1D8] bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full min-h-[56px] px-6 py-4 flex items-center justify-between gap-4 text-left font-display font-semibold text-[17px] text-[#0B1F3B]"
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
                    <div className="px-6 pb-5 text-[16px] leading-[1.6] text-[#0B1F3B]/80 max-w-[68ch]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. BOOK A DEMO BAND (Navy #0B1F3B) */}
      <section id="book-demo" className="bg-[#0B1F3B] py-14 lg:py-24 text-white">
        <div className="mx-auto max-w-[1280px] px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-5">
            <h2 className="font-display font-semibold text-[28px] leading-[1.2] lg:text-[36px] text-white">
              See ServeMyFood in your own shop
            </h2>
            <p className="text-[18px] leading-[1.6] text-white/85 max-w-[56ch]">
              Tell us your shop name and phone number. We will show you the waiter, kitchen,
              cashier and owner screens live.
            </p>

            <div className="flex flex-wrap gap-3">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 h-[52px] px-6 rounded-[12px] bg-[#FF6A00] text-[16px] font-semibold text-[#0B1F3B] hover:-translate-y-0.5 transition-transform"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                <span>Chat on WhatsApp</span>
              </a>
            </div>

            {!hasTodoValue(SITE_CONFIG.contactPhone) && (
              <p className="text-[15px] text-white/80">Phone: {SITE_CONFIG.contactPhone}</p>
            )}
          </div>

          <div className="lg:col-span-7">
            <DemoForm lang="en" hideQuickLinks onNavigate={onNavigate} />
          </div>
        </div>
      </section>
    </div>
  );
};
