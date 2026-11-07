import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Receipt,
  CreditCard,
  QrCode,
  Banknote,
  Users,
  Printer,
  Split,
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

export const BillingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeTenant } = useAuth();

  // Sessions and Active Selection
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [billData, setBillData] = useState<BillCalculation | null>(null);
  const [settling, setSettling] = useState<boolean>(false);

  // Settlement Form
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "UPI" | "CARD" | "ROOM_FOLIO" | "SPLIT"
  >("CASH");
  const [amountTendered, setAmountTendered] = useState<string>("");
  const [discountPaise] = useState<number>(0);
  const [notes] = useState<string>("");

  // Bill Splitter
  const [splitMode, setSplitMode] = useState<"SINGLE" | "EQUAL" | "MULTI_TENDER">("SINGLE");
  const [splitCount, setSplitCount] = useState<number>(2);
  const [cashPart, setCashPart] = useState<string>("");
  const [upiPart, setUpiPart] = useState<string>("");

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
      setAmountTendered((res.data.total_paise / 100).toFixed(2));
      setCashPart((res.data.total_paise / 2 / 100).toFixed(2));
      setUpiPart((res.data.total_paise / 2 / 100).toFixed(2));
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
  const tenderedPaise = Math.round((parseFloat(amountTendered) || 0) * 100);
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
        notes:
          splitMode === "MULTI_TENDER"
            ? `Split Tender: ₹${cashPart} Cash + ₹${upiPart} UPI`
            : notes,
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
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background font-sans overflow-hidden">
      {/* Top Header */}
      <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-[#FF6A00]" />
          <div>
            <h1 className="text-lg font-extrabold font-heading text-foreground">
              Cashier POS & Bill Settlement
            </h1>
            <p className="text-xs text-muted-foreground">
              Table checkout, GST tax invoices, split billing, and thermal printing.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="text-xs font-semibold gap-1.5"
          onClick={() => navigate("/billing/closeout")}
        >
          <ShieldCheck className="h-4 w-4 text-emerald-600" /> Daily Shift Closeout (Z-Report)
        </Button>
      </div>

      {errorMessage && (
        <div className="bg-destructive/15 text-destructive px-4 py-2 text-xs font-semibold border-b border-destructive/20 flex justify-between items-center">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)}>×</button>
        </div>
      )}

      {/* 2-Column Split Layout */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* Left: Active Tables List (4 of 12 cols) */}
        <div className="col-span-12 md:col-span-4 border-r border-border bg-card/40 p-4 flex flex-col h-full overflow-hidden">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
            Active Tables ({sessions.length})
          </h2>

          <div className="flex-1 overflow-y-auto pt-3 space-y-2 pr-1">
            {sessions.length === 0 ? (
              <div className="text-center p-8 text-xs text-muted-foreground">
                No active dining sessions awaiting checkout.
              </div>
            ) : (
              sessions.map((sess) => {
                const isSelected = selectedSessionId === sess.id;
                const tblLabel = sess.table?.label ? `Table ${sess.table.label}` : "Counter";
                return (
                  <button
                    key={sess.id}
                    onClick={() => handleSelectSession(sess.id)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? "border-[#FF6A00] ring-2 ring-[#FF6A00]/20 bg-orange-50/50 dark:bg-orange-950/20"
                        : "border-border bg-card hover:border-[#FF6A00]/40"
                    }`}
                  >
                    <div>
                      <span className="font-heading font-extrabold text-sm text-foreground">
                        {tblLabel}
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Code: {sess.session_code} • {sess.guest_count} guests
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Bill Calculation & Settlement Terminal (8 of 12 cols) */}
        <div className="col-span-12 md:col-span-8 p-6 flex flex-col h-full overflow-y-auto bg-background">
          {!billData ? (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground">
              Select an active table session on the left to calculate and settle the bill.
            </div>
          ) : (
            <div className="max-w-2xl mx-auto w-full space-y-6">
              {/* Table Bill Summary Card */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase">
                      Dining Tab
                    </span>
                    <h2 className="text-xl font-extrabold font-heading text-foreground">
                      Table {billData.table_label}
                    </h2>
                  </div>
                  <Badge variant="secondary" className="text-xs px-2 py-0.5 font-bold">
                    {billData.items_count} items
                  </Badge>
                </div>

                {/* Itemized Order Lines */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-2">
                  {billData.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#FF6A00]">{it.quantity}×</span>
                        <span className="font-semibold text-foreground">{it.item_name}</span>
                      </div>
                      <span className="font-extrabold font-mono text-foreground">
                        ₹{(it.subtotal_paise / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Financial Summary */}
                <div className="pt-3 border-t border-border space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Net Subtotal:</span>
                    <span className="font-mono">
                      ₹{(billData.net_subtotal_paise / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST (2.5%):</span>
                    <span className="font-mono">₹{(billData.cgst_paise / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST (2.5%):</span>
                    <span className="font-mono">₹{(billData.sgst_paise / 100).toFixed(2)}</span>
                  </div>
                  {discountPaise > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Discount:</span>
                      <span className="font-mono">-₹{(discountPaise / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-foreground pt-2 border-t border-border">
                    <span>Grand Total:</span>
                    <span className="font-mono text-xl text-[#FF6A00]">
                      ₹{(grandTotalPaise / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bill Splitter Mode Controls */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Split className="h-3.5 w-3.5" /> Billing Mode
                  </span>
                  <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/30">
                    <button
                      type="button"
                      onClick={() => setSplitMode("SINGLE")}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        splitMode === "SINGLE" ? "bg-[#0A192F] text-white" : "text-muted-foreground"
                      }`}
                    >
                      Single Payer
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode("EQUAL")}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        splitMode === "EQUAL" ? "bg-[#0A192F] text-white" : "text-muted-foreground"
                      }`}
                    >
                      Split Equally
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode("MULTI_TENDER")}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        splitMode === "MULTI_TENDER"
                          ? "bg-[#0A192F] text-white"
                          : "text-muted-foreground"
                      }`}
                    >
                      Cash + UPI Split
                    </button>
                  </div>
                </div>

                {splitMode === "EQUAL" && (
                  <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#FF6A00]" />
                      <span>Divide across guests:</span>
                      <input
                        type="number"
                        min={2}
                        max={20}
                        value={splitCount}
                        onChange={(e) => setSplitCount(Math.max(2, parseInt(e.target.value) || 2))}
                        className="w-14 h-7 text-center rounded border border-input text-xs font-bold bg-card"
                      />
                    </div>
                    <div className="font-extrabold text-sm text-[#FF6A00]">
                      ₹{(grandTotalPaise / splitCount / 100).toFixed(2)} per person
                    </div>
                  </div>
                )}

                {splitMode === "MULTI_TENDER" && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground">
                        Cash Portion (₹)
                      </label>
                      <Input
                        type="number"
                        value={cashPart}
                        onChange={(e) => setCashPart(e.target.value)}
                        className="h-8 text-xs font-mono mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-muted-foreground">
                        UPI Portion (₹)
                      </label>
                      <Input
                        type="number"
                        value={upiPart}
                        onChange={(e) => setUpiPart(e.target.value)}
                        className="h-8 text-xs font-mono mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <span className="text-xs font-bold text-muted-foreground uppercase">
                  Payment Method
                </span>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "CASH", label: "Cash", icon: Banknote },
                    { id: "UPI", label: "UPI QR", icon: QrCode },
                    { id: "CARD", label: "Card", icon: CreditCard },
                  ].map((pm) => {
                    const Icon = pm.icon;
                    const isSelected = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id as any)}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                          isSelected
                            ? "border-[#FF6A00] ring-2 ring-[#FF6A00]/20 bg-orange-50/40 text-[#FF6A00]"
                            : "border-border bg-card text-foreground hover:border-[#FF6A00]/40"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-bold">{pm.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Cash Tender Calculation */}
                {paymentMethod === "CASH" && (
                  <div className="p-3 bg-muted/30 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted-foreground">Cash Tendered:</span>
                      <div className="w-40">
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={amountTendered}
                          onChange={(e) => setAmountTendered(e.target.value)}
                          className="h-8 text-right font-mono font-bold text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between font-bold pt-1 border-t border-border">
                      <span className="text-muted-foreground">Change Due to Guest:</span>
                      <span className="font-mono text-sm text-emerald-600 font-extrabold">
                        ₹{(changeDuePaise / 100).toFixed(2)}
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
                    : `Settle & Print Tax Invoice (₹${(grandTotalPaise / 100).toFixed(2)})`}
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
            <DialogTitle>Tax Invoice {settledInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="p-4 bg-white text-black font-mono text-xs rounded-lg border border-border/80 space-y-2 select-all shadow-inner print:shadow-none">
            <div className="text-center pb-2 border-b border-dashed border-gray-400">
              <h2 className="font-black text-sm uppercase">
                {activeTenant?.tenant_name || "ServeMyFood"}
              </h2>
              <p className="text-[10px] text-gray-600">GST Tax Invoice</p>
              <p className="text-[10px] text-gray-500">Invoice: {settledInvoice?.invoice_number}</p>
              <p className="text-[10px] text-gray-500">
                Table: {settledInvoice?.table_label} • {new Date().toLocaleTimeString()}
              </p>
            </div>

            <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
              {billData?.items.map((it, i) => (
                <div key={i} className="flex justify-between text-[11px]">
                  <span>
                    {it.quantity}x {it.item_name}
                  </span>
                  <span>₹{(it.subtotal_paise / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="py-1 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>
                  ₹
                  {(settledInvoice?.subtotal_paise
                    ? settledInvoice.subtotal_paise / 100
                    : 0
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>CGST (2.5%):</span>
                <span>
                  ₹{(settledInvoice?.cgst_paise ? settledInvoice.cgst_paise / 100 : 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>SGST (2.5%):</span>
                <span>
                  ₹{(settledInvoice?.sgst_paise ? settledInvoice.sgst_paise / 100 : 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-black text-sm pt-1 border-t border-black">
                <span>NET TOTAL:</span>
                <span>
                  ₹{(settledInvoice?.total_paise ? settledInvoice.total_paise / 100 : 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-600 pt-1">
                <span>Paid via {settledInvoice?.payment_method}:</span>
                <span>
                  ₹
                  {(settledInvoice?.amount_tendered_paise
                    ? settledInvoice.amount_tendered_paise / 100
                    : 0
                  ).toFixed(2)}
                </span>
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
