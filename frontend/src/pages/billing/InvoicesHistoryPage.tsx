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
} from "lucide-react";
import { ordersApi, BillInvoice } from "../../api/orders";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { useAuth } from "../../context/AuthContext";

export const InvoicesHistoryPage: React.FC = () => {
  const { activeTenant } = useAuth();
  const [invoices, setInvoices] = useState<BillInvoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");
  const [reprintInvoice, setReprintInvoice] = useState<BillInvoice | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const res = await ordersApi.getInvoices();
      const raw = (res.data as any)?.results || res.data || [];
      setInvoices(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const invoiceList = Array.isArray(invoices) ? invoices : [];
  const filteredInvoices = invoiceList.filter((inv) => {
    if (methodFilter !== "ALL" && inv.payment_method !== methodFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const numMatch = inv.invoice_number?.toLowerCase().includes(q);
      const tableMatch = inv.table_number?.toLowerCase().includes(q);
      if (!numMatch && !tableMatch) return false;
    }
    return true;
  });

  const handlePrint = () => {
    window.print();
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
            Authoritative settlement records, invoice audits, and 80mm thermal receipt reprints
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

        <div className="relative min-w-[260px]">
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
                  <th className="p-3 text-right">Total Amount</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-mono font-bold text-foreground">
                      {inv.invoice_number}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {inv.created_at
                        ? new Date(inv.created_at).toLocaleString([], {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      {inv.table_number ? (
                        <span className="flex items-center gap-1">
                          <Utensils className="h-3 w-3 text-[#FF6A00]" /> Table {inv.table_number}
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
                      {formatRupees(inv.total_paise)}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                        PAID
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReprintInvoice(inv)}
                        className="text-xs min-h-[36px] font-semibold"
                      >
                        <Printer className="h-3.5 w-3.5 mr-1 text-[#FF6A00]" />
                        Reprint
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                <div className="text-[11px] text-gray-600 font-sans font-bold">
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
                {(reprintInvoice?.items || []).map((it, idx) => (
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
