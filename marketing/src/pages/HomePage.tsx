import React, { useEffect, useState } from "react";
import { ChevronDown, Pause, Play } from "lucide-react";
import { getWhatsAppHref } from "../../content/site";
import type { Lang } from "../routes";
import { DeviceFrame } from "../components/DeviceFrame";

interface HomePageProps {
  lang?: Lang;
  onNavigate?: (path: string) => void;
}

const JOURNEY_STEPS = [
  {
    id: "order",
    label: "Order",
    caption: "Waiter takes the order at the table or counter on a phone.",
    src: "/shots/waiter-order.webp",
    alt: "Waiter taking an order on ServeMyFood phone screen",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    caption: "Kitchen sees the ticket right away with a clear sound alert.",
    src: "/shots/kitchen-kds.webp",
    alt: "Kitchen display screen showing live order tickets",
  },
  {
    id: "serve",
    label: "Serve",
    caption: "Cook marks the dish ready and the waiter serves it hot.",
    src: "/shots/sold-out.webp",
    alt: "Kitchen ready and item availability screen",
  },
  {
    id: "pay",
    label: "Pay",
    caption: "Cashier records cash, UPI or card and prints the receipt.",
    src: "/shots/bill-receipt.webp",
    alt: "Cashier billing and printed receipt screen",
  },
  {
    id: "sales",
    label: "Sales",
    caption: "Owner sees today's sales, top dishes and payment totals.",
    src: "/shots/owner-dashboard.webp",
    alt: "Owner dashboard showing today's sales and charts",
  },
] as const;

const WHO_IT_IS_FOR = [
  {
    title: "Tea shops and bakeries",
    src: "/shots/tea-counters.webp",
    alt: "Tea shop counter and token queue screen",
    outcomes: [
      "Take fast counter orders in two taps.",
      "Issue token numbers with no paper slips.",
      "Check daily cash and UPI totals at close.",
    ],
  },
  {
    title: "Cafes and restaurants",
    src: "/shots/waiter-order.webp",
    alt: "Cafe and restaurant waiter order screen",
    outcomes: [
      "Send table orders straight to the kitchen.",
      "Track cooking and ready status live.",
      "Split or settle bills cleanly at the counter.",
    ],
  },
  {
    title: "Hotels",
    src: "/shots/hotel-areas.webp",
    alt: "Hotel multi-outlet sections and dining areas screen",
    outcomes: [
      "Manage dining halls, cafes and patios together.",
      "Compare daily sales across every outlet.",
      "Give each staff role its own login.",
    ],
  },
] as const;

const FEATURE_ROWS = [
  {
    title: "Kitchen screen with sound alert",
    body: "Every new order arrives on the kitchen screen immediately with a clear chime. Cooks see cooking time, spice notes and a one-tap Ready button.",
    src: "/shots/kitchen-kds.webp",
    alt: "Kitchen Display System screen with live tickets",
  },
  {
    title: "Menu with photos and Tamil names",
    body: "Show clear dish photos alongside English and Tamil names so every staff member finds items fast. Organise dishes into simple categories with veg and non-veg tags.",
    src: "/shots/menu-photos.webp",
    alt: "Menu management screen with dish photos and Tamil names",
  },
  {
    title: "Sold-out in one tap",
    body: "When a dish finishes during a rush, mark it unavailable in a single tap. Waiters and cashiers stop seeing it right away so guests are never disappointed.",
    src: "/shots/sold-out.webp",
    alt: "Today's availability screen with one-tap sold-out toggles",
  },
  {
    title: "Separate logins for each role",
    body: "Waiters see orders, cooks see the kitchen screen, cashiers see billing, and owners see daily sales. Each person gets only the screens needed for their work.",
    src: "/shots/staff-roles.webp",
    alt: "Staff management screen showing separate logins per role",
  },
] as const;

const FAQS = [
  {
    q: "What devices work with ServeMyFood?",
    a: "Any Android phone, tablet, laptop or desktop with a modern web browser works. You do not need special hardware to start.",
  },
  {
    q: "Does it need an internet connection?",
    a: "Yes. ServeMyFood runs in your browser over shop Wi-Fi or mobile data so kitchen and counter screens stay in sync.",
  },
  {
    q: "Can we use an 80mm receipt printer?",
    a: "Yes. Billing formats clean 80mm thermal receipts from the browser, and demo receipts are clearly marked.",
  },
  {
    q: "Can staff use it in Tamil?",
    a: "Yes. Every screen switches between English and Tamil in one tap, and menu items support Tamil names.",
  },
  {
    q: "How long does it take to start?",
    a: "Most shops are ready in one short setup session. We help you enter your menu, floor layout and staff logins.",
  },
  {
    q: "What is not ready yet?",
    a: "Tax invoices are not ready yet. Online customer payments, stock tracking and hotel room charges are also not live yet.",
  },
] as const;

