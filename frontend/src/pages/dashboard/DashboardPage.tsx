import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Utensils,
  QrCode,
  Users,
  LayoutGrid,
  IndianRupee,
  ShoppingBag,
  Receipt,
  Download,
  Share2,
  Calendar,
  Flame,
  Bell,
  Boxes,
  Bed,
  Tent,
  Zap,
  Check,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { UpgradeModal } from "../../components/app/UpgradeModal";
import { apiClient } from "../../api/client";
import { ordersApi, KDSTicket } from "../../api/orders";
import { unwrapList } from "../../api/pagination";
import { useAuth } from "../../context/AuthContext";
import { formatRupees } from "../../utils/currency";
import { playOrderAlert, playWaiterCallAlert } from "../../utils/soundAlerts";

interface EntitlementsResponse {
  plan_name: string;
  status: string;
  limits: {
    max_branches?: {
      limit: number | null;
      current: number;
      remaining: number | null;
      over_limit: boolean;
    };
    max_service_areas?: {
      limit: number | null;
      current: number;
      remaining: number | null;
      over_limit: boolean;
    };
    max_tables?: {
      limit: number | null;
      current: number;
      remaining: number | null;
      over_limit: boolean;
    };
  };
  features?: {
    floor_editor: boolean;
    table_merge: boolean;
    courses: boolean;
  };
}

interface OnboardingResponse {
  is_complete: boolean;
  completion_percentage: number;
  steps: Record<string, boolean>;
  summary: {
    branches_count: number;
    service_areas_count: number;
    tables_count: number;
    qr_codes_count: number;
    staff_count: number;
  };
}

interface TodayReportResponse {
  date: string;
  sales_paise: number;
  orders_count: number;
  settled_invoices_count: number;
  average_order_value_paise: number;
  open_orders: number;
  sales_by_payment_method: Record<string, number>;
  top_items: Array<{
    item_name: string;
    quantity: number;
    total_paise: number;
  }>;
  last_bills: Array<{
    id: string;
    invoice_number: string;
    table_label: string;
    total_paise: number;
    payment_method: string;
    settled_at: string;
  }>;
}

interface TableOccupancy {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  percent: number;
}

interface LowStockAlert {
  id: string;
  name: string;
  current_stock: string;
  min_threshold: string;
  unit: string;
}

interface DailyTrendPoint {
  date: string;
  label: string;
  sales_paise: number;
  orders_count: number;
  settled_invoices_count: number;
}

export function getUsageMeterColor(
  percentage: number,
  isOverLimit?: boolean
): { className: string; hex: string } {
  if (isOverLimit || percentage >= 100) {
    return { className: "bg-destructive", hex: "#DC2626" };
  }
  if (percentage >= 80) {
    return { className: "bg-amber-500", hex: "#D97706" };
  }
  return { className: "bg-primary", hex: "#FF6A00" };
}

