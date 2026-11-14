import React, { useEffect, useState } from "react";
import { CreditCard, AlertTriangle, Layers, Calendar, Clock } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { apiClient } from "../../api/client";
import { formatRupees } from "../../utils/currency";
import { mapBackendErrorCode } from "../../lib/errorMapper";

interface LimitMetric {
  limit: number | null;
  current: number;
  remaining: number | null;
  over_limit: boolean;
}

interface EntitlementsSummary {
  plan_name: string;
  price_paise: number;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  days_remaining: number | null;
  is_expired: boolean;
  is_expiring_soon: boolean;
  limits: {
    max_branches?: LimitMetric;
    max_service_areas?: LimitMetric;
    max_tables?: LimitMetric;
    max_menu_items?: LimitMetric;
    max_image_storage_mb?: LimitMetric;
  };
}

const LIMIT_LABELS: Array<{
  key: keyof EntitlementsSummary["limits"];
  label: string;
  unit?: string;
}> = [
  { key: "max_branches", label: "Branches / Outlets" },
  { key: "max_service_areas", label: "Service Areas" },
  { key: "max_tables", label: "Dining Tables / Rooms" },
  { key: "max_menu_items", label: "Menu Items" },
  { key: "max_image_storage_mb", label: "Image Storage", unit: "MB" },
];

function formatDateLabel(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRemainingLabel(
  daysRemaining: number | null | undefined,
  isExpired: boolean | undefined
): string {
  if (daysRemaining === null || daysRemaining === undefined) {
    return isExpired ? "Expired" : "Ongoing";
  }
  if (daysRemaining < 0) {
    const overdue = Math.abs(daysRemaining);
    return `Expired ${overdue} ${overdue === 1 ? "day" : "days"} ago`;
  }
  if (daysRemaining === 0) {
    return isExpired ? "Expired today" : "Expires today";
  }
  return `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining`;
}

export const PlanBillingPage: React.FC = () => {
  const [summary, setSummary] = useState<EntitlementsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadPlanData = async () => {
      setLoading(true);
      setError(null);
      try {
        const entRes = await apiClient.get<EntitlementsSummary>("/entitlements/");
        if (!mounted) return;
        setSummary(entRes.data);
      } catch (err) {
        if (!mounted) return;
        setError(mapBackendErrorCode(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadPlanData();
    return () => {
      mounted = false;
    };
  }, []);

  const isExpiredState =
    Boolean(summary?.is_expired) ||
    summary?.status === "EXPIRED" ||
    summary?.status === "SUSPENDED";
  const isExpiringSoonState =
    !isExpiredState &&
    (Boolean(summary?.is_expiring_soon) ||
      summary?.status === "EXPIRING" ||
      summary?.status === "GRACE");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Plan & Billing"
        description="Active subscription details, renewal timeline, and live resource usage."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Settings" },
          { label: "Your Plan & Billing" },
        ]}
      />

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <Card className="h-44 animate-pulse bg-muted/40" />
          <Card className="h-44 animate-pulse bg-muted/40" />
        </div>
      ) : (
        <>
          {/* Expiry / Renewal Lifecycle Alert */}
          {isExpiredState && summary && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-bold text-destructive">
                  Subscription {summary.status === "SUSPENDED" ? "Suspended" : "Expired"} —{" "}
                  {formatRemainingLabel(summary.days_remaining, true)}
                </p>
                <p className="text-foreground/90">
                  Your <strong>{summary.plan_name}</strong>{" "}
                  {summary.ends_at
                    ? `ended on ${formatDateLabel(summary.ends_at, "—")}.`
                    : "is currently inactive."}{" "}
                  Operations such as placing new orders, adding branches, or creating tables may be
                  restricted until the subscription is renewed. Contact your ServeMyFood account
                  administrator to renew and restore full access.
                </p>
              </div>
            </div>
          )}

          {isExpiringSoonState && summary && (
            <div
              role="status"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3"
            >
              <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-bold text-amber-800 dark:text-amber-300">
                  Subscription Expiring Soon — {formatRemainingLabel(summary.days_remaining, false)}
                </p>
                <p className="text-foreground/90">
                  Your <strong>{summary.plan_name}</strong> is scheduled to expire on{" "}
                  <strong>{formatDateLabel(summary.ends_at, "—")}</strong>. Renew before this date
                  to avoid service interruption.
                </p>
              </div>
            </div>
          )}

          {/* Active Plan Summary */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-[#FF6A00]/15 text-[#FF6A00] shrink-0">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {summary?.plan_name || "Active Subscription"}
                  </CardTitle>
                  <CardDescription>
                    Current subscription status, billing cycle, and monthly plan rate
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    isExpiredState
                      ? "destructive"
                      : summary?.status === "ACTIVE"
                        ? "default"
                        : "secondary"
                  }
                  className={
                    !isExpiredState && summary?.status === "ACTIVE"
                      ? "bg-[#FF6A00] text-[#0B1F3B] font-bold"
                      : "font-semibold"
                  }
                >
                  {summary?.status || "UNKNOWN"}
                </Badge>
                {summary && (
                  <span className="font-heading font-extrabold text-xl text-foreground">
                    {formatRupees(summary.price_paise)}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
                  </span>
                )}
              </div>
            </CardHeader>

            {summary && (
              <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-0">
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-[#FF6A00]" />
                    Start Date
                  </div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {formatDateLabel(summary.starts_at, "—")}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-[#FF6A00]" />
                    Expiry / Renewal Date
                  </div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {formatDateLabel(summary.ends_at, "No expiry set")}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-[#FF6A00]" />
                    Validity Status
                  </div>
                  <div
                    className={`mt-1 text-sm font-bold ${
                      isExpiredState
                        ? "text-destructive"
                        : isExpiringSoonState
                          ? "text-amber-600"
                          : "text-foreground"
                    }`}
                  >
                    {formatRemainingLabel(summary.days_remaining, isExpiredState)}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Resource Usage & Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#FF6A00]" />
                Resource Usage & Limits
              </CardTitle>
              <CardDescription>
                Live usage counted against your current plan allowances.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {LIMIT_LABELS.map(({ key, label, unit }) => {
                const metric = summary?.limits?.[key];
                if (!metric) return null;
                const limitVal = metric.limit;
                const isUnlimited = limitVal === null || limitVal < 0;
                const pct =
                  !isUnlimited && limitVal > 0
                    ? Math.min(100, Math.round((metric.current / limitVal) * 100))
                    : 0;
                return (
                  <div
                    key={key}
                    className="rounded-lg border border-border p-3.5 bg-background space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                      {metric.over_limit && (
                        <Badge variant="destructive" className="text-[10px]">
                          Over Limit
                        </Badge>
                      )}
                    </div>
                    <div className="text-base font-bold text-foreground">
                      {metric.current}
                      {unit ? ` ${unit}` : ""}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        / {isUnlimited ? "Unlimited" : `${limitVal}${unit ? ` ${unit}` : ""}`}
                      </span>
                    </div>
                    {!isUnlimited && (
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            metric.over_limit ? "bg-destructive" : "bg-[#FF6A00]"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