export const HomePage: React.FC<HomePageProps> = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % JOURNEY_STEPS.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  const currentStep = JOURNEY_STEPS[activeStep];

  const whatsappHref = getWhatsAppHref("Hello, I would like a free demo of ServeMyFood.");

  return (
    <div>
      {/* 2. Hero (Cream #FFF3E0) */}
      <section className="bg-[#FFF3E0] py-14 lg:py-24 overflow-x-hidden">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <h1 className="font-display font-semibold text-[36px] leading-[40px] lg:text-[56px] lg:leading-[64px] text-[#0B1F3B]">
              Take orders. Run the kitchen. Get paid. See today&apos;s sales.
            </h1>
            <p className="text-[18px] leading-[1.6] text-[#0B1F3B]/85 max-w-[70ch]">
              One simple system for tea shops, cafes, restaurants and hotels.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <a
                href="#book-demo-band"
                className="inline-flex items-center justify-center h-[52px] px-6 rounded-[12px] bg-[#FF6A00] text-[16px] font-semibold text-[#0B1F3B] hover:bg-[#e55f00] transition-colors"
              >
                Book a free demo
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center h-[52px] px-6 rounded-[12px] border border-[#0B1F3B]/25 bg-white text-[16px] font-semibold text-[#0B1F3B] hover:bg-white/80 transition-colors"
              >
                See how it works
              </a>
            </div>
            <p className="text-[15px] text-[#0B1F3B]/90">
              Works on phone, tablet and computer. Tamil and English.
            </p>
          </div>

          <div className="lg:col-span-6 relative pt-4 pb-6 sm:pb-8">
            {/* Tablet frame: Kitchen screen */}
            <DeviceFrame
              kind="tablet"
              src="/shots/kitchen-kds.webp"
              alt="Kitchen Display System on tablet"
              eager
              className="w-[90%] ml-auto"
            />
            {/* Phone frame overlapping bottom-left */}
            <DeviceFrame
              kind="phone"
              src="/shots/waiter-phone.webp"
              alt="Waiter taking an order on phone"
              eager
              className="w-[30%] min-w-[116px] max-w-[158px] absolute left-0 bottom-0 ring-4 ring-[#FFF3E0]"
            />
            {/* Stage 2 sliding chip */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E6E1D8] bg-white px-3.5 py-1.5 text-[14px] font-semibold text-[#0B1F3B] absolute right-3 top-0 animate-chip-slide">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF6A00]" aria-hidden="true" />
              <span>New order T4</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Order Journey (White #FFFFFF) */}
      <section id="how-it-works" className="bg-white py-14 lg:py-24">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-6 space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="max-w-[70ch] space-y-3">
              <div className="h-1 w-12 rounded-full bg-[#FF6A00]" aria-hidden="true" />
              <h2 className="font-display font-semibold text-[30px] sm:text-[36px] leading-[1.2] text-[#0B1F3B]">
                From order to sales in 5 steps
              </h2>
            </div>

            {!reducedMotion && (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Play order journey" : "Pause order journey"}
                className="inline-flex items-center gap-2 h-[48px] px-4 rounded-[12px] border border-[#E6E1D8] bg-white text-[15px] font-semibold text-[#0B1F3B] hover:border-[#0B1F3B]/40 transition-colors self-start sm:self-auto"
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                <span>{paused ? "Play" : "Pause"}</span>
              </button>
            )}
          </div>

          {/* 5 Numbered Nodes on a Horizontal Line */}
          <div className="relative">
            <div
              className="absolute left-6 right-6 top-6 h-[2px] bg-[#E6E1D8]"
              aria-hidden="true"
            />
            <div className="grid grid-cols-5 gap-1 sm:gap-3 relative z-10">
              {JOURNEY_STEPS.map((st, idx) => {
                const isActive = idx === activeStep;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setActiveStep(idx);
                      setPaused(true);
                    }}
                    className="flex flex-col items-center text-center gap-2 p-1 sm:p-2 rounded-[12px] min-h-[48px] focus-visible:outline-[#FF6A00]"
                  >
                    <span
                      className={`inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border text-[15px] sm:text-[16px] font-semibold transition-colors ${
                        isActive
                          ? "bg-[#FF6A00] border-[#FF6A00] text-[#0B1F3B]"
                          : "bg-white border-[#E6E1D8] text-[#0B1F3B]"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[13px] sm:text-[16px] font-semibold text-[#0B1F3B]">
                      {st.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* One Large Device Frame (Crossfades across steps) */}
          <div className="max-w-[820px] mx-auto space-y-4 text-center">
            <div key={currentStep.id} className="animate-step-in">
              <DeviceFrame kind="laptop" src={currentStep.src} alt={currentStep.alt} />
            </div>
            <p className="text-[18px] leading-[1.6] text-[#0B1F3B] max-w-[70ch] mx-auto">
              {currentStep.caption}
            </p>
          </div>
        </div>
      </section>

      {/* 4. Who it is for (Cream #FFF3E0) */}
      <section id="who-it-is-for" className="bg-[#FFF3E0] py-14 lg:py-24">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-6 space-y-10">
          <div className="max-w-[70ch] space-y-3">
            <div className="h-1 w-12 rounded-full bg-[#FF6A00]" aria-hidden="true" />
            <h2 className="font-display font-semibold text-[30px] sm:text-[36px] leading-[1.2] text-[#0B1F3B]">
              Who it is for
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {WHO_IT_IS_FOR.map((card) => (
              <article
                key={card.title}
                className="rounded-[16px] border border-[#E6E1D8] bg-white p-6 flex flex-col gap-5"
              >
                <div className="overflow-hidden rounded-[12px] border border-[#E6E1D8] aspect-[16/10] bg-[#FFFBF7]">
                  <img
                    src={card.src}
                    alt={card.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <h3 className="font-display font-semibold text-[22px] leading-[1.3] text-[#0B1F3B]">
                  {card.title}
                </h3>
                <ul className="space-y-2.5 text-[18px] leading-[1.6] text-[#0B1F3B]/85">
                  {card.outcomes.map((line) => (
                    <li key={line} className="flex items-start gap-2.5">
                      <span
                        className="mt-2.5 h-2 w-2 rounded-full bg-[#FF6A00] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Features (White #FFFFFF) */}
      <section className="bg-white py-14 lg:py-24">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-6 space-y-12">
          <div className="max-w-[70ch] space-y-3">
            <div className="h-1 w-12 rounded-full bg-[#FF6A00]" aria-hidden="true" />
            <h2 className="font-display font-semibold text-[30px] sm:text-[36px] leading-[1.2] text-[#0B1F3B]">
              Built for busy service hours
            </h2>
          </div>

          <div className="space-y-12 lg:space-y-16">
            {FEATURE_ROWS.map((row, idx) => {
              const imageFirst = idx % 2 === 1;
              return (
                <div
                  key={row.title}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
                >
                  <div className={`lg:col-span-5 space-y-3 ${imageFirst ? "lg:order-2" : ""}`}>
                    <h3 className="font-display font-semibold text-[26px] leading-[1.25] text-[#0B1F3B]">
                      {row.title}
                    </h3>
                    <p className="text-[18px] leading-[1.6] text-[#0B1F3B]/85 max-w-[70ch]">
                      {row.body}
                    </p>
                  </div>
                  <div className={`lg:col-span-7 ${imageFirst ? "lg:order-1" : ""}`}>
                    <DeviceFrame kind="tablet" src={row.src} alt={row.alt} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Book a demo band (Navy #0B1F3B) */}
      <section id="book-demo-band" className="bg-[#0B1F3B] text-white py-14 lg:py-24">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="space-y-3 max-w-[70ch]">
            <h2 className="font-display font-semibold text-[30px] sm:text-[36px] leading-[1.2]">
              See ServeMyFood with your own menu
            </h2>
            <p className="text-[18px] leading-[1.6] text-white/85">
              Book a short walkthrough in English or Tamil for your team.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-[52px] px-6 rounded-[12px] bg-[#FF6A00] text-[16px] font-semibold text-[#0B1F3B] hover:bg-[#e55f00] transition-colors"
            >
              Book a free demo
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-[52px] px-5 rounded-[12px] border border-white/30 text-[16px] font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* 7. FAQ (Cream #FFF3E0) */}
      <section id="faq" className="bg-[#FFF3E0] py-14 lg:py-24">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-4 space-y-3">
            <div className="h-1 w-12 rounded-full bg-[#FF6A00]" aria-hidden="true" />
            <h2 className="font-display font-semibold text-[30px] sm:text-[36px] leading-[1.2] text-[#0B1F3B]">
              Common questions
            </h2>
            <p className="text-[18px] leading-[1.6] text-[#0B1F3B]/85 max-w-[70ch]">
              Clear answers before you book a walkthrough.
            </p>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {FAQS.map((item, idx) => (
              <details
                key={item.q}
                open={idx === 0}
                className="group rounded-[16px] border border-[#E6E1D8] bg-white px-6 py-4"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-semibold text-[18px] text-[#0B1F3B] min-h-[48px]">
                  <span>{item.q}</span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-[#0B1F3B] transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 pb-1 text-[18px] leading-[1.6] text-[#0B1F3B]/85 max-w-[70ch]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
