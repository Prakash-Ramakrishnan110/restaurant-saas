import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Printer,
  CheckCircle2,
  ArrowLeft,
  Calculator,
  Lock,
  PlusCircle,
  Banknote,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ordersApi, BillInvoice, ShiftCloseoutState, CashMovementRecord } from "../../api/orders";
import { unwrapList } from "../../api/pagination";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { formatRupees, parseRupees } from "../../utils/currency";
import { dispatchThermalPrint } from "../../utils/thermalPrint";

export interface ShiftCloseoutRecord {
  timestamp: string;
  cashier: string;
  opening_cash_paise: number;
  cash_sales_paise: number;
  cash_in_paise: number;
  cash_out_paise: number;
  cash_refunds_paise: number;
  expected_cash_paise: number;
  actual_cash_paise: number;
  variance_paise: number;
  variance_reason_code?: string;
  upi_total_paise: number;
  card_total_paise: number;
  total_shift_paise: number;
  invoices_count: number;
  is_locked?: boolean;
}

const DENOMINATIONS = [
  { key: "2000", label: "₹2000", valueRupees: 2000 },
  { key: "500", label: "₹500", valueRupees: 500 },
  { key: "200", label: "₹200", valueRupees: 200 },
  { key: "100", label: "₹100", valueRupees: 100 },
  { key: "50", label: "₹50", valueRupees: 50 },
  { key: "20", label: "₹20", valueRupees: 20 },
  { key: "10", label: "₹10", valueRupees: 10 },
  { key: "coins", label: "Coins (₹1-₹5)", valueRupees: 1 },
];

