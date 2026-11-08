import React, { useState, useEffect } from "react";
import { ShieldCheck, Printer, CheckCircle2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ordersApi, BillInvoice } from "../../api/orders";
import { unwrapList } from "../../api/pagination";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { formatRupees, parseRupees } from "../../utils/currency";

export interface ShiftCloseoutRecord {
  timestamp: string;
  cashier: string;
  opening_cash_paise: number;
  cash_sales_paise: number;
  expected_cash_paise: number;
  actual_cash_paise: number;
  variance_paise: number;
  upi_total_paise: number;
  card_total_paise: number;
  total_shift_paise: number;
  invoices_count: number;
}

export const ShiftCloseoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeTenant } = useAuth();

  const [openingCash, setOpeningCash] = useState<string>("2000");
  const [actualCash, setActualCash] = useState<string>("");
  const [invoices, setInvoices] = useState<BillInvoice[]>([]);
  const [closeoutResult, setCloseoutResult] = useState<ShiftCloseoutRecord | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    ordersApi
      .getInvoices()
      .then((res) => {
        setInvoices(unwrapList<BillInvoice>(res.data));
      })
      .catch(() => setInvoices([]));
  }, [activeTenant?.tenant_id]);

  const invoiceList = Array.isArray(invoices) ? invoices : [];

  // Aggregate today's settlements
  const cashTotal = invoiceList
    .filter((inv) => inv.payment_method === "CASH")
    .reduce((sum, inv) => sum + inv.total_paise, 0);

  const upiTotal = invoiceList
    .filter((inv) => inv.payment_method === "UPI")
    .reduce((sum, inv) => sum + inv.total_paise, 0);

  const cardTotal = invoiceList
    .filter((inv) => inv.payment_method === "CARD")
    .reduce((sum, inv) => sum + inv.total_paise, 0);

  const openingPaise = parseRupees(openingCash);
  const expectedCashTotal = openingPaise + cashTotal;

  const handlePerformCloseout = () => {
    setSubmitting(true);
    const countedPaise = parseRupees(actualCash);
    const variancePaise = countedPaise - expectedCashTotal;

    setCloseoutResult({
      timestamp: new Date().toLocaleString(),
      cashier: user?.full_name || "Cashier",
      opening_cash_paise: openingPaise,
      cash_sales_paise: cashTotal,
      expected_cash_paise: expectedCashTotal,
      actual_cash_paise: countedPaise,
      variance_paise: variancePaise,
      upi_total_paise: upiTotal,
      card_total_paise: cardTotal,
      total_shift_paise: cashTotal + upiTotal + cardTotal,
      invoices_count: invoices.length,
    });
    setSubmitting(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 font-sans">
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

        <Badge variant="outline" className="text-xs font-bold">
          {invoices.length} Invoices Today
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blind Count Form */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <h2 className="text-sm font-extrabold text-foreground uppercase tracking-wider">
            Cash Drawer Blind Count
          </h2>
          <p className="text-xs text-muted-foreground">
            Count the physical currency notes and coins in the register. Enter the total amount
            below.
          </p>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground">Opening Float Cash (₹)</label>
              <Input
                type="number"
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
                placeholder="Enter counted cash..."
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="h-10 mt-1 font-mono font-bold text-base text-[#FF6A00]"
              />
            </div>
          </div>

          <Button
            className="w-full h-11 bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white font-bold text-sm gap-2 mt-4"
            disabled={!actualCash || submitting}
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
                onClick={() => window.print()}
                className="h-7 text-xs gap-1"
              >
                <Printer className="h-3.5 w-3.5" /> Print Z-Report
              </Button>
            )}
          </div>

          {!closeoutResult ? (
            <div className="h-48 flex items-center justify-center text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              Enter your counted cash and tap Reconcile to generate the Z-Report.
            </div>
          ) : (
            <div className="space-y-3 text-xs p-4 bg-muted/30 rounded-xl border border-border/80">
              <div className="flex justify-between py-1 border-b border-border/60">
                <span className="text-muted-foreground">Cashier:</span>
                <span className="font-bold">{closeoutResult.cashier}</span>
              </div>
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
                  className={`font-mono font-extrabold ${closeoutResult.variance_paise === 0 ? "text-emerald-600" : "text-destructive"}`}
                >
                  {formatRupees(closeoutResult.variance_paise)}
                </span>
              </div>
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
    </div>
  );
};
