import React, { useState, useEffect, useCallback, useMemo } from "react";
import { GitBranch, RefreshCw, ArrowRightLeft, Plus, Send, CheckCircle2 } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";

interface OutletMetric {
  branch_id: string;
  name: string;
  venue_profile: string;
  orders_count?: number;
  invoices_count: number;
  total_sales_paise: number;
  gross_sales_paise?: number;
  refunds_paise?: number;
  net_sales_paise?: number;
  cogs_paise?: number;
  gross_margin_paise?: number;
  gross_margin_percent?: number;
  wastage_paise?: number;
  average_ticket_paise: number;
}

interface OutletReportTotals {
  orders_count: number;
  invoices_count: number;
  gross_sales_paise: number;
  refunds_paise: number;
  net_sales_paise: number;
  cogs_paise: number;
  gross_margin_paise: number;
  gross_margin_percent: number;
  wastage_paise: number;
}

interface OutletReportData {
  start_date: string;
  end_date: string;
  totals?: OutletReportTotals;
  outlets: OutletMetric[];
}

interface BranchOption {
  id: string;
  name: string;
}

interface InventoryItemOption {
  id: string;
  name: string;
  base_unit: string;
}

interface StockTransferRecord {
  id: string;
  from_branch: string;
  from_branch_name: string;
  to_branch: string;
  to_branch_name: string;
  status: "DRAFT" | "APPROVED" | "COMPLETED" | "CANCELLED";
  notes: string;
  created_at: string;
  lines: Array<{
    id: string;
    item: string;
    item_name: string;
    base_unit: string;
    quantity: string;
  }>;
}