export const ShiftCloseoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeTenant } = useAuth();

  const [openingCash, setOpeningCash] = useState<string>("2000");
  const [actualCash, setActualCash] = useState<string>("");
  const [varianceReason, setVarianceReason] = useState<string>("");
  const [shiftNotes, setShiftNotes] = useState<string>("");
  const [showDenomHelper, setShowDenomHelper] = useState<boolean>(false);
  const [denomCounts, setDenomCounts] = useState<Record<string, number>>({
    "2000": 0,
    "500": 0,
    "200": 0,
    "100": 0,
    "50": 0,
    "20": 0,
    "10": 0,
    coins: 0,
  });

  // Mid-shift cash movements
  const [activeShift, setActiveShift] = useState<ShiftCloseoutState | null>(null);
  const [movements, setMovements] = useState<CashMovementRecord[]>([]);
  const [mvType, setMvType] = useState<"FLOAT_IN" | "CASH_DROP" | "PETTY_CASH_OUT">("CASH_DROP");
  const [mvAmount, setMvAmount] = useState<string>("");
  const [mvReason, setMvReason] = useState<string>("");
  const [mvSaving, setMvSaving] = useState<boolean>(false);

  const [invoices, setInvoices] = useState<BillInvoice[]>([]);
  const [closeoutResult, setCloseoutResult] = useState<ShiftCloseoutRecord | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    ordersApi
      .getInvoices()
      .then((res) => {
        setInvoices(unwrapList<BillInvoice>(res.data));
      })
      .catch(() => setInvoices([]));

    ordersApi
      .getCurrentShift()
      .then((res) => {
        if (res.data && typeof res.data === "object" && "id" in res.data) {
          setActiveShift(res.data);
          setMovements(res.data.cash_movements || []);
          if (res.data.opening_cash_paise) {
            setOpeningCash(String(Math.trunc(res.data.opening_cash_paise / 100)));
          }
        }
      })
      .catch(() => {});
  }, [activeTenant?.tenant_id]);

  const handleDenomChange = (key: string, countStr: string) => {
    const count = Math.max(0, parseInt(countStr || "0", 10) || 0);
    const updated = { ...denomCounts, [key]: count };
    setDenomCounts(updated);
    const totalRupees = DENOMINATIONS.reduce(
      (sum, d) => sum + (updated[d.key] || 0) * d.valueRupees,
      0
    );
    setActualCash(String(totalRupees));
  };

  const handleAddCashMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const amtPaise = parseRupees(mvAmount);
    if (amtPaise <= 0 || !mvReason.trim()) {
      setErrorMessage("Enter a valid positive amount and reason for the cash drawer movement.");
      return;
    }
    setMvSaving(true);
    try {
      if (activeShift?.id) {
        const res = await ordersApi.recordCashMovement(activeShift.id, {
          movement_type: mvType,
          amount_paise: amtPaise,
          reason: mvReason.trim(),
        });
        setMovements((prev) => [...prev, res.data]);
      } else {
        setMovements((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            shift_id: "local",
            movement_type: mvType,
            amount_paise: amtPaise,
            reason: mvReason.trim(),
            recorded_by_name: user?.full_name || "Cashier",
            created_at: new Date().toISOString(),
          },
        ]);
      }
      setMvAmount("");
      setMvReason("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Cannot record movement on a closed or locked shift.";
      setErrorMessage(msg);
    } finally {
      setMvSaving(false);
    }
  };

  const invoiceList = Array.isArray(invoices) ? invoices : [];

  const cashTotal = invoiceList
    .filter((inv) => inv.payment_method === "CASH")
    .reduce((sum, inv) => sum + inv.total_paise, 0);

  const upiTotal = invoiceList
    .filter((inv) => inv.payment_method === "UPI")
    .reduce((sum, inv) => sum + inv.total_paise, 0);

  const cardTotal = invoiceList
    .filter((inv) => inv.payment_method === "CARD")
    .reduce((sum, inv) => sum + inv.total_paise, 0);

  const cashInPaise = movements
    .filter((m) => m.movement_type === "FLOAT_IN")
    .reduce((s, m) => s + m.amount_paise, 0);

  const cashOutPaise = movements
    .filter((m) => m.movement_type === "CASH_DROP" || m.movement_type === "PETTY_CASH_OUT")
    .reduce((s, m) => s + m.amount_paise, 0);

  const cashRefundsPaise = movements
    .filter((m) => m.movement_type === "REFUND_CASH_OUT")
    .reduce((s, m) => s + m.amount_paise, 0);

  const openingPaise = parseRupees(openingCash);
  const expectedCashTotal =
    openingPaise + cashTotal + cashInPaise - cashOutPaise - cashRefundsPaise;

  const handlePerformCloseout = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    const countedPaise = parseRupees(actualCash);
    const variancePaise = countedPaise - expectedCashTotal;

    if (activeShift?.id) {
      try {
        const res = await ordersApi.closeShift(activeShift.id, {
          actual_cash_paise: countedPaise,
          opening_cash_paise: openingPaise,
          denominations_snapshot: denomCounts,
          variance_reason_code: varianceReason || (Math.abs(variancePaise) > 10000 ? "OTHER" : ""),
          notes: shiftNotes,
        });
        if (res.data && typeof res.data === "object" && "expected_cash_paise" in res.data) {
          const d = res.data;
          setActiveShift(d);
          setCloseoutResult({
            timestamp: new Date().toLocaleString(),
            cashier: d.cashier_name || user?.full_name || "Cashier",
            opening_cash_paise: d.opening_cash_paise,
            cash_sales_paise: d.cash_sales_paise,
            cash_in_paise: d.cash_in_paise,
            cash_out_paise: d.cash_out_paise,
            cash_refunds_paise: d.cash_refunds_paise,
            expected_cash_paise: d.expected_cash_paise ?? expectedCashTotal,
            actual_cash_paise: d.actual_cash_paise,
            variance_paise: d.cash_variance_paise ?? variancePaise,
            variance_reason_code: d.variance_reason_code,
            upi_total_paise: d.upi_total_paise,
            card_total_paise: d.card_total_paise,
            total_shift_paise: d.total_settled_paise,
            invoices_count: d.total_invoices_count,
            is_locked: d.is_locked,
          });
          setSubmitting(false);
          return;
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message;
        if (msg) {
          setErrorMessage(msg);
          setSubmitting(false);
          return;
        }
      }
    }

    setCloseoutResult({
      timestamp: new Date().toLocaleString(),
      cashier: user?.full_name || "Cashier",
      opening_cash_paise: openingPaise,
      cash_sales_paise: cashTotal,
      cash_in_paise: cashInPaise,
      cash_out_paise: cashOutPaise,
      cash_refunds_paise: cashRefundsPaise,
      expected_cash_paise: expectedCashTotal,
      actual_cash_paise: countedPaise,
      variance_paise: variancePaise,
      variance_reason_code: varianceReason || undefined,
      upi_total_paise: upiTotal,
      card_total_paise: cardTotal,
      total_shift_paise: cashTotal + upiTotal + cardTotal,
      invoices_count: invoiceList.length,
      is_locked: true,
    });
    setSubmitting(false);
  };

  const isShiftLocked = Boolean(closeoutResult?.is_locked || activeShift?.is_locked);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/billing")}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-extrabold font-heading text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Cashier Shift Closeout (Z-Report)
            </h1>
            <p className="text-xs text-muted-foreground">
              Blind cash drawer reconciliation to prevent theft and accounting discrepancies.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isShiftLocked && (
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs font-bold gap-1">
              <Lock className="h-3 w-3" /> SHIFT LOCKED
            </Badge>
          )}
          <Badge variant="outline" className="text-xs font-bold">
            {invoiceList.length} Invoices Today
          </Badge>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blind Count Form */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">
              Cash Drawer Blind Count
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowDenomHelper((prev) => !prev)}
            >
              <Calculator className="h-3.5 w-3.5 text-[#FF6A00]" />
              {showDenomHelper ? "Hide Denominations" : "Count Notes & Coins"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Count the physical currency notes and coins in the register. Expected cash remains
            hidden until you submit your blind count.
          </p>

          {showDenomHelper && (
            <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-2">
              <div className="text-[11px] font-bold text-foreground uppercase">
                Denomination Note & Coin Counter
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DENOMINATIONS.map((d) => (
                  <div key={d.key} className="space-y-0.5">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      {d.label}
                    </label>
                    <Input
                      type="number"
                      min={0}
                      disabled={isShiftLocked}
                      value={denomCounts[d.key] || ""}
                      placeholder="0"
                      onChange={(e) => handleDenomChange(d.key, e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground">Opening Float Cash (₹)</label>
              <Input
                type="number"
                disabled={isShiftLocked}
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="h-9 mt-1 font-mono font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-foreground">
                Actual Counted Cash in Drawer (₹)
              </label>
              <Input
                type="number"
                disabled={isShiftLocked}
                placeholder="Enter counted cash..."
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="h-10 mt-1 font-mono font-bold text-base text-[#FF6A00]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-muted-foreground">
                  Variance Reason (if over/short)
                </label>
                <select
                  aria-label="Variance Reason"
                  disabled={isShiftLocked}
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  className="w-full h-9 mt-1 px-2.5 text-xs rounded-md border border-input bg-background"
                >
                  <option value="">None / Balanced</option>
                  <option value="CHANGE_ERROR">Change / Counting Error</option>
                  <option value="FLOAT_ERROR">Opening Float Discrepancy</option>
                  <option value="DROP_MISSING">Unrecorded Safe Drop</option>
                  <option value="OTHER">Other Discrepancy</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-muted-foreground">Handover Notes</label>
                <Input
                  type="text"
                  disabled={isShiftLocked}
                  placeholder="Optional shift notes..."
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  className="h-9 mt-1 text-xs"
                />
              </div>
            </div>
          </div>

          <Button
            className="w-full h-11 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B] font-bold text-sm gap-2 mt-4"
            disabled={!actualCash || submitting || isShiftLocked}
            onClick={handlePerformCloseout}
          >
            <CheckCircle2 className="h-4 w-4" /> Reconcile & Generate Z-Report
          </Button>
        </div>

        {/* Live Closeout Summary & Z-Report */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">
              Shift Z-Report Summary
            </h2>
            {closeoutResult && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  dispatchThermalPrint({
                    slipType: "Z_REPORT",
                    title: "SHIFT Z-REPORT",
                    lines: [
                      { left: "Cashier", right: closeoutResult.cashier },
                      {
                        left: "Expected Cash",
                        right: formatRupees(closeoutResult.expected_cash_paise),
                      },
                      {
                        left: "Counted Cash",
                        right: formatRupees(closeoutResult.actual_cash_paise),
                        bold: true,
                      },
                      {
                        left: "Variance",
                        right: formatRupees(closeoutResult.variance_paise),
                        bold: true,
                      },
                    ],
                  })
                }
                className="h-7 text-xs gap-1"
              >
                <Printer className="h-3.5 w-3.5" /> Print Z-Report
              </Button>
            )}
          </div>

          {!closeoutResult ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-xs text-muted-foreground border border-dashed rounded-lg p-4 gap-2">
              <Lock className="h-5 w-5 text-muted-foreground/50" />
              <span>
                Blind Count Active: Enter your counted cash and tap Reconcile to reveal expected
                drawer cash and generate the Z-Report.
              </span>
            </div>
          ) : (
            <div className="space-y-2.5 text-xs p-4 bg-muted/30 rounded-xl border border-border/80">
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-muted-foreground">Cashier:</span>
                <span className="font-bold">{closeoutResult.cashier}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-muted-foreground">Opening Float:</span>
                <span className="font-mono font-semibold">
                  {formatRupees(closeoutResult.opening_cash_paise)}
                </span>
              </div>
              {(closeoutResult.cash_in_paise > 0 ||
                closeoutResult.cash_out_paise > 0 ||
                closeoutResult.cash_refunds_paise > 0) && (
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Net Drawer Movements (In/Out):</span>
                  <span className="font-mono font-semibold">
                    {formatRupees(
                      closeoutResult.cash_in_paise -
                        closeoutResult.cash_out_paise -
                        closeoutResult.cash_refunds_paise
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-muted-foreground">Expected Drawer Cash:</span>
                <span className="font-mono font-bold">
                  {formatRupees(closeoutResult.expected_cash_paise)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-muted-foreground">Actual Counted Cash:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatRupees(closeoutResult.actual_cash_paise)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-muted-foreground">Cash Variance (Over / Short):</span>
                <span
                  className={`font-mono font-extrabold ${
                    closeoutResult.variance_paise === 0 ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {formatRupees(closeoutResult.variance_paise)}
                </span>
              </div>
              {closeoutResult.variance_reason_code && (
                <div className="flex justify-between py-1 border-b border-border/60">
                  <span className="text-muted-foreground">Variance Reason Code:</span>
                  <span className="font-mono font-bold">{closeoutResult.variance_reason_code}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-muted-foreground">UPI Digital Sales:</span>
                <span className="font-mono font-bold">
                  {formatRupees(closeoutResult.upi_total_paise)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-muted-foreground">Card Sales:</span>
                <span className="font-mono font-bold">
                  {formatRupees(closeoutResult.card_total_paise)}
                </span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-extrabold text-foreground">
                <span>Total Shift Net Revenue:</span>
                <span className="font-mono text-base text-[#FF6A00]">
                  {formatRupees(closeoutResult.total_shift_paise)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mid-Shift Cash Drawer Movements (Float In, Safe Drop, Petty Cash Out) */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Banknote className="h-4 w-4 text-[#FF6A00]" /> Mid-Shift Cash Drawer Movements
            </h2>
            <p className="text-xs text-muted-foreground">
              Record safe cash drops, float additions, and petty cash payouts before closing the
              shift.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleAddCashMovement}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end text-xs"
        >
          <div className="sm:col-span-3">
            <label className="font-semibold text-muted-foreground">Movement Type</label>
            <select
              aria-label="Movement Type"
              disabled={isShiftLocked}
              value={mvType}
              onChange={(e) =>
                setMvType(e.target.value as "FLOAT_IN" | "CASH_DROP" | "PETTY_CASH_OUT")
              }
              className="w-full h-9 mt-1 px-2.5 text-xs rounded-md border border-input bg-background"
            >
              <option value="CASH_DROP">Safe Cash Drop (-)</option>
              <option value="PETTY_CASH_OUT">Petty Cash Out (-)</option>
              <option value="FLOAT_IN">Float Addition (+)</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="font-semibold text-muted-foreground">Amount (₹)</label>
            <Input
              type="number"
              min={1}
              disabled={isShiftLocked}
              placeholder="e.g. 500"
              value={mvAmount}
              onChange={(e) => setMvAmount(e.target.value)}
              className="h-9 mt-1 font-mono"
            />
          </div>
          <div className="sm:col-span-4">
            <label className="font-semibold text-muted-foreground">Reason / Voucher Note</label>
            <Input
              type="text"
              disabled={isShiftLocked}
              placeholder="e.g. Evening safe drop / Milk purchase"
              value={mvReason}
              onChange={(e) => setMvReason(e.target.value)}
              className="h-9 mt-1"
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={isShiftLocked || mvSaving || !mvAmount}
              className="w-full h-9 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B] font-bold text-xs gap-1"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Record
            </Button>
          </div>
        </form>

        {movements.length > 0 && (
          <div className="border-t border-border pt-3 space-y-1.5 text-xs">
            {movements.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between py-1.5 px-3 rounded bg-muted/40"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {m.movement_type}
                  </Badge>
                  <span className="font-medium text-foreground">{m.reason}</span>
                </div>
                <span
                  className={`font-mono font-bold ${
                    m.movement_type === "FLOAT_IN" ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {m.movement_type === "FLOAT_IN" ? "+" : "-"}
                  {formatRupees(m.amount_paise)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
