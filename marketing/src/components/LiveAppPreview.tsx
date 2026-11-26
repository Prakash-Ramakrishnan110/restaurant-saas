import React, { useEffect, useRef, useState } from "react";
import { Bell, Check, Flame, Pause, Play, Receipt, Smartphone, TrendingUp } from "lucide-react";

const LOOP_SECONDS = 16;

interface FloatingCard {
  id: string;
  title: string;
  detail: string;
  value?: string;
  tag?: string;
  dotColor?: string;
  startSec: number;
  endSec: number;
  desktopPos: string;
}

const FLOATING_CARDS: FloatingCard[] = [
  {
    id: "new-order",
    title: "New order T4",
    detail: "2x Masala dosa",
    dotColor: "#FF6A00",
    startSec: 1.0,
    endSec: 3.8,
    desktopPos: "lg:-bottom-2 lg:right-2",
  },
  {
    id: "t4-ready",
    title: "T4 ready",
    detail: "Kitchen marked Ready",
    dotColor: "#1D9E75",
    startSec: 4.8,
    endSec: 7.6,
    desktopPos: "lg:top-2 lg:bottom-auto lg:left-2",
  },
  {
    id: "paid-cash",
    title: "Paid by cash",
    detail: "Receipt printed",
    dotColor: "#1D9E75",
    startSec: 8.4,
    endSec: 11.2,
    desktopPos: "lg:-bottom-2 lg:left-2",
  },
  {
    id: "todays-sales",
    title: "Today's sales",
    value: "₹12,450",
    detail: "Live total updated",
    tag: "Sample data",
    startSec: 12.0,
    endSec: 15.0,
    desktopPos: "lg:-bottom-2 lg:right-2",
  },
];

