import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
  Building2,
  Users,
  Plus,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Skeleton } from "../../components/ui/skeleton";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";

export interface PlanRecord {
  id: string;
  name: string;
  slug: string;
  price_paise: number;
  entitlements: {
    max_branches?: number;
    max_service_areas?: number;
    max_tables?: number;
    max_menu_items?: number;
    floor_editor?: boolean;
    table_merge?: boolean;
    courses?: boolean;
    reports?: boolean;
    [key: string]: unknown;
  };
  is_active: boolean;
}

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  plan_name?: string;
  status: string;
}

export const PlatformPlansPage: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanRecord | null>(null);

  const fetchPlansAndTenants = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [plansRes, tenantsRes] = await Promise.allSettled([
        apiClient.get<PlanRecord[]>("/plans/"),
        apiClient.get<ListResponse<TenantItem> | TenantItem[]>("/tenants/"),
      ]);

      if (plansRes.status === "fulfilled") {
        setPlans(plansRes.value.data);
      } else {
        setError("Failed to load platform subscription plans.");
      }

      if (tenantsRes.status === "fulfilled") {
        setTenants(unwrapList<TenantItem>(tenantsRes.value.data));
      }
    } catch {
      setError("Failed to load platform subscription plans.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlansAndTenants();
  }, []);

  // Tenants subscribed to the currently selected plan
  const subscribedTenants = useMemo(() => {
    if (!selectedPlan) return [];
    return tenants.filter((t) => {
      const planName = (t.plan_name || "").toLowerCase();
      const planSlug = selectedPlan.slug.toLowerCase();
      const planTitle = selectedPlan.name.toLowerCase();
      return (
        planName === planSlug ||
        planName === planTitle ||
        planName.includes(planSlug) ||
        planTitle.includes(planName)
      );
    });
  }, [selectedPlan, tenants]);

  const getSubscribersCount = (plan: PlanRecord) => {
    return tenants.filter((t) => {
      const planName = (t.plan_name || "").toLowerCase();
      const planSlug = plan.slug.toLowerCase();
      const planTitle = plan.name.toLowerCase();
      return (
        planName === planSlug ||
        planName === planTitle ||
        planName.includes(planSlug) ||
        planTitle.includes(planName)
      );
    }).length;
  };

  const formatQuota = (val: number | undefined) => {
    if (val === undefined || val === null) return "Unlimited";
    if (val === -1) return "Unlimited";
    return val.toString();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            Tier Management &amp; Entitlements
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground mt-0.5 flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-[#FF6A00]" />
            SaaS Subscription Plans
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Compact pricing cards with operational quotas and feature entitlements. Click any plan card to inspect full details.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchPlansAndTenants}
            disabled={isLoading}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/admin/tenants/new")}
            className="text-xs bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white gap-1.5"
          >
            <Plus className="w-4 h-4" /> New Customer
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Compact Plans Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-xs">
          No active subscription plans found.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isPopular = p.slug.includes("pro") || p.slug.includes("business");
            const subCount = getSubscribersCount(p);

            return (
              <div
                key={p.id}
                onClick={() => setSelectedPlan(p)}
                className={`group relative p-4 rounded-xl border bg-card cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] flex flex-col justify-between ${
                  isPopular
                    ? "border-[#FF6A00] ring-1 ring-[#FF6A00]/40 shadow-xs"
                    : "border-border hover:border-foreground/30"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-2.5 right-4 px-2 py-0.5 bg-[#FF6A00] text-white text-[10px] font-black uppercase tracking-wider rounded-full shadow-xs">
                    Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h2 className="text-base font-extrabold text-foreground group-hover:text-[#FF6A00] transition-colors">
                      {p.name}
                    </h2>
                    <Badge variant="outline" className="text-[10px] font-mono uppercase bg-muted/30">
                      {p.slug}
                    </Badge>
                  </div>

                  <div className="mt-2 mb-3">
                    <span className="text-2xl font-black text-foreground">
                      {formatRupees(p.price_paise)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1 font-medium">/ month</span>
                  </div>

                  {/* Compact Quick Limits & Feature Highlights */}
                  <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="px-2 py-0.5 rounded bg-muted font-semibold">
                      {formatQuota(p.entitlements.max_branches)} outlet(s)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-muted font-semibold">
                      {formatQuota(p.entitlements.max_tables)} tables
                    </span>
                    {p.entitlements.floor_editor && (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                        Visual Floor Plan Editor
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-blue-500" />
                    {subCount} {subCount === 1 ? "Brand" : "Brands"}
                  </span>
                  <span className="text-[#FF6A00] font-bold text-[11px] group-hover:underline flex items-center gap-0.5">
                    View details <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Entitlements Modal Dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={(open) => !open && setSelectedPlan(null)}>
        {selectedPlan && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto font-sans">
            <DialogHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
                    Tier Entitlements &amp; Operational Quotas
                  </span>
                  <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-2 mt-0.5">
                    {selectedPlan.name}
                    <Badge variant="outline" className="text-xs font-mono uppercase">
                      {selectedPlan.slug}
                    </Badge>
                  </DialogTitle>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-foreground">
                    {formatRupees(selectedPlan.price_paise)}
                  </span>
                  <span className="text-xs text-muted-foreground block">per month (billed monthly)</span>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Quotas Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Operational Limits &amp; Quotas
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">Max Outlets</span>
                    <span className="text-lg font-black text-foreground mt-0.5 block">
                      {formatQuota(selectedPlan.entitlements.max_branches)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">Dining Tables</span>
                    <span className="text-lg font-black text-foreground mt-0.5 block">
                      {formatQuota(selectedPlan.entitlements.max_tables)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">Service Areas</span>
                    <span className="text-lg font-black text-foreground mt-0.5 block">
                      {formatQuota(selectedPlan.entitlements.max_service_areas)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-border bg-muted/20">
                    <span className="text-[11px] text-muted-foreground block">Menu Dishes</span>
                    <span className="text-lg font-black text-foreground mt-0.5 block">
                      {formatQuota(selectedPlan.entitlements.max_menu_items)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Feature Flags & Capabilities */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Platform Feature Entitlements
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    {
                      label: "Visual Floor Plan Editor",
                      enabled: !!selectedPlan.entitlements.floor_editor,
                      desc: "Drag-and-drop table layouts and section mapping",
                    },
                    {
                      label: "Dynamic Table Merging",
                      enabled: !!selectedPlan.entitlements.table_merge,
                      desc: "Combine adjacent tables for large party guest seating",
                    },
                    {
                      label: "Multi-Course Pacing (KOT)",
                      enabled: !!selectedPlan.entitlements.courses,
                      desc: "Appetizer, Main, Dessert staged fire tickets",
                    },
                    {
                      label: "Kitchen Station Routing (KDS)",
                      enabled: true,
                      desc: "Direct ticket dispatch to hot kitchen, pantry, and bar",
                    },
                    {
                      label: "Token Numbers & Counter Queue",
                      enabled: true,
                      desc: "Quick service token tracking for tea shops and bakeries",
                    },
                    {
                      label: "QR Dine-In Mobile Ordering",
                      enabled: true,
                      desc: "Guest mobile menu browsing, ordering, and self-service",
                    },
                  ].map((feat) => (
                    <div
                      key={feat.label}
                      className="p-2.5 rounded-lg border border-border bg-card flex items-start gap-2.5"
                    >
                      {feat.enabled ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span
                          className={`font-bold block ${
                            feat.enabled ? "text-foreground" : "text-muted-foreground line-through"
                          }`}
                        >
                          {feat.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-tight">
                          {feat.desc}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subscribed Brands on this tier */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Subscribed Brands ({subscribedTenants.length})
                  </h3>
                  <span className="text-[11px] text-muted-foreground">Active venue chains</span>
                </div>

                {subscribedTenants.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 rounded-lg border border-dashed border-border text-center">
                    No active restaurant brands currently subscribed to this plan.
                  </p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {subscribedTenants.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedPlan(null);
                          navigate(`/admin/tenants/${t.id}`);
                        }}
                        className="p-2 rounded-md border border-border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-[#FF6A00]" />
                          <span className="font-bold text-foreground">{t.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">({t.business_type})</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {t.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => setSelectedPlan(null)}>
                  Close
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedPlan(null);
                    navigate("/admin/tenants/new");
                  }}
                  className="bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white text-xs gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Provision New Customer
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};
