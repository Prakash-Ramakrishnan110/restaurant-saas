import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Receipt,
  CreditCard,
  QrCode,
  Banknote,
  Users,
  Printer,
  ChevronRight,
  ShieldCheck,
  Split,
  ArrowRightLeft,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { ordersApi, BillCalculation, BillInvoice, Order, ServiceRequest } from "../../api/orders";
import { playWaiterCallAlert } from "../../utils/soundAlerts";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { formatRupees, parseRupees } from "../../utils/currency";
import { unwrapList, ListResponse } from "../../api/pagination";
import { computeEqualSplitShares } from "../../utils/thermalPrint";

interface TableSessionInfo {
  id: string;
  table?: { label: string } | string;
  table_label?: string;
  session_code?: string;
  party_size?: number;
  orders_count?: number;
  status: string;
}

export const BillingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeTenant } = useAuth();
  const usesTables = React.useMemo(() => {
    const tenant = activeTenant as
      | (typeof activeTenant & {
          uses_tables?: boolean;
          business_type?: string;
          venue_profile?: string;
        })
      | null;
    if (!tenant) return true;
    return !(
      tenant.uses_tables === false ||
      tenant.business_type === "TEA_SHOP" ||
      tenant.business_type === "BAKERY" ||
      tenant.business_type === "FOOD_COURT" ||
      tenant.business_type === "FOOD_TRUCK_COURT" ||
      tenant.business_type === "QUICK_SERVICE" ||
      tenant.venue_profile === "QUICK_SERVICE"
    );
  }, [activeTenant]);

  // Active Bills and Selection
  const [sessions, setSessions] = useState<TableSessionInfo[]>([]);
  const [billRequests, setBillRequests] = useState<ServiceRequest[]>([]);
  const prevBillReqIdsRef = React.useRef<Set<string> | null>(null);
  const [awaitingPaymentOrders, setAwaitingPaymentOrders] = useState<Order[]>([]);
  const [settlingOrderId, setSettlingOrderId] = useState<string | null>(null);
  const [orderPaymentMethods, setOrderPaymentMethods] = useState<
    Record<string, "CASH" | "UPI" | "CARD">
  >({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [billData, setBillData] = useState<BillCalculation | null>(null);
  const [settling, setSettling] = useState<boolean>(false);

  // Settlement Form (Full Payment Only)
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD" | "ROOM_FOLIO">(
    "CASH"
  );
  const [amountTendered, setAmountTendered] = useState<string>("");
  const [discountPaise] = useState<number>(0);
  const [notes] = useState<string>("");

  // Printable Receipt Modal
  const [receiptModalOpen, setReceiptModalOpen] = useState<boolean>(false);
  const [settledInvoice, setSettledInvoice] = useState<BillInvoice | null>(null);

  // Stage B: Split Bill & Move/Merge Tables state
  const [splitModalOpen, setSplitModalOpen] = useState<boolean>(false);
  const [splitMode, setSplitMode] = useState<"EQUAL" | "ITEMS">("EQUAL");
  const [splitShares, setSplitShares] = useState<number>(2);
  const [selectedItemIndices, setSelectedItemIndices] = useState<number[]>([]);
  const [mergeTargetSessionId, setMergeTargetSessionId] = useState<string>("");
  const [opsNotice, setOpsNotice] = useState<string | null>(null);

  // Stage D3: Guest Phone Lookup & Loyalty Points state
  const [guestSearchPhone, setGuestSearchPhone] = useState<string>("");
  const [matchedGuest, setMatchedGuest] = useState<{
    id: string;
    name: string;
    phone: string;
    consent_given: boolean;
    dietary_preference: string;
    allergies: string;
    loyalty_points: number;
  } | null>(null);
  const [redeemLoyaltyPoints, setRedeemLoyaltyPoints] = useState<number>(0);

  const handleLookupGuest = async () => {
    if (!guestSearchPhone.trim()) return;
    try {
      const res = await apiClient.get<any>("/customers/", {
        params: { search: guestSearchPhone.trim() },
      });
      const list = unwrapList<any>(res.data);
      if (list.length > 0) {
        setMatchedGuest(list[0]);
        setRedeemLoyaltyPoints(0);
        setOpsNotice(`Linked guest ${list[0].name} (${list[0].loyalty_points || 0} loyalty pts).`);
      } else {
        setMatchedGuest(null);
        setErrorMessage("No guest profile found matching that phone or name.");
      }
    } catch {
      setErrorMessage("Could not search guest directory.");
    }
  };

  // Error / Success
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!activeTenant) return;
    try {
      const [sessRes, awaitRes, reqRes] = await Promise.all([
        apiClient.get<ListResponse<TableSessionInfo> | TableSessionInfo[]>("/table-sessions/"),
        ordersApi.getOrders({ status: "AWAITING_PAYMENT" }).catch(() => ({ data: [] })),
        ordersApi.getServiceRequests("PENDING").catch(() => ({ data: [] })),
      ]);
      const openSessions = unwrapList<TableSessionInfo>(sessRes.data).filter(
        (s) => s.status === "OPEN"
      );
      const pendingBillReqs = unwrapList<ServiceRequest>(reqRes.data).filter(
        (r) => r.request_type === "BILL"
      );
      const nextReqIds = new Set(pendingBillReqs.map((r) => r.id));
      if (prevBillReqIdsRef.current !== null) {
        const newest = pendingBillReqs.find((r) => !prevBillReqIdsRef.current!.has(r.id));
        if (newest) {
          playWaiterCallAlert(
            newest.table_label ? `Bill requested for Table ${newest.table_label}` : undefined
          );
        }
      }
      prevBillReqIdsRef.current = nextReqIds;
      setBillRequests(pendingBillReqs);
      setSessions(openSessions);
      setAwaitingPaymentOrders(unwrapList<Order>(awaitRes.data));

      const targetId =
        searchParams.get("session_id") || (openSessions.length > 0 ? openSessions[0].id : null);
      if (targetId) {
        setSelectedSessionId(targetId);
        loadSessionBill(targetId);
      }
    } catch {
      setErrorMessage(
        usesTables ? "Failed to load active tables." : "Failed to load counter queue."
      );
    }
  };

  const handleSettleAwaitingOrder = async (ord: Order) => {
    setSettlingOrderId(ord.id);
    setErrorMessage(null);
    try {
      const method = orderPaymentMethods[ord.id] || "CASH";
      await ordersApi.settleOrder(ord.id, {
        payment_method: method,
        amount_tendered_paise: ord.total_paise || 0,
        discount_paise: 0,
        notes: "Counter QR pay-first settlement",
      });
      await fetchSessions();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error?.message ||
          err.response?.data?.detail ||
          "Failed to mark order as paid."
      );
    } finally {
      setSettlingOrderId(null);
    }
  };

  const loadSessionBill = async (sessionId: string) => {
    try {
      const res = await ordersApi.getSessionBill(sessionId);
      setBillData(res.data);
      const wholeRupees = Math.trunc(res.data.total_paise / 100);
      setAmountTendered(String(wholeRupees));
    } catch {
      setErrorMessage("Could not load bill details.");
    }
  };

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenant?.tenant_id]);

  const handleSelectSession = (sId: string) => {
    setSelectedSessionId(sId);
    loadSessionBill(sId);
  };

  const loyaltyDiscountPaise =
    matchedGuest && matchedGuest.consent_given
      ? Math.min(redeemLoyaltyPoints, matchedGuest.loyalty_points || 0) * 100
      : 0;
  const totalDiscountPaise = discountPaise + loyaltyDiscountPaise;
  const grandTotalPaise = Math.max(0, (billData?.total_paise || 0) - totalDiscountPaise);
  const tenderedPaise = parseRupees(amountTendered) || grandTotalPaise;
  const changeDuePaise = Math.max(0, tenderedPaise - grandTotalPaise);

  const handleSettle = async () => {
    if (!selectedSessionId || !billData) return;
    setSettling(true);
    setErrorMessage(null);
    try {
      const res = await ordersApi.settleBill(selectedSessionId, {
        payment_method: paymentMethod,
        amount_tendered_paise: tenderedPaise || grandTotalPaise,
        discount_paise: discountPaise,
        customer_id: matchedGuest?.id || null,
        redeem_loyalty_points: matchedGuest && matchedGuest.consent_given ? redeemLoyaltyPoints : 0,
        notes: notes || "",
      });

      setSettledInvoice(res.data);
      setReceiptModalOpen(true);
      const matchingReqs = billRequests.filter(
        (r) =>
          (billData.table_label && r.table_label === billData.table_label) || r.status === "PENDING"
      );
      await Promise.all(
        matchingReqs
          .filter((r) => billData.table_label && r.table_label === billData.table_label)
          .map((r) => ordersApi.resolveServiceRequest(r.id).catch(() => null))
      );
      setSelectedSessionId(null);
      setBillData(null);
      await fetchSessions();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string; detail?: string } };
        message?: string;
      };
      setErrorMessage(
        axiosErr?.response?.data?.message ||
          axiosErr?.response?.data?.detail ||
          axiosErr?.message ||
          "Failed to settle bill."
      );
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-black font-heading text-foreground tracking-tight flex items-center gap-2">
            <Receipt className="h-6 w-6 text-[#FF6A00]" />
            Billing & Settlement
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {usesTables
              ? "Table checkout, bill settlement, and thermal receipts."
              : "Counter checkout, bill settlement, and thermal receipts."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => navigate("/orders/floor")}
          >
            {usesTables ? "Floor POS" : "Counter Orders"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => navigate("/billing/closeout")}
          >
            Shift Close-Out
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg font-semibold flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Awaiting Payment (Pay-First Counter / QR) */}
      {awaitingPaymentOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Awaiting Payment — Counter / QR ({awaitingPaymentOrders.length})
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {awaitingPaymentOrders.map((ord) => {
              const method = orderPaymentMethods[ord.id] || "CASH";
              return (
                <div
                  key={ord.id}
                  className="p-4 rounded-xl border border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {ord.daily_token ? `Token #${ord.daily_token}` : ord.order_number}
                        </span>
                        {ord.source === "QR" && (
                          <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded bg-[#FF6A00] text-[#0B1F3B]">
                            QR
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {usesTables && ord.table_number ? `Table ${ord.table_number}` : "Counter"} •{" "}
                        {ord.order_number}
                      </p>
                    </div>
                    <div className="font-bold text-sm text-foreground">
                      {formatRupees(ord.total_paise || 0)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(["CASH", "UPI", "CARD"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setOrderPaymentMethods((prev) => ({ ...prev, [ord.id]: m }))}
                        className={`flex-1 min-h-[44px] py-1.5 rounded text-xs font-semibold border transition-colors ${
                          method === m
                            ? "bg-[#0B1F3B] text-white border-[#0B1F3B]"
                            : "bg-card text-foreground border-border"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    disabled={settlingOrderId === ord.id}
                    onClick={() => handleSettleAwaitingOrder(ord)}
                    className="w-full min-h-[48px] bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-xs"
                  >
                    {settlingOrderId === ord.id ? "Processing..." : "Mark Paid & Send to Kitchen"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Open Bills Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {usesTables
                ? `Active Tables (${sessions.length})`
                : `Open Counter Bills (${sessions.length})`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-[36px] text-xs"
              onClick={fetchSessions}
            >
              Refresh
            </Button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card/40 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs font-semibold">
                  {usesTables ? "No open tables awaiting billing." : "No open counter bills."}
                </p>
                <p className="text-xs text-muted-foreground/80 mt-1">
                  {usesTables
                    ? "Seat guests and place orders in Floor POS to generate bills."
                    : "Place orders in Counter Orders to settle bills here."}
                </p>
              </div>
            ) : (
              sessions.map((sess) => {
                const isSelected = sess.id === selectedSessionId;
                return (
                  <div
                    key={sess.id}
                    onClick={() => handleSelectSession(sess.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "border-[#FF6A00] bg-[#FF6A00]/5 ring-1 ring-[#FF6A00]"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-foreground">
                          {usesTables && sess.table_label
                            ? `Table ${sess.table_label}`
                            : usesTables && typeof sess.table === "object" && sess.table?.label
                              ? `Table ${sess.table.label}`
                              : "Direct Counter"}
                        </span>
                        <Badge variant="outline" className="text-xs py-0 px-1.5 font-mono">
                          {sess.session_code}
                        </Badge>
                        {sess.table_label &&
                          billRequests.some((r) => r.table_label === sess.table_label) && (
                            <Badge className="bg-[#FF6A00] text-[#0B1F3B] text-xs py-0 px-1.5 font-bold">
                              Bill Requested
                            </Badge>
                          )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Party of {sess.party_size || 2} • {sess.orders_count || 0} order(s)
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 ${
                        isSelected
                          ? "text-[#C2410C] dark:text-[#FF6A00]"
                          : "text-muted-foreground/40"
                      }`}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Authoritative Bill Breakdown & Tender (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {!billData ? (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-2xl bg-card/20 text-muted-foreground text-center">
              <Receipt className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold">
                {usesTables
                  ? "Select an active table to begin checkout."
                  : "Select an open order to begin checkout."}
              </p>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm">
                Totals and line items are calculated accurately on the server.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bill Card */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <span className="text-xs uppercase font-bold text-muted-foreground">
                      Order Bill
                    </span>
                    <h2 className="text-lg font-black font-heading text-foreground">
                      {usesTables && billData.table_label !== "N/A"
                        ? `Table ${billData.table_label}`
                        : "Counter Checkout"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedItemIndices([]);
                        setSplitModalOpen(true);
                      }}
                      className="h-7 text-xs gap-1"
                    >
                      <Split className="h-3.5 w-3.5 text-[#FF6A00]" /> Split / Merge
                    </Button>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md font-bold">
                      <ShieldCheck className="h-3.5 w-3.5" /> Server Calculated
                    </div>
                  </div>
                </div>

                {opsNotice && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                    {opsNotice}
                  </div>
                )}

                {/* Itemized Order Lines */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
                  {(billData?.items || []).map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0B1F3B] dark:text-[#FF6A00]">
                          {it.quantity}×
                        </span>
                        <span className="semibold text-foreground">{it.item_name}</span>
                      </div>
                      <span className="font-extrabold font-mono text-foreground">
                        {formatRupees(it.subtotal_paise)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Financial Summary */}
                <div className="pt-3 border-t border-border space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatRupees(billData.subtotal_paise)}</span>
                  </div>
                  {totalDiscountPaise > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>
                        Discount
                        {loyaltyDiscountPaise > 0
                          ? ` (includes ${redeemLoyaltyPoints} loyalty pts)`
                          : ""}
                        :
                      </span>
                      <span className="font-mono">-{formatRupees(totalDiscountPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-foreground pt-2 border-t border-border">
                    <span>Grand Total:</span>
                    <span className="font-mono text-xl text-foreground">
                      {formatRupees(grandTotalPaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stage D3: Guest Phone Lookup & Loyalty Points Redemption */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase text-muted-foreground">
                    Guest Loyalty &amp; Phone Lookup
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Earn 1 pt / ₹100 • Redeem 1 pt = ₹1
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    aria-label="Enter guest phone or name"
                    data-testid="billing-guest-phone-input"
                    placeholder="Enter guest phone or name..."
                    value={guestSearchPhone}
                    onChange={(e) => setGuestSearchPhone(e.target.value)}
                    className="h-10 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="billing-guest-lookup-btn"
                    onClick={() => void handleLookupGuest()}
                    className="h-9 text-xs font-bold shrink-0"
                  >
                    Lookup Guest
                  </Button>
                </div>
                {matchedGuest && (
                  <div
                    data-testid="billing-matched-guest-card"
                    className="p-3 rounded-lg border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-foreground">
                        {matchedGuest.name} ({matchedGuest.phone})
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Available Balance: <strong>{matchedGuest.loyalty_points || 0} pts</strong>
                        {matchedGuest.allergies ? ` • Allergic: ${matchedGuest.allergies}` : ""}
                      </div>
                    </div>
                    {matchedGuest.consent_given && (matchedGuest.loyalty_points || 0) > 0 && (
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="redeem-pts-input"
                          className="text-[11px] font-semibold text-muted-foreground"
                        >
                          Redeem Pts:
                        </label>
                        <input
                          id="redeem-pts-input"
                          data-testid="billing-redeem-points-input"
                          type="number"
                          min={0}
                          max={matchedGuest.loyalty_points || 0}
                          value={redeemLoyaltyPoints}
                          onChange={(e) =>
                            setRedeemLoyaltyPoints(
                              Math.max(
                                0,
                                Math.min(
                                  matchedGuest.loyalty_points || 0,
                                  Number(e.target.value) || 0
                                )
                              )
                            )
                          }
                          className="w-20 px-2 py-1 rounded border border-input bg-background font-mono text-right font-bold"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Settlement Form */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Payment Method
                </span>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "CASH" as const, label: "Cash", icon: Banknote },
                    { id: "UPI" as const, label: "UPI QR", icon: QrCode },
                    { id: "CARD" as const, label: "Card", icon: CreditCard },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id)}
                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border text-xs font-bold transition-all ${
                          isSelected
                            ? "border-[#FF6A00] bg-[#FF6A00]/10 text-foreground ring-1 ring-[#FF6A00]"
                            : "border-border bg-card text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${isSelected ? "text-[#FF6A00]" : "text-muted-foreground"}`}
                        />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Cash Tender Calculation */}
                {paymentMethod === "CASH" && (
                  <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted-foreground">
                        Amount Tendered (₹):
                      </span>
                      <div className="w-36">
                        <Input
                          type="number"
                          aria-label="Amount tendered in rupees"
                          value={amountTendered}
                          onChange={(e) => setAmountTendered(e.target.value)}
                          className="h-8 font-mono text-right text-sm font-bold"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between font-bold pt-1 border-t border-border">
                      <span className="text-muted-foreground">Change Due to Guest:</span>
                      <span className="font-mono text-sm text-emerald-600 font-extrabold">
                        {formatRupees(changeDuePaise)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Settle Action Button */}
                <Button
                  className="w-full min-h-[50px] text-base font-extrabold bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B] gap-2 shadow-sm"
                  disabled={settling}
                  onClick={handleSettle}
                >
                  <Receipt className="h-5 w-5" />
                  {settling
                    ? "Settling..."
                    : `Settle & Print Receipt (${formatRupees(grandTotalPaise)})`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Printable 80mm Thermal Receipt Modal */}
      <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receipt {settledInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-white text-black font-mono text-xs rounded-lg border border-border/80 space-y-2 select-all shadow-inner print:shadow-none">
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <h2 className="font-black text-sm uppercase">
                {activeTenant?.tenant_name || "ServeMyFood"}
              </h2>
              <p className="text-xs text-gray-600 font-bold">DEMO ORDER SUMMARY</p>
              <p className="text-xs text-gray-600">Invoice: {settledInvoice?.invoice_number}</p>
              <p className="text-xs text-gray-600">
                {usesTables ? `Table: ${settledInvoice?.table_label}` : "Counter Order"} •{" "}
                {new Date().toLocaleTimeString()}
              </p>
            </div>

            <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
              {(billData?.items || settledInvoice?.items || []).map((it: any, i: number) => (
                <div key={i} className="flex justify-between text-xs">
                  <span>
                    {it.quantity}x {it.item_name}
                  </span>
                  <span>
                    {formatRupees(it.subtotal_paise || it.unit_price_paise * it.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="py-1 text-xs space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatRupees(settledInvoice?.subtotal_paise || 0)}</span>
              </div>
              <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
                <span>NET TOTAL:</span>
                <span>{formatRupees(settledInvoice?.total_paise || 0)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600 pt-1">
                <span>Paid via {settledInvoice?.payment_method}:</span>
                <span>{formatRupees(settledInvoice?.amount_tendered_paise || 0)}</span>
              </div>
            </div>

            <div className="text-center pt-2 border-t border-dashed border-gray-400 text-xs text-gray-600">
              <p>Thank you! Visit again.</p>
              <p>Powered by ServeMyFood</p>
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between items-center">
            <Button variant="outline" onClick={() => setReceiptModalOpen(false)}>
              Done
            </Button>
            <Button
              className="bg-[#0A192F] text-white gap-2 font-bold"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" /> Print 80mm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stage B: Split Bill (Equal N Shares / By Items) & Merge / Move Items Dialog */}
      <Dialog open={splitModalOpen} onOpenChange={setSplitModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <Split className="h-4 w-4 text-[#C2410C] dark:text-[#FF6A00]" />
              {usesTables ? "Split Bill & Table Merge — " : "Split Bill — "}
              {usesTables && billData?.table_label && billData.table_label !== "N/A"
                ? `Table ${billData.table_label}`
                : "Counter Order"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            {/* Mode Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
              <button
                type="button"
                onClick={() => setSplitMode("EQUAL")}
                className={`py-1.5 rounded-md font-bold transition-colors ${
                  splitMode === "EQUAL"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Equal N Shares
              </button>
              <button
                type="button"
                onClick={() => setSplitMode("ITEMS")}
                className={`py-1.5 rounded-md font-bold transition-colors ${
                  splitMode === "ITEMS"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                Split / Move by Items
              </button>
            </div>

            {splitMode === "EQUAL" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground">
                    Number of Diners / Shares (2–20):
                  </label>
                  <Input
                    type="number"
                    min={2}
                    max={20}
                    value={splitShares}
                    onChange={(e) =>
                      setSplitShares(Math.max(2, Math.min(20, parseInt(e.target.value || "2", 10))))
                    }
                    className="w-24 h-8 font-mono font-bold text-right"
                  />
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1.5 max-h-48 overflow-y-auto">
                  {computeEqualSplitShares(grandTotalPaise, splitShares).map((sh) => (
                    <div
                      key={sh.share_index}
                      className="flex items-center justify-between py-1 border-b border-border/50 last:border-none"
                    >
                      <span className="font-semibold text-foreground">{sh.label}</span>
                      <span className="font-mono font-extrabold text-[#FF6A00]">
                        {sh.formatted}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Rounding remainder is assigned to Share 1 so shares sum to{" "}
                  <strong className="text-foreground">{formatRupees(grandTotalPaise)}</strong>{" "}
                  accurately.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[11px] font-semibold text-muted-foreground">
                  Select dishes to split into Sub-Bill A or move to another open table:
                </div>
                <div className="max-h-44 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                  {(billData?.items || []).map((it, idx) => {
                    const checked = selectedItemIndices.includes(idx);
                    return (
                      <label
                        key={idx}
                        className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItemIndices((prev) => [...prev, idx]);
                              } else {
                                setSelectedItemIndices((prev) => prev.filter((i) => i !== idx));
                              }
                            }}
                            className="accent-[#FF6A00]"
                          />
                          <span className="font-semibold">
                            {it.quantity}× {it.item_name}
                          </span>
                        </div>
                        <span className="font-mono font-bold">
                          {formatRupees(it.subtotal_paise)}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {(() => {
                  const selectedPaise = (billData?.items || [])
                    .filter((_, idx) => selectedItemIndices.includes(idx))
                    .reduce((s, it) => s + it.subtotal_paise, 0);
                  const remainingPaise = Math.max(0, grandTotalPaise - selectedPaise);
                  return (
                    <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>Split Bill A (Selected):</span>
                        <span className="font-mono text-[#0B1F3B] dark:text-[#FF6A00]">
                          {formatRupees(selectedPaise)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Split Bill B (Remaining):</span>
                        <span className="font-mono">{formatRupees(remainingPaise)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Move Items or Merge into Another Open Order (Dine-in tables only) */}
            {usesTables && sessions.filter((s) => s.id !== selectedSessionId).length > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-[#C2410C] dark:text-[#FF6A00]" />
                  Combine or Move to Another Open Table
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Target Open Table"
                    value={mergeTargetSessionId}
                    onChange={(e) => setMergeTargetSessionId(e.target.value)}
                    className="flex-1 h-9 px-2.5 text-xs rounded-md border border-input bg-background"
                  >
                    <option value="">Select target open table...</option>
                    {sessions
                      .filter((s) => s.id !== selectedSessionId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.table_label
                            ? `Table ${s.table_label}`
                            : typeof s.table === "object" && s.table?.label
                              ? `Table ${s.table.label}`
                              : s.session_code}
                        </option>
                      ))}
                  </select>
                  {splitMode === "ITEMS" && selectedItemIndices.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!mergeTargetSessionId}
                      onClick={async () => {
                        if (!selectedSessionId || !mergeTargetSessionId) return;
                        const ids = (billData?.items || [])
                          .filter((_, idx) => selectedItemIndices.includes(idx))
                          .map((it) => it.id)
                          .filter(Boolean) as string[];
                        if (ids.length === 0) return;
                        await ordersApi.moveSessionItems(selectedSessionId, {
                          target_session_id: mergeTargetSessionId,
                          item_ids: ids,
                        });
                        setOpsNotice(`Moved ${ids.length} item(s) to target table.`);
                        setSplitModalOpen(false);
                        await fetchSessions();
                      }}
                      className="h-9 text-xs font-bold"
                    >
                      Move Selected Items
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={!mergeTargetSessionId}
                    onClick={async () => {
                      if (!selectedSessionId || !mergeTargetSessionId) return;
                      await ordersApi.mergeTableSessions(selectedSessionId, {
                        target_session_id: mergeTargetSessionId,
                      });
                      setOpsNotice("Tables merged successfully.");
                      setSplitModalOpen(false);
                      setSelectedSessionId(mergeTargetSessionId);
                      await fetchSessions();
                    }}
                    className="h-9 bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] text-xs font-bold"
                  >
                    Merge Full Table
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSplitModalOpen(false)} className="text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
