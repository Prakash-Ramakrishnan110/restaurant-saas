import React, { useState, useEffect } from "react";
import { Users, Plus, Edit2, Key, Shield, AlertTriangle, Check, Copy, Power } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import { mapBackendErrorCode } from "../../lib/errorMapper";

export interface StaffMembership {
  id: string;
  role: string;
  is_active: boolean;
  created_at: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    phone?: string;
  };
  branches: Array<{
    id: string;
    name: string;
  }>;
}

export const StaffPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, can, activeTenant, activeRole } = useAuth();
  const canManage = can("staff.manage");

  const [staffList, setStaffList] = useState<StaffMembership[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<StaffMembership | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffMembership | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StaffMembership | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Temporary password modal (SHOWN ONCE)
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Add Form
  const [addForm, setAddForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "WAITER",
    branch_ids: [] as string[],
  });

  // Edit Form
  const [editForm, setEditForm] = useState({
    role: "WAITER",
    is_active: true,
    branch_ids: [] as string[],
  });

  const fetchStaff = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const queryParams: Record<string, string> = {};
      if (roleFilter) queryParams.role = roleFilter;
      if (statusFilter) queryParams.is_active = statusFilter;
      if (branchFilter) queryParams.branch = branchFilter;

      const [staffRes, branchRes] = await Promise.all([
        apiClient.get<any>("/staff/", { params: queryParams }),
        apiClient.get<any>("/branches/"),
      ]);

      setStaffList(staffRes.data?.results || staffRes.data || []);
      setBranches(branchRes.data?.results || branchRes.data || []);
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [roleFilter, statusFilter, branchFilter, activeTenant?.tenant_id]);

  // Allowed roles based on caller's rank
  const isOwner = activeRole === "OWNER" || user?.is_platform_admin;
  const assignableRoles = isOwner
    ? [
        { value: "BRANCH_MANAGER", label: "Branch Manager" },
        { value: "CASHIER", label: "Cashier" },
        { value: "WAITER", label: "Waiter / Captain" },
        { value: "KITCHEN", label: "Kitchen Staff / Chef" },
        { value: "INVENTORY_MANAGER", label: "Inventory Manager" },
      ]
    : [
        { value: "CASHIER", label: "Cashier" },
        { value: "WAITER", label: "Waiter / Captain" },
        { value: "KITCHEN", label: "Kitchen Staff / Chef" },
      ];

  const handleOpenAdd = () => {
    setAddForm({
      full_name: "",
      email: "",
      phone: "",
      role: assignableRoles[0]?.value || "WAITER",
      branch_ids: branches.slice(0, 1).map((b) => b.id),
    });
    setIsAddOpen(true);
  };

  const handleOpenEdit = (staff: StaffMembership) => {
    setEditTarget(staff);
    setEditForm({
      role: staff.role,
      is_active: staff.is_active,
      branch_ids: staff.branches.map((b) => b.id),
    });
    setIsEditOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.post("/staff/", addForm);
      setIsAddOpen(false);

      // Requirement B6: Temporary password shown ONCE
      if (res.data?.temporary_password) {
        setTempPassword(res.data.temporary_password);
        setCopied(false);
      }

      await fetchStaff();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.patch(`/staff/${editTarget.id}/`, editForm);
      setIsEditOpen(false);
      setEditTarget(null);
      await fetchStaff();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.post(`/staff/${resetTarget.id}/reset-password/`);
      setResetTarget(null);

      // Show new temporary password ONCE
      if (res.data?.temporary_password) {
        setTempPassword(res.data.temporary_password);
        setCopied(false);
      }
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.patch(`/staff/${deactivateTarget.id}/`, {
        is_active: !deactivateTarget.is_active,
      });
      setDeactivateTarget(null);
      await fetchStaff();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const roleBadges: Record<string, string> = {
    OWNER: "bg-purple-500/10 text-purple-700 border-purple-500/30",
    BRANCH_MANAGER: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    CASHIER: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    WAITER: "bg-[#FF6A00]/10 text-[#0B1F3B] dark:text-white border-[#FF6A00]/30",
    KITCHEN: "bg-amber-500/10 text-amber-800 border-amber-500/30",
    INVENTORY_MANAGER: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("staff.title")}
        description={t("staff.subtitle")}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: t("staff.title") }]}
        actions={
          canManage && (
            <Button
              onClick={handleOpenAdd}
              disabled={loading}
              className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t("staff.addStaff")}
            </Button>
          )
        }
      />

      {errorMessage && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Filter Toolbar */}
      <Card className="border border-border">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">
              {t("staff.filterRole")}
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-md border border-input bg-card p-2 min-h-[40px]"
            >
              <option value="">{t("staff.filterRole")}</option>
              <option value="OWNER">Owner</option>
              <option value="BRANCH_MANAGER">Branch Manager</option>
              <option value="CASHIER">Cashier</option>
              <option value="WAITER">Waiter</option>
              <option value="KITCHEN">Kitchen Staff</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">
              {t("staff.filterActive")}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border border-input bg-card p-2 min-h-[40px]"
            >
              <option value="">{t("staff.filterActive")}</option>
              <option value="true">{t("staff.active")}</option>
              <option value="false">{t("staff.inactive")}</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">
              {t("staff.filterBranch")}
            </label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full rounded-md border border-input bg-card p-2 min-h-[40px]"
            >
              <option value="">{t("staff.filterBranch")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Staff DataTable */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : staffList.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-foreground">No team members found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Add staff members to grant them role-based access.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Contact</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Branches</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {staffList.map((staff) => (
                <tr key={staff.id} className="hover:bg-muted/10 transition">
                  <td className="p-3.5 font-bold text-foreground">
                    <span className="text-sm">{staff.user.full_name}</span>
                  </td>
                  <td className="p-3.5 text-muted-foreground">
                    <div>{staff.user.email}</div>
                    {staff.user.phone && <div className="text-[11px]">{staff.user.phone}</div>}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${roleBadges[staff.role] || ""}`}
                    >
                      {staff.role}
                    </span>
                  </td>
                  <td className="p-3.5 text-muted-foreground">
                    {staff.branches.map((b) => b.name).join(", ") || "All Branches"}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        staff.is_active
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {staff.is_active ? t("staff.active") : t("staff.inactive")}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResetTarget(staff)}
                          className="h-8 px-2 text-xs font-semibold"
                          title={t("staff.resetPassword")}
                        >
                          <Key className="w-3.5 h-3.5 mr-1" />
                          Reset
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(staff)}
                          className="h-8 px-2"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeactivateTarget(staff)}
                          className="h-8 px-2 text-destructive hover:bg-destructive/10"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleAddSubmit}>
            <DialogHeader>
              <DialogTitle>{t("staff.addStaff")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("staff.fullName")} *
                </label>
                <input
                  required
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  placeholder="e.g. Anand Kumar"
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("staff.email")} *
                </label>
                <input
                  required
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="anand@example.com"
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("staff.phone")}
                </label>
                <input
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("staff.role")} *
                </label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                >
                  {assignableRoles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("staff.branches")}
                </label>
                <div className="space-y-1.5 border border-border rounded-lg p-2 max-h-32 overflow-y-auto">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addForm.branch_ids.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAddForm({ ...addForm, branch_ids: [...addForm.branch_ids, b.id] });
                          } else {
                            setAddForm({
                              ...addForm,
                              branch_ids: addForm.branch_ids.filter((id) => id !== b.id),
                            });
                          }
                        }}
                        className="rounded border-border text-[#FF6A00]"
                      />
                      <span>{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
              >
                {actionLoading ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>
                {t("staff.editStaff")} ({editTarget?.user.full_name})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("staff.role")} *
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                >
                  {assignableRoles.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("staff.branches")}
                </label>
                <div className="space-y-1.5 border border-border rounded-lg p-2 max-h-32 overflow-y-auto">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.branch_ids.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditForm({
                              ...editForm,
                              branch_ids: [...editForm.branch_ids, b.id],
                            });
                          } else {
                            setEditForm({
                              ...editForm,
                              branch_ids: editForm.branch_ids.filter((id) => id !== b.id),
                            });
                          }
                        }}
                        className="rounded border-border text-[#FF6A00]"
                      />
                      <span>{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
              >
                {actionLoading ? t("common.saving") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Temporary Password Modal (Shown ONCE with Copy Button) */}
      <Dialog open={Boolean(tempPassword)} onOpenChange={(open) => !open && setTempPassword(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#FF6A00]" />
              {t("staff.tempPasswordModalTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-xs">
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>{t("staff.tempPasswordWarning")}</span>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
              <span className="font-mono text-base font-black text-primary select-all">
                {tempPassword}
              </span>
              <Button
                size="sm"
                onClick={handleCopyPassword}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold text-xs"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 mr-1" />
                ) : (
                  <Copy className="w-3.5 h-3.5 mr-1" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Notice: <strong>{t("staff.tempPasswordNotice")}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              onClick={() => setTempPassword(null)}
            >
              I have saved the password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => !open && setResetTarget(null)}
        title={t("staff.resetPassword")}
        description={t("staff.resetPasswordConfirm")}
        confirmLabel="Generate New Password"
        variant="destructive"
        isLoading={actionLoading}
        onConfirm={handleResetPassword}
      />

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="Deactivate Team Member?"
        description="Deactivating this member will immediately revoke their access and terminate any active sessions."
        confirmLabel={t("common.confirm")}
        variant="destructive"
        isLoading={actionLoading}
        onConfirm={handleDeactivate}
      />
    </div>
  );
};
