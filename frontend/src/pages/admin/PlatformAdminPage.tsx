import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  ShieldCheck,
  Power,
  PowerOff,
  Layers,
  CheckCircle2,
  Plus,
  PlusCircle,
  Eye,
  IndianRupee,
  Search,
  Download,
  RefreshCw,
  FileText,
  Activity,
  LifeBuoy,
  Megaphone,
  ArrowRight,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { formatRupees } from "../../utils/currency";
import { PlatformAdminNav } from "../../components/admin/PlatformAdminNav";

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
  api_health: string;
}

export const PlatformAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Search & Filtering States
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>("ALL");
  const [planFilter, setPlanFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "outlets">("newest");

  const fetchTenants = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [tenantsRes, summaryRes] = await Promise.allSettled([
        apiClient.get<ListResponse<TenantItem> | TenantItem[]>("/tenants/"),
        apiClient.get<PlatformSummary>("/platform/summary/"),
      ]);

      if (tenantsRes.status === "fulfilled") {
        setTenants(unwrapList<TenantItem>(tenantsRes.value.data));
      }
      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value.data);
      }
      if (isManualRefresh) {
        setToastMsg("Platform metrics refreshed successfully.");
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleToggleStatus = async (tenant: TenantItem) => {
    setActionLoading(tenant.id);
    try {
      if (tenant.status === "ACTIVE") {
        await apiClient.post(`/tenants/${tenant.id}/suspend/`, {
          reason: "Platform operator manual toggle",
        });
        setToastMsg(`Suspended ${tenant.name}`);
      } else {
        await apiClient.post(`/tenants/${tenant.id}/activate/`, {
          reason: "Platform operator manual toggle",
        });
        setToastMsg(`Activated ${tenant.name}`);
      }
      await fetchTenants();
    } catch {
      setToastMsg("Could not change tenant status.");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredTenants = useMemo(() => {
    return tenants
      .filter((t) => {
        if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
        if (businessTypeFilter !== "ALL" && t.business_type !== businessTypeFilter) return false;
        if (planFilter !== "ALL" && (t.plan_name || "Starter") !== planFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = (t.name || "").toLowerCase().includes(q);
          const matchSlug = (t.slug || "").toLowerCase().includes(q);
          const matchEmail = (t.owner_email || "").toLowerCase().includes(q);
          if (!matchName && !matchSlug && !matchEmail) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "outlets") return (b.branches_count || 1) - (a.branches_count || 1);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [tenants, statusFilter, businessTypeFilter, planFilter, searchQuery, sortBy]);

  const handleExportCSV = () => {
    if (filteredTenants.length === 0) {
      setToastMsg("No tenants to export.");
      return;
    }
    const headers = [
      "ID",
      "Brand Name",
      "Slug",
      "Business Type",
      "Status",
      "Plan",
      "Owner Email",
      "Outlets",
      "Created At",
    ];
    const rows = filteredTenants.map((t) => [
      t.id,
      `"${(t.name || "").replace(/"/g, '""')}"`,
      t.slug,
      t.business_type || "RESTAURANT",
      t.status,
      t.plan_name || "Starter",
      t.owner_email || "",
      t.branches_count || 1,
      t.created_at || "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `servemyfood_tenants_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMsg(`Exported ${filteredTenants.length} tenants to CSV`);
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
    setBusinessTypeFilter("ALL");
    setPlanFilter("ALL");
    setSortBy("newest");
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    statusFilter !== "ALL" ||
    businessTypeFilter !== "ALL" ||
    planFilter !== "ALL" ||
    sortBy !== "newest";

  const quickModules = [
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
      description: "Manage Starter, Growth, Pro, and Enterprise quotas and pricing.",
      path: "/admin/plans",
      icon: Layers,
      badge: "Billing & Plans",
      color: "border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20",
      iconColor: "text-blue-500",
      cta: "Configure Plans",
    },
    {
      title: "System Health & Uptime",
      description: "Inspect Redis, PostgreSQL database latency, and API response metrics.",
      path: "/admin/health",
      icon: Activity,
      badge: "Infrastructure",
      color: "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20",
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
      badge: "Helpdesk",
      color: "border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20",
      iconColor: "text-amber-700 dark:text-amber-400",
      cta: "Open Helpdesk",
    },
    {
      title: "Broadcast Announcements",
      description: "Publish emergency banners or scheduled maintenance notices.",
      path: "/admin/announcements",
      icon: Megaphone,
      badge: "Broadcasts",
      color: "border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20",
      iconColor: "text-purple-500",
      cta: "Post Banner",
    },
  ];

  const getBusinessTypeColor = (type?: string) => {
    switch (type) {
      case "RESTAURANT":
        return "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-800";
      case "CAFE":
        return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800";
      case "TEA_SHOP":
        return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800";
      case "HOTEL":
        return "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-800";
      default:
        return "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-800";
    }
  };

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

      {/* 1. Super Admin Sub-Navigation Bar */}
      <PlatformAdminNav />

      {/* 2. Executive Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            SaaS Platform Operator
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground mt-0.5 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-600" /> Super-Admin Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage registered restaurant chains, subscription quotas, system health, and customer
            support across India.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchTenants(true)}
            disabled={refreshing}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={() => navigate("/admin/tenants/new")}
            className="text-xs bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white gap-1.5"
          >
            <Plus className="h-4 w-4" /> New Customer
          </Button>

          <Badge variant="outline" className="text-xs px-3 py-1 font-bold bg-muted/40">
            {user?.email}
          </Badge>
        </div>
      </div>

      {/* 3. Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3 shadow-sm hover:border-border/80 transition-all">
          <Building2 className="h-8 w-8 text-[#FF6A00] shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground font-semibold">Active Restaurants</span>
            <div className="text-2xl font-extrabold text-foreground">
              {summary ? summary.active_tenants : tenants.length}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold">
              +{summary?.new_this_week || 0} onboarded this week
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3 shadow-sm hover:border-border/80 transition-all">
          <Layers className="h-8 w-8 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground font-semibold">
              Live Outlets & Stalls
            </span>
            <div className="text-2xl font-extrabold text-foreground">
              {tenants.reduce((sum, t) => sum + (t.branches_count || 1), 0)}
            </div>
            <span className="text-[11px] text-muted-foreground">across all tenant brands</span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3 shadow-sm hover:border-border/80 transition-all">
          <IndianRupee className="h-8 w-8 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground font-semibold">Monthly MRR (Live)</span>
            <div className="text-2xl font-extrabold text-foreground">
              {summary ? formatRupees(summary.mrr_paise) : "₹0.00"}
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold">
              {Object.keys(summary?.plan_distribution || {}).length} Active Plans
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3 shadow-sm hover:border-border/80 transition-all">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-muted-foreground font-semibold">Platform Status</span>
            <div className="text-2xl font-extrabold text-emerald-600">
              {summary?.api_health === "HEALTHY" ? "100% Online" : "Degraded"}
            </div>
            <button
              onClick={() => navigate("/admin/health")}
              className="text-[11px] text-[#FF6A00] hover:underline font-semibold flex items-center gap-0.5"
            >
              View health details <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Command Hub: 6 Management Modules */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Platform Command Modules & Tools
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
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {mod.badge}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {mod.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-semibold text-foreground hover:text-[#FF6A00]">
                  <span>{mod.cta}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Subscription Distribution Filter Pills */}
      {summary?.plan_distribution && Object.keys(summary.plan_distribution).length > 0 && (
        <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 mr-1">
            <Layers className="h-3.5 w-3.5" /> Tier Filter:
          </span>
          <button
            onClick={() => setPlanFilter("ALL")}
            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
              planFilter === "ALL"
                ? "bg-[#FF6A00] text-[#0B1F3B] shadow-xs"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            All Plans ({tenants.length})
          </button>
          {Object.entries(summary.plan_distribution).map(([planName, count]) => (
            <button
              key={planName}
              onClick={() => setPlanFilter(planFilter === planName ? "ALL" : planName)}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                planFilter === planName
                  ? "bg-[#FF6A00] text-[#0B1F3B] shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {planName} ({count})
            </button>
          ))}
        </div>
      )}

      {/* 6. Tenants Directory Header & Toolbar */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                All Registered Restaurant Tenants
              </h2>
              <p className="text-xs text-muted-foreground">
                Showing {filteredTenants.length} of {tenants.length} registered brands
              </p>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-xs text-muted-foreground hover:text-foreground h-8 gap-1"
              >
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            )}
          </div>

          {/* Search & Multi-Criteria Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search brand, slug, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <select
              aria-label="Filter by business type"
              value={businessTypeFilter}
              onChange={(e) => setBusinessTypeFilter(e.target.value)}
              className="text-xs font-medium bg-background border border-input rounded-md px-3 h-9 focus:ring-2 focus:ring-[#FF6A00] outline-none"
            >
              <option value="ALL">All Business Types</option>
              <option value="RESTAURANT">Dining Restaurant</option>
              <option value="CAFE">Cafe / Bakery</option>
              <option value="TEA_SHOP">Quick Service / Tea Shop</option>
              <option value="HOTEL">Hotel & Resort</option>
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium bg-background border border-input rounded-md px-3 h-9 focus:ring-2 focus:ring-[#FF6A00] outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="TRIAL">Trial</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            <select
              aria-label="Sort tenants by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "name" | "outlets")}
              className="text-xs font-medium bg-background border border-input rounded-md px-3 h-9 focus:ring-2 focus:ring-[#FF6A00] outline-none"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="name">Sort: Brand Name (A-Z)</option>
              <option value="outlets">Sort: Most Outlets</option>
            </select>
          </div>
        </div>

        {/* Tenants Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center space-y-2">
              <RefreshCw className="h-8 w-8 text-[#FF6A00] animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground font-semibold">
                Loading platform tenants...
              </p>
            </div>
          ) : filteredTenants.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Building2 className="h-10 w-10 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-bold text-foreground">No matching restaurant tenants</p>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search query, status filters, or business type selection.
              </p>
              {hasActiveFilters && (
                <Button size="sm" variant="outline" onClick={clearAllFilters} className="text-xs mt-2">
                  Reset All Filters
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[11px] border-b border-border">
                <tr>
                  <th className="py-3 px-4">Restaurant Brand</th>
                  <th className="py-3 px-4">Business Preset</th>
                  <th className="py-3 px-4">Subscription Plan</th>
                  <th className="py-3 px-4">Outlets</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => navigate(`/admin/tenants/${t.id}`)}
                        className="font-bold text-foreground text-sm text-left hover:text-[#FF6A00] transition-colors block"
                      >
                        {t.name}
                      </button>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          slug: {t.slug}
                        </span>
                        {t.owner_email && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            • {t.owner_email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getBusinessTypeColor(
                          t.business_type
                        )}`}
                      >
                        {t.business_type || "RESTAURANT"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-foreground">
                      <Badge variant="outline" className="text-[11px] font-semibold bg-muted/30">
                        {t.plan_name || "Starter"}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-foreground">
                      {t.branches_count || 1} outlet{((t.branches_count || 1) > 1) ? "s" : ""}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={t.status === "ACTIVE" ? "default" : "destructive"}
                        className={`text-[10px] font-bold ${
                          t.status === "ACTIVE"
                            ? "bg-emerald-600 text-white"
                            : t.status === "TRIAL"
                              ? "bg-blue-600 text-white"
                              : ""
                        }`}
                      >
                        {t.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => navigate(`/admin/tenants/${t.id}`)}
                        >
                          <Eye className="h-3 w-3" /> Details
                        </Button>
                        <Button
                          size="sm"
                          variant={t.status === "ACTIVE" ? "destructive" : "default"}
                          className="h-7 text-xs gap-1"
                          disabled={actionLoading === t.id}
                          onClick={() => handleToggleStatus(t)}
                        >
                          {t.status === "ACTIVE" ? (
                            <>
                              <PowerOff className="h-3 w-3" /> Suspend
                            </>
                          ) : (
                            <>
                              <Power className="h-3 w-3" /> Activate
                            </>
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
