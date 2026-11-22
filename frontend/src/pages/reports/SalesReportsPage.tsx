import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Calendar, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { ordersApi, RangeReportResponse } from "../../api/orders";
import { formatRupees } from "../../utils/currency";

export const SalesReportsPage: React.FC = () => {
  const [rangePreset, setRangePreset] = useState<"today" | "7d" | "30d" | "custom">("7d");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<RangeReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async (start: string, end: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ordersApi.getRangeReport({ start_date: start, end_date: end });
      setReport(res.data);
    } catch {
      setError("Failed to load sales report data. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (rangePreset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
      fetchReport(todayStr, todayStr);
    } else if (rangePreset === "7d") {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      const pastStr = past.toISOString().split("T")[0];
      setStartDate(pastStr);
      setEndDate(todayStr);
      fetchReport(pastStr, todayStr);
    } else if (rangePreset === "30d") {
      const past = new Date();
      past.setDate(past.getDate() - 29);
      const pastStr = past.toISOString().split("T")[0];
      setStartDate(pastStr);
      setEndDate(todayStr);
      fetchReport(pastStr, todayStr);
    }
  }, [rangePreset]);

  const handleCustomApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate) {
      fetchReport(startDate, endDate);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Sales Reports{" "}
            <span className="text-xs text-muted-foreground font-normal">விற்பனை அறிக்கை</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Authoritative revenue analytics and settlement metrics calculated in integer paise.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
          <Link
            to="/reports/sales"
            className="px-3 py-1.5 text-xs font-bold rounded-md bg-background text-foreground shadow-sm"
          >
            Sales Overview
          </Link>
          <Link
            to="/reports/items"
            className="px-3 py-1.5 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground"
          >
            Items & Categories
          </Link>
          <Link
            to="/reports/payments"
            className="px-3 py-1.5 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground"
          >
            Payments
          </Link>
        </div>
      </div>

      {/* Date Range Selector Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">Time Range:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={rangePreset === "today" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setRangePreset("today")}
              >
                Today
              </Button>
              <Button
                variant={rangePreset === "7d" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setRangePreset("7d")}
              >
                Last 7 Days
              </Button>
              <Button
                variant={rangePreset === "30d" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setRangePreset("30d")}
              >
                Last 30 Days
              </Button>
              <Button
                variant={rangePreset === "custom" ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setRangePreset("custom")}
              >
                Custom
              </Button>
            </div>
          </div>

          {rangePreset === "custom" && (
            <form onSubmit={handleCustomApply} className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 px-2 text-xs border rounded-md bg-background"
                required
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 px-2 text-xs border rounded-md bg-background"
                required
              />
              <Button type="submit" size="sm" className="h-8 text-xs">
                Apply
              </Button>
            </form>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 ml-auto"
            onClick={() => fetchReport(startDate, endDate)}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">
              Total Gross Sales
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                formatRupees(report?.sales_paise || 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div>Zero float arithmetic • {report?.settled_invoices_count || 0} settled bills</div>
            {(report?.refunds_paise || 0) > 0 && (
              <div className="font-mono text-[11px] text-amber-600 font-semibold">
                Refunds: -{formatRupees(report?.refunds_paise || 0)} • Net Collected:{" "}
                {formatRupees(report?.net_sales_paise || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">
              Average Order Value (AOV)
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                formatRupees(report?.average_order_value_paise || 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Per settled customer checkout
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">
              Settled Invoices
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                (report?.settled_invoices_count || 0).toLocaleString()
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Completed cash & digital bills
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider">
              Orders Processed
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                (report?.orders_count || 0).toLocaleString()
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Kitchen & counter order tickets
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span>Daily Sales Breakdown</span>
            <span className="text-xs font-normal text-muted-foreground">
              Period: {startDate} to {endDate}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase font-bold text-muted-foreground border-y">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Settled Bills</th>
                  <th className="px-4 py-3 text-right">Gross Sales (₹)</th>
                  <th className="px-4 py-3 text-right">Average Bill (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ) : !report?.daily_breakdown || report.daily_breakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No settled sales recorded for this date window.
                    </td>
                  </tr>
                ) : (
                  report.daily_breakdown.map((row) => {
                    const avgBill =
                      row.invoices_count > 0 ? Math.floor(row.sales_paise / row.invoices_count) : 0;
                    return (
                      <tr key={row.date} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">{row.date}</td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {row.invoices_count}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-foreground">
                          {formatRupees(row.sales_paise)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                          {formatRupees(avgBill)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
