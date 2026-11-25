import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Printer,
  CreditCard,
  QrCode,
  Banknote,
  RefreshCw,
  Utensils,
  Zap,
  RotateCcw,
} from "lucide-react";
import { ordersApi, BillInvoice, InvoiceRefundRecord } from "../../api/orders";
import { unwrapList } from "../../api/pagination";
import { formatRupees, parseRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { useAuth } from "../../context/AuthContext";
import { dispatchThermalPrint } from "../../utils/thermalPrint";

const REFUND_REASONS = [
  { value: "ITEM_RETURNED", label: "Item Returned by Guest" },
  { value: "QUALITY_ISSUE", label: "Food Quality / Taste Issue" },
  { value: "WRONG_ITEM", label: "Wrong Item Punched / Served" },
  { value: "OVERCHARGED", label: "Billing / Price Overcharge" },
  { value: "CUSTOMER_CANCELLED", label: "Customer Cancelled Item" },
] as const;

function getLocalDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const InvoicesHistoryPage: React.FC = () => {
  const { activeTenant } = useAuth();
  const [invoices, setInvoices] = useState<BillInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString(0));
  const [reprintInvoice, setReprintInvoice] = useState<BillInvoice | null>(null);

  // Stage B: Partial Refund & Bill Adjustment state
  const [refundTarget, setRefundTarget] = useState<BillInvoice | null>(null);
  const [refundRupees, setRefundRupees] = useState<string>("");
  const [refundReason, setRefundReason] =
    useState<(typeof REFUND_REASONS)[number]["value"]>("ITEM_RETURNED");
  const [restockAction, setRestockAction] = useState<"NONE" | "RESTOCK" | "WASTE">("NONE");
  const [refundNotes, setRefundNotes] = useState<string>("");
  const [refundSubmitting, setRefundSubmitting] = useState<boolean>(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [latestRefundSlip, setLatestRefundSlip] = useState<InvoiceRefundRecord | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await ordersApi.getInvoices();
      setInvoices(unwrapList<BillInvoice>(res.data));
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const openRefundDialog = (inv: BillInvoice) => {
    const remainingPaise = Math.max(0, inv.total_paise - (inv.refunded_paise || 0));
    setRefundTarget(inv);
    setRefundRupees(String(Math.trunc(remainingPaise / 100)));
    setRefundReason("ITEM_RETURNED");
    setRestockAction("NONE");
    setRefundNotes("");
    setRefundError(null);
    setLatestRefundSlip(null);
  };

  const handleIssueRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    setRefundError(null);
    const amountPaise = parseRupees(refundRupees);
    const remainingPaise = Math.max(
      0,
      refundTarget.total_paise - (refundTarget.refunded_paise || 0)
    );
    if (amountPaise <= 0) {
      setRefundError("Refund amount must be greater than ₹0.00.");
      return;
    }
    if (amountPaise > remainingPaise) {
      setRefundError(
        `Refund cannot exceed remaining refundable balance (${formatRupees(remainingPaise)}).`
      );
      return;
    }
    setRefundSubmitting(true);
    try {
      const res = await ordersApi.createInvoiceRefund(refundTarget.id, {
        amount_paise: amountPaise,
        reason_code: refundReason,
        refund_method: refundTarget.payment_method,
        restock_action: restockAction,
        notes: refundNotes.trim(),
      });
      setLatestRefundSlip(res.data);
      await fetchInvoices();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Failed to process refund.";
      setRefundError(msg);
    } finally {
      setRefundSubmitting(false);
    }
  };

  const invoiceList = Array.isArray(invoices) ? invoices : [];
  const filteredInvoices = invoiceList.filter((inv) => {
    if (selectedDate && inv.created_at) {
      const d = new Date(inv.created_at);
      const localYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (localYmd !== selectedDate) return false;
    }
    if (methodFilter !== "ALL" && inv.payment_method !== methodFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const numMatch = inv.invoice_number?.toLowerCase().includes(q);
      const tableMatch = (inv.table_number || inv.table_label)?.toLowerCase().includes(q);
      if (!numMatch && !tableMatch) return false;
    }
    return true;
  });

  const handlePrint = () => {
    dispatchThermalPrint({
      slipType: "BILL",
      title: reprintInvoice?.invoice_number || "RECEIPT",
      lines: (reprintInvoice?.items || reprintInvoice?.snapshot_lines || []).map((it) => ({
        left: `${it.quantity}x ${it.item_name}`,
        right: formatRupees(it.subtotal_paise || it.unit_price_paise * it.quantity),
      })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#FF6A00]" />
            Bills & Receipts History
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Authoritative settlement records, partial refund adjustments, and 80mm thermal receipt
            reprints
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchInvoices}
          disabled={loading}
          className="min-h-[40px] text-xs font-semibold self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Bills
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0">
          {["ALL", "CASH", "CARD", "UPI"].map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all min-h-[36px] ${
                methodFilter === m
                  ? "bg-[#0B1F3B] text-white dark:bg-white dark:text-[#0B1F3B] shadow"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {m === "ALL" ? "All Methods" : m}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-input bg-card p-1">
            {[
              { label: "Today", value: getLocalDateString(0) },
              { label: "Yesterday", value: getLocalDateString(-1) },
              { label: "All Dates", value: "" },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedDate(opt.value)}
                className={`px-2.5 py-1 rounded text-xs font-semibold min-h-[32px] transition-colors ${
                  selectedDate === opt.value
                    ? "bg-[#FF6A00] text-[#0B1F3B]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            aria-label="Filter bills by date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-card border border-input rounded-md focus:ring-2 focus:ring-[#FF6A00] outline-none min-h-[40px]"
          />
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search invoice # or table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-card border border-input rounded-md focus:ring-2 focus:ring-[#FF6A00] outline-none min-h-[40px]"
            />
          </div>
        </div>
      </div>

      {/* Invoices Table / List */}
      {loading && invoiceList.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin" />
          Loading invoices history...
        </div>
      ) : filteredInvoices.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-xs border-dashed">
          <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          No invoices found.
        </Card>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3">Invoice Number</th>
                  <th className="p-3">Date & Time</th>
                  <th className="p-3">Destination</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3 text-right">Gross Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.map((inv) => {
                  const refundedPaise = inv.refunded_paise || 0;
                  const netPaise = inv.net_total_paise ?? inv.total_paise - refundedPaise;
                  return (
                    <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 font-mono font-bold text-foreground">
                        {inv.invoice_number}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {inv.created_at || inv.settled_at
                          ? new Date((inv.created_at || inv.settled_at)!).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—"}
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {inv.table_number || (inv.table_label && inv.table_label !== "Counter") ? (
                          <span className="flex items-center gap-1">
                            <Utensils className="h-3 w-3 text-[#FF6A00]" /> Table{" "}
                            {inv.table_number || inv.table_label}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3 text-[#FF6A00]" /> Counter/Takeaway
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold text-[11px] bg-muted text-foreground">
                          {inv.payment_method === "UPI" && (
                            <QrCode className="h-3 w-3 text-purple-600" />
                          )}
                          {inv.payment_method === "CARD" && (
                            <CreditCard className="h-3 w-3 text-blue-600" />
                          )}
                          {inv.payment_method === "CASH" && (
                            <Banknote className="h-3 w-3 text-emerald-600" />
                          )}
                          {inv.payment_method}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-sm text-foreground">
                        <div>{formatRupees(inv.total_paise)}</div>
                        {refundedPaise > 0 && (
                          <div className="text-[10px] font-mono text-amber-600">
                            Refunded: -{formatRupees(refundedPaise)} • Net: {formatRupees(netPaise)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                          {refundedPaise >= inv.total_paise
                            ? "REFUNDED"
                            : refundedPaise > 0
                              ? "PARTIAL REFUND"
                              : "PAID"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {refundedPaise < inv.total_paise && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openRefundDialog(inv)}
                              className="text-xs min-h-[36px] font-semibold"
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1 text-amber-600" />
                              Refund
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReprintInvoice(inv)}
                            className="text-xs min-h-[36px] font-semibold"
                          >
                            <Printer className="h-3.5 w-3.5 mr-1 text-[#FF6A00]" />
                            Reprint
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stage B: Partial Refund & Bill Adjustment Dialog */}
      <Dialog open={!!refundTarget} onOpenChange={(open) => !open && setRefundTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-[#FF6A00]" />
              Partial Refund / Bill Adjustment — {refundTarget?.invoice_number}
            </DialogTitle>
          </DialogHeader>

          {!latestRefundSlip ? (
            <form onSubmit={handleIssueRefund} className="space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Bill Total (Immutable):</span>
                  <span className="font-mono font-bold">
                    {formatRupees(refundTarget?.total_paise || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Refunded:</span>
                  <span className="font-mono font-semibold text-amber-600">
                    {formatRupees(refundTarget?.refunded_paise || 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border/60 font-bold">
                  <span>Remaining Refundable Balance:</span>
                  <span className="font-mono text-emerald-600">
                    {formatRupees(
                      Math.max(
                        0,
                        (refundTarget?.total_paise || 0) - (refundTarget?.refunded_paise || 0)
                      )
                    )}
                  </span>
                </div>
              </div>

              {refundError && (
                <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive font-semibold">
                  {refundError}
                </div>
              )}

              {/* Quick Line-Item Pickers if snapshot_lines / items exist */}
              {(refundTarget?.snapshot_lines || refundTarget?.items || []).length > 0 && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-muted-foreground">
                    Quick Select Line Item Amount
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(refundTarget?.snapshot_lines || refundTarget?.items || []).map((line, i) => {
                      const linePaise =
                        line.subtotal_paise || line.unit_price_paise * line.quantity;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setRefundRupees(String(linePaise / 100))}
                          className="px-2.5 py-1 rounded border border-border bg-card hover:border-[#FF6A00] text-[11px] font-medium"
                        >
                          {line.item_name} ({formatRupees(linePaise)})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="font-semibold text-foreground">Refund Amount (₹)</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={refundRupees}
                  onChange={(e) => setRefundRupees(e.target.value)}
                  className="h-9 mt-1 font-mono font-bold"
                />
                {parseRupees(refundRupees) > 50000 && (
                  <p className="text-[11px] text-amber-600 font-semibold mt-1">
                    Note: Refunds above ₹500.00 require Owner or Branch Manager authorization.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-foreground">Compulsory Reason Code</label>
                  <select
                    aria-label="Refund Reason Code"
                    value={refundReason}
                    onChange={(e) =>
                      setRefundReason(e.target.value as (typeof REFUND_REASONS)[number]["value"])
                    }
                    className="w-full h-9 mt-1 px-2 text-xs rounded-md border border-input bg-background"
                  >
                    {REFUND_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground">Inventory Action</label>
                  <select
                    aria-label="Inventory Restock Action"
                    value={restockAction}
                    onChange={(e) =>
                      setRestockAction(e.target.value as "NONE" | "RESTOCK" | "WASTE")
                    }
                    className="w-full h-9 mt-1 px-2 text-xs rounded-md border border-input bg-background"
                  >
                    <option value="NONE">No Stock Change</option>
                    <option value="RESTOCK">Return Unopened to Stock</option>
                    <option value="WASTE">Log Spoiled / Kitchen Waste</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground">Audit Notes</label>
                <Input
                  type="text"
                  placeholder="Optional details for audit log..."
                  value={refundNotes}
                  onChange={(e) => setRefundNotes(e.target.value)}
                  className="h-9 mt-1 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRefundTarget(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={refundSubmitting}
                  className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-xs"
                >
                  {refundSubmitting ? "Processing..." : "Confirm Append-Only Refund"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="w-full max-w-[80mm] mx-auto border-2 border-dashed border-gray-300 bg-white text-black p-4 font-mono space-y-2">
                <div className="text-center border-b border-gray-300 pb-2">
                  <div className="font-black text-sm uppercase">
                    {activeTenant?.tenant_name || "ServeMyFood"}
                  </div>
                  <div className="text-xs font-bold">REFUND SLIP - INTERNAL RECORD</div>
                  <div className="text-[10px] text-gray-600">{latestRefundSlip.refund_number}</div>
                  <div className="text-[10px] text-gray-600">
                    Ref Bill: {refundTarget?.invoice_number}
                  </div>
                </div>
                <div className="space-y-1 py-2 border-b border-gray-300">
                  <div className="flex justify-between">
                    <span>Reason:</span>
                    <span className="font-bold">{latestRefundSlip.reason_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Method:</span>
                    <span className="font-bold">{latestRefundSlip.refund_method}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black pt-1">
                    <span>REFUND AMOUNT:</span>
                    <span>{formatRupees(latestRefundSlip.amount_paise)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => setRefundTarget(null)}
                >
                  Close
                </Button>
                <Button
                  className="flex-1 bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-xs"
                  onClick={() =>
                    dispatchThermalPrint({
                      slipType: "REFUND",
                      title: latestRefundSlip.refund_number,
                      lines: [
                        {
                          left: `Ref Bill ${refundTarget?.invoice_number}`,
                          right: formatRupees(latestRefundSlip.amount_paise),
                          bold: true,
                        },
                      ],
                    })
                  }
                >
                  <Printer className="h-3.5 w-3.5 mr-1" /> Print Refund Slip
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 80mm Thermal Receipt Reprint Dialog */}
      <Dialog open={!!reprintInvoice} onOpenChange={(open) => !open && setReprintInvoice(null)}>
        <DialogContent className="sm:max-w-md bg-white text-black p-0 border-none shadow-2xl">
          <div className="p-6 bg-white text-black font-mono text-xs max-h-[85vh] overflow-y-auto">
            {/* 80mm Thermal Receipt Paper */}
            <div className="w-full max-w-[80mm] mx-auto border-2 border-dashed border-gray-300 p-4 space-y-4">
              <div className="text-center space-y-1 border-b border-gray-300 pb-3">
                <div className="font-black text-base uppercase tracking-wider">
                  {activeTenant?.tenant_name || "ServeMyFood Restaurant"}
                </div>
                <div className="text-xs text-gray-600 font-sans font-bold">
                  DEMO RECEIPT - NOT A TAX INVOICE
                </div>
                <div className="text-[10px] text-gray-500">{reprintInvoice?.invoice_number}</div>
                <div className="text-[10px] text-gray-500">
                  {reprintInvoice?.created_at &&
                    new Date(reprintInvoice.created_at).toLocaleString()}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 border-b border-gray-300 pb-3">
                <div className="flex justify-between font-bold text-[11px] border-b border-gray-200 pb-1">
                  <span>ITEM</span>
                  <span>QTY</span>
                  <span>PRICE</span>
                </div>
                {(reprintInvoice?.items || reprintInvoice?.snapshot_lines || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[120px]">{it.item_name}</span>
                    <span>{it.quantity}</span>
                    <span>
                      {formatRupees(it.subtotal_paise || it.unit_price_paise * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Authoritative Total */}
              <div className="space-y-1 border-b border-gray-300 pb-3">
                <div className="flex justify-between font-bold text-sm">
                  <span>TOTAL PAID</span>
                  <span>{formatRupees(reprintInvoice?.total_paise || 0)}</span>
                </div>
                {(reprintInvoice?.refunded_paise || 0) > 0 && (
                  <div className="flex justify-between text-[11px] text-gray-700">
                    <span>LESS REFUNDS:</span>
                    <span>-{formatRupees(reprintInvoice?.refunded_paise || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>Payment Method:</span>
                  <span className="font-bold">{reprintInvoice?.payment_method}</span>
                </div>
              </div>

              <div className="text-center text-[10px] text-gray-500 space-y-0.5 pt-1">
                <div>Thank you for dining with us!</div>
                <div>ServeMyFood Cloud POS</div>
              </div>
            </div>

            {/* Print & Close Buttons */}
            <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200 no-print font-sans">
              <Button
                variant="outline"
                onClick={() => setReprintInvoice(null)}
                className="flex-1 min-h-[44px] text-xs font-semibold"
              >
                Close
              </Button>
              <Button
                onClick={handlePrint}
                className="flex-1 min-h-[44px] text-xs font-bold bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B]"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Print 80mm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
