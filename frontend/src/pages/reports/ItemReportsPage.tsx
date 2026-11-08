import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { UtensilsCrossed, Layers, Calendar, RefreshCw, ShoppingBag } from "lucide-react";
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

export const ItemReportsPage: React.FC = () => {
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
      setError("Failed to load item report data. Please check your connection.");
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
            <UtensilsCrossed className="w-6 h-6 text-primary" />
            Items & Categories Report{" "}
            <span className="text-xs text-muted-foreground font-normal">உணவு & வகை அறிக்கை</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Analyze bestselling dishes, item-level demand, and category revenue contributions.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
          <Link
            to="/reports/sales"
            className="px-3 py-1.5 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground"
          >
            Sales Overview
          </Link>
          <Link
            to="/reports/items"
            className="px-3 py-1.5 text-xs font-bold rounded-md bg-background text-foreground shadow-sm"
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
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Time Range:</span>
            <div className="flex items-center gap-1">
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
            <form onSubmit={handleCustomApply} className="flex items-center gap-2">
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

      {/* Top Items List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary" />
              Top Selling Dishes (உணவுகள்)
            </CardTitle>
            <CardDescription className="text-xs">
              Ranked by quantity ordered across all tickets in this period.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-xs uppercase font-bold text-muted-foreground border-y">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Dish Name</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Gross Sales (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ) : !report?.top_items || report.top_items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-muted-foreground">
                        No item orders recorded for this period.
                      </td>
                    </tr>
                  ) : (
                    report.top_items.map((item, idx) => (
                      <tr key={item.item_name} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {item.item_name}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-primary">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground">
                          {formatRupees(item.total_paise)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Category Contribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              Category Breakdown (வகைகள்)
            </CardTitle>
            <CardDescription className="text-xs">
              Revenue and sales volume distributed by menu category.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-xs uppercase font-bold text-muted-foreground border-y">
                  <tr>
                    <th className="px-4 py-2.5">Category</th>
                    <th className="px-4 py-2.5 text-right">Items Sold</th>
                    <th className="px-4 py-2.5 text-right">Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ) : !report?.top_categories || report.top_categories.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-muted-foreground">
                        No categories found in this period.
                      </td>
                    </tr>
                  ) : (
                    report.top_categories.map((cat) => (
                      <tr key={cat.category_name} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {cat.category_name}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {cat.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-foreground">
                          {formatRupees(cat.total_paise)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