export const DashboardPage: React.FC = () => {
  const { user, activeTenant, activeRole } = useAuth();
  const navigate = useNavigate();
  const currentRole = activeTenant?.role || activeRole;

  useEffect(() => {
    if (user?.is_platform_admin) {
      navigate("/admin", { replace: true });
      return;
    }
    if (currentRole === "WAITER") {
      navigate("/pos", { replace: true });
      return;
    }
    if (currentRole === "CASHIER") {
      navigate("/billing", { replace: true });
      return;
    }
    if (currentRole === "KITCHEN") {
      navigate("/kds", { replace: true });
      return;
    }
  }, [user, currentRole, navigate]);

  const [businessInfo, setBusinessInfo] = useState<{
    business_type?: string;
    venue_profile?: string;
    allows_room_service?: boolean;
    uses_tables?: boolean;
  }>({});

  useEffect(() => {
    apiClient
      .get<{
        business_type?: string;
        venue_profile?: string;
        allows_room_service?: boolean;
        business_settings?: { allows_room_service?: boolean };
      }>("/business/")
      .then((res) => {
        const bType = res.data?.business_type;
        const vProf = res.data?.venue_profile;
        const roomSvc =
          res.data?.allows_room_service ??
          res.data?.business_settings?.allows_room_service ??
          (bType === "HOTEL" || vProf === "HOTEL_RESTAURANT");
        setBusinessInfo({
          business_type: bType,
          venue_profile: vProf,
          allows_room_service: Boolean(roomSvc),
          uses_tables:
            bType !== "TEA_SHOP" &&
            bType !== "QUICK_SERVICE" &&
            vProf !== "QUICK_SERVICE",
        });
      })
      .catch(() => {});
  }, [activeTenant]);

  const businessType =
    businessInfo.business_type || activeTenant?.business_type || "";
  const venueProfile =
    businessInfo.venue_profile || activeTenant?.venue_profile || "";
  const usesTables =
    businessInfo.uses_tables ?? activeTenant?.uses_tables ?? true;

  const isHotel =
    businessType === "HOTEL" ||
    venueProfile === "HOTEL_RESTAURANT" ||
    businessInfo.allows_room_service === true ||
    activeTenant?.allows_room_service === true;

  const isDhaba = businessType === "DHABA";

  const isQuickService =
    !usesTables ||
    businessType === "TEA_SHOP" ||
    businessType === "BAKERY" ||
    businessType === "FOOD_COURT" ||
    businessType === "QUICK_SERVICE" ||
    venueProfile === "QUICK_SERVICE";

  // Data states
  const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingResponse | null>(null);
  const [todayReport, setTodayReport] = useState<TodayReportResponse | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [overLimitKey, setOverLimitKey] = useState<string>("tables");

  // Operational widgets state
  const [occupancy, setOccupancy] = useState<TableOccupancy | null>(null);
  const [delayedTickets, setDelayedTickets] = useState<KDSTicket[]>([]);
  const [waiterCallActive, setWaiterCallActive] = useState<{ id: string; target: string; time: string } | null>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [totalIngredientsCount, setTotalIngredientsCount] = useState<number>(0);
  const [sevenDayTrend, setSevenDayTrend] = useState<DailyTrendPoint[]>([]);

  // Historical export controls
  const [exportPreset, setExportPreset] = useState<"today" | "yesterday" | "7d" | "30d" | "custom">("today");
  const [exportStartDate, setExportStartDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [exportEndDate, setExportEndDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [isExporting, setIsExporting] = useState(false);

  // Audio alert tracking
  const prevOrderCount = useRef<number>(0);

  // Fetch all primary dashboard metrics
  useEffect(() => {
    if (!activeTenant?.tenant_id) return;
    if (
      user?.is_platform_admin ||
      currentRole === "WAITER" ||
      currentRole === "CASHIER" ||
      currentRole === "KITCHEN"
    ) {
      return;
    }
    let isMounted = true;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const todayStr = new Date().toISOString().split("T")[0];
        const past7Days = new Date();
        past7Days.setDate(past7Days.getDate() - 6);
        const past7DaysStr = past7Days.toISOString().split("T")[0];

        const [entRes, onbRes, reportRes, tablesRes, kdsRes, alertsRes, ingRes, trendRes] =
          await Promise.allSettled([
            apiClient.get<EntitlementsResponse>("/entitlements/"),
            apiClient.get<OnboardingResponse>("/onboarding/status/"),
            ordersApi.getTodayReport(),
            apiClient.get<any>("/tables/"),
            ordersApi.getKDSTickets(),
            apiClient.get<LowStockAlert[]>("/inventory/alerts/"),
            apiClient.get<any>("/inventory/ingredients/"),
            ordersApi.getRangeReport({ start_date: past7DaysStr, end_date: todayStr }),
          ]);

        if (isMounted) {
          if (entRes.status === "fulfilled") {
            setEntitlements(entRes.value.data);
          }
          if (onbRes.status === "fulfilled") {
            setOnboarding(onbRes.value.data);
          }
          if (reportRes.status === "fulfilled") {
            const data = reportRes.value.data as unknown as TodayReportResponse;
            setTodayReport(data);
            setReportError(null);

            // Trigger order chime if orders increased
            if (data.orders_count > prevOrderCount.current && prevOrderCount.current > 0) {
              const target = data.last_bills?.[0]?.table_label || "Table";
              playOrderAlert(target);
            }
            prevOrderCount.current = data.orders_count;
          } else {
            const err: any = reportRes.reason;
            const statusCode = err?.response?.status;
            if (statusCode === 403) {
              setReportError("You do not have permission to view sales reports.");
            } else {
              setReportError("Failed to load today's sales report.");
            }
            setTodayReport(null);
          }

          // 1. Table Occupancy Calculation
          if (tablesRes.status === "fulfilled") {
            const rawTables = unwrapList<any>(tablesRes.value.data);
            const total = rawTables.length;
            const occupied = rawTables.filter((t: any) => t.status === "OCCUPIED").length;
            const available = rawTables.filter((t: any) => t.status === "AVAILABLE" || !t.status).length;
            const reserved = rawTables.filter((t: any) => t.status === "RESERVED").length;
            const percent = total > 0 ? Math.round((occupied / total) * 100) : 0;
            setOccupancy({ total, occupied, available, reserved, percent });
          }

          // 2. Kitchen Delayed Tickets (> 15 minutes)
          if (kdsRes.status === "fulfilled") {
            const tickets = unwrapList<KDSTicket>(kdsRes.value.data);
            const delayed = tickets.filter(
              (t) =>
                t.elapsed_minutes >= 15 &&
                t.status !== "READY" &&
                t.status !== "SERVED" &&
                t.status !== "COMPLETED" &&
                t.status !== "CANCELLED"
            );
            setDelayedTickets(delayed);
          }

          // 3. Low stock alerts and ingredient count
          if (alertsRes.status === "fulfilled") {
            setLowStockAlerts(unwrapList<LowStockAlert>(alertsRes.value.data));
          }
          if (ingRes.status === "fulfilled") {
            setTotalIngredientsCount(unwrapList<any>(ingRes.value.data).length);
          }

          // 4. 7-Day Revenue Trend
          if (trendRes.status === "fulfilled") {
            const rangeData = trendRes.value.data;
            if (rangeData && rangeData.daily_breakdown) {
              const points = rangeData.daily_breakdown.map((d) => {
                const dateObj = new Date(d.date);
                const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                return {
                  date: d.date,
                  label: dayName,
                  sales_paise: d.sales_paise || 0,
                  orders_count: d.invoices_count || 0,
                  settled_invoices_count: d.invoices_count || 0,
                };
              });
              setSevenDayTrend(points);
            }
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000); // Poll every 15s for live updates

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTenant?.tenant_id]);

  // Handle Preset Change for Download
  const handlePresetSelect = (preset: "today" | "yesterday" | "7d" | "30d" | "custom") => {
    setExportPreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if (preset === "today") {
      setExportStartDate(todayStr);
      setExportEndDate(todayStr);
    } else if (preset === "yesterday") {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split("T")[0];
      setExportStartDate(yestStr);
      setExportEndDate(yestStr);
    } else if (preset === "7d") {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      setExportStartDate(past.toISOString().split("T")[0]);
      setExportEndDate(todayStr);
    } else if (preset === "30d") {
      const past = new Date();
      past.setDate(past.getDate() - 29);
      setExportStartDate(past.toISOString().split("T")[0]);
      setExportEndDate(todayStr);
    }
  };

  // 1-Click CSV Download
  const handleDownloadCSV = async () => {
    setIsExporting(true);
    try {
      const res = await ordersApi.getRangeReport({
        start_date: exportStartDate,
        end_date: exportEndDate,
      });
      const data = res.data;

      const rows = [
        ["Date", "Settled Bills", "Gross Sales (INR)", "Average Order Value (INR)"],
        ...(data.daily_breakdown || []).map((b) => {
          const aov = b.invoices_count > 0 ? (b.sales_paise / b.invoices_count / 100).toFixed(2) : "0.00";
          return [
            b.date,
            b.invoices_count,
            (b.sales_paise / 100).toFixed(2),
            aov,
          ];
        }),
        [],
        ["Total Settled Bills", data.settled_invoices_count],
        ["Total Gross Sales (INR)", (data.sales_paise / 100).toFixed(2)],
        ["Average Order Value (INR)", (data.average_order_value_paise / 100).toFixed(2)],
      ];

      const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `sales_report_${exportStartDate}_to_${exportEndDate}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Failed to download sales report. Please check date range.");
    } finally {
      setIsExporting(false);
    }
  };

  // 1-Click WhatsApp Summary Share
  const handleShareWhatsApp = () => {
    const venueName = activeTenant?.tenant_name || "Restaurant";
    const dateLabel =
      exportStartDate === exportEndDate ? exportStartDate : `${exportStartDate} to ${exportEndDate}`;
    const totalSales = formatRupees(todayReport?.sales_paise || 0);
    const billsCount = todayReport?.settled_invoices_count || 0;
    const aov = formatRupees(todayReport?.average_order_value_paise || 0);

    const cashSales = formatRupees(todayReport?.sales_by_payment_method?.CASH || 0);
    const upiSales = formatRupees(todayReport?.sales_by_payment_method?.UPI || 0);

    const topDish = todayReport?.top_items?.[0]
      ? `${todayReport.top_items[0].item_name} (${todayReport.top_items[0].quantity} sold)`
      : "No orders yet";

    const text = `📊 *Daily Settlement Summary: ${venueName}*\n📅 *Period:* ${dateLabel}\n\n💰 *Total Gross Sales:* ${totalSales}\n🧾 *Settled Bills:* ${billsCount} | *AOV:* ${aov}\n💵 *Cash:* ${cashSales} | 📲 *UPI:* ${upiSales}\n⭐ *Top Item:* ${topDish}\n\n_Generated via ServeMyFood Management Suite_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const ONBOARDING_STEPS = [
    { key: "business_profile", label: "Business Profile", path: "/settings/venue" },
    { key: "first_branch", label: "Branch Configured", path: "/branches" },
    { key: "venue_profile_chosen", label: "Venue Preset", path: "/settings/venue" },
    { key: "service_areas", label: "Service Areas", path: "/venue?tab=areas" },
    { key: "tables_or_counters", label: "Tables / Layout", path: "/venue" },
    { key: "qr_codes", label: "QR codes printed", path: "/qr" },
    { key: "staff_invited", label: "Staff Invited", path: "/staff" },
  ];
  const completedStepsCount = ONBOARDING_STEPS.filter((s) => onboarding?.steps?.[s.key]).length;

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const hasAnyOverLimit =
    entitlements?.limits && Object.values(entitlements.limits).some((lim) => lim?.over_limit);

  // Maximum scale for 7-day trend chart
  const maxTrendPaise = useMemo(() => {
    if (!sevenDayTrend || sevenDayTrend.length === 0) return 100000;
    const maxVal = Math.max(...sevenDayTrend.map((p) => p.sales_paise));
    return maxVal > 0 ? maxVal : 100000;
  }, [sevenDayTrend]);

  if (user?.is_platform_admin) {
    return null;
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      {/* 1. Top Header with Venue-Adaptive Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            {activeTenant?.tenant_name || "Restaurant SaaS"}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground mt-0.5">
            {getTimeGreeting()}, {user?.full_name?.split(" ")[0] || "Chef"}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time venue operations, intelligent sales velocity, and floor occupancy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Adaptive Venue Button */}
          {isHotel ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/venue?tab=rooms")}>
              <Bed className="h-4 w-4 mr-1.5 text-[#FF6A00]" />
              Rooms & Tables
            </Button>
          ) : isDhaba ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/venue?tab=tables")}>
              <Tent className="h-4 w-4 mr-1.5 text-[#FF6A00]" />
              Huts & Tables
            </Button>
          ) : isQuickService ? (
            <Button variant="outline" size="sm" onClick={() => navigate("/venue?tab=counters")}>
              <Zap className="h-4 w-4 mr-1.5 text-[#FF6A00]" />
              Manage Counters
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate("/venue")}>
              <Utensils className="h-4 w-4 mr-1.5 text-[#FF6A00]" />
              Venue Layout
            </Button>
          )}

          <Button variant="default" size="sm" onClick={() => navigate("/qr")}>
            <QrCode className="h-4 w-4 mr-1.5" />
            QR codes
          </Button>
        </div>
      </div>

      {/* 2. Live Table Occupancy Heatmap Bar (Non-QSR) */}
      {!isQuickService && occupancy && occupancy.total > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground text-sm flex items-center gap-1.5">
                <LayoutGrid className="h-4 w-4 text-[#FF6A00]" />
                Live Occupancy Heatmap:
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                🟢 {occupancy.available} Free
              </span>
              <span className="text-amber-700 dark:text-amber-400 font-bold">
                🟡 {occupancy.occupied} Occupied
              </span>
              {occupancy.reserved > 0 && (
                <span className="text-blue-700 dark:text-blue-400 font-bold">
                  🔵 {occupancy.reserved} Reserved
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-extrabold text-foreground">
                {occupancy.percent}% Occupancy ({occupancy.occupied} / {occupancy.total}{" "}
                {isHotel ? "Rooms & Tables" : isDhaba ? "Huts & Tables" : "Tables"})
              </span>
              <Link
                to="/venue"
                className="text-[#FF6A00] font-semibold hover:underline inline-flex items-center gap-1"
              >
                View Floor <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Segmented Occupancy Bar */}
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden flex">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${(occupancy.available / occupancy.total) * 100}%` }}
              title={`${occupancy.available} Available`}
            />
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${(occupancy.occupied / occupancy.total) * 100}%` }}
              title={`${occupancy.occupied} Occupied`}
            />
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${(occupancy.reserved / occupancy.total) * 100}%` }}
              title={`${occupancy.reserved} Reserved`}
            />
          </div>
        </div>
      )}

      {/* 3. Kitchen Delay / Rush Warning Banner */}
      {delayedTickets.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-red-500/10 dark:bg-red-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900 dark:text-red-200 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <Flame className="h-6 w-6 text-destructive shrink-0" />
            <div>
              <h4 className="font-black text-sm">
                ⚠️ Kitchen Delay Warning: {delayedTickets.length} order ticket
                {delayedTickets.length > 1 ? "s" : ""} waiting &gt; 15 mins!
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Delayed tickets:{" "}
                <span className="font-bold text-foreground">
                  {delayedTickets
                    .map((t) => `${t.table_label || "Order"} (${t.elapsed_minutes}m)`)
                    .slice(0, 4)
                    .join(", ")}
                </span>
                {delayedTickets.length > 4 ? "..." : ""}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => navigate("/kds")}
            className="shrink-0 font-bold"
          >
            Expedite in KDS
          </Button>
        </div>
      )}

      {/* 4. Digital Waiter Call Alert Banner */}
      {waiterCallActive && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3 text-foreground"
        >
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-[#B45309] dark:text-[#FBBF24] animate-bounce" />
            <div>
              <p className="text-xs sm:text-sm font-bold">
                🔔 Service Call: Guest at{" "}
                <span className="text-[#FF6A00] font-black">{waiterCallActive.target}</span> is
                calling waiter!
              </p>
              <span className="text-[11px] text-muted-foreground">{waiterCallActive.time}</span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setWaiterCallActive(null);
              playWaiterCallAlert();
            }}
            className="h-8 text-xs font-bold border-amber-500/40 hover:bg-amber-500/20"
          >
            Acknowledge
          </Button>
        </div>
      )}

      {/* Over Limit Alert Banner */}
      {hasAnyOverLimit && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-red-50/80 dark:bg-red-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900 dark:text-red-200"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <h4 className="font-bold text-sm">Entitlement Limit Exceeded</h4>
              <p className="text-xs text-red-800/80 dark:text-red-300">
                One or more venue resources have exceeded your active tier limits. Upgrade to avoid
                operation throttling.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setOverLimitKey("tables");
              setUpgradeOpen(true);
            }}
            className="shrink-0"
          >
            Upgrade Plan
          </Button>
        </div>
      )}

      {/* 5. Today's Operational Sales & Velocity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#FF6A00]" />
            <h2 className="text-xl font-bold font-heading text-foreground">
              Today's Sales & Operations
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Live updates · {todayReport?.date || new Date().toISOString().split("T")[0]}
          </span>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Today's Sales
                </span>
                <div className="p-2 rounded-lg bg-[#FF6A00]/10 text-[#FF6A00]">
                  <IndianRupee className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div
                  className="text-2xl font-black font-heading text-foreground"
                  data-testid="metric-today-sales"
                >
                  {todayReport ? formatRupees(todayReport.sales_paise) : "₹0.00"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {todayReport?.settled_invoices_count ?? 0} settled bills
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Total Orders
                </span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div
                  className="text-2xl font-black font-heading text-foreground"
                  data-testid="metric-today-orders"
                >
                  {todayReport?.orders_count ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {todayReport?.open_orders ?? 0} active in progress
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Avg Order Value
                </span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Receipt className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black font-heading text-foreground">
                  {todayReport ? formatRupees(todayReport.average_order_value_paise) : "₹0.00"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Per settled order</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Kitchen Queue
                </span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                  <Utensils className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black font-heading text-foreground">
                  {todayReport?.open_orders ?? 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Active tickets pending</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 6. Interactive 7-Day Revenue Trend Graph */}
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#FF6A00]" />
                  7-Day Revenue Trend
                </CardTitle>
                <CardDescription>Daily gross sales volume in rupees (last 7 days)</CardDescription>
              </div>
              <span className="text-xs font-bold text-muted-foreground">
                Peak: {formatRupees(maxTrendPaise)}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {sevenDayTrend.length > 0 ? (
              <div className="space-y-2">
                <div className="h-40 flex items-end justify-between gap-2 sm:gap-4 pt-6 px-2">
                  {sevenDayTrend.map((point) => {
                    const heightPct = Math.max(8, Math.round((point.sales_paise / maxTrendPaise) * 100));
                    const isToday = point.date === new Date().toISOString().split("T")[0];
                    return (
                      <div
                        key={point.date}
                        className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative"
                      >
                        {/* Tooltip on Hover */}
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-[11px] font-bold py-1 px-2 rounded shadow-md pointer-events-none whitespace-nowrap z-20 border border-border">
                          {formatRupees(point.sales_paise)} • {point.orders_count} orders
                        </div>

                        {/* Bar */}
                        <div
                          className={`w-full max-w-[48px] rounded-t-md transition-all ${
                            isToday
                              ? "bg-[#FF6A00]"
                              : "bg-[#FF6A00]/40 hover:bg-[#FF6A00]/80"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />

                        {/* X-axis Label */}
                        <span
                          className={`text-[11px] font-bold ${
                            isToday ? "text-[#FF6A00]" : "text-muted-foreground"
                          }`}
                        >
                          {point.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-xs text-muted-foreground">
                No past order history available for chart plotting.
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2 Columns: Payment Breakdown & Top Bestsellers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Sales by Payment Method</CardTitle>
              <CardDescription>Tender distribution collected today</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {["CASH", "UPI", "CARD"].map((method) => {
                const paise = todayReport?.sales_by_payment_method?.[method] || 0;
                const totalPaise = todayReport?.sales_paise || 1;
                const pct = todayReport?.sales_paise ? Math.round((paise / totalPaise) * 100) : 0;
                return (
                  <div key={method} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-foreground">{method}</span>
                      <span className="font-bold text-foreground">
                        {formatRupees(paise)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#FF6A00] h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Top 5 Bestselling Items</CardTitle>
              <CardDescription>Highest volume dishes ordered today</CardDescription>
            </CardHeader>
            <CardContent>
              {todayReport?.top_items && todayReport.top_items.length > 0 ? (
                <div className="divide-y divide-border">
                  {todayReport.top_items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black w-5 text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.item_name}</p>
                          <p className="text-xs text-muted-foreground">{item.quantity} orders</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        {formatRupees(item.total_paise)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No orders completed yet today.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 7. Historical Sales Report Downloader with Date Selection */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#FF6A00]" />
              <CardTitle className="text-base font-heading">Sales Report Quick Export</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              Forgot to download yesterday? Pick any date range below to export.
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "7d", label: "Last 7 Days" },
                { id: "30d", label: "Last 30 Days" },
                { id: "custom", label: "Custom Range" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePresetSelect(p.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  exportPreset === p.id
                    ? "bg-[#FF6A00] text-[#0B1F3B] shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Pickers & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-border">
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <label htmlFor="export-start-date" className="font-semibold text-muted-foreground">
                  From:
                </label>
                <input
                  id="export-start-date"
                  type="date"
                  aria-label="Export start date"
                  value={exportStartDate}
                  onChange={(e) => {
                    setExportStartDate(e.target.value);
                    setExportPreset("custom");
                  }}
                  className="rounded-md border border-input bg-card px-2.5 py-1 text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="export-end-date" className="font-semibold text-muted-foreground">
                  To:
                </label>
                <input
                  id="export-end-date"
                  type="date"
                  aria-label="Export end date"
                  value={exportEndDate}
                  onChange={(e) => {
                    setExportEndDate(e.target.value);
                    setExportPreset("custom");
                  }}
                  className="rounded-md border border-input bg-card px-2.5 py-1 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareWhatsApp}
                className="text-xs font-bold gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                <Share2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Share WhatsApp
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadCSV}
                disabled={isExporting}
                className="text-xs font-bold gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                {isExporting ? "Exporting..." : "Download CSV"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 8. Stock & Inventory Health Card */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-[#FF6A00]" />
              <CardTitle className="text-base font-heading">Inventory & Stock Health</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/inventory">
                <Button variant="outline" size="sm" className="text-xs h-7">
                  View Stock
                </Button>
              </Link>
              <Link to="/inventory/purchases">
                <Button variant="outline" size="sm" className="text-xs h-7">
                  New Purchase Order
                </Button>
              </Link>
            </div>
          </div>
          <CardDescription>
            {totalIngredientsCount} raw ingredients tracked • Real-time stock alerts & recipe BOM
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lowStockAlerts.length > 0 ? (
            <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 text-[#B45309] dark:text-[#FBBF24] shrink-0" />
                <span>
                  <strong>{lowStockAlerts.length} ingredients below minimum threshold:</strong>{" "}
                  {lowStockAlerts
                    .map((a) => `${a.name} (${a.current_stock} ${a.unit})`)
                    .slice(0, 3)
                    .join(", ")}
                  {lowStockAlerts.length > 3 ? "..." : ""}
                </span>
              </div>
              <Link to="/menu/availability">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-bold border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 whitespace-nowrap"
                >
                  1-Click Out-of-Stock Toggle
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold py-1">
              <Check className="h-4 w-4" />
              All ingredient stock levels healthy and above reorder thresholds.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 9. Onboarding Status Checklist Card */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#FF6A00]" />
              <CardTitle className="text-lg font-heading">
                {completedStepsCount === 7 ? "Setup complete" : "Onboarding Checklist"}
              </CardTitle>
            </div>
            {onboarding && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#FF6A00]/10 text-[#FF6A00]">
                {completedStepsCount} of 7 steps done
              </span>
            )}
          </div>
          <CardDescription>
            Complete these steps to fully configure your restaurant's digital presence and floor
            management.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {ONBOARDING_STEPS.map((step) => {
                const isDone = onboarding?.steps?.[step.key];
                return (
                  <Link
                    key={step.key}
                    to={step.path}
                    className="flex items-center justify-between p-3 rounded-lg border border-border/70 hover:border-[#FF6A00] transition-colors bg-card/60"
                  >
                    <div className="flex items-center gap-2.5">
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-foreground">{step.label}</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 10. Subscription Entitlements & Usage Bars */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#FF6A00]" />
              <CardTitle className="text-lg font-heading">Your plan</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-foreground bg-muted px-2.5 py-1 rounded-md">
                {entitlements?.plan_name || "Professional"} plan
              </span>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2 py-1 rounded-md">
                {entitlements?.status || "ACTIVE"}
              </span>
            </div>
          </div>
          <CardDescription>How much of your plan you have used.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { key: "max_branches", label: "Active Branches", icon: GitBranchWrapper },
                { key: "max_service_areas", label: "Service Areas", icon: LayoutGrid },
                { key: "max_tables", label: isHotel ? "Rooms & Tables" : isDhaba ? "Huts & Tables" : "Dining Tables", icon: Utensils },
              ].map(({ key, label, icon: Icon }) => {
                const metric = entitlements?.limits?.[key as keyof typeof entitlements.limits];
                const limit = metric?.limit ?? 10;
                const current = metric?.current ?? 0;
                const remaining = metric?.remaining ?? 0;
                const overLimit = metric?.over_limit;
                const percentage = Math.min(100, Math.round((current / (limit || 1)) * 100));

                return (
                  <div
                    key={key}
                    className="p-4 rounded-xl border border-border bg-card/60 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-[#FF6A00]" />
                        <span className="text-xs font-bold text-foreground">{label}</span>
                      </div>
                      {overLimit && (
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-destructive text-white">
                          Over Limit
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="font-bold text-foreground text-sm">
                        {current}{" "}
                        <span className="text-muted-foreground font-normal">
                          / {limit ?? "Unlimited"}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {remaining !== null ? `${remaining} remaining` : "No limit"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          getUsageMeterColor(percentage, overLimit).className
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Feature Flag Badges */}
          {entitlements?.features && (
            <div className="pt-4 border-t border-border flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-muted-foreground">Enabled Modules:</span>
              <span
                className={`text-xs px-2.5 py-1 rounded-md font-semibold ${entitlements.features.floor_editor ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}
              >
                Visual Floor Editor: {entitlements.features.floor_editor ? "Enabled" : "Disabled"}
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-md font-semibold ${entitlements.features.table_merge ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}
              >
                Table Merge / Split: {entitlements.features.table_merge ? "Enabled" : "Disabled"}
              </span>
              <span
                className={`text-xs px-2.5 py-1 rounded-md font-semibold ${entitlements.features.courses ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}
              >
                Course Management: {entitlements.features.courses ? "Enabled" : "Disabled"}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 11. Quick Action Cards (4 Cards Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          to="/venue"
          className="p-5 rounded-xl border border-border bg-card hover:border-[#FF6A00] transition-all group"
        >
          {isHotel ? (
            <Bed className="h-6 w-6 text-[#FF6A00] mb-3 group-hover:scale-110 transition-transform" />
          ) : isDhaba ? (
            <Tent className="h-6 w-6 text-[#FF6A00] mb-3 group-hover:scale-110 transition-transform" />
          ) : (
            <LayoutGrid className="h-6 w-6 text-[#FF6A00] mb-3 group-hover:scale-110 transition-transform" />
          )}
          <h4 className="font-bold text-foreground text-sm font-heading">
            {isHotel ? "Hotel Rooms & Tables" : isDhaba ? "Huts & Tables" : "Venue Layout"}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Manage spaces, capacities, and visual layout editor in one unified hub.
          </p>
        </Link>

        <Link
          to="/inventory"
          className="p-5 rounded-xl border border-border bg-card hover:border-[#FF6A00] transition-all group"
        >
          <Boxes className="h-6 w-6 text-[#FF6A00] mb-3 group-hover:scale-110 transition-transform" />
          <h4 className="font-bold text-foreground text-sm font-heading">Inventory & Stock</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Raw ingredients, recipe cost calculation, and vendor purchase orders.
          </p>
        </Link>

        <Link
          to="/pos"
          className="p-5 rounded-xl border border-border bg-card hover:border-[#FF6A00] transition-all group"
        >
          <Utensils className="h-6 w-6 text-[#FF6A00] mb-3 group-hover:scale-110 transition-transform" />
          <h4 className="font-bold text-foreground text-sm font-heading">
            {isQuickService ? "Counter Orders" : "Floor POS"}
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            Punch orders, fire courses to kitchen, and manage live dining tables.
          </p>
        </Link>

        <Link
          to="/staff"
          className="p-5 rounded-xl border border-border bg-card hover:border-[#FF6A00] transition-all group"
        >
          <Users className="h-6 w-6 text-[#FF6A00] mb-3 group-hover:scale-110 transition-transform" />
          <h4 className="font-bold text-foreground text-sm font-heading">Staff & Permissions</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Invite managers, cashiers, and waiters with scoped branch access.
          </p>
        </Link>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        limitKey={overLimitKey}
        current={entitlements?.limits?.max_tables?.current || 0}
        limit={entitlements?.limits?.max_tables?.limit || 15}
      />
    </div>
  );
};

const GitBranchWrapper: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="6" x2="6" y1="3" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);
