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
} from "lucide-react";
import { apiClient } from "../../api/client";
import { ordersApi, BillCalculation, BillInvoice } from "../../api/orders";
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

export const BillingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeTenant } = useAuth();

  // Sessions and Active Selection
  const [sessions, setSessions] = useState<any[]>([]);
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

  // Error / Success
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!activeTenant) return;
    try {
      const res = await apiClient.get<any>("/sessions/");
      const openSessions = (res.data?.results || res.data || []).filter(
        (s: any) => s.status === "OPEN"
      );
      setSessions(openSessions);

      const targetId =
        searchParams.get("session_id") || (openSessions.length > 0 ? openSessions[0].id : null);
      if (targetId) {
        setSelectedSessionId(targetId);
        loadSessionBill(targetId);
      }
    } catch {
      setErrorMessage("Failed to load active dining sessions.");
    }
  };

  const loadSessionBill = async (sessionId: string) => {
    try {
      const res = await ordersApi.getSessionBill(sessionId);
      setBillData(res.data);
      const wholeRupees = Math.trunc(res.data.total_paise / 100);
      setAmountTendered(String(wholeRupees));
    } catch {
      setErrorMessage("Could not calculate bill for this session.");
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

  const grandTotalPaise = Math.max(0, (billData?.total_paise || 0) - discountPaise);
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
        notes: notes || "",
      });

      setSettledInvoice(res.data);
      setReceiptModalOpen(true);
      await fetchSessions();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Failed to settle bill.");
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
            Table checkout, bill settlement, and thermal receipts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => navigate("/orders/floor")}
          >
            Floor POS
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

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Dining Sessions (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Active Dining Sessions ({sessions.length})
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchSessions}>
              Refresh
            </Button>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-border rounded-xl bg-card/40 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-xs font-semibold">No active dining sessions.</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  Open a table session in Floor POS to generate bills.
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
                          {sess.table ? `Table ${sess.table.label}` : "Direct Counter"}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                          {sess.session_code}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Party of {sess.party_size || 2} • {sess.orders_count || 0} order(s)
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 ${
                        isSelected ? "text-[#FF6A00]" : "text-muted-foreground/40"
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
              <p className="text-sm font-semibold">Select a dining session to begin checkout.</p>
              <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
                Totals and line items are authoritative server calculations.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Bill Card */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <span className="text-[11px] uppercase font-bold text-muted-foreground">
                      Session Bill
                    </span>
                    <h2 className="text-lg font-black font-heading text-foreground">
                      {billData.table_label !== "N/A"
                        ? `Table ${billData.table_label}`
                        : "Counter Checkout"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-md font-bold">
                    <ShieldCheck className="h-3.5 w-3.5" /> Server Calculated
                  </div>
                </div>

                {/* Itemized Order Lines */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
                  {(billData?.items || []).map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#FF6A00]">{it.quantity}×</span>
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
                  {discountPaise > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Discount:</span>
                      <span className="font-mono">-{formatRupees(discountPaise)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-foreground pt-2 border-t border-border">
                    <span>Grand Total:</span>
                    <span className="font-mono text-xl text-[#FF6A00]">
                      {formatRupees(grandTotalPaise)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Settlement Form */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Payment Method
                </span>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "CASH", label: "Cash", icon: Banknote },
                    { id: "UPI", label: "UPI QR", icon: QrCode },
                    { id: "CARD", label: "Card", icon: CreditCard },
                  ].map((m) => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
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
                  className="w-full min-h-[50px] text-base font-extrabold bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white gap-2 shadow-sm"
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
              <p className="text-[10px] text-gray-600 font-bold">
                DEMO RECEIPT - NOT A TAX INVOICE
              </p>
              <p className="text-[10px] text-gray-500">Invoice: {settledInvoice?.invoice_number}</p>
              <p className="text-[10px] text-gray-500">
                Table: {settledInvoice?.table_label} • {new Date().toLocaleTimeString()}
              </p>
            </div>

            <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
              {(billData?.items || settledInvoice?.items || []).map((it: any, i: number) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span>
                    {it.quantity}x {it.item_name}
                  </span>
                  <span>
                    {formatRupees(it.subtotal_paise || it.unit_price_paise * it.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="py-1 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatRupees(settledInvoice?.subtotal_paise || 0)}</span>
              </div>
              <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
                <span>NET TOTAL:</span>
                <span>{formatRupees(settledInvoice?.total_paise || 0)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-600 pt-1">
                <span>Paid via {settledInvoice?.payment_method}:</span>
                <span>{formatRupees(settledInvoice?.amount_tendered_paise || 0)}</span>
              </div>
            </div>

            <div className="text-center pt-2 border-t border-dashed border-gray-400 text-[10px] text-gray-600">
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
    </div>
  );
};