export const HeroLivePreview: React.FC = () => {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [clockSec, setClockSec] = useState(1.6);

  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? true),
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || !inView || !tabVisible) return;
    const id = window.setInterval(() => {
      setClockSec((prev) => Number(((prev + 0.5) % LOOP_SECONDS).toFixed(1)));
    }, 500);
    return () => window.clearInterval(id);
  }, [paused, reducedMotion, inView, tabVisible]);

  // Derived states from the single 16s master clock
  const t = reducedMotion ? 2.0 : clockSec;
  const orderSent = t >= 2.2;
  const kdsStage: "PLACED" | "PREPARING" | "READY" =
    t < 4.4 ? "PLACED" : t < 7.2 ? "PREPARING" : "READY";
  const waiterReadyAlert = t >= 7.2 && t < 11.5;

  const activeCard = reducedMotion
    ? FLOATING_CARDS[3]
    : FLOATING_CARDS.find((c) => t >= c.startSec && t <= c.endSec) ?? null;

  return (
    <div ref={rootRef} className="space-y-2.5 lg:space-y-3">
      <div className="relative flex flex-col lg:flex-row items-center justify-center gap-4 pb-5 lg:pb-4">
        {/* Desktop Kitchen Tablet Preview */}
        <div
          aria-label="Kitchen tablet live preview"
          className="hidden lg:block w-[450px] shrink-0 rounded-[20px] border border-white/20 bg-[#0B1F3B] p-2.5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
        >
          <div className="flex items-center justify-between px-2 pb-1.5" aria-hidden="true">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
            </div>
            <span className="text-[11px] font-medium text-white/60">Kitchen Display</span>
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </div>

          <div className="rounded-[12px] bg-[#F8FAFC] p-3 text-[#0B1F3B]">
            <div className="grid grid-cols-2 gap-3">
              {/* Ticket 1: Table T1 */}
              <div className="rounded-[10px] border border-[#E6E1D8] bg-white overflow-hidden">
                <div className="bg-[#0B1F3B] px-3 py-2 flex items-center justify-between text-white">
                  <span className="text-[13px] font-bold">Table T1</span>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                    3m
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold">1x Plain Dosa</span>
                    <span className="text-[11px] font-semibold text-[#0B1F3B]/65">MAIN</span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold">2x Filter Coffee</span>
                    <span className="text-[11px] font-semibold text-[#0B1F3B]/65">HOT</span>
                  </div>
                  <div className="pt-1">
                    <div className="w-full rounded-[8px] bg-[#147A59] py-1.5 text-center text-[12px] font-semibold text-white">
                      Mark Ready
                    </div>
                  </div>
                </div>
              </div>

              {/* Ticket 2: Table T4 (Live synced state) */}
              <div
                className={`rounded-[10px] border overflow-hidden transition-all duration-300 ${
                  kdsStage === "READY"
                    ? "border-[#1D9E75] bg-white"
                    : "border-[#FF6A00] bg-white"
                }`}
              >
                <div className="bg-[#0B1F3B] px-3 py-2 flex items-center justify-between text-white">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-bold">Table T4</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        kdsStage === "READY"
                          ? "bg-[#147A59] text-white"
                          : kdsStage === "PREPARING"
                            ? "bg-[#FF6A00] text-[#0B1F3B]"
                            : "bg-white/20 text-white"
                      }`}
                    >
                      {kdsStage}
                    </span>
                  </div>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                    {kdsStage === "PLACED" ? "0m" : "2m"}
                  </span>
                </div>

                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold">2x Masala Dosa</span>
                    <span className="text-[11px] font-semibold text-[#0B1F3B]/65">MAIN</span>
                  </div>
                  <div className="rounded-[6px] bg-[#FFF3E0] px-2 py-1 text-[11px] font-medium text-[#0B1F3B]">
                    Less spicy, extra chutney
                  </div>
                  <div className="pt-1">
                    {kdsStage === "PLACED" && (
                      <div className="w-full rounded-[8px] bg-[#FF6A00] py-1.5 text-center text-[12px] font-bold text-[#0B1F3B]">
                        Start Cooking
                      </div>
                    )}
                    {kdsStage === "PREPARING" && (
                      <div className="w-full rounded-[8px] bg-[#147A59] py-1.5 text-center text-[12px] font-bold text-white">
                        Mark Ready
                      </div>
                    )}
                    {kdsStage === "READY" && (
                      <div className="w-full rounded-[8px] border border-[#1D9E75] bg-[#1D9E75]/10 py-1.5 text-center text-[12px] font-bold text-[#0B1F3B]">
                        Ready to Serve
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Waiter Phone Preview (Mobile & Desktop) */}
        <div
          aria-label="Waiter phone live preview"
          className="relative w-[228px] lg:w-[250px] shrink-0 rounded-[26px] border border-white/25 bg-[#0B1F3B] p-2 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
        >
          <div className="mx-auto mb-1.5 flex items-center justify-center gap-2" aria-hidden="true">
            <span className="h-1 w-8 rounded-full bg-white/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/35" />
          </div>

          <div className="rounded-[18px] bg-white p-3 text-[#0B1F3B] space-y-2.5">
            {/* Phone Header */}
            <div className="flex items-center justify-between border-b border-[#E6E1D8] pb-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0B1F3B]/80">
                  Order Target
                </p>
                <p className="text-[15px] font-bold text-[#0B1F3B]">Table T4</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  waiterReadyAlert
                    ? "bg-[#147A59] text-white"
                    : "bg-[#FFF3E0] text-[#0B1F3B]"
                }`}
              >
                {waiterReadyAlert ? "Ready" : "2 Guests"}
              </span>
            </div>

            {/* Menu Items */}
            <div className="space-y-1.5">
              <div className="rounded-[10px] border border-[#FF6A00] bg-[#FFF3E0]/45 px-2.5 py-2 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-bold leading-tight">Masala Dosa</p>
                  <p className="text-[12px] text-[#0B1F3B]/75">₹135 × 2</p>
                </div>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#0B1F3B] text-[12px] font-bold text-white">
                  2
                </span>
              </div>

              <div className="rounded-[10px] border border-[#E6E1D8] bg-white px-2.5 py-2 flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold leading-tight">Filter Coffee</p>
                  <p className="text-[12px] text-[#0B1F3B]/70">₹45</p>
                </div>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#E6E1D8] text-[13px] font-bold text-[#0B1F3B]">
                  +
                </span>
              </div>
            </div>

            {/* Total & Action */}
            <div className="border-t border-[#E6E1D8] pt-2 space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#0B1F3B]/75 font-medium">Total</span>
                <span className="font-bold text-[15px]">₹270</span>
              </div>

              {waiterReadyAlert ? (
                <div className="w-full rounded-[10px] bg-[#147A59] py-2 text-center text-[13px] font-bold text-white">
                  Mark Served
                </div>
              ) : orderSent ? (
                <div className="w-full rounded-[10px] bg-[#0B1F3B] py-2 text-center text-[13px] font-bold text-white">
                  Sent to Kitchen
                </div>
              ) : (
                <div className="w-full rounded-[10px] bg-[#FF6A00] py-2 text-center text-[13px] font-bold text-[#0B1F3B]">
                  Send to Kitchen
                </div>
              )}
            </div>
          </div>

          {/* Mobile round Pause button at corner of phone frame */}
          <button
            type="button"
            aria-pressed={paused}
            aria-label={paused ? "Play preview" : "Pause preview"}
            onClick={() => setPaused((p) => !p)}
            className="lg:hidden absolute -top-2 -right-4 z-20 inline-flex items-center justify-center h-12 w-12 rounded-full border border-white/35 bg-[#0B1F3B] ring-2 ring-[#0B1F3B] text-white shadow-lg hover:bg-[#132D54] transition-colors"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        </div>

        {/* Single Floating Card (only one visible at a time, 300ms fade + 12px rise) */}
        {FLOATING_CARDS.map((card) => {
          const isVisible = activeCard?.id === card.id;
          return (
            <div
              key={card.id}
              aria-hidden={!isVisible}
              className={`pointer-events-none absolute z-20 bottom-0 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 ${card.desktopPos} w-[220px] lg:w-[232px] rounded-[14px] border border-[#E6E1D8] bg-white px-4 py-3 text-[#0B1F3B] shadow-[0_16px_36px_-8px_rgba(11,31,59,0.55)] transition-all duration-300 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {card.dotColor && (
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: card.dotColor }}
                    />
                  )}
                  <p className="text-[14px] font-semibold leading-tight text-[#0B1F3B]">
                    {card.title}
                  </p>
                </div>
                {card.tag && (
                  <span className="shrink-0 whitespace-nowrap rounded-full bg-[#FFF3E0] px-2 py-0.5 text-[11px] font-semibold text-[#0B1F3B]">
                    {card.tag}
                  </span>
                )}
              </div>
              {card.value && (
                <p className="font-display text-[22px] font-semibold leading-tight text-[#0B1F3B] mt-1">
                  {card.value}
                </p>
              )}
              <p className="text-[13px] text-[#0B1F3B]/80 mt-0.5 leading-snug">{card.detail}</p>
            </div>
          );
        })}
      </div>

      {/* Caption & Desktop Pause Control */}
      <div className="flex items-center justify-center lg:justify-between gap-3 pt-1">
        <p className="text-[13px] sm:text-[14px] text-white/85">
          Interactive preview — Sample data
        </p>

        <button
          type="button"
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
          className="hidden lg:inline-flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-[12px] border border-white/30 bg-white/10 text-[14px] font-semibold text-white hover:bg-white/20 transition-colors"
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          <span>{paused ? "Play" : "Pause"}</span>
        </button>
      </div>
    </div>
  );
};

export const StepScreenPreview: React.FC<{ stepIndex: number }> = ({ stepIndex }) => {
  if (stepIndex === 0) {
    return (
      <div className="w-full max-w-[420px] rounded-[20px] border border-[#0B1F3B]/15 bg-[#0B1F3B] p-2.5">
        <div className="rounded-[14px] bg-white p-4 text-[#0B1F3B] space-y-3">
          <div className="flex items-center justify-between border-b border-[#E6E1D8] pb-2.5">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-[#0B1F3B]" aria-hidden="true" />
              <span className="font-bold text-[15px]">Waiter POS — Table T4</span>
            </div>
            <span className="rounded-full bg-[#FFF3E0] px-2.5 py-0.5 text-[12px] font-semibold">
              EN / தமிழ்
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[12px] border-2 border-[#FF6A00] bg-[#FFF3E0]/40 p-3">
              <p className="font-bold text-[14px]">Masala Dosa</p>
              <p className="text-[12px] text-[#0B1F3B]/75">மசாலா தோசை</p>
              <p className="font-bold text-[14px] mt-1.5">₹135 × 2</p>
            </div>
            <div className="rounded-[12px] border border-[#E6E1D8] bg-white p-3">
              <p className="font-bold text-[14px]">Filter Coffee</p>
              <p className="text-[12px] text-[#0B1F3B]/75">பில்டர் காபி</p>
              <p className="font-bold text-[14px] mt-1.5">₹45</p>
            </div>
          </div>
          <div className="rounded-[10px] bg-[#FF6A00] py-2.5 text-center text-[14px] font-bold text-[#0B1F3B]">
            Send Order to Kitchen (₹270)
          </div>
        </div>
      </div>
    );
  }

  if (stepIndex === 1) {
    return (
      <div className="w-full max-w-[460px] rounded-[20px] border border-[#0B1F3B]/15 bg-[#0B1F3B] p-2.5">
        <div className="rounded-[14px] bg-[#F8FAFC] p-4 text-[#0B1F3B] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#0B1F3B]" aria-hidden="true" />
              <span className="font-bold text-[15px]">Kitchen Display</span>
            </div>
            <span className="rounded-full bg-[#1D9E75]/15 px-2.5 py-0.5 text-[12px] font-semibold text-[#0B1F3B]">
              Sound chime on
            </span>
          </div>
          <div className="rounded-[12px] border-2 border-[#FF6A00] bg-white overflow-hidden">
            <div className="bg-[#0B1F3B] px-3.5 py-2 flex items-center justify-between text-white">
              <span className="font-bold text-[14px]">Table T4 — PREPARING</span>
              <span className="text-[12px] font-semibold">01:45</span>
            </div>
            <div className="p-3.5 space-y-2.5">
              <p className="font-semibold text-[15px]">2× Ghee Roast Masala Dosa</p>
              <p className="rounded-[8px] bg-[#FFF3E0] px-2.5 py-1.5 text-[13px] font-medium">
                Note: Less spicy, extra chutney
              </p>
              <div className="rounded-[10px] bg-[#1D9E75] py-2 text-center text-[14px] font-bold text-white">
                Mark Ready
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stepIndex === 2) {
    return (
      <div className="w-full max-w-[420px] rounded-[20px] border border-[#0B1F3B]/15 bg-[#0B1F3B] p-2.5">
        <div className="rounded-[14px] bg-white p-4 text-[#0B1F3B] space-y-3">
          <div className="flex items-center justify-between border-b border-[#E6E1D8] pb-2.5">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#1D9E75]" aria-hidden="true" />
              <span className="font-bold text-[15px]">Ready to Serve</span>
            </div>
            <span className="rounded-full bg-[#1D9E75]/15 px-2.5 py-0.5 text-[12px] font-bold text-[#0B1F3B]">
              1 Ready
            </span>
          </div>
          <div className="rounded-[12px] border border-[#1D9E75] bg-[#1D9E75]/5 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[16px]">Table T4</span>
              <span className="rounded-full bg-[#1D9E75] px-2.5 py-0.5 text-[11px] font-bold text-white">
                Ready now
              </span>
            </div>
            <p className="text-[14px] font-medium">2× Ghee Roast Masala Dosa</p>
            <div className="rounded-[10px] bg-[#1D9E75] py-2 text-center text-[14px] font-bold text-white">
              Mark Served to Guest
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stepIndex === 3) {
    return (
      <div className="w-full max-w-[460px] rounded-[20px] border border-[#0B1F3B]/15 bg-[#0B1F3B] p-2.5">
        <div className="rounded-[14px] bg-white p-4 text-[#0B1F3B] space-y-3">
          <div className="flex items-center justify-between border-b border-[#E6E1D8] pb-2.5">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[#0B1F3B]" aria-hidden="true" />
              <span className="font-bold text-[15px]">Cashier Billing — Table T4</span>
            </div>
            <span className="text-[12px] font-semibold text-[#0B1F3B]/70">Sample receipt</span>
          </div>
          <div className="space-y-1.5 text-[14px]">
            <div className="flex justify-between">
              <span>2× Ghee Roast Masala Dosa</span>
              <span className="font-semibold">₹270</span>
            </div>
            <div className="flex justify-between border-t border-[#E6E1D8] pt-2 font-bold text-[16px]">
              <span>Grand Total</span>
              <span>₹270</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[10px] border-2 border-[#0B1F3B] bg-[#FFF3E0] py-2 text-center text-[13px] font-bold">
              Cash
            </div>
            <div className="rounded-[10px] border border-[#E6E1D8] py-2 text-center text-[13px] font-semibold">
              UPI
            </div>
            <div className="rounded-[10px] border border-[#E6E1D8] py-2 text-center text-[13px] font-semibold">
              Card
            </div>
          </div>
          <div className="rounded-[10px] bg-[#FF6A00] py-2.5 text-center text-[14px] font-bold text-[#0B1F3B]">
            Settle &amp; Print Receipt (₹270)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[460px] rounded-[20px] border border-[#0B1F3B]/15 bg-[#0B1F3B] p-2.5">
      <div className="rounded-[14px] bg-white p-4 text-[#0B1F3B] space-y-3.5">
        <div className="flex items-center justify-between border-b border-[#E6E1D8] pb-2.5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#1D9E75]" aria-hidden="true" />
            <span className="font-bold text-[15px]">Owner Dashboard</span>
          </div>
          <span className="rounded-full bg-[#FFF3E0] px-2.5 py-0.5 text-[12px] font-semibold">
            Sample data
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-[10px] bg-[#FFF3E0]/70 p-2.5">
            <p className="text-[11px] font-semibold text-[#0B1F3B]/70">Today&apos;s sales</p>
            <p className="font-display font-bold text-[18px]">₹12,450</p>
          </div>
          <div className="rounded-[10px] bg-[#F8FAFC] border border-[#E6E1D8] p-2.5">
            <p className="text-[11px] font-semibold text-[#0B1F3B]/70">Cash</p>
            <p className="font-display font-bold text-[18px]">₹5,200</p>
          </div>
          <div className="rounded-[10px] bg-[#F8FAFC] border border-[#E6E1D8] p-2.5">
            <p className="text-[11px] font-semibold text-[#0B1F3B]/70">UPI</p>
            <p className="font-display font-bold text-[18px]">₹7,250</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">Masala Dosa</span>
            <span className="font-bold">38 orders</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#E6E1D8] overflow-hidden">
            <div className="h-full w-[82%] bg-[#FF6A00] rounded-full" />
          </div>
          <div className="flex items-center justify-between text-[13px] pt-1">
            <span className="font-medium">Filter Coffee</span>
            <span className="font-bold">54 orders</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#E6E1D8] overflow-hidden">
            <div className="h-full w-[94%] bg-[#1D9E75] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

export const VenueMiniPreview: React.FC<{ kind: "tea" | "restaurant" | "hotel" }> = ({ kind }) => {
  if (kind === "tea") {
    return (
      <div className="rounded-[12px] border border-[#E6E1D8] bg-[#FFF3E0]/70 p-3.5 space-y-2.5 text-[#0B1F3B]">
        <div className="flex items-center justify-between">
          <span className="rounded-[8px] bg-[#0B1F3B] px-2.5 py-1 text-[12px] font-bold text-white">
            Token #12
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#147A59] px-2.5 py-0.5 text-[11px] font-bold text-white">
            <Check className="h-3 w-3" aria-hidden="true" />
            Ready
          </span>
        </div>
        <div className="rounded-[8px] bg-white border border-[#E6E1D8] px-3 py-2 flex items-center justify-between text-[13px]">
          <span className="font-semibold">2× Masala Chai, 1× Samosa</span>
          <span className="font-bold">₹90</span>
        </div>
      </div>
    );
  }
  if (kind === "restaurant") {
    return (
      <div className="rounded-[12px] border border-[#E6E1D8] bg-[#FFF3E0]/70 p-3.5 space-y-2.5 text-[#0B1F3B]">
        <div className="flex items-center justify-between">
          <span className="rounded-[8px] bg-[#FF6A00] px-2.5 py-1 text-[12px] font-bold text-[#0B1F3B]">
            Table T4
          </span>
          <span className="text-[12px] font-semibold text-[#0B1F3B]/75">Kitchen chime on</span>
        </div>
        <div className="rounded-[8px] bg-white border border-[#E6E1D8] px-3 py-2 flex items-center justify-between text-[13px]">
          <span className="font-semibold">2× Masala Dosa</span>
          <span className="font-bold text-[#147A59]">Preparing</span>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-[12px] border border-[#E6E1D8] bg-[#FFF3E0]/70 p-3.5 space-y-2.5 text-[#0B1F3B]">
      <div className="flex items-center justify-between">
        <span className="rounded-[8px] bg-[#0B1F3B] px-2.5 py-1 text-[12px] font-bold text-white">
          2 Dining Areas
        </span>
        <span className="text-[12px] font-semibold text-[#0B1F3B]/75">4 Staff Roles</span>
      </div>
      <div className="rounded-[8px] bg-white border border-[#E6E1D8] px-3 py-2 flex items-center justify-between text-[13px]">
        <span className="font-semibold">AC Hall + Terrace</span>
        <span className="font-bold">Live view</span>
      </div>
    </div>
  );
};
