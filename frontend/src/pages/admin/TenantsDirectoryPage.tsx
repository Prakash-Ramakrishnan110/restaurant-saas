import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Users,
  Plus,
  Search,
  Download,
  RefreshCw,
  Eye,
  Power,
  PowerOff,
  KeyRound,
  X,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";

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

export const TenantsDirectoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tenants, setTenants] = useState<TenantItem[]>([]);
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
      const res = await apiClient.get<ListResponse<TenantItem> | TenantItem[]>("/tenants/");
      setTenants(unwrapList<TenantItem>(res.data));
      if (isManualRefresh) {
        setToastMsg("Customers directory refreshed successfully.");
      }
    } catch {
      // Error handled gracefully
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleToggleStatus = async (tenant: TenantItem) => {
    const isSuspending = tenant.status === "ACTIVE" || tenant.status === "TRIAL";
    const nextStatus = isSuspending ? "SUSPENDED" : "ACTIVE";

    if (
      !window.confirm(
        `Are you sure you want to ${isSuspending ? "SUSPEND" : "ACTIVATE"} ${tenant.name}?`
      )
    ) {
      return;
    }

    setActionLoading(tenant.id);
    try {
      await apiClient.post(`/tenants/${tenant.id}/toggle_status/`, {
        status: nextStatus,
        reason: isSuspending ? "Administrative suspension" : "Administrative reactivation",
      });
      setTenants((prev) =>
        prev.map((t) => (t.id === tenant.id ? { ...t, status: nextStatus } : t))
      );
      setToastMsg(`Customer "${tenant.name}" marked as ${nextStatus}`);
    } catch {
      setToastMsg(`Failed to change status for ${tenant.name}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (tenant: TenantItem) => {
    if (!window.confirm(`Send password reset or reset credentials for ${tenant.name}?`)) {
      return;
    }
    setActionLoading(tenant.id);
    try {
      await apiClient.post(`/tenants/${tenant.id}/reset_owner_password/`);
      setToastMsg(`Password reset instructions triggered for ${tenant.owner_email || tenant.name}`);
    } catch {
      setToastMsg(`Failed to trigger reset for ${tenant.name}`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredTenants = useMemo(() => {
    return tenants
      .filter((t) => {
        if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
        if (businessTypeFilter !== "ALL" && t.business_type !== businessTypeFilter) return false;
        if (
          planFilter !== "ALL" &&
          (t.plan_name || "Starter").toLowerCase() !== planFilter.toLowerCase()
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = t.name.toLowerCase().includes(q);
          const matchSlug = t.slug.toLowerCase().includes(q);
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
    const headers = ["ID", "Name", "Slug", "Type", "Status", "Plan", "Owner Email", "Branches", "Created"];
    const rows = filteredTenants.map((t) => [
      t.id,
      `"${t.name.replace(/"/g, '""')}"`,
      t.slug,
      t.business_type,
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
    setToastMsg(`Exported ${filteredTenants.length} customers to CSV`);
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

      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            Customers Management
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground mt-0.5 flex items-center gap-2">
            <Users className="h-7 w-7 text-[#FF6A00]" /> Customers Directory
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Search, filter, inspect, and manage all registered restaurant chains, cafes, tea shops, and hotels.
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
            className="text-xs bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B] font-bold gap-1.5"
          >
            <Plus className="h-4 w-4" /> New Customer
          </Button>

          <Badge variant="outline" className="text-xs px-3 py-1 font-bold bg-muted/40">
            {user?.email}
          </Badge>
        </div>
      </div>

      {/* Tenants Directory Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
                All Registered Brands &amp; Venues
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
              <option value="HOTEL">Hotel &amp; Resort</option>
              <option value="FOOD_COURT">Food Court Stall</option>
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-medium bg-background border border-input rounded-md px-3 h-9 focus:ring-2 focus:ring-[#FF6A00] outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="TRIAL">Trial Period</option>
              <option value="SUSPENDED">Suspended Only</option>
            </select>

            <select
              aria-label="Sort customers by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "name" | "outlets")}
              className="text-xs font-medium bg-background border border-input rounded-md px-3 h-9 focus:ring-2 focus:ring-[#FF6A00] outline-none"
            >
              <option value="newest">Sort: Newest Onboarded</option>
              <option value="name">Sort: Brand Name (A-Z)</option>
              <option value="outlets">Sort: Most Outlets</option>
            </select>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Brand / Entity</th>
                <th className="py-3 px-4">Venue Type</th>
                <th className="py-3 px-4">Subscription Plan</th>
                <th className="py-3 px-4">Outlets &amp; Stalls</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Owner Login</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#FF6A00]" />
                      <span>Loading customers directory...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="font-semibold text-sm">No restaurant customers found.</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasActiveFilters
                        ? "Try clearing filters to see all customers."
                        : "Click 'New Customer' above to onboard your first brand."}
                    </p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllFilters}
                        className="mt-3 text-xs"
                      >
                        Reset All Filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  const isActionBusy = actionLoading === tenant.id;

                  return (
                    <tr
                      key={tenant.id}
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground text-sm flex items-center gap-2">
                          {tenant.name}
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          slug: {tenant.slug}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getBusinessTypeColor(
                            tenant.business_type
                          )}`}
                        >
                          {tenant.business_type}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[11px] font-bold bg-muted/20">
                          {tenant.plan_name || "Starter"}
                        </Badge>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-foreground">
                          {tenant.branches_count || 1}
                        </span>
                        <span className="text-muted-foreground ml-1">outlet(s)</span>
                      </td>

                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-extrabold px-2 py-0.5 ${
                            tenant.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : tenant.status === "TRIAL"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                          }`}
                        >
                          {tenant.status}
                        </Badge>
                      </td>

                      <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                        {tenant.owner_email || "—"}
                      </td>

                      <td className="py-3 px-4 text-muted-foreground text-[11px]">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/admin/tenants/${tenant.id}`)}
                            title="Inspect Details"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResetPassword(tenant)}
                            disabled={isActionBusy}
                            title="Reset Owner Password"
                            className="h-8 w-8 p-0"
                          >
                            <KeyRound className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleStatus(tenant)}
                            disabled={isActionBusy}
                            title={
                              tenant.status === "ACTIVE"
                                ? "Suspend Brand Access"
                                : "Activate Brand Access"
                            }
                            className="h-8 w-8 p-0"
                          >
                            {tenant.status === "ACTIVE" ? (
                              <PowerOff className="h-4 w-4 text-destructive hover:text-destructive/80" />
                            ) : (
                              <Power className="h-4 w-4 text-emerald-600 hover:text-emerald-700" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
