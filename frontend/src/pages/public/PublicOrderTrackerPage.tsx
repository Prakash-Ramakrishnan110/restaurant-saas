import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Utensils,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  Ban,
  Banknote,
} from "lucide-react";
import { publicQrApi, PublicOrderTrackerResponse } from "../../api/publicQr";
import { formatRupees } from "../../utils/currency";
import { PUBLIC_QR_COPY, CustomerLang, getCustomerInitialLang } from "./publicQrStrings";

const TERMINAL_STATUSES = new Set(["BILLED", "COMPLETED", "CANCELLED"]);

function getStepIndex(status: string): number {
  switch (status) {
    case "PLACED":
    case "NEW":
      return 0;
    case "PREPARING":
      return 1;
    case "READY":
      return 2;
    case "SERVED":
    case "BILLED":
    case "COMPLETED":
      return 3;
    default:
      return -1;
  }
}

export const PublicOrderTrackerPage: React.FC = () => {
  const { token, trackingToken } = useParams<{ token: string; trackingToken: string }>();
  const [lang, setLang] = useState<CustomerLang>(() => getCustomerInitialLang());
  const [order, setOrder] = useState<PublicOrderTrackerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  const copy = PUBLIC_QR_COPY[lang];

  // Set no-referrer and noindex meta tags for tracking privacy
  useEffect(() => {
    const metaReferrer = document.createElement("meta");
    metaReferrer.name = "referrer";
    metaReferrer.content = "no-referrer";

    const metaRobots = document.createElement("meta");
    metaRobots.name = "robots";
    metaRobots.content = "noindex, nofollow";

    document.head.appendChild(metaReferrer);
    document.head.appendChild(metaRobots);

    return () => {
      document.head.removeChild(metaReferrer);
      document.head.removeChild(metaRobots);
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!trackingToken) return;
    try {
      const res = await publicQrApi.trackOrder(trackingToken);
      setOrder(res.data);
      setNotFound(false);
      setError(false);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [trackingToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Visibility-aware polling: 5s visible, 30s hidden, stop on terminal or 404
  useEffect(() => {
    const isTerminal = notFound || (order && TERMINAL_STATUSES.has(order.status));
    if (isTerminal) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }

    const schedulePoll = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      const delay = document.visibilityState === "visible" ? 5000 : 30000;
      timerRef.current = window.setInterval(fetchStatus, delay);
    };

    schedulePoll();
    const onVisChange = () => schedulePoll();
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, [fetchStatus, order, notFound]);

  const menuPath = token ? `/q/${encodeURIComponent(token)}` : "/";

  const steps = [
    { label: copy.stepReceived, icon: Clock },
    { label: copy.stepPreparing, icon: ChefHat },
    { label: copy.stepReady, icon: CheckCircle2 },
    { label: copy.stepServed, icon: Utensils },
  ];

  const activeStep = order ? getStepIndex(order.status) : -1;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 bg-[#0B1F3B] text-white px-4 py-3 flex items-center justify-between shadow-sm">
        <Link
          to={menuPath}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-[#FF6A00] min-h-[44px] px-2 -ml-2 rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{copy.backToMenu}</span>
        </Link>
        <button
          type="button"
          onClick={() => setLang((prev) => (prev === "en" ? "ta" : "en"))}
          className="px-3.5 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold min-h-[44px]"
        >
          {copy.langToggleLabel}
        </button>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto px-4 py-5 space-y-5">
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin motion-reduce:animate-none mx-auto" />
          </div>
        ) : notFound ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
            <h1 className="text-lg font-bold">{copy.orderExpiredTitle}</h1>
            <p className="text-sm text-muted-foreground">{copy.orderExpiredBody}</p>
            <Link
              to={menuPath}
              className="flex items-center justify-center w-full min-h-[56px] rounded-xl bg-[#FF6A00] text-[#0B1F3B] font-bold text-base"
            >
              {copy.backToMenu}
            </Link>
          </div>
        ) : error && !order ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4">
            <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-muted-foreground">{copy.genericOrderError}</p>
            <button
              type="button"
              onClick={fetchStatus}
              className="w-full min-h-[56px] rounded-xl bg-[#FF6A00] text-[#0B1F3B] font-bold text-base"
            >
              {copy.retry}
            </button>
          </div>
        ) : order ? (
          <>
            {/* Header Summary */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  {copy.orderNumber} #{order.order_number}
                </span>
                {order.target_label && (
                  <span className="px-2.5 py-1 rounded-full bg-muted text-foreground text-xs font-bold">
                    {order.target_label}
                  </span>
                )}
              </div>

              {/* Big Token Banner if token_number exists */}
              {order.token_number !== null && (
                <div className="mt-2 rounded-xl bg-[#0B1F3B] text-white p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-white/80 font-semibold">
                    {copy.tokenNumber}
                  </div>
                  <div className="text-4xl font-extrabold tracking-tight text-[#FF6A00] mt-1">
                    #{order.token_number}
                  </div>
                </div>
              )}
            </div>

            {/* Status Card */}
            {order.status === "AWAITING_PAYMENT" ? (
              <div className="rounded-2xl border-2 border-[#FF6A00] bg-orange-50/60 dark:bg-orange-950/30 p-5 text-center space-y-2">
                <Banknote className="h-9 w-9 text-[#0B1F3B] dark:text-[#FF6A00] mx-auto" />
                <h1 className="text-lg font-extrabold text-foreground">{copy.payFirstTitle}</h1>
                <p className="text-sm text-muted-foreground">{copy.payFirstBody}</p>
              </div>
            ) : order.status === "PENDING_APPROVAL" ? (
              <div className="rounded-2xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-5 text-center space-y-2">
                <Clock className="h-9 w-9 text-amber-700 dark:text-amber-300 mx-auto" />
                <h1 className="text-lg font-extrabold text-foreground">
                  {copy.waitingApprovalTitle}
                </h1>
                <p className="text-sm text-muted-foreground">{copy.waitingApprovalBody}</p>
              </div>
            ) : order.status === "CANCELLED" ? (
              <div className="rounded-2xl border border-rose-300 bg-rose-50/70 dark:bg-rose-950/30 p-5 text-center space-y-2">
                <Ban className="h-9 w-9 text-rose-700 dark:text-rose-300 mx-auto" />
                <h1 className="text-lg font-extrabold text-foreground">
                  {order.rejected_reason ? copy.rejectedTitle : copy.cancelledTitle}
                </h1>
                {order.rejected_reason && (
                  <p className="text-sm font-medium text-foreground bg-background/70 rounded-lg p-3">
                    {order.rejected_reason}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
                <h1 className="text-lg font-extrabold text-foreground">
                  {order.status === "BILLED" || order.status === "COMPLETED"
                    ? copy.completedTitle
                    : steps[Math.max(0, activeStep)]?.label}
                </h1>
                {(order.status === "BILLED" || order.status === "COMPLETED") && (
                  <p className="text-sm text-muted-foreground">{copy.completedBody}</p>
                )}

                {/* 4-Step Progress Line */}
                <ol className="grid grid-cols-4 gap-2 pt-2" aria-label="Order progress">
                  {steps.map((step, idx) => {
                    const Icon = step.icon;
                    const done = activeStep >= idx;
                    const current = activeStep === idx;
                    return (
                      <li
                        key={step.label}
                        className="flex flex-col items-center text-center gap-1.5"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                            done
                              ? "bg-[#FF6A00] border-[#FF6A00] text-[#0B1F3B]"
                              : "bg-muted border-border text-muted-foreground"
                          } ${current ? "ring-4 ring-[#FF6A00]/25" : ""}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span
                          className={`text-[11px] leading-tight font-semibold ${
                            done ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Items Ordered */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
              <h2 className="text-sm font-bold text-foreground">{copy.itemsOrdered}</h2>
              <ul className="divide-y divide-border">
                {order.items.map((it, idx) => (
                  <li key={idx} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground">
                        {it.quantity} × {it.item_name}
                        {it.variant_name ? ` (${it.variant_name})` : ""}
                      </div>
                      {it.options && it.options.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {it.options.map((o) => o.name).join(", ")}
                        </div>
                      )}
                      {it.notes && (
                        <div className="text-xs text-muted-foreground italic">"{it.notes}"</div>
                      )}
                    </div>
                    <div className="font-semibold text-foreground whitespace-nowrap">
                      {formatRupees(it.subtotal_paise)}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="pt-3 border-t border-border flex items-center justify-between text-base font-extrabold">
                <span>{copy.totalLabel}</span>
                <span>{formatRupees(order.total_paise)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {!TERMINAL_STATUSES.has(order.status) && (
                <button
                  type="button"
                  onClick={fetchStatus}
                  className="w-full min-h-[56px] rounded-xl border border-border bg-card hover:bg-muted text-foreground font-bold text-sm flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {copy.refreshStatus}
                </button>
              )}
              <Link
                to={menuPath}
                className="w-full min-h-[56px] rounded-xl bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-base flex items-center justify-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {copy.backToMenu}
              </Link>
            </div>
          </>
        ) : null}
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
        {copy.poweredBy}
      </footer>
    </div>
  );
};
