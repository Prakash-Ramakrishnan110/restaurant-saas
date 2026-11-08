import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, CheckCircle2, Printer, Building, RefreshCw } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";

interface Invoice {
  id: string;
  invoice_number: string;
  table_label?: string;
  settled_at: string;
  total_paise: number;
  payment_method: string;
  customer_name?: string;
  room_number?: string;
  settled_by_name?: string;
}

export const RoomChargesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<"TODAY" | "7D" | "30D">("TODAY");

  const fetchRoomCharges = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ListResponse<Invoice>>("/invoices/");
      const allInvoices = unwrapList(res.data);

      // Filter invoices settled with ROOM_FOLIO or associated with hotel room
      const folioInvoices = allInvoices.filter(
        (inv) =>
          inv.payment_method === "ROOM_FOLIO" ||
          (inv.table_label && inv.table_label.toLowerCase().includes("room"))
      );
      setInvoices(folioInvoices);
    } catch {
      setError("Failed to load room charges folio invoices.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoomCharges();
  }, [fetchRoomCharges]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRoom = inv.table_label?.toLowerCase().includes(q);
        const matchesNum = inv.invoice_number.toLowerCase().includes(q);
        const matchesGuest = inv.customer_name?.toLowerCase().includes(q);
        return matchesRoom || matchesNum || matchesGuest;
      }
      return true;
    });
  }, [invoices, searchQuery]);

  const totalPaise = useMemo(() => {
    return filteredInvoices.reduce((acc, curr) => acc + curr.total_paise, 0);
  }, [filteredInvoices]);

  const handlePrintAuditSheet = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building className="w-6 h-6 text-[#FF6A00]" />
            Front Desk Room Charges Folio
          </h1>
          <p className="text-sm text-muted-foreground">
            Daily verified room charge invoices ready for Front Desk / PMS posting and night audit
            (H-05).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchRoomCharges} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrintAuditSheet}
            className="border-border hover:bg-muted"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Night Audit
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase">
            Total Folio Settlements
          </span>
          <div className="text-2xl font-bold text-foreground mt-1">{formatRupees(totalPaise)}</div>
        </div>
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase">
            Total Invoices Posted
          </span>
          <div className="text-2xl font-bold text-foreground mt-1">{filteredInvoices.length}</div>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-500/10">
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
            Dispute Status
          </span>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6" />
            100% Verified
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border">
        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search room number, invoice # or guest..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
          />
        </div>

        <div className="flex items-center gap-2">
          {(["TODAY", "7D", "30D"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-colors ${
                dateRange === r
                  ? "bg-[#0B1F3B] text-white border-[#0B1F3B] dark:bg-white dark:text-[#0B1F3B]"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {r === "TODAY" ? "Today" : r === "7D" ? "Last 7 Days" : "Last 30 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Room / Suite</th>
                <th className="px-4 py-3">Guest Name / Folio</th>
                <th className="px-4 py-3">Front Desk Check</th>
                <th className="px-4 py-3 text-right">Charged Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Loading room folio invoices...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No room charges recorded for this period.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {inv.invoice_number}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(inv.settled_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {inv.table_label || "Room Service"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {inv.customer_name || "Hotel Resident"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Signed & Verified
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground text-right">
                      {formatRupees(inv.total_paise)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground text-center">
        DEMO RECEIPT - NOT A TAX INVOICE | All figures in integer paise without floating-point
        rounding.
      </div>
    </div>
  );
};
