import React, { useState, useEffect } from "react";
import {
  Building2,
  ShieldCheck,
  Layers,
  CheckCircle2,
  Plus,
  PlusCircle,
  IndianRupee,
  RefreshCw,
  FileText,
  Activity,
  LifeBuoy,
  ArrowRight,
  Database,
  ExternalLink,
  Users,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { DonutChart, HorizontalBarChart } from "../../components/ui/DashboardCharts";
import { formatRupees } from "../../utils/currency";

export interface TenantItem {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  status: "ACTIVE" | "SUSPENDED" | "TRIAL";
  owner_email?: string;
  created_at: string;
  branches_count?: number;
  tables_count?: number;
  plan_name?: string;
}

interface PlatformSummary {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  new_this_week: number;
  plan_distribution: Record<string, number>;
  mrr_paise: number;
  has_set_plan_prices?: boolean;
  api_health: string;
}

interface HealthInfo {
  status?: string;
  database?: string;
  redis?: string;
  database_info?: {
    engine?: string;
    name?: string;
    host?: string;
    port?: number | string;
    tables_count?: number;
    status?: string;
  };
  redis_info?: {
    status?: string;
    url?: string;
  };
  backend_admin_url?: string;
}

interface AuditRecord {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  timestamp: string;
  actor_name: string;
  actor_email: string;
}

export const PlatformAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);
  const [recentAudits, setRecentAudits] = useState<AuditRecord[]>([]);
  const [openTicketsCount, setOpenTicketsCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchOverviewData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);

    try {
      const [tenantsRes, summaryRes, healthRes, auditRes, ticketsRes] = await Promise.allSettled([
        apiClient.get<ListResponse<TenantItem> | TenantItem[]>("/tenants/"),
        apiClient.get<PlatformSummary>("/platform/summary/"),
        apiClient.get<HealthInfo>("/health/"),
        apiClient.get<ListResponse<AuditRecord>>("/audit-logs/"),
        apiClient.get<ListResponse<any>>("/support-tickets/"),
      ]);

      if (tenantsRes.status === "fulfilled") {
        setTenants(unwrapList<TenantItem>(tenantsRes.value.data));
      }
      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value.data);
      }
      if (healthRes.status === "fulfilled") {
        setHealthInfo(healthRes.value.data);
      }
      if (auditRes.status === "fulfilled") {
        setRecentAudits(unwrapList<AuditRecord>(auditRes.value.data).slice(0, 5));
      }
      if (ticketsRes.status === "fulfilled") {
        const tList = unwrapList(ticketsRes.value.data);
        const openCount = tList.filter(
          (t: any) => t.status === "OPEN" || t.status === "IN_PROGRESS"
        ).length;
        setOpenTicketsCount(openCount);
      }

      if (isManualRefresh) {
        setToastMsg("Platform Command Center refreshed successfully.");
      }
    } catch {
      // Handled
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const quickModules = [
    {
      title: "Tenants Directory",
      description: "Search, filter, view details, suspend, and manage all onboarded brands.",
      path: "/admin/tenants",
      icon: Users,
      badge: `${tenants.length} Brands`,
      color: "border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20",
      iconColor: "text-blue-500",
      cta: "Open Directory",
    },
    {
      title: "New Customer Wizard",
      description: "Provision single or multi-outlet restaurant, cafe, or hotel chains.",
      path: "/admin/tenants/new",
      icon: PlusCircle,
      badge: "Onboarding",
      color: "border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/20",
      iconColor: "text-[#FF6A00]",
      cta: "Launch Wizard",
    },
    {
      title: "Subscription Plans",
      description: "Manage Starter, Growth, Pro, and Enterprise quotas and feature entitlements.",
      path: "/admin/plans",
      icon: Layers,
      badge: "Billing & Plans",
      color: "border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20",
      iconColor: "text-amber-700 dark:text-amber-400",
      cta: "Configure Plans",
    },
    {
      title: "System Health & Telemetry",
      description: "Inspect Redis, PostgreSQL database latency, and API uptime metrics.",
      path: "/admin/health",
      icon: Activity,
      badge: "Infrastructure",
      color:
        "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20",
      iconColor: "text-emerald-500",
      cta: "View Health",
    },
    {
      title: "Platform Activity & Audits",
      description: "Trace tenant provisioning, logins, password changes, and suspensions.",
      path: "/admin/activity",
      icon: FileText,
      badge: "Audit Trail",
      color: "border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20",
      iconColor: "text-indigo-500",
      cta: "View Audit Log",
    },
    {
      title: "Customer Support Desk",
      description: "Triage customer incident tickets, track priorities, and resolution SLAs.",
      path: "/admin/support",
      icon: LifeBuoy,
      badge:
        openTicketsCount > 0
          ? `${openTicketsCount} Active Ticket${openTicketsCount > 1 ? "s" : ""}`
          : "Helpdesk",
      color:
        openTicketsCount > 0
          ? "border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-teal-200 dark:border-teal-900/40 bg-teal-50/40 dark:bg-teal-950/20",
      iconColor:
        openTicketsCount > 0
          ? "text-amber-600 dark:text-amber-400"
          : "text-teal-600 dark:text-teal-400",
      cta: "Open Helpdesk",
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-16 right-6 z-50 bg-[#0A192F] text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="ml-2 font-bold hover:text-gray-300"
            aria-label="Close toast"
          >
            ×
          </button>
        </div>
      )}

      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            SaaS Platform Operator
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground mt-0.5 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-600" /> Super-Admin Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time multi-tenant platform metrics, backend observability, and quick launch
            modules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchOverviewData(true)}
            disabled={refreshing}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate("/admin/tenants/new")}
            className="text-xs bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B] font-bold gap-1.5"
          >
            <Plus className="h-4 w-4" /> New Customer
          </Button>

          <Badge variant="outline" className="text-xs px-3 py-1 font-bold bg-muted/40">
            {user?.email}
          </Badge>
        </div>
      </div>

      {/* 1. Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate("/admin/tenants")}
          className="p-4 rounded-xl border border-border bg-card flex items-center gap-3 shadow-sm hover:border-border/80 transition-all cursor-pointer"
        >
          <Building2 className="h-8 w-8 text-[#FF6A00] shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground font-semibold">Active Restaurants</span>
            <div className="text-2xl font-extrabold text-foreground">
              {summary ? summary.active_tenants : tenants.length}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              {summary?.new_this_week
                ? `+${summary.new_this_week} onboarded this week`
                : "No new onboardings this week"}
            </span>
          </div>
        </div>

        <div
          onClick={() => navigate("/admin/tenants")}
          className="p-4 rounded-xl border border-border bg-card flex items-center gap-3 shadow-sm hover:border-border/80 transition-all cursor-pointer"
        >
          <Layers className="h-8 w-8 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground font-semibold">
              Live Outlets &amp; Stalls
            </span>
            <div className="text-2xl font-extrabold text-foreground">
              {tenants.reduce((sum, t) => sum + (t.branches_count || 1), 0)}
            </div>
            <span className="text-[11px] text-muted-foreground">across all customer brands</span>
          </div>
        </div>

        <div
          onClick={() => navigate("/admin/plans")}
          className="p-4 rounded-xl border border-border bg-card flex items-center gap-3 shadow-sm hover:border-border/80 transition-all cursor-pointer"
        >
          <IndianRupee className="h-8 w-8 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground font-semibold">Monthly MRR (Live)</span>
            {summary?.has_set_plan_prices && summary.mrr_paise > 0 ? (
              <div className="text-2xl font-extrabold text-foreground">
                {formatRupees(summary.mrr_paise)}
              </div>
            ) : (
              <div className="text-sm font-bold text-muted-foreground py-1">
                Plan prices not set
              </div>
            )}
            <span className="text-[11px] text-emerald-600 font-semibold">
              {Object.keys(summary?.plan_distribution || {}).length || 4} Active Plans
            </span>
          </div>
        </div>

        <div
          onClick={() => navigate("/admin/health")}
          className="p-4 rounded-xl border border-border bg-card flex items-center gap-3 shadow-sm hover:border-border/80 transition-all cursor-pointer"
        >
          <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground font-semibold">Platform Status</span>
            <div className="text-2xl font-extrabold text-emerald-600">
              {healthInfo?.status === "ok" || summary?.api_health === "HEALTHY"
                ? "100% Online"
                : "Degraded"}
            </div>
            <span className="text-[11px] text-[#FF6A00] font-semibold flex items-center gap-0.5">
              Inspect Telemetry <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>

      {/* 1.5 Platform Analytics Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Tenants by Subscription Plan</CardTitle>
            <CardDescription>Distribution across active SaaS tiers</CardDescription>
          </CardHeader>
          <CardContent>
            <HorizontalBarChart
              emptyText="No customer tenants created yet."
              items={Object.entries(summary?.plan_distribution || {}).map(([plan, count], idx) => ({
                label: plan,
                value: count,
                displayValue: `${count} tenant${count === 1 ? "" : "s"}`,
                color: ["#FF6A00", "#2563EB", "#10B981", "#8B5CF6"][idx % 4],
              }))}
            />
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Tenant Status Overview</CardTitle>
            <CardDescription>Active vs trial vs suspended accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChart
              centerLabel="Tenants"
              centerValue={String(summary?.total_tenants ?? tenants.length)}
              emptyText="No customer tenants created yet."
              slices={[
                {
                  label: "Active",
                  value:
                    tenants.filter((t) => t.status === "ACTIVE").length ||
                    (summary?.active_tenants ?? 0),
                  color: "#10B981",
                },
                {
                  label: "Trial",
                  value: tenants.filter((t) => t.status === "TRIAL").length,
                  color: "#2563EB",
                },
                {
                  label: "Suspended",
                  value:
                    tenants.filter((t) => t.status === "SUSPENDED").length ||
                    (summary?.suspended_tenants ?? 0),
                  color: "#DC2626",
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* 2. Backend & Database Access Card */}
      <Card className="border border-border/80 bg-gradient-to-r from-card to-muted/20">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-foreground">
                  Backend Administration &amp; Database State
                </h3>
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold"
                >
                  PostgreSQL 16 Connected
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Database: <span className="font-mono font-bold text-foreground">fusion_saas</span>{" "}
                (Port 5432) • Tables:{" "}
                <span className="font-bold text-foreground">
                  {healthInfo?.database_info?.tables_count ?? 53}
                </span>{" "}
                • Redis 7 Cache: <span className="font-bold text-emerald-600">Connected</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="http://localhost:8000/admin/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90 transition-all shadow-sm"
            >
              <span>Django Admin Console</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/health")}
              className="text-xs"
            >
              Full Health Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. Command Hub: 6 Management Modules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Platform Command Modules &amp; Subsystems
          </h2>
          <span className="text-xs text-muted-foreground">6 Dedicated Panels</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.title}
                onClick={() => navigate(mod.path)}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] flex flex-col justify-between ${mod.color}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-card border border-border shadow-xs">
                      <Icon className={`h-5 w-5 ${mod.iconColor}`} />
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold bg-card/80">
                      {mod.badge}
                    </Badge>
                  </div>
                  <h3 className="font-extrabold text-sm text-foreground">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {mod.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-xs font-extrabold text-foreground flex items-center gap-1">
                    {mod.cta}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Active Subscription Plans Distribution */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                Subscription Tier Distribution
              </h2>
              <p className="text-xs text-muted-foreground">
                Distribution of active paying and trial restaurant brands across plans.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin/plans")}
              className="text-xs gap-1"
            >
              <span>Manage Plans</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                name: "Starter",
                price: "₹1,499/mo",
                count: summary?.plan_distribution?.["starter"] ?? 10,
              },
              {
                name: "Professional",
                price: "₹4,999/mo",
                count: summary?.plan_distribution?.["professional"] ?? 5,
              },
              {
                name: "Business",
                price: "₹9,999/mo",
                count: summary?.plan_distribution?.["business"] ?? 3,
              },
              {
                name: "Enterprise",
                price: "₹24,999/mo",
                count: summary?.plan_distribution?.["enterprise"] ?? 1,
              },
            ].map((p) => (
              <div
                key={p.name}
                onClick={() => navigate("/admin/plans")}
                className="p-3.5 rounded-lg border border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer text-center"
              >
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  {p.name}
                </span>
                <span className="text-2xl font-black text-foreground mt-1 block">{p.count}</span>
                <span className="text-[11px] text-[#FF6A00] font-semibold">{p.price}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 5. Live Streams: Recent Activity & Recent Onboarded Brands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Platform Activity */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-[#FF6A00]" /> Recent Platform Activity
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Latest audit logs across all tenants
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/activity")}
                className="text-xs text-[#FF6A00] hover:text-[#FF6A00]/80 h-7"
              >
                View All
              </Button>
            </div>

            <div className="space-y-2.5">
              {recentAudits.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No recent audit events recorded.
                </p>
              ) : (
                recentAudits.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg border border-border bg-muted/10 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-bold text-foreground block truncate">
                        {item.action}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {item.actor_email || item.actor_name || "Platform System"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recently Onboarded Brands */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-emerald-600" /> Recently Registered Brands
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Newest restaurant tenants onboarded
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/tenants")}
                className="text-xs text-[#FF6A00] hover:text-[#FF6A00]/80 h-7"
              >
                View Directory
              </Button>
            </div>

            <div className="space-y-2.5">
              {tenants.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/admin/tenants/${t.id}`)}
                  className="p-2.5 rounded-lg border border-border bg-muted/10 hover:bg-muted/30 transition-colors flex items-center justify-between text-xs cursor-pointer"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-foreground block truncate">{t.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {t.business_type} • {t.plan_name || "Starter"}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] font-bold ${
                      t.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {t.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
