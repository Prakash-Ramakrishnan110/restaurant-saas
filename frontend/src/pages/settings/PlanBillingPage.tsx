import React, { useEffect, useState } from "react";
import { CreditCard, CheckCircle2, AlertTriangle, Sparkles, Layers } from "lucide-react";
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
import { unwrapList } from "../../api/pagination";
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
  status: string;
  limits: {
    max_branches?: LimitMetric;
    max_service_areas?: LimitMetric;
    max_tables?: LimitMetric;
    max_menu_items?: LimitMetric;
    max_image_storage_mb?: LimitMetric;
  };
  features?: Record<string, boolean>;
}

interface PlanOption {
  id: string;
  name: string;
  slug: string;
  price_paise: number;
  entitlements: Record<string, number | boolean | null>;
  is_active: boolean;
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

const FEATURE_LABELS: Record<string, string> = {
  floor_editor: "Visual Floor Plan Editor",
  table_merge: "Table Join & Split",
  courses: "Multi-Course Kitchen Firing",
  allows_huts: "Dhaba Huts & Lawn Seating",
  allows_waiter_call: "QR Waiter Call Alerts",
  allows_minimum_spend: "Minimum Spend Controls",
  allows_room_service: "Hotel Room Service",
  allows_room_folio: "Hotel Room Folio Billing",
  kds_multi_station: "Multi-Station KDS Routing",
};

export const PlanBillingPage: React.FC = () => {
  const [summary, setSummary] = useState<EntitlementsSummary | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const loadPlanData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [entRes, plansRes] = await Promise.all([
          apiClient.get<EntitlementsSummary>("/entitlements/"),
          apiClient.get<PlanOption[] | { results: PlanOption[] }>("/plans/"),
        ]);
        if (!mounted) return;
        setSummary(entRes.data);
        setPlans(unwrapList<PlanOption>(plansRes.data));
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

  const currentPlanMatch = plans.find(
    (p) => summary && p.name.toLowerCase() === summary.plan_name.toLowerCase()
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Plan & Billing"
        description="View your active subscription plan, usage limits, and included capabilities."
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="h-40 animate-pulse bg-muted/40" />
          <Card className="h-40 animate-pulse bg-muted/40" />
        </div>
      ) : (
        <>
          {/* Current Plan Summary */}
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
                    Current subscription status and monthly plan rate
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={summary?.status === "ACTIVE" ? "default" : "secondary"}
                  className={
                    summary?.status === "ACTIVE"
                      ? "bg-[#FF6A00] text-[#0B1F3B] font-bold"
                      : "font-semibold"
                  }
                >
                  {summary?.status || "UNKNOWN"}
                </Badge>
                {currentPlanMatch && (
                  <span className="font-heading font-extrabold text-xl text-foreground">
                    {formatRupees(currentPlanMatch.price_paise)}
                    <span className="text-xs font-normal text-muted-foreground"> / month</span>
                  </span>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Usage & Limits */}
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
                const pct =
                  limitVal && limitVal > 0
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
                        / {limitVal === null ? "Unlimited" : `${limitVal}${unit ? ` ${unit}` : ""}`}
                      </span>
                    </div>
                    {limitVal !== null && (
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

          {/* Included Features */}
          {summary?.features && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#FF6A00]" />
                  Included Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(summary.features).map(([key, enabled]) => {
                  if (!enabled) return null;
                  return (
                    <Badge
                      key={key}
                      variant="outline"
                      className="px-3 py-1 text-xs font-medium flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      {FEATURE_LABELS[key] || key}
                    </Badge>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Available Plans */}
          {plans.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-bold font-heading text-foreground">Available Plans</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((plan) => {
                  const isCurrent =
                    summary && plan.name.toLowerCase() === summary.plan_name.toLowerCase();
                  return (
                    <Card
                      key={plan.id}
                      className={
                        isCurrent ? "border-[#FF6A00] ring-1 ring-[#FF6A00]/40" : "border-border"
                      }
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">{plan.name}</CardTitle>
                          {isCurrent && (
                            <Badge className="bg-[#FF6A00] text-[#0B1F3B] text-[10px] font-bold">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="text-2xl font-extrabold font-heading text-foreground pt-1">
                          {formatRupees(plan.price_paise)}
                          <span className="text-xs font-normal text-muted-foreground"> / mo</span>
                        </div>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground space-y-1.5">
                        <div>
                          Branches:{" "}
                          <strong className="text-foreground">
                            {plan.entitlements?.max_branches ?? "Unlimited"}
                          </strong>
                        </div>
                        <div>
                          Tables / Rooms:{" "}
                          <strong className="text-foreground">
                            {plan.entitlements?.max_tables ?? "Unlimited"}
                          </strong>
                        </div>
                        <div>
                          Menu Items:{" "}
                          <strong className="text-foreground">
                            {plan.entitlements?.max_menu_items ?? "Unlimited"}
                          </strong>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
