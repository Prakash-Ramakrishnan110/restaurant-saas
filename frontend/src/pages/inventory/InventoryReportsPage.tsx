import React, { useState, useEffect, useCallback } from "react";
import { BarChart3, Download } from "lucide-react";
import { apiClient } from "../../api/client";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";

type ReportTab = "stock-on-hand" | "movements" | "low-stock" | "wastage" | "usage";

const TABS: Array<{ id: ReportTab; label: string }> = [
  { id: "stock-on-hand", label: "Stock on Hand" },
  { id: "movements", label: "Movements" },
  { id: "low-stock", label: "Low & Negative" },
  { id: "wastage", label: "Wastage by Reason" },
  { id: "usage", label: "Usage by Day" },
];

export const InventoryReportsPage: React.FC = () => {
  const { can } = useAuth();
  const canSeeCosts = can("inventory.costs");

  const [tab, setTab] = useState<ReportTab>("stock-on-hand");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await apiClient.get<Record<string, unknown>>(`/inventory/reports/${tab}/`, {
        params,
      });
      setData(res.data || {});
    } catch {
      setData({});
    } finally {
      setLoading(false);
    }
  }, [tab, dateFrom, dateTo]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCsv = async () => {
    const params: Record<string, string> = { export: "csv" };
    if (dateFrom) params.date_from = dateFrom;
    if (dateTo) params.date_to = dateTo;
    const res = await apiClient.get(`/inventory/reports/${tab}/`, {
      params,
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const rows = (data.rows || data.low_stock || data.by_reason || []) as Array<
    Record<string, unknown>
  >;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#FF6A00]" />
            <span>Inventory Reports</span>
            <span className="text-xs text-muted-foreground font-normal">சரக்கு அறிக்கைகள்</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Server-calculated stock levels, movements, low stock, wastage, and daily usage.
          </p>
        </div>
        <Button
          onClick={handleExportCsv}
          className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[44px]"
        >
          <Download className="w-4 h-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold min-h-[40px] border ${
              tab === t.id
                ? "bg-[#FF6A00] text-[#0B1F3B] border-transparent"
                : "bg-card text-foreground border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-input bg-card min-h-[40px]"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2.5 py-1.5 text-xs rounded-lg border border-input bg-card min-h-[40px]"
        />
      </div>

      {tab === "stock-on-hand" && canSeeCosts && typeof data.total_value_paise === "number" && (
        <div className="p-4 rounded-xl border border-border bg-card inline-block">
          <div className="text-xs text-muted-foreground font-semibold">Total Stock Value</div>
          <div className="text-2xl font-black text-foreground">
            {formatRupees(data.total_value_paise)}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading report...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No records for this filter.
          </div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="border-b border-border bg-muted/40 uppercase text-muted-foreground">
              <tr>
                {Object.keys(rows[0]).map((col) => (
                  <th key={col} className="p-3">
                    {col.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row, idx) => (
                <tr key={idx}>
                  {Object.entries(row).map(([k, v]) => (
                    <td key={k} className="p-3 font-mono">
                      {k.endsWith("_paise") && typeof v === "number"
                        ? formatRupees(v)
                        : String(v ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
