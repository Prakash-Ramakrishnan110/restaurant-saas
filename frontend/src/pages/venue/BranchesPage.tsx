import React, { useState, useEffect } from "react";
import {
  GitBranch,
  Plus,
  Edit2,
  Power,
  AlertTriangle,
  ArrowUpRight,
  Phone,
  MapPin,
  Store,
} from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
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

export interface BranchItem {
  id: string;
  name: string;
  venue_profile: string;
  address: string;
  phone: string;
  is_active: boolean;
  operating_hours?: Record<string, any>;
}

export const BranchesPage: React.FC = () => {
  const { t } = useTranslation();
  const { can, activeTenant } = useAuth();
  const canManage = can("branch.manage");

  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Plan entitlements
  const [maxBranches, setMaxBranches] = useState<number>(1);
  const [planLimitReached, setPlanLimitReached] = useState<boolean>(false);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<BranchItem | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<BranchItem | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    venue_profile: "CASUAL_DINING",
    address: "",
    phone: "",
  });
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false);

  const fetchBranches = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [branchRes, entRes] = await Promise.all([
        apiClient.get<any>("/branches/"),
        apiClient
          .get<any>("/entitlements/")
          .catch(() => ({ data: { entitlements: { max_branches: 1 } } })),
      ]);

      const items: BranchItem[] = branchRes.data?.results || branchRes.data || [];
      setBranches(items);

      const limit = entRes.data?.entitlements?.max_branches ?? 1;
      setMaxBranches(limit);
      setPlanLimitReached(items.filter((b) => b.is_active).length >= limit);
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [activeTenant?.tenant_id]);

  const handleOpenAdd = () => {
    setFormData({
      name: "",
      venue_profile: "CASUAL_DINING",
      address: "",
      phone: "",
    });
    setIsFormDirty(false);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (branch: BranchItem) => {
    setEditTarget(branch);
    setFormData({
      name: branch.name,
      venue_profile: branch.venue_profile || "CASUAL_DINING",
      address: branch.address || "",
      phone: branch.phone || "",
    });
    setIsFormDirty(false);
    setIsEditOpen(true);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (planLimitReached) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.post("/branches/", formData);
      setIsAddOpen(false);
      setIsFormDirty(false);
      await fetchBranches();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.patch(`/branches/${editTarget.id}/`, formData);
      setIsEditOpen(false);
      setEditTarget(null);
      setIsFormDirty(false);
      await fetchBranches();
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
      await apiClient.patch(`/branches/${deactivateTarget.id}/`, {
        is_active: !deactivateTarget.is_active,
      });
      setDeactivateTarget(null);
      await fetchBranches();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const venueTypeLabels: Record<string, string> = {
    QUICK_SERVICE: "Quick Service / Counter",
    CAFE: "Café",
    CASUAL_DINING: "Casual Dining",
    FINE_DINING: "Fine Dining",
    HOTEL_RESTAURANT: "Hotel Restaurant",
    FOOD_COURT: "Food Court",
    BAR_BREWERY: "Bar / Brewery",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("branches.title")}
        description={t("branches.subtitle")}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: t("branches.title") }]}
        actions={
          canManage && (
            <Button
              onClick={handleOpenAdd}
              disabled={loading}
              className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px] sm:min-h-[48px]"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("branches.addBranch")}
            </Button>
          )
        }
      />

      {/* Plan limit warning banner */}
      {planLimitReached && canManage && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-foreground">{t("branches.limitReached")}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("branches.limitReachedDesc")} ({branches.filter((b) => b.is_active).length} of{" "}
              {maxBranches} used)
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 text-xs font-semibold">
            Upgrade Plan <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Branch Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground font-medium">
          {t("common.loading")}
        </div>
      ) : branches.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Store className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-foreground">No branches found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Get started by creating your primary branch.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <Card
              key={branch.id}
              className="relative overflow-hidden border border-border flex flex-col justify-between"
            >
              <div
                className={`h-2 w-full ${
                  branch.is_active ? "bg-emerald-500" : "bg-muted-foreground/30"
                }`}
              />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-[#FF6A00]" />
                      <span>{branch.name}</span>
                    </CardTitle>
                    <span className="inline-block mt-1.5 px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-primary/10 text-[#0B1F3B] dark:text-white border border-primary/20">
                      {venueTypeLabels[branch.venue_profile] || branch.venue_profile}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                      branch.is_active
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                  >
                    {branch.is_active ? t("branches.active") : t("branches.inactive")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs text-muted-foreground flex-1">
                {branch.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{branch.address}</span>
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{branch.phone}</span>
                  </div>
                )}
              </CardContent>
              {canManage && (
                <div className="p-4 pt-2 border-t border-border/60 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(branch)}
                    className="min-h-[44px] text-xs font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                    {t("branches.editBranch")}
                  </Button>
                  <Button
                    variant={branch.is_active ? "ghost" : "outline"}
                    size="sm"
                    onClick={() => setDeactivateTarget(branch)}
                    className={`min-h-[44px] text-xs font-semibold ${
                      branch.is_active
                        ? "text-destructive hover:bg-destructive/10"
                        : "text-emerald-600"
                    }`}
                  >
                    <Power className="w-3.5 h-3.5 mr-1.5" />
                    {branch.is_active ? t("branches.deactivateBranch") : "Activate"}
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add Branch Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) =>
          !open &&
          (!isFormDirty || window.confirm("You have unsaved changes. Discard?")) &&
          setIsAddOpen(false)
        }
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveAdd}>
            <DialogHeader>
              <DialogTitle>{t("branches.addBranch")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              {planLimitReached ? (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-semibold">
                  {t("branches.limitReachedDesc")}
                </div>
              ) : (
                <>
                  <div>
                    <label className="font-semibold block mb-1 text-foreground">
                      {t("branches.branchName")} *
                    </label>
                    <input
                      required
                      value={formData.name}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        setIsFormDirty(true);
                      }}
                      className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                      placeholder="e.g. Indiranagar Outlet"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1 text-foreground">
                      {t("branches.venueType")} *
                    </label>
                    <select
                      value={formData.venue_profile}
                      onChange={(e) => {
                        setFormData({ ...formData, venue_profile: e.target.value });
                        setIsFormDirty(true);
                      }}
                      className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                    >
                      <option value="QUICK_SERVICE">Quick Service / Tea Shop / Bakery</option>
                      <option value="CAFE">Café</option>
                      <option value="CASUAL_DINING">Casual Dining Restaurant</option>
                      <option value="FINE_DINING">Fine Dining</option>
                      <option value="HOTEL_RESTAURANT">Hotel Restaurant</option>
                      <option value="FOOD_COURT">Food Court Counter</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1 text-foreground">
                      {t("branches.address")}
                    </label>
                    <textarea
                      rows={2}
                      value={formData.address}
                      onChange={(e) => {
                        setFormData({ ...formData, address: e.target.value });
                        setIsFormDirty(true);
                      }}
                      className="w-full rounded-md border border-input bg-card p-2.5 text-xs"
                      placeholder="123 100ft Road, Bangalore"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1 text-foreground">
                      {t("branches.phone")}
                    </label>
                    <input
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        setIsFormDirty(true);
                      }}
                      className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                {t("common.cancel")}
              </Button>
              {!planLimitReached && (
                <Button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
                >
                  {actionLoading ? t("common.saving") : t("common.save")}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) =>
          !open &&
          (!isFormDirty || window.confirm("You have unsaved changes. Discard?")) &&
          setIsEditOpen(false)
        }
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>{t("branches.editBranch")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("branches.branchName")} *
                </label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("branches.venueType")} *
                </label>
                <select
                  value={formData.venue_profile}
                  onChange={(e) => {
                    setFormData({ ...formData, venue_profile: e.target.value });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                >
                  <option value="QUICK_SERVICE">Quick Service / Tea Shop / Bakery</option>
                  <option value="CAFE">Café</option>
                  <option value="CASUAL_DINING">Casual Dining Restaurant</option>
                  <option value="FINE_DINING">Fine Dining</option>
                  <option value="HOTEL_RESTAURANT">Hotel Restaurant</option>
                  <option value="FOOD_COURT">Food Court Counter</option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("branches.address")}
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => {
                    setFormData({ ...formData, address: e.target.value });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("branches.phone")}
                </label>
                <input
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                />
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

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title={t("branches.deactivateBranch")}
        description={t("branches.deactivateConfirm")}
        confirmLabel={t("common.confirm")}
        variant="destructive"
        isLoading={actionLoading}
        onConfirm={handleDeactivate}
      />
    </div>
  );
};
