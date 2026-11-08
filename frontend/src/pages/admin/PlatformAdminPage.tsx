import React, { useState, useEffect } from "react";
import {
  Building2,
  ShieldCheck,
  Power,
  PowerOff,
  ExternalLink,
  Layers,
  CheckCircle2,
  Plus,
  Eye,
  IndianRupee,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
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
  api_health: string;
}

export const PlatformAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectTenant } = useAuth();
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [summary, setSummary] = useState<PlatformSummary | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchTenants = async () => {
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
    } catch {
      // Fallback
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

  const handleImpersonate = (tenantId: string) => {
    selectTenant(tenantId);
    navigate("/dashboard");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-16 right-6 z-50 bg-[#0A192F] text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="ml-2 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <span className="text-xs font-bold text-[#FF6A00] uppercase tracking-wider">
            SaaS Platform Operator
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-foreground mt-0.5 flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-600" /> Super-Admin Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage all registered restaurant chains across India, view subscriptions, and control
            tenant access.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
          <Building2 className="h-8 w-8 text-[#FF6A00]" />
          <div>
            <span className="text-xs text-muted-foreground font-semibold">Active Restaurants</span>
            <div className="text-2xl font-extrabold text-foreground">
              {summary ? summary.active_tenants : tenants.length}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
          <Layers className="h-8 w-8 text-blue-500" />
          <div>
            <span className="text-xs text-muted-foreground font-semibold">
              Live Outlets & Stalls
            </span>
            <div className="text-2xl font-extrabold text-foreground">
              {tenants.reduce((sum, t) => sum + (t.branches_count || 1), 0)}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
          <IndianRupee className="h-8 w-8 text-emerald-600" />
          <div>
            <span className="text-xs text-muted-foreground font-semibold">Monthly MRR (Live)</span>
            <div className="text-2xl font-extrabold text-foreground">
              {summary ? formatRupees(summary.mrr_paise) : "₹0.00"}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <div>
            <span className="text-xs text-muted-foreground font-semibold">Platform Status</span>
            <div className="text-2xl font-extrabold text-emerald-600">
              {summary?.api_health === "HEALTHY" ? "100% Online" : "Degraded"}
            </div>
          </div>
        </div>
      </div>

      {/* Restaurant Chains DataTable */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">
            All Registered Restaurant Tenants
          </h2>
          <span className="text-xs text-muted-foreground font-semibold">
            {tenants.length} Brands Registered
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[11px] border-b border-border">
              <tr>
                <th className="py-3 px-4">Restaurant Brand</th>
                <th className="py-3 px-4">Business Preset</th>
                <th className="py-3 px-4">Subscription Plan</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <button
                      onClick={() => navigate(`/admin/tenants/${t.id}`)}
                      className="font-bold text-foreground text-sm text-left hover:text-[#FF6A00] transition-colors block"
                    >
                      {t.name}
                    </button>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      slug: {t.slug}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {t.business_type || "RESTAURANT"}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-foreground">
                    {t.plan_name || "Starter"}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge
                      variant={t.status === "ACTIVE" ? "default" : "destructive"}
                      className={`text-[10px] font-bold ${
                        t.status === "ACTIVE" ? "bg-emerald-600 text-white" : ""
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
                        <Eye className="h-3 w-3" /> Detail
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleImpersonate(t.id)}
                      >
                        <ExternalLink className="h-3 w-3" /> Workspace
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
        </div>
      </div>
    </div>
  );
};
