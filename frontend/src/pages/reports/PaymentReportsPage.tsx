import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Banknote, QrCode, Hotel, Calendar, RefreshCw } from "lucide-react";
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

export const PaymentReportsPage: React.FC = () => {
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
      setError("Failed to load payment report data. Please check your connection.");
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

  const methods = report?.sales_by_payment_method || { CASH: 0, UPI: 0, CARD: 0, ROOM_FOLIO: 0 };

  const getMethodPercent = (paise: number) => {
    if (!report?.sales_paise || report.sales_paise === 0) return 0;
    return Math.round((paise / report.sales_paise) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Sub-navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            Payment Methods Report{" "}
            <span className="text-xs text-muted-foreground font-normal">பணம் செலுத்தும் முறை</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete reconciliation breakdown by tender: Cash, UPI, Card, and Room Charges.
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
            className="px-3 py-1.5 text-xs font-semibold rounded-md text-muted-foreground hover:text-foreground"
          >
            Items & Categories
          </Link>
          <Link
            to="/reports/payments"
            className="px-3 py-1.5 text-xs font-bold rounded-md bg-background text-foreground shadow-sm"
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

      {/* Tender Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CASH */}
        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                Cash (பணம்)
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                {getMethodPercent(methods.CASH || 0)}%
              </span>
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatRupees(methods.CASH || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Register cash drawer collections
          </CardContent>
        </Card>

        {/* UPI */}
        <Card className="border-l-4 border-l-primary shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-primary" />
                UPI / QR (ஜிபே/போன்பே)
              </span>
              <span className="text-xs font-semibold text-primary">
                {getMethodPercent(methods.UPI || 0)}%
              </span>
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatRupees(methods.UPI || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Direct bank settlements via UPI QR
          </CardContent>
        </Card>

        {/* CARD */}
        <Card className="border-l-4 border-l-blue-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                Card POS (அட்டை)
              </span>
              <span className="text-xs font-semibold text-blue-600">
                {getMethodPercent(methods.CARD || 0)}%
              </span>
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {isLoading ? <Skeleton className="h-8 w-24" /> : formatRupees(methods.CARD || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Debit and credit card terminal swipes
          </CardContent>
        </Card>

        {/* ROOM_FOLIO */}
        <Card className="border-l-4 border-l-amber-600 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Hotel className="w-3.5 h-3.5 text-amber-600" />
                Room Charge (அறை கட்டணம்)
              </span>
              <span className="text-xs font-semibold text-amber-600">
                {getMethodPercent(methods.ROOM_FOLIO || 0)}%
              </span>
            </CardDescription>
            <CardTitle className="text-2xl font-black text-foreground">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                formatRupees(methods.ROOM_FOLIO || 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Hotel guest room folio settlements
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center justify-between">
            <span>Payment Method Reconciliation</span>
            <span className="text-xs font-normal text-muted-foreground">
              Total Tendered: {formatRupees(report?.sales_paise || 0)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase font-bold text-muted-foreground border-y">
                <tr>
                  <th className="px-4 py-3">Tender Method</th>
                  <th className="px-4 py-3 text-right">Share (%)</th>
                  <th className="px-4 py-3 text-right">Total Settled (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ) : (
                  [
                    { label: "Cash (பணம்)", paise: methods.CASH || 0 },
                    { label: "UPI / QR Code", paise: methods.UPI || 0 },
                    { label: "Card Terminal POS", paise: methods.CARD || 0 },
                    { label: "Room Charge Folio", paise: methods.ROOM_FOLIO || 0 },
                  ].map((row) => (
                    <tr key={row.label} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{row.label}</td>
                      <td className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {getMethodPercent(row.paise)}%
                      </td>
                      <td className="px-4 py-3 text-right font-black text-foreground">
                        {formatRupees(row.paise)}
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
  );
};