export const OutletComparisonPage: React.FC = () => {
  const [data, setData] = useState<OutletReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<"TODAY" | "7D" | "30D">("7D");

  // Stage D1: Inter-Branch Stock Transfers state
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([]);
  const [transfers, setTransfers] = useState<StockTransferRecord[]>([]);
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [transferQty, setTransferQty] = useState("5");
  const [transferNotes, setTransferNotes] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  const fetchOutletsAndTransfers = useCallback(async () => {
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
      const [repRes, branchRes, itemRes, trfRes] = await Promise.all([
        apiClient.get<OutletReportData>("/reports/outlets/", {
          params: { start_date: startStr, end_date: endStr },
        }),
        apiClient
          .get<ListResponse<BranchOption> | BranchOption[]>("/branches/")
          .catch(() => ({ data: [] })),
        apiClient
          .get<ListResponse<InventoryItemOption> | InventoryItemOption[]>("/inventory/items/")
          .catch(() => ({ data: [] })),
        apiClient
          .get<ListResponse<StockTransferRecord> | StockTransferRecord[]>("/inventory/transfers/")
          .catch(() => ({ data: [] })),
      ]);

      setData(repRes.data);
      const branchList = unwrapList<BranchOption>(branchRes.data);
      const itemList = unwrapList<InventoryItemOption>(itemRes.data);
      const transferList = unwrapList<StockTransferRecord>(trfRes.data);

      setBranches(branchList);
      setInventoryItems(itemList);
      setTransfers(transferList);

      if (branchList.length >= 2) {
        setFromBranchId((prev) => prev || branchList[0].id);
        setToBranchId((prev) => prev || branchList[1].id);
      } else if (branchList.length === 1) {
        setFromBranchId((prev) => prev || branchList[0].id);
      }
      if (itemList.length > 0) {
        setSelectedItemId((prev) => prev || itemList[0].id);
      }
    } catch {
      setError("Failed to load outlet comparison report.");
    } finally {
      setIsLoading(false);
    }
  }, [datePreset]);

  useEffect(() => {
    void fetchOutletsAndTransfers();
  }, [fetchOutletsAndTransfers]);

  const totalRevenuePaise = useMemo(() => {
    if (!data?.outlets) return 0;
    return data.outlets.reduce(
      (acc, curr) => acc + (curr.net_sales_paise ?? curr.total_sales_paise),
      0
    );
  }, [data]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromBranchId || !toBranchId || !selectedItemId) return;
    setTransferBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.post("/inventory/transfers/", {
        from_branch: fromBranchId,
        to_branch: toBranchId,
        notes: transferNotes.trim() || "Inter-branch stock rebalance",
        lines: [
          {
            item: selectedItemId,
            quantity: transferQty,
          },
        ],
      });
      setNotice("Inter-branch stock transfer created in DRAFT status.");
      setTransferNotes("");
      await fetchOutletsAndTransfers();
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          "Could not create stock transfer."
      );
    } finally {
      setTransferBusy(false);
    }
  };

  const handleDispatchTransfer = async (transferId: string) => {
    setTransferBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.post(`/inventory/transfers/${transferId}/dispatch/`);
      setNotice("Stock transfer dispatched (TRANSFER_OUT posted on source branch).");
      await fetchOutletsAndTransfers();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not dispatch stock transfer.");
    } finally {
      setTransferBusy(false);
    }
  };

  const handleReceiveTransfer = async (transferId: string) => {
    setTransferBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiClient.post(`/inventory/transfers/${transferId}/receive/`);
      setNotice("Stock transfer received (TRANSFER_IN posted & destination WAC updated).");
      await fetchOutletsAndTransfers();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not receive stock transfer.");
    } finally {
      setTransferBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-[#FF6A00]" />
            Multi-Outlet Revenue Comparison
          </h1>
          <p className="text-sm text-muted-foreground">
            Consolidated gross sales, refunds, net sales, COGS, gross margin, wastage, and
            inter-branch stock transfers across all outlets (H-21, Stage D1).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchOutletsAndTransfers()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

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

      {/* Consolidated Group Totals KPI Strip */}
      {data?.totals && (
        <div
          data-testid="consolidated-outlet-totals"
          className="grid grid-cols-2 md:grid-cols-5 gap-3"
        >
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-[11px] uppercase font-bold text-muted-foreground">
              Group Gross Sales
            </span>
            <div className="text-lg font-black text-foreground mt-1">
              {formatRupees(data.totals.gross_sales_paise)}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {data.totals.invoices_count} settled bills
            </span>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-[11px] uppercase font-bold text-muted-foreground">
              Group Refunds
            </span>
            <div className="text-lg font-black text-rose-600 mt-1">
              {formatRupees(data.totals.refunds_paise)}
            </div>
            <span className="text-[11px] text-muted-foreground">Append-only adjustments</span>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-[11px] uppercase font-bold text-muted-foreground">
              Group Net Sales
            </span>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-1">
              {formatRupees(data.totals.net_sales_paise)}
            </div>
            <span className="text-[11px] text-muted-foreground">Gross minus refunds</span>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-[11px] uppercase font-bold text-muted-foreground">
              COGS &amp; Gross Margin
            </span>
            <div className="text-lg font-black text-foreground mt-1">
              {formatRupees(data.totals.gross_margin_paise)}{" "}
              <span className="text-xs font-bold text-[#C2410C]">
                ({data.totals.gross_margin_percent}%)
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              COGS: {formatRupees(data.totals.cogs_paise)}
            </span>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card">
            <span className="text-[11px] uppercase font-bold text-muted-foreground">
              Total Wastage
            </span>
            <div className="text-lg font-black text-amber-700 dark:text-amber-400 mt-1">
              {formatRupees(data.totals.wastage_paise)}
            </div>
            <span className="text-[11px] text-muted-foreground">Recorded kitchen waste</span>
          </div>
        </div>
      )}

      {/* Outlet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {data?.outlets.map((outlet) => {
          const netPaise = outlet.net_sales_paise ?? outlet.total_sales_paise;
          const sharePercent =
            totalRevenuePaise > 0 ? Math.round((netPaise / totalRevenuePaise) * 100) : 0;

          return (
            <div
              key={outlet.branch_id}
              className="p-5 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-lg font-bold text-foreground">{outlet.name}</span>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-muted text-muted-foreground">
                    {outlet.venue_profile}
                  </span>
                </div>

                <div className="text-2xl font-black text-foreground mt-2">
                  {formatRupees(netPaise)}
                </div>

                {/* Progress bar of revenue share */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Revenue Share</span>
                    <span className="font-semibold text-foreground">{sharePercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#FF6A00] rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, sharePercent)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">Invoices Settled</span>
                  <span className="font-semibold text-foreground">{outlet.invoices_count}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Average Ticket</span>
                  <span className="font-semibold text-foreground">
                    {formatRupees(outlet.average_ticket_paise)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3">Outlet / Branch</th>
                <th className="px-4 py-3">Venue Type</th>
                <th className="px-4 py-3 text-right">Settled Invoices</th>
                <th className="px-4 py-3 text-right">Gross Sales</th>
                <th className="px-4 py-3 text-right">Refunds</th>
                <th className="px-4 py-3 text-right">Net Sales</th>
                <th className="px-4 py-3 text-right">COGS</th>
                <th className="px-4 py-3 text-right">Gross Margin</th>
                <th className="px-4 py-3 text-right">Wastage</th>
                <th className="px-4 py-3 text-right">Avg Ticket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    Loading outlet comparison...
                  </td>
                </tr>
              ) : !data?.outlets || data.outlets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                    No outlet sales data available.
                  </td>
                </tr>
              ) : (
                data.outlets.map((o) => (
                  <tr key={o.branch_id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{o.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{o.venue_profile}</td>
                    <td className="px-4 py-3 font-medium text-foreground text-right">
                      {o.invoices_count}
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground text-right">
                      {formatRupees(o.gross_sales_paise ?? o.total_sales_paise)}
                    </td>
                    <td className="px-4 py-3 font-mono text-rose-600 text-right">
                      {formatRupees(o.refunds_paise ?? 0)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground text-right">
                      {formatRupees(o.net_sales_paise ?? o.total_sales_paise)}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground text-right">
                      {formatRupees(o.cogs_paise ?? 0)}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-700 dark:text-emerald-400 text-right">
                      {formatRupees(o.gross_margin_paise ?? o.total_sales_paise)} (
                      {o.gross_margin_percent ?? 100}%)
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-700 dark:text-amber-400 text-right">
                      {formatRupees(o.wastage_paise ?? 0)}
                    </td>
                    <td className="px-4 py-3 font-medium text-muted-foreground text-right">
                      {formatRupees(o.average_ticket_paise)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stage D1: Inter-Branch Stock Transfers Section */}
      <div className="border border-border rounded-xl bg-card p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-[#FF6A00]" />
              Inter-Branch Stock Transfers
            </h2>
            <p className="text-xs text-muted-foreground">
              Move ingredients and supplies between outlets with append-only TRANSFER_OUT and
              TRANSFER_IN ledger movements preserving WAC cost.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleCreateTransfer}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-1 text-xs"
        >
          <div>
            <label
              htmlFor="transfer-from-branch"
              className="font-semibold text-muted-foreground block mb-1"
            >
              From Branch
            </label>
            <select
              id="transfer-from-branch"
              aria-label="From Branch"
              value={fromBranchId}
              onChange={(e) => setFromBranchId(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-input bg-background min-h-[38px]"
            >
              <option value="">Select source...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="transfer-to-branch"
              className="font-semibold text-muted-foreground block mb-1"
            >
              To Branch
            </label>
            <select
              id="transfer-to-branch"
              aria-label="To Branch"
              value={toBranchId}
              onChange={(e) => setToBranchId(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-input bg-background min-h-[38px]"
            >
              <option value="">Select destination...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="transfer-item"
              className="font-semibold text-muted-foreground block mb-1"
            >
              Inventory Item
            </label>
            <select
              id="transfer-item"
              aria-label="Inventory Item"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-input bg-background min-h-[38px]"
            >
              <option value="">Select item...</option>
              {inventoryItems.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name} ({it.base_unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="transfer-qty"
              className="font-semibold text-muted-foreground block mb-1"
            >
              Quantity
            </label>
            <input
              id="transfer-qty"
              aria-label="Transfer Quantity"
              type="number"
              min="0.001"
              step="any"
              value={transferQty}
              onChange={(e) => setTransferQty(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-input bg-background min-h-[38px]"
            />
          </div>

          <div>
            <label
              htmlFor="transfer-notes"
              className="font-semibold text-muted-foreground block mb-1"
            >
              Notes
            </label>
            <input
              id="transfer-notes"
              aria-label="Transfer Notes"
              type="text"
              placeholder="Central kitchen dispatch"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-input bg-background min-h-[38px]"
            />
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              data-testid="create-transfer-btn"
              disabled={transferBusy || !fromBranchId || !toBranchId || !selectedItemId}
              className="w-full min-h-[38px] bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Create Transfer
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border uppercase text-muted-foreground">
              <tr>
                <th className="p-2.5">Source Branch</th>
                <th className="p-2.5">Destination Branch</th>
                <th className="p-2.5">Items</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-muted-foreground">
                    No inter-branch stock transfers recorded yet.
                  </td>
                </tr>
              ) : (
                transfers.map((trf) => (
                  <tr key={trf.id}>
                    <td className="p-2.5 font-semibold">{trf.from_branch_name}</td>
                    <td className="p-2.5 font-semibold">{trf.to_branch_name}</td>
                    <td className="p-2.5 font-mono">
                      {(trf.lines || [])
                        .map((l) => `${l.item_name}: ${l.quantity} ${l.base_unit}`)
                        .join(", ")}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          trf.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                            : trf.status === "APPROVED"
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {trf.status === "APPROVED" ? "IN_TRANSIT" : trf.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right space-x-2">
                      {trf.status === "DRAFT" && (
                        <Button
                          type="button"
                          size="sm"
                          data-testid="dispatch-transfer-btn"
                          disabled={transferBusy}
                          onClick={() => void handleDispatchTransfer(trf.id)}
                          className="h-7 text-[11px] bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Dispatch
                        </Button>
                      )}
                      {trf.status === "APPROVED" && (
                        <Button
                          type="button"
                          size="sm"
                          data-testid="receive-transfer-btn"
                          disabled={transferBusy}
                          onClick={() => void handleReceiveTransfer(trf.id)}
                          className="h-7 text-[11px] bg-[#0B1F3B] text-white font-bold"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Receive Stock
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
