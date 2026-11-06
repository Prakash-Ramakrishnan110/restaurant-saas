import React, { useState, useEffect } from "react";
import { Utensils, Plus, Copy, Link2, Unlink, QrCode, Search, Power } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../components/ui/dialog";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { mapBackendErrorCode } from "../../lib/errorMapper";

export interface DiningTableItem {
  id: string;
  label: string;
  label_prefix: string;
  label_number: number;
  capacity: number;
  shape: string;
  table_type: string;
  is_combinable: boolean;
  is_active: boolean;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLING" | "DIRTY";
  section: {
    id: string;
    name: string;
    service_area?: {
      id: string;
      name: string;
    };
  };
  group?: {
    id: string;
    label: string;
  } | null;
}

export const TablesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can, activeTenant } = useAuth();
  const canManage = can("table.manage");
  const canUpdateStatus = can("table.status_update");
  const canMerge = can("table.merge");

  const [tables, setTables] = useState<DiningTableItem[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Entitlements
  const [maxTables, setMaxTables] = useState<number>(50);

  // Filters
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dialogs
  const [isBulkOpen, setIsBulkOpen] = useState<boolean>(false);
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [isJoinOpen, setIsJoinOpen] = useState<boolean>(false);
  const [deactivateTarget, setDeactivateTarget] = useState<DiningTableItem | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Bulk form
  const [bulkForm, setBulkForm] = useState({
    section_id: "",
    prefix: "T",
    start_number: 1,
    count: 10,
    capacity: 4,
    shape: "SQUARE",
    table_type: "TABLE",
  });

  // Single form
  const [singleForm, setSingleForm] = useState({
    section_id: "",
    label: "",
    capacity: 4,
    shape: "SQUARE",
    table_type: "TABLE",
    is_combinable: true,
  });

  // Join form
  const [selectedTableIdsForJoin, setSelectedTableIdsForJoin] = useState<string[]>([]);
  const [joinGroupLabel, setJoinGroupLabel] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const queryParams: Record<string, string> = {};
      if (selectedAreaId) queryParams.area_id = selectedAreaId;
      if (selectedSectionId) queryParams.section_id = selectedSectionId;
      if (selectedStatus) queryParams.status = selectedStatus;
      if (searchQuery.trim()) queryParams.search = searchQuery.trim();

      const [tblRes, secRes, areaRes, entRes] = await Promise.all([
        apiClient.get<any>("/tables/", { params: queryParams }),
        apiClient.get<any>("/sections/"),
        apiClient.get<any>("/service-areas/"),
        apiClient.get<any>("/entitlements/").catch(() => ({ data: { entitlements: { max_tables: 50 } } })),
      ]);

      setTables(tblRes.data?.results || tblRes.data || []);
      setSections(secRes.data?.results || secRes.data || []);
      setAreas(areaRes.data?.results || areaRes.data || []);
      setMaxTables(entRes.data?.entitlements?.max_tables ?? 50);
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedAreaId, selectedSectionId, selectedStatus, searchQuery, activeTenant?.tenant_id]);

  // Bulk label preview computation
  const getBulkPreviewString = () => {
    const count = Math.min(Math.max(bulkForm.count, 1), 100);
    const start = Math.max(bulkForm.start_number, 1);
    const prefix = bulkForm.prefix || "T";
    if (count <= 4) {
      return Array.from({ length: count }, (_, i) => `${prefix}${start + i}`).join(", ");
    }
    return `${prefix}${start}, ${prefix}${start + 1}, ${prefix}${start + 2} ... ${prefix}${start + count - 1}`;
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkForm.section_id) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.post("/tables/bulk-create/", bulkForm);
      setIsBulkOpen(false);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleForm.section_id) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      // Find branch from selected section
      const sec = sections.find((s) => s.id === singleForm.section_id);
      await apiClient.post("/tables/", {
        ...singleForm,
        branch: sec?.branch || "",
        section: singleForm.section_id,
      });
      setIsAddOpen(false);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (table: DiningTableItem, newStatus: string) => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.post(`/tables/${table.id}/status/`, {
        status: newStatus,
        reason: `Status updated via tables screen to ${newStatus}`,
      });
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTableIdsForJoin.length < 2) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.post("/tables/join/", {
        table_ids: selectedTableIdsForJoin,
        label: joinGroupLabel || `Group-${Date.now().toString().slice(-4)}`,
      });
      setIsJoinOpen(false);
      setSelectedTableIdsForJoin([]);
      setJoinGroupLabel("");
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSplitGroup = async (groupId: string) => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.post("/tables/split/", { group_id: groupId });
      await fetchData();
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
      await apiClient.patch(`/tables/${deactivateTarget.id}/`, {
        is_active: !deactivateTarget.is_active,
      });
      setDeactivateTarget(null);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    AVAILABLE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    OCCUPIED: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    RESERVED: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    BILLING: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    DIRTY: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  };

  const allowedTransitions: Record<string, string[]> = {
    AVAILABLE: ["OCCUPIED", "RESERVED"],
    OCCUPIED: ["BILLING", "AVAILABLE"],
    BILLING: ["DIRTY", "AVAILABLE"],
    DIRTY: ["AVAILABLE"],
    RESERVED: ["OCCUPIED", "AVAILABLE"],
  };

  const activeCount = tables.filter((t) => t.is_active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("tables.title")}
        description={t("tables.subtitle")}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: t("tables.title") },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {canMerge && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedTableIdsForJoin([]);
                  setJoinGroupLabel("");
                  setIsJoinOpen(true);
                }}
                disabled={loading || tables.filter((t) => t.is_combinable && !t.group).length < 2}
                className="min-h-[44px]"
              >
                <Link2 className="w-4 h-4 mr-1.5" />
                {t("tables.joinTables")}
              </Button>
            )}
            {canManage && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setBulkForm({
                      ...bulkForm,
                      section_id: sections[0]?.id || "",
                    });
                    setIsBulkOpen(true);
                  }}
                  disabled={loading || sections.length === 0}
                  className="min-h-[44px]"
                >
                  <Copy className="w-4 h-4 mr-1.5" />
                  {t("tables.bulkCreate")}
                </Button>
                <Button
                  onClick={() => {
                    setSingleForm({
                      ...singleForm,
                      section_id: sections[0]?.id || "",
                    });
                    setIsAddOpen(true);
                  }}
                  disabled={loading || sections.length === 0}
                  className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {t("tables.addTable")}
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Plan Usage Meter Card */}
      <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="text-xs font-semibold text-muted-foreground block">{t("tables.planUsage")}</span>
          <span className="text-lg font-black text-foreground">
            {activeCount} of {maxTables} tables used
          </span>
        </div>
        <div className="w-full sm:w-64">
          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full transition-all ${
                activeCount / maxTables >= 1
                  ? "bg-destructive"
                  : activeCount / maxTables >= 0.8
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min((activeCount / maxTables) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Filter Toolbar */}
      <Card className="border border-border">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Area</label>
            <select
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              className="w-full rounded-md border border-input bg-card p-2 min-h-[40px]"
            >
              <option value="">{t("tables.filterArea")}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Section</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full rounded-md border border-input bg-card p-2 min-h-[40px]"
            >
              <option value="">{t("tables.filterSection")}</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-md border border-input bg-card p-2 min-h-[40px]"
            >
              <option value="">{t("tables.filterStatus")}</option>
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="RESERVED">Reserved</option>
              <option value="BILLING">Billing</option>
              <option value="DIRTY">Dirty</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("tables.searchPlaceholder")}
                className="w-full pl-9 rounded-md border border-input bg-card p-2 min-h-[40px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tables DataTable */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground font-medium">{t("common.loading")}</div>
      ) : tables.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Utensils className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-foreground">No tables match your filter</h3>
            <p className="text-xs text-muted-foreground mt-1">Try resetting filters or adding new dining tables.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-border rounded-xl bg-card overflow-x-auto shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="p-3.5">Label</th>
                <th className="p-3.5">Section</th>
                <th className="p-3.5">Seats</th>
                <th className="p-3.5">Type & Shape</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Group</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {tables.map((table) => (
                <tr key={table.id} className="hover:bg-muted/10 transition">
                  <td className="p-3.5 font-bold text-foreground">
                    <span className="text-sm">{table.label}</span>
                    {!table.is_active && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded bg-destructive/10 text-destructive">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-muted-foreground">
                    {table.section?.name || "-"}
                  </td>
                  <td className="p-3.5 font-medium">{table.capacity} seats</td>
                  <td className="p-3.5 text-muted-foreground">
                    {table.table_type} • {table.shape}
                  </td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusColors[table.status] || ""}`}>
                      {table.status}
                    </span>
                  </td>
                  <td className="p-3.5">
                    {table.group ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-primary">{table.group.label}</span>
                        {canMerge && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSplitGroup(table.group!.id)}
                            className="h-6 px-1.5 text-destructive"
                            title={t("tables.splitGroup")}
                          >
                            <Unlink className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-[11px]">Single</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Status Transition buttons if permitted */}
                      {canUpdateStatus && allowedTransitions[table.status]?.map((nextStat) => (
                        <Button
                          key={nextStat}
                          variant="outline"
                          size="sm"
                          disabled={actionLoading}
                          onClick={() => handleStatusChange(table, nextStat)}
                          className="h-8 px-2 text-[10px] font-bold"
                        >
                          → {nextStat}
                        </Button>
                      ))}

                      {/* QR standee link */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate("/qr")}
                        className="h-8 px-2 text-muted-foreground"
                        title={t("tables.qrCode")}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                      </Button>

                      {/* Deactivate table */}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeactivateTarget(table)}
                          className="h-8 px-2 text-destructive hover:bg-destructive/10"
                        >
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Create Dialog */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleBulkSubmit}>
            <DialogHeader>
              <DialogTitle>{t("tables.bulkCreate")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">Section *</label>
                <select
                  required
                  value={bulkForm.section_id}
                  onChange={(e) => setBulkForm({ ...bulkForm, section_id: e.target.value })}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold block mb-1 text-foreground">{t("tables.prefix")}</label>
                  <input
                    value={bulkForm.prefix}
                    onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value })}
                    className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-foreground">{t("tables.startNumber")}</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkForm.start_number}
                    onChange={(e) => setBulkForm({ ...bulkForm, start_number: Number(e.target.value) })}
                    className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-foreground">{t("tables.count")}</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={bulkForm.count}
                    onChange={(e) => setBulkForm({ ...bulkForm, count: Number(e.target.value) })}
                    className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                  />
                </div>
              </div>

              {/* Label Preview */}
              <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs">
                <span className="font-bold text-muted-foreground block mb-0.5">{t("tables.bulkPreview")}:</span>
                <span className="font-mono text-primary font-bold">{getBulkPreviewString()}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1 text-foreground">{t("tables.seats")}</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkForm.capacity}
                    onChange={(e) => setBulkForm({ ...bulkForm, capacity: Number(e.target.value) })}
                    className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-foreground">{t("tables.shape")}</label>
                  <select
                    value={bulkForm.shape}
                    onChange={(e) => setBulkForm({ ...bulkForm, shape: e.target.value })}
                    className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                  >
                    <option value="SQUARE">Square</option>
                    <option value="ROUND">Round</option>
                    <option value="RECTANGLE">Rectangle</option>
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBulkOpen(false)}>
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

      {/* Add Single Table Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSingleSubmit}>
            <DialogHeader>
              <DialogTitle>{t("tables.addTable")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">Section *</label>
                <select
                  required
                  value={singleForm.section_id}
                  onChange={(e) => setSingleForm({ ...singleForm, section_id: e.target.value })}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">{t("tables.label")} *</label>
                <input
                  required
                  value={singleForm.label}
                  onChange={(e) => setSingleForm({ ...singleForm, label: e.target.value })}
                  placeholder="e.g. T15 or VIP-1"
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1 text-foreground">{t("tables.seats")}</label>
                  <input
                    type="number"
                    min="1"
                    value={singleForm.capacity}
                    onChange={(e) => setSingleForm({ ...singleForm, capacity: Number(e.target.value) })}
                    className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1 text-foreground">{t("tables.shape")}</label>
                  <select
                    value={singleForm.shape}
                    onChange={(e) => setSingleForm({ ...singleForm, shape: e.target.value })}
                    className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                  >
                    <option value="SQUARE">Square</option>
                    <option value="ROUND">Round</option>
                    <option value="RECTANGLE">Rectangle</option>
                  </select>
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

      {/* Join Tables Dialog */}
      <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleJoinSubmit}>
            <DialogHeader>
              <DialogTitle>{t("tables.joinTables")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">{t("tables.groupLabel")}</label>
                <input
                  value={joinGroupLabel}
                  onChange={(e) => setJoinGroupLabel(e.target.value)}
                  placeholder="e.g. Birthday Party Group"
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1 text-foreground">Select joinable tables (min 2):</label>
                <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-2 space-y-1.5">
                  {tables
                    .filter((t) => t.is_combinable && !t.group)
                    .map((table) => {
                      const isChecked = selectedTableIdsForJoin.includes(table.id);
                      return (
                        <label
                          key={table.id}
                          className="flex items-center gap-2.5 p-2 rounded hover:bg-muted/30 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTableIdsForJoin([...selectedTableIdsForJoin, table.id]);
                              } else {
                                setSelectedTableIdsForJoin(selectedTableIdsForJoin.filter((id) => id !== table.id));
                              }
                            }}
                            className="rounded border-border text-[#FF6A00] focus:ring-[#FF6A00]"
                          />
                          <span className="font-bold text-foreground">{table.label}</span>
                          <span className="text-muted-foreground text-[11px]">({table.capacity} seats, {table.section?.name})</span>
                        </label>
                      );
                    })}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsJoinOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={actionLoading || selectedTableIdsForJoin.length < 2}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
              >
                {actionLoading ? t("common.saving") : t("tables.joinTables")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title={t("tables.deactivateTable")}
        description={t("tables.deactivateConfirm")}
        confirmLabel={t("common.confirm")}
        variant="destructive"
        isLoading={actionLoading}
        onConfirm={handleDeactivate}
      />
    </div>
  );
};
