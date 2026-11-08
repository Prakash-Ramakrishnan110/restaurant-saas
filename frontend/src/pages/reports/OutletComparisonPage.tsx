import React, { useState, useEffect, useCallback, useMemo } from "react";
import { GitBranch, RefreshCw } from "lucide-react";
import { apiClient } from "../../api/client";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";

interface OutletMetric {
  branch_id: string;
  name: string;
  venue_profile: string;
  invoices_count: number;
  total_sales_paise: number;
  average_ticket_paise: number;
}

interface OutletReportData {
  start_date: string;
  end_date: string;
  outlets: OutletMetric[];
}

export const OutletComparisonPage: React.FC = () => {
  const [data, setData] = useState<OutletReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<"TODAY" | "7D" | "30D">("7D");

  const fetchOutlets = useCallback(async () => {
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
      const res = await apiClient.get<OutletReportData>("/reports/outlets/", {
        params: { start_date: startStr, end_date: endStr },
      });
      setData(res.data);
    } catch {
      setError("Failed to load outlet comparison report.");
    } finally {
      setIsLoading(false);
    }
  }, [datePreset]);

  useEffect(() => {
    fetchOutlets();
  }, [fetchOutlets]);

  const totalRevenuePaise = useMemo(() => {
    if (!data?.outlets) return 0;
    return data.outlets.reduce((acc, curr) => acc + curr.total_sales_paise, 0);
  }, [data]);

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
            Compare sales volume, invoice throughput, and average ticket across all restaurant
            branches and outlets (H-21).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchOutlets} disabled={isLoading}>
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

      {/* Outlet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {data?.outlets.map((outlet) => {
          const sharePercent =
            totalRevenuePaise > 0
              ? Math.round((outlet.total_sales_paise / totalRevenuePaise) * 100)
              : 0;

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
                  {formatRupees(outlet.total_sales_paise)}
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
                <th className="px-4 py-3 text-right">Avg Ticket</th>
                <th className="px-4 py-3 text-right">Total Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Loading outlet comparison...
                  </td>
                </tr>
              ) : !data?.outlets || data.outlets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
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
                    <td className="px-4 py-3 font-medium text-muted-foreground text-right">
                      {formatRupees(o.average_ticket_paise)}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground text-right">
                      {formatRupees(o.total_sales_paise)}
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
