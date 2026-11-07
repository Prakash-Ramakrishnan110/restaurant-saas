import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Building2,
  Layers,
  DollarSign,
  ExternalLink,
  Power,
  PowerOff,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  status: "ACTIVE" | "SUSPENDED" | "TRIAL";
  owner_email?: string;
  created_at: string;
  branches_count?: number;
  tables_count?: number;
  active_plan?: string;
}

export const PlatformAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, selectTenant } = useAuth();
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchTenants = async () => {
    try {
      const res = await apiClient.get<any>("/tenants/");
      setTenants(res.data?.results || res.data || []);
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
          reason: "Admin manual suspension",
        });
        setToastMsg(`Suspended ${tenant.name}`);
      } else {
        await apiClient.post(`/tenants/${tenant.id}/activate/`);
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

        <Badge variant="outline" className="text-xs px-3 py-1 font-bold bg-muted/40">
          Signed in as Platform Superuser ({user?.email})
        </Badge>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
          <Building2 className="h-8 w-8 text-[#FF6A00]" />
          <div>
            <span className="text-xs text-muted-foreground font-semibold">Active Restaurants</span>
            <div className="text-2xl font-extrabold text-foreground">{tenants.length}</div>
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
          <DollarSign className="h-8 w-8 text-emerald-600" />
          <div>
            <span className="text-xs text-muted-foreground font-semibold">Monthly MRR (Est.)</span>
            <div className="text-2xl font-extrabold text-foreground">₹24,995</div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          <div>
            <span className="text-xs text-muted-foreground font-semibold">Platform Status</span>
            <div className="text-2xl font-extrabold text-emerald-600">100% Online</div>
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
                    <span className="font-bold text-foreground text-sm block">{t.name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      slug: {t.slug}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {t.business_type || "CASUAL_DINING"}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-foreground">
                    {t.active_plan || "Professional"}
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
