import React, { useState, useEffect } from "react";
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
import { ordersApi } from "../../api/orders";
import { useAuth } from "../../context/AuthContext";
import { formatRupees } from "../../utils/currency";

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
  const { user, activeTenant } = useAuth();
  const navigate = useNavigate();

  const [entitlements, setEntitlements] = useState<EntitlementsResponse | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingResponse | null>(null);
  const [todayReport, setTodayReport] = useState<TodayReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [overLimitKey, setOverLimitKey] = useState<string>("tables");

  useEffect(() => {
    if (!activeTenant?.tenant_id) return;
    let isMounted = true;
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [entRes, onbRes, reportRes] = await Promise.allSettled([
          apiClient.get<EntitlementsResponse>("/entitlements/"),
          apiClient.get<OnboardingResponse>("/onboarding/status/"),
          ordersApi.getTodayReport(),
        ]);

        if (isMounted) {
          if (entRes.status === "fulfilled") {
            setEntitlements(entRes.value.data);
          }
          if (onbRes.status === "fulfilled") {
            setOnboarding(onbRes.value.data);
          }
          if (reportRes.status === "fulfilled") {
            setTodayReport(reportRes.value.data as unknown as TodayReportResponse);
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => {
      isMounted = false;
    };
  }, [activeTenant?.tenant_id]);

  const ONBOARDING_STEPS = [
    { key: "business_profile", label: "Business Profile", path: "/settings/venue" },
    { key: "first_branch", label: "Branch Configured", path: "/branches" },
    { key: "venue_profile_chosen", label: "Venue Preset", path: "/settings/venue" },
    { key: "service_areas", label: "Service Areas", path: "/venue/areas" },
    { key: "tables_or_counters", label: "Tables / Counters", path: "/venue/tables" },
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

  return (
    <div className="space-y-8 animate-in fade-in-50">
      {/* 1. Header & Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            {activeTenant?.tenant_name || "Restaurant SaaS"}
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground mt-0.5">
            {getTimeGreeting()}, {user?.full_name?.split(" ")[0] || "Chef"}!
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time venue operations, plan limits, and onboarding progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/venue/tables")}>
            <Utensils className="h-4 w-4 mr-1.5 text-[#FF6A00]" />
            Manage Tables
          </Button>
          <Button variant="default" size="sm" onClick={() => navigate("/qr")}>
            <QrCode className="h-4 w-4 mr-1.5" />
            Print QR codes
          </Button>
        </div>
      </div>

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

      {/* 2. Today's Operational Sales & Velocity (Owner & Manager View) */}
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

      {/* 3. Onboarding Status Checklist Card */}
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

      {/* 3. Subscription Entitlements & Usage Bars */}
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
                { key: "max_tables", label: "Dining Tables", icon: Utensils },
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

      {/* 4. Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/venue/tables"
          className="p-5 rounded-xl border border-border bg-card hover:border-[#FF6A00] transition-all group"
        >
          <Utensils className="h-6 w-6 text-[#FF6A00] mb-3 group-hover:scale-110 transition-transform" />
          <h4 className="font-bold text-foreground text-sm font-heading">Dining Tables</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Configure table capacities, labels, and monitor live table states.
          </p>
        </Link>

        <Link
          to="/venue/floor"
          className="p-5 rounded-xl border border-border bg-card hover:border-[#FF6A00] transition-all group"
        >
          <LayoutGrid className="h-6 w-6 text-[#FF6A00] mb-3 group-hover:scale-110 transition-transform" />
          <h4 className="font-bold text-foreground text-sm font-heading">Floor Plan Editor</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Arrange tables in 2D space, adjust shapes, and customize section boundaries.
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
