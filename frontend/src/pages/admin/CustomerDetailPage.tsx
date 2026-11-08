import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2,
  Layers,
  User,
  CreditCard,
  FileText,
  Activity,
  ShieldAlert,
  ShieldCheck,
  ArrowLeft,
  KeyRound,
  Calendar,
  CheckCircle2,
  Plus,
  Copy,
  Check,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { formatRupees } from "../../utils/currency";

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  suggested_venue_profile: string;
  status: "ACTIVE" | "SUSPENDED";
  email: string;
  phone: string;
  address: string;
  timezone: string;
  currency: string;
  business_settings: {
    legal_name?: string;
    document_language?: string;
    invoice_prefix?: string;
    tax_mode?: string;
  };
  branches: Array<{
    id: string;
    name: string;
    venue_profile: string;
    address: string;
    phone: string;
    is_active: boolean;
  }>;
  owner: {
    id: string;
    email: string;
    full_name: string;
    phone: string;
    is_active: boolean;
  } | null;
  subscription: {
    status: string;
    plan_name: string;
    plan_slug: string;
    price_paise: number;
    starts_at: string | null;
    ends_at: string | null;
    trial_days_remaining: number | null;
    entitlements: Record<string, unknown>;
  } | null;
  notes: Array<{
    id: string;
    note: string;
    reason: string;
    author: string;
    timestamp: string;
  }>;
  recent_activity: Array<{
    id: string;
    action: string;
    actor: string;
    details: Record<string, unknown>;
    timestamp: string;
  }>;
  created_at: string;
  updated_at: string;
}

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "outlets" | "owner" | "plan" | "notes" | "activity"
  >("overview");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modals state
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [extendTrialModalOpen, setExtendTrialModalOpen] = useState(false);
  const [changePlanModalOpen, setChangePlanModalOpen] = useState(false);
  const [resetPwdModalOpen, setResetPwdModalOpen] = useState(false);
  const [addNoteModalOpen, setAddNoteModalOpen] = useState(false);

  // Form states for modals
  const [actionReason, setActionReason] = useState("");
  const [extendDays, setExtendDays] = useState(14);
  const [selectedPlanSlug, setSelectedPlanSlug] = useState<string>("professional");
  const [noteContent, setNoteContent] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);
  const [copiedPwd, setCopiedPwd] = useState(false);

  const fetchTenantDetail = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await apiClient.get<TenantDetail>(`/tenants/${id}/`);
      setTenant(res.data);
    } catch {
      setToastMsg("Failed to load tenant details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAction = async (endpoint: string, payload: Record<string, unknown>) => {
    if (!id) return;
    setActionSubmitting(true);
    try {
      const res = await apiClient.post(`/tenants/${id}/${endpoint}/`, payload);
      setToastMsg("Action executed successfully.");
      if (endpoint === "reset-owner-password") {
        setTempPasswordResult(res.data?.temporary_password || "");
      } else {
        closeAllModals();
      }
      await fetchTenantDetail();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { reason?: string[]; detail?: string } } };
      const msg =
        axiosErr.response?.data?.reason?.[0] ||
        axiosErr.response?.data?.detail ||
        "Action failed. Ensure reason is provided.";
      alert(msg);
    } finally {
      setActionSubmitting(false);
    }
  };

  const closeAllModals = () => {
    setSuspendModalOpen(false);
    setActivateModalOpen(false);
    setExtendTrialModalOpen(false);
    setChangePlanModalOpen(false);
    setResetPwdModalOpen(false);
    setAddNoteModalOpen(false);
    setActionReason("");
    setNoteContent("");
    setTempPasswordResult(null);
  };

  if (loading || !tenant) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        Loading customer record...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-16 right-6 z-50 bg-[#0A192F] text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="ml-2 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/tenants")}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-black font-heading text-foreground">{tenant.name}</h1>
            <Badge
              variant="outline"
              className={
                tenant.status === "ACTIVE"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-bold"
                  : "bg-destructive/10 text-destructive border-destructive/30 text-xs font-bold"
              }
            >
              {tenant.status}
            </Badge>
            <Badge variant="outline" className="text-xs font-semibold">
              {tenant.business_type}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground ml-10">
            Tenant ID: <span className="font-mono text-foreground">{tenant.id}</span> · Slug:{" "}
            <span className="font-mono text-foreground">{tenant.slug}</span>
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {tenant.status === "ACTIVE" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuspendModalOpen(true)}
              className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1" /> Suspend
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivateModalOpen(true)}
              className="text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
            >
              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Reactivate
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setExtendTrialModalOpen(true)}
            className="text-xs"
          >
            <Calendar className="h-3.5 w-3.5 mr-1" /> Extend Trial
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setChangePlanModalOpen(true)}
            className="text-xs"
          >
            <CreditCard className="h-3.5 w-3.5 mr-1" /> Change Plan
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setResetPwdModalOpen(true)}
            className="text-xs"
          >
            <KeyRound className="h-3.5 w-3.5 mr-1" /> Reset Pwd
          </Button>

          <Button
            size="sm"
            onClick={() => setAddNoteModalOpen(true)}
            className="text-xs bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
          </Button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto text-xs font-bold">
        {[
          { key: "overview" as const, label: "Overview", icon: Building2 },
          { key: "outlets" as const, label: `Outlets (${tenant.branches.length})`, icon: Layers },
          { key: "owner" as const, label: "Owner Account", icon: User },
          { key: "plan" as const, label: "Plan & Usage", icon: CreditCard },
          { key: "notes" as const, label: `Notes (${tenant.notes.length})`, icon: FileText },
          {
            key: "activity" as const,
            label: `Activity Log (${tenant.recent_activity.length})`,
            icon: Activity,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-[#FF6A00] text-[#FF6A00]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-heading">Business Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Legal Entity:</span>
                <span className="font-semibold text-foreground">
                  {tenant.business_settings?.legal_name || tenant.name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Operating City:</span>
                <span className="font-semibold text-foreground">{tenant.address || "—"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Document Language:</span>
                <span className="font-semibold text-foreground">
                  {tenant.business_settings?.document_language === "EN_TA"
                    ? "English & Tamil"
                    : "English"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Invoice Prefix:</span>
                <span className="font-mono font-semibold text-foreground">
                  {tenant.business_settings?.invoice_prefix || "INV-"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Timezone:</span>
                <span className="font-semibold text-foreground">{tenant.timezone}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Created On:</span>
                <span className="font-semibold text-foreground">
                  {new Date(tenant.created_at).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-heading">Subscription Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Plan Tier:</span>
                <span className="font-extrabold text-[#FF6A00] uppercase">
                  {tenant.subscription?.plan_name || "Trial"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Standing:</span>
                <Badge variant="outline" className="text-[10px]">
                  {tenant.subscription?.status || "TRIAL"}
                </Badge>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Trial Remaining:</span>
                <span className="font-bold text-foreground">
                  {tenant.subscription?.trial_days_remaining !== null
                    ? `${tenant.subscription?.trial_days_remaining} days`
                    : "Not on trial"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Period End:</span>
                <span className="font-semibold text-foreground">
                  {tenant.subscription?.ends_at
                    ? new Date(tenant.subscription.ends_at).toLocaleDateString()
                    : "Open-ended"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Outlets */}
      {activeTab === "outlets" && (
        <Card className="border border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-heading">Configured Outlets & Stalls</CardTitle>
            <span className="text-xs text-muted-foreground">
              {tenant.branches.length} branch(es) registered
            </span>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {tenant.branches.map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{b.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {b.venue_profile}
                      </Badge>
                      {b.is_active ? (
                        <span className="text-[10px] text-emerald-600 font-bold">● Active</span>
                      ) : (
                        <span className="text-[10px] text-destructive font-bold">● Inactive</span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5">
                      {b.address || "Main City"} · Phone: {b.phone || "—"}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{b.id}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Owner */}
      {activeTab === "owner" && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-heading">Primary Owner Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {tenant.owner ? (
              <div className="space-y-3">
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Full Name:</span>
                  <span className="font-bold text-foreground">{tenant.owner.full_name}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Login Email:</span>
                  <span className="font-bold text-foreground font-mono">{tenant.owner.email}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-semibold text-foreground">{tenant.owner.phone || "—"}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">Account Status:</span>
                  <Badge variant="outline" className="text-[10px]">
                    {tenant.owner.is_active ? "Active" : "Disabled"}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No active owner account assigned.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Plan & Usage */}
      {activeTab === "plan" && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-heading">Subscription Tier & Entitlements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <span className="text-muted-foreground font-semibold">Active Plan</span>
                <div className="text-base font-black text-foreground mt-0.5">
                  {tenant.subscription?.plan_name || "Starter"}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <span className="text-muted-foreground font-semibold">Recurring Price</span>
                <div className="text-base font-black text-foreground mt-0.5">
                  {tenant.subscription?.price_paise
                    ? formatRupees(tenant.subscription.price_paise)
                    : "₹0.00"}
                  / mo
                </div>
              </div>
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <span className="text-muted-foreground font-semibold">Status</span>
                <div className="text-base font-black text-emerald-600 mt-0.5">
                  {tenant.subscription?.status || "TRIAL"}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-foreground mb-2">Entitlement Operational Limits</h3>
              <div className="p-3 rounded-xl border border-border bg-card font-mono text-[11px]">
                <pre className="text-foreground overflow-x-auto">
                  {JSON.stringify(tenant.subscription?.entitlements || {}, null, 2)}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Notes */}
      {activeTab === "notes" && (
        <Card className="border border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-heading">Internal Operator Notes</CardTitle>
            <Button
              size="sm"
              onClick={() => setAddNoteModalOpen(true)}
              className="text-xs bg-[#FF6A00] text-white"
            >
              <Plus className="h-3 w-3 mr-1" /> Add Note
            </Button>
          </CardHeader>
          <CardContent>
            {tenant.notes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No internal notes recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {tenant.notes.map((n) => (
                  <div key={n.id} className="p-3 rounded-xl border border-border bg-card space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-bold text-foreground">{n.author}</span>
                      <span>{new Date(n.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-foreground font-medium">{n.note}</p>
                    {n.reason && (
                      <p className="text-[10px] text-muted-foreground italic">
                        Context: {n.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 6: Activity */}
      {activeTab === "activity" && (
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-heading">Audit Trail & Security Log</CardTitle>
          </CardHeader>
          <CardContent>
            {tenant.recent_activity.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No audit events recorded.
              </p>
            ) : (
              <div className="divide-y divide-border text-xs">
                {tenant.recent_activity.map((act) => (
                  <div key={act.id} className="py-2.5 flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{act.action}</span>
                        <span className="text-[10px] text-muted-foreground">by {act.actor}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {JSON.stringify(act.details)}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {new Date(act.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODAL 1: Suspend */}
      <Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Suspend Restaurant Tenant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">
              Suspending this tenant immediately revokes access for all staff and invalidates active
              authentication tokens.
            </p>
            <div>
              <label className="block font-bold text-foreground mb-1">Mandatory Reason *</label>
              <Input
                placeholder="e.g. Non-payment, violation of terms, owner requested pause"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={closeAllModals}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!actionReason.trim() || actionSubmitting}
              onClick={() => handleAction("suspend", { reason: actionReason })}
            >
              {actionSubmitting ? "Suspending..." : "Confirm Suspension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Reactivate */}
      <Dialog open={activateModalOpen} onOpenChange={setActivateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-emerald-600 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" /> Reactivate Restaurant Tenant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground">
              Reactivating will immediately restore system access for all registered staff.
            </p>
            <div>
              <label className="block font-bold text-foreground mb-1">Mandatory Reason *</label>
              <Input
                placeholder="e.g. Invoiced payment verified, dispute resolved"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={closeAllModals}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={!actionReason.trim() || actionSubmitting}
              onClick={() => handleAction("activate", { reason: actionReason })}
            >
              {actionSubmitting ? "Activating..." : "Confirm Reactivation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Extend Trial */}
      <Dialog open={extendTrialModalOpen} onOpenChange={setExtendTrialModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#FF6A00]" /> Extend Free Trial
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">Additional Days</label>
              <Input
                type="number"
                min={1}
                max={60}
                value={extendDays}
                onChange={(e) => setExtendDays(Number(e.target.value) || 14)}
                className="text-xs"
              />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Mandatory Reason *</label>
              <Input
                placeholder="e.g. Extended pilot requested by general manager"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={closeAllModals}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!actionReason.trim() || actionSubmitting}
              onClick={() =>
                handleAction("extend-trial", { days: extendDays, reason: actionReason })
              }
            >
              {actionSubmitting ? "Extending..." : "Extend Trial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Change Plan */}
      <Dialog open={changePlanModalOpen} onOpenChange={setChangePlanModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#FF6A00]" /> Change Subscription Plan
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">New Plan Tier</label>
              <select
                value={selectedPlanSlug}
                onChange={(e) => setSelectedPlanSlug(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-card px-2 text-xs"
              >
                <option value="starter">Starter (₹1,499 / mo - 1 branch, 10 tables)</option>
                <option value="professional">
                  Professional (₹4,999 / mo - 5 branches, 50 tables)
                </option>
                <option value="business">Business (₹9,999 / mo - 15 branches, 150 tables)</option>
                <option value="enterprise">Enterprise (₹24,999 / mo - Unlimited)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Mandatory Reason *</label>
              <Input
                placeholder="e.g. Upgraded to multi-branch chain tier"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={closeAllModals}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!actionReason.trim() || actionSubmitting}
              onClick={() =>
                handleAction("change-plan", { plan_slug: selectedPlanSlug, reason: actionReason })
              }
            >
              {actionSubmitting ? "Changing..." : "Update Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: Reset Owner Password */}
      <Dialog open={resetPwdModalOpen} onOpenChange={setResetPwdModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-[#FF6A00]" /> Reset Owner Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            {!tempPasswordResult ? (
              <>
                <p className="text-muted-foreground">
                  Generates a new single-use temporary password for{" "}
                  <strong>{tenant.owner?.email}</strong>. The owner will be required to change it on
                  login.
                </p>
                <div>
                  <label className="block font-bold text-foreground mb-1">Mandatory Reason *</label>
                  <Input
                    placeholder="e.g. Owner locked out, requested password reset via support"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </>
            ) : (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                  New Single-Use Temporary Password
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-sm font-black text-foreground bg-card p-2 rounded border border-border select-all">
                    {tempPasswordResult}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPasswordResult);
                      setCopiedPwd(true);
                      setTimeout(() => setCopiedPwd(false), 2000);
                    }}
                  >
                    {copiedPwd ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-amber-800/80 dark:text-amber-300">
                  Shown once only. Please deliver it directly to the customer.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            {!tempPasswordResult ? (
              <>
                <Button variant="ghost" size="sm" onClick={closeAllModals}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!actionReason.trim() || actionSubmitting}
                  onClick={() => handleAction("reset-owner-password", { reason: actionReason })}
                >
                  {actionSubmitting ? "Generating..." : "Generate Temporary Password"}
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={closeAllModals}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 6: Add Internal Note */}
      <Dialog open={addNoteModalOpen} onOpenChange={setAddNoteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#FF6A00]" /> Add Internal Operator Note
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="block font-bold text-foreground mb-1">Note Content *</label>
              <textarea
                rows={4}
                placeholder="Enter internal operator context, meeting notes, or follow-ups..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full rounded-md border border-input bg-card p-2 text-xs text-foreground"
              />
            </div>
            <div>
              <label className="block font-bold text-foreground mb-1">Context / Reason</label>
              <Input
                placeholder="e.g. Onboarding call, check-in, billing review"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={closeAllModals}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!noteContent.trim() || actionSubmitting}
              onClick={() => handleAction("notes", { note: noteContent, reason: actionReason })}
            >
              {actionSubmitting ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
