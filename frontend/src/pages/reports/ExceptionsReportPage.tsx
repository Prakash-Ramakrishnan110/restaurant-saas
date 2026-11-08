import React, { useState, useEffect, useCallback } from "react";
import { AlertOctagon, Percent, XCircle, Printer, RefreshCw } from "lucide-react";
import { apiClient } from "../../api/client";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";

interface DiscountItem {
  id: string;
  invoice_number: string;
  discount_paise: number;
  total_paise: number;
  settled_by_name: string;
  settled_at: string;
}

interface CancellationItem {
  id: string;
  order_number: string;
  placed_at: string;
  cancelled_at: string;
  reason: string;
  items_count: number;
  total_paise: number;
}

interface ReprintItem {
  id: string;
  actor: string;
  timestamp: string;
  notes: string;
}

interface ExceptionsReportData {
  start_date: string;
  end_date: string;
  total_discount_paise: number;
  discounted_invoices_count: number;
  cancelled_orders_count: number;
  reprints_count: number;
  discounts: DiscountItem[];
  cancellations: CancellationItem[];
  reprints: ReprintItem[];
}

export const ExceptionsReportPage: React.FC = () => {
  const [data, setData] = useState<ExceptionsReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"discounts" | "cancellations" | "reprints">(
    "discounts"
  );
  const [datePreset, setDatePreset] = useState<"TODAY" | "7D" | "30D">("7D");

  const fetchExceptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const now = new Date();
    const endStr = now.toISOString().split("T")[0];
    let daysAgo = 6;
    if (datePreset === "TODAY") daysAgo = 0;
    if (datePreset === "30D") daysAgo = 29;

    const startDateObj = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const startStr = startDateObj.toISOString().split("T")[0];

    try {
      const res = await apiClient.get<ExceptionsReportData>("/reports/exceptions/", {
        params: { start_date: startStr, end_date: endStr },
      });
      setData(res.data);
    } catch {
      setError("Failed to load exceptions audit report.");
    } finally {
      setIsLoading(false);
    }
  }, [datePreset]);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-[#FF6A00]" />
            Operational Exceptions Audit
          </h1>
          <p className="text-sm text-muted-foreground">
            Audit discounts, cancelled / voided orders, and receipt reprints to stop revenue leaks
            (H-01).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchExceptions} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Date Preset Selector */}
      <div className="flex items-center gap-2">
        {(["TODAY", "7D", "30D"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setDatePreset(p)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              datePreset === p
                ? "bg-[#0B1F3B] text-white border-[#0B1F3B] dark:bg-white dark:text-[#0B1F3B]"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {p === "TODAY" ? "Today" : p === "7D" ? "Last 7 Days" : "Last 30 Days"}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            <Percent className="w-4 h-4 text-[#FF6A00]" />
            Total Discounts
          </span>
          <div className="text-2xl font-bold text-foreground mt-1">
            {formatRupees(data?.total_discount_paise || 0)}
          </div>
          <span className="text-[11px] text-muted-foreground">
            Across {data?.discounted_invoices_count || 0} invoices
          </span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-red-500" />
            Voided / Cancelled
          </span>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
            {data?.cancelled_orders_count || 0}
          </div>
          <span className="text-[11px] text-muted-foreground">Orders voided</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
            <Printer className="w-4 h-4 text-blue-500" />
            Receipt Reprints
          </span>
          <div className="text-2xl font-bold text-foreground mt-1">{data?.reprints_count || 0}</div>
          <span className="text-[11px] text-muted-foreground">Duplicate prints</span>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <span className="text-xs font-semibold text-muted-foreground uppercase">
            Audit Integrity
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            100% Logged
          </div>
          <span className="text-[11px] text-muted-foreground">Tamper-evident log</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("discounts")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "discounts"
              ? "border-[#FF6A00] text-[#FF6A00]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Discounts Applied ({data?.discounts.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("cancellations")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "cancellations"
              ? "border-[#FF6A00] text-[#FF6A00]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Cancelled / Voided Orders ({data?.cancellations.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("reprints")}
          className={`pb-3 px-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "reprints"
              ? "border-[#FF6A00] text-[#FF6A00]"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Reprint Events ({data?.reprints.length || 0})
        </button>
      </div>

      {/* Tab Content */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        {activeTab === "discounts" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Settled By</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3 text-right">Discount Given</th>
                  <th className="px-4 py-3 text-right">Settled Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Loading discount exceptions...
                    </td>
                  </tr>
                ) : !data?.discounts || data.discounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No discounts given during this period. Zero discount leakage detected.
                    </td>
                  </tr>
                ) : (
                  data.discounts.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {d.invoice_number}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {d.settled_by_name}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(d.settled_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400 text-right">
                        {formatRupees(d.discount_paise)}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground text-right">
                        {formatRupees(d.total_paise)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "cancellations" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Order #</th>
                  <th className="px-4 py-3">Placed At</th>
                  <th className="px-4 py-3">Cancelled At</th>
                  <th className="px-4 py-3">Reason Provided</th>
                  <th className="px-4 py-3 text-right">Lost Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Loading cancellations...
                    </td>
                  </tr>
                ) : !data?.cancellations || data.cancellations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No cancelled orders found. Clean operational run!
                    </td>
                  </tr>
                ) : (
                  data.cancellations.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold text-foreground">{c.order_number}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(c.placed_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(c.cancelled_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">{c.reason}</td>
                      <td className="px-4 py-3 font-bold text-red-600 dark:text-red-400 text-right">
                        {formatRupees(c.total_paise)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "reprints" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Actor / Staff</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Reprint Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      Loading reprints...
                    </td>
                  </tr>
                ) : !data?.reprints || data.reprints.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      No receipt reprints logged during this period.
                    </td>
                  </tr>
                ) : (
                  data.reprints.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold text-foreground">{r.actor}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground font-medium">{r.notes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
