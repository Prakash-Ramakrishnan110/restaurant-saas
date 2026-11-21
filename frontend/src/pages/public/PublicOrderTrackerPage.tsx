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
  Printer,
  Download,
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

  const [foodRating, setFoodRating] = useState<number>(5);
  const [serviceRating, setServiceRating] = useState<number>(5);
  const [suggestionType, setSuggestionType] = useState<
    "" | "TASTE" | "PORTION" | "SPEED" | "SERVICE" | "OTHER"
  >("");
  const [feedbackComment, setFeedbackComment] = useState<string>("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState<boolean>(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

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

            {/* Items Ordered / Printable Bill */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
              {order.display_name && (
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  {order.logo_url && (
                    <img
                      src={order.logo_url}
                      alt={order.display_name}
                      className="w-10 h-10 rounded-lg object-cover bg-white shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-foreground truncate">
                      {order.display_name}
                    </div>
                    {order.branch_name && (
                      <div className="text-xs text-muted-foreground truncate">
                        {order.branch_name} • {order.order_number}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-foreground">{copy.itemsOrdered}</h2>
                <div className="print:hidden flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const esc = (s: string) =>
                        s.replace(
                          /[&<>"']/g,
                          (c) =>
                            ({
                              "&": "&amp;",
                              "<": "&lt;",
                              ">": "&gt;",
                              '"': "&quot;",
                              "'": "&#39;",
                            })[c] || c
                        );
                      const rowsHtml = order.items
                        .map(
                          (it) =>
                            `<tr><td>${it.quantity} x ${esc(it.item_name)}${it.variant_name ? ` (${esc(it.variant_name)})` : ""}</td><td style="text-align:right">${esc(formatRupees(it.subtotal_paise))}</td></tr>`
                        )
                        .join("");
                      const logoHtml = order.logo_url
                        ? `<img src="${esc(order.logo_url)}" alt="" style="width:48px;height:48px;border-radius:8px;object-fit:cover;margin-bottom:6px;" />`
                        : "";
                      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(order.order_number)}</title><style>body{font-family:sans-serif;max-width:380px;margin:24px auto;padding:16px;border:1px solid #ddd;border-radius:12px}table{width:100%;border-collapse:collapse;margin:12px 0}td{padding:6px 0;border-bottom:1px solid #eee;font-size:14px}.tot{font-weight:bold;font-size:16px;display:flex;justify-content:space-between;padding-top:8px}</style></head><body><div style="text-align:center">${logoHtml}<h2 style="margin:4px 0">${esc(order.display_name || "ServeMyFood")}</h2><div style="color:#666;font-size:12px">${esc(order.branch_name || "")} • ${esc(order.order_number)}${order.target_label ? ` • ${esc(order.target_label)}` : ""}</div></div><table>${rowsHtml}</table><div class="tot"><span>Total</span><span>${esc(formatRupees(order.total_paise))}</span></div></body></html>`;
                      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `bill-${order.order_number}.html`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="min-h-[36px] px-3 rounded-lg bg-[#FF6A00] text-[#0B1F3B] text-xs font-bold flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{lang === "ta" ? "பில் பதிவிறக்கு" : "Download Bill"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="min-h-[36px] px-3 rounded-lg border border-border bg-background hover:bg-muted text-xs font-bold flex items-center gap-1.5"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>{lang === "ta" ? "அச்சிடு" : "Print"}</span>
                  </button>
                </div>
              </div>
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

            {/* Verified Order Feedback */}
            {(order.status === "SERVED" || order.status === "COMPLETED") && trackingToken && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
                <h2 className="text-sm font-bold text-foreground">
                  {lang === "ta" ? "உங்கள் ஆர்டரை மதிப்பிடுங்கள்" : "Rate your order"}
                </h2>
                {feedbackSubmitted ? (
                  <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {lang === "ta" ? "உங்கள் கருத்துக்கு நன்றி!" : "Thank you for your feedback!"}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {lang === "ta" ? "உணவு தரம்" : "Food rating"}
                      </span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setFoodRating(n)}
                            aria-label={`Food rating ${n}`}
                            className={`w-9 h-9 rounded-lg text-xs font-bold border ${
                              foodRating === n
                                ? "bg-[#FF6A00] border-[#FF6A00] text-[#0B1F3B]"
                                : "bg-background border-border text-foreground"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">
                        {lang === "ta" ? "சேவை தரம்" : "Service rating"}
                      </span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setServiceRating(n)}
                            aria-label={`Service rating ${n}`}
                            className={`w-9 h-9 rounded-lg text-xs font-bold border ${
                              serviceRating === n
                                ? "bg-[#FF6A00] border-[#FF6A00] text-[#0B1F3B]"
                                : "bg-background border-border text-foreground"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="feedback-suggestion"
                        className="block text-xs font-semibold mb-1"
                      >
                        {lang === "ta" ? "ஆலோசனை வகை (விருப்பம்)" : "Suggestion topic (optional)"}
                      </label>
                      <select
                        id="feedback-suggestion"
                        value={suggestionType}
                        onChange={(e) => setSuggestionType(e.target.value as any)}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-input bg-background text-xs"
                      >
                        <option value="">{lang === "ta" ? "தேர்வு செய்க..." : "Select..."}</option>
                        <option value="TASTE">{lang === "ta" ? "சுவை" : "Taste"}</option>
                        <option value="PORTION">{lang === "ta" ? "அளவு" : "Portion"}</option>
                        <option value="SPEED">{lang === "ta" ? "வேகம்" : "Speed"}</option>
                        <option value="SERVICE">{lang === "ta" ? "சேவை" : "Service"}</option>
                        <option value="OTHER">{lang === "ta" ? "மற்றவை" : "Other"}</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="feedback-comment"
                        className="block text-xs font-semibold mb-1"
                      >
                        {lang === "ta" ? "கருத்து (விருப்பம்)" : "Comment (optional)"}
                      </label>
                      <textarea
                        id="feedback-comment"
                        rows={2}
                        maxLength={300}
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-input bg-background text-xs"
                      />
                    </div>
                    {feedbackError && (
                      <div role="alert" className="text-xs font-semibold text-destructive">
                        {feedbackError}
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={feedbackSubmitting}
                      onClick={async () => {
                        setFeedbackSubmitting(true);
                        setFeedbackError(null);
                        try {
                          await publicQrApi.submitFeedback(trackingToken, {
                            food_rating: foodRating,
                            service_rating: serviceRating,
                            suggestion_type: suggestionType,
                            comment: feedbackComment.trim(),
                          });
                          setFeedbackSubmitted(true);
                        } catch (err: any) {
                          setFeedbackError(
                            err?.response?.data?.detail ||
                              (lang === "ta"
                                ? "கருத்து அனுப்ப முடியவில்லை."
                                : "Could not submit feedback.")
                          );
                        } finally {
                          setFeedbackSubmitting(false);
                        }
                      }}
                      className="w-full min-h-[48px] rounded-xl bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-sm disabled:opacity-50"
                    >
                      {lang === "ta" ? "கருத்தை அனுப்பு" : "Submit feedback"}
                    </button>
                  </div>
                )}
              </div>
            )}

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
