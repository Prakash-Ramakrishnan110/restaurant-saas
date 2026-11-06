import React, { useState, useEffect } from "react";
import { Layers, Plus, Edit2, Trash2, ChevronUp, ChevronDown, Folder } from "lucide-react";
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

export interface SectionItem {
  id: string;
  name: string;
  section_type: "INDOOR" | "OUTDOOR" | "VIP" | "PRIVATE_ROOM";
  is_active: boolean;
  color: string;
  sort_order: number;
  service_area: string;
  tables_count?: number;
}

export interface ServiceAreaItem {
  id: string;
  name: string;
  area_type: string;
  service_charge_bps: number;
  is_active: boolean;
  sort_order: number;
  branch: string;
  sections?: SectionItem[];
}

export const AreasPage: React.FC = () => {
  const { t } = useTranslation();
  const { can, activeTenant } = useAuth();
  const canManage = can("area.manage");

  const [areas, setAreas] = useState<ServiceAreaItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dialog states
  const [isAreaAddOpen, setIsAreaAddOpen] = useState<boolean>(false);
  const [isAreaEditOpen, setIsAreaEditOpen] = useState<boolean>(false);
  const [editAreaTarget, setEditAreaTarget] = useState<ServiceAreaItem | null>(null);

  const [isSectionAddOpen, setIsSectionAddOpen] = useState<boolean>(false);
  const [selectedAreaForSection, setSelectedAreaForSection] = useState<ServiceAreaItem | null>(
    null
  );
  const [isSectionEditOpen, setIsSectionEditOpen] = useState<boolean>(false);
  const [editSectionTarget, setEditSectionTarget] = useState<SectionItem | null>(null);
  const [deactivateSectionTarget, setDeactivateSectionTarget] = useState<SectionItem | null>(null);

  const [deactivateAreaTarget, setDeactivateAreaTarget] = useState<ServiceAreaItem | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Form states
  const [areaForm, setAreaForm] = useState({
    name: "",
    area_type: "DINING",
    service_charge_bps: 0,
  });
  const [sectionForm, setSectionForm] = useState({
    name: "",
    section_type: "INDOOR" as "INDOOR" | "OUTDOOR" | "VIP" | "PRIVATE_ROOM",
    color: "#3B82F6",
    is_active: true,
  });
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false);

  const [activeBranchId, setActiveBranchId] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [branchRes, areaRes, secRes] = await Promise.all([
        apiClient.get<any>("/branches/"),
        apiClient.get<any>("/service-areas/"),
        apiClient.get<any>("/sections/"),
      ]);

      const branches = branchRes.data?.results || branchRes.data || [];
      const branchId = branches[0]?.id || "";
      setActiveBranchId(branchId);

      const allAreas: ServiceAreaItem[] = areaRes.data?.results || areaRes.data || [];
      const allSections: SectionItem[] = secRes.data?.results || secRes.data || [];

      setSections(allSections);
      setAreas(allAreas);
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTenant?.tenant_id]);

  const handleOpenAddArea = () => {
    setAreaForm({ name: "", area_type: "DINING", service_charge_bps: 0 });
    setIsFormDirty(false);
    setIsAreaAddOpen(true);
  };

  const handleOpenEditArea = (area: ServiceAreaItem) => {
    setEditAreaTarget(area);
    setAreaForm({
      name: area.name,
      area_type: area.area_type || "DINING",
      service_charge_bps: area.service_charge_bps || 0,
    });
    setIsFormDirty(false);
    setIsAreaEditOpen(true);
  };

  const handleSaveAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranchId) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.post("/service-areas/", {
        ...areaForm,
        branch: activeBranchId,
        sort_order: areas.length + 1,
      });
      setIsAreaAddOpen(false);
      setIsFormDirty(false);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEditArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAreaTarget) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.patch(`/service-areas/${editAreaTarget.id}/`, areaForm);
      setIsAreaEditOpen(false);
      setEditAreaTarget(null);
      setIsFormDirty(false);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReorderArea = async (area: ServiceAreaItem, direction: "up" | "down") => {
    const sorted = [...areas].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((a) => a.id === area.id);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const swapTarget = sorted[targetIndex];
    setActionLoading(true);
    try {
      await Promise.all([
        apiClient.patch(`/service-areas/${area.id}/`, { sort_order: swapTarget.sort_order }),
        apiClient.patch(`/service-areas/${swapTarget.id}/`, { sort_order: area.sort_order }),
      ]);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenAddSection = (area: ServiceAreaItem) => {
    setSelectedAreaForSection(area);
    setSectionForm({
      name: "",
      section_type: "INDOOR",
      color: "#3B82F6",
      is_active: true,
    });
    setIsFormDirty(false);
    setIsSectionAddOpen(true);
  };

  const handleOpenEditSection = (sec: SectionItem) => {
    setEditSectionTarget(sec);
    setSectionForm({
      name: sec.name,
      section_type: sec.section_type || "INDOOR",
      color: sec.color || "#3B82F6",
      is_active: sec.is_active ?? true,
    });
    setIsFormDirty(false);
    setIsSectionEditOpen(true);
  };

  const handleSaveAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaForSection || !activeBranchId) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.post("/sections/", {
        ...sectionForm,
        branch: activeBranchId,
        service_area: selectedAreaForSection.id,
        sort_order: sections.filter((s) => s.service_area === selectedAreaForSection.id).length + 1,
      });
      setIsSectionAddOpen(false);
      setSelectedAreaForSection(null);
      setIsFormDirty(false);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEditSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSectionTarget) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.patch(`/sections/${editSectionTarget.id}/`, sectionForm);
      setIsSectionEditOpen(false);
      setEditSectionTarget(null);
      setIsFormDirty(false);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReorderSection = async (sec: SectionItem, direction: "up" | "down") => {
    const areaSections = sections
      .filter((s) => s.service_area === sec.service_area)
      .sort((a, b) => a.sort_order - b.sort_order);
    const index = areaSections.findIndex((s) => s.id === sec.id);
    if (index === -1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= areaSections.length) return;

    const swapTarget = areaSections[targetIndex];
    setActionLoading(true);
    try {
      await Promise.all([
        apiClient.patch(`/sections/${sec.id}/`, { sort_order: swapTarget.sort_order }),
        apiClient.patch(`/sections/${swapTarget.id}/`, { sort_order: sec.sort_order }),
      ]);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateSection = async () => {
    if (!deactivateSectionTarget) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.patch(`/sections/${deactivateSectionTarget.id}/`, { is_active: false });
      setDeactivateSectionTarget(null);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateArea = async () => {
    if (!deactivateAreaTarget) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.patch(`/service-areas/${deactivateAreaTarget.id}/`, {
        is_active: !deactivateAreaTarget.is_active,
      });
      setDeactivateAreaTarget(null);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("areas.title")}
        description={t("areas.subtitle")}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: t("areas.title") }]}
        actions={
          canManage && (
            <Button
              onClick={handleOpenAddArea}
              disabled={loading || !activeBranchId}
              className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("areas.addArea")}
            </Button>
          )
        }
      />

      {errorMessage && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Tree View of Areas and Sections */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground font-medium">
          {t("common.loading")}
        </div>
      ) : areas.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-foreground">{t("areas.noAreas")}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first service area (e.g. Main Hall, AC Room, Counter).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {areas
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((area, areaIdx, areaArr) => {
              const areaSections = sections
                .filter((s) => s.service_area === area.id || (s as any).service_area_id === area.id)
                .sort((a, b) => a.sort_order - b.sort_order);

              return (
                <Card key={area.id} className="border border-border overflow-hidden">
                  <div className="p-4 bg-muted/30 border-b border-border flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <Folder className="w-5 h-5 text-[#FF6A00]" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-foreground">{area.name}</h3>
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-muted border border-border">
                            {area.area_type}
                          </span>
                          {!area.is_active && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-destructive/10 text-destructive border border-destructive/20">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {areaSections.length} sections •{" "}
                          {area.service_charge_bps > 0
                            ? `${area.service_charge_bps / 100}% service charge`
                            : "No service charge"}
                        </p>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={areaIdx === 0 || actionLoading}
                          onClick={() => handleReorderArea(area, "up")}
                          aria-label={t("areas.reorderUp")}
                          className="min-h-[36px]"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={areaIdx === areaArr.length - 1 || actionLoading}
                          onClick={() => handleReorderArea(area, "down")}
                          aria-label={t("areas.reorderDown")}
                          className="min-h-[36px]"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenAddSection(area)}
                          className="text-xs min-h-[36px]"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          {t("areas.addSection")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditArea(area)}
                          className="min-h-[36px]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeactivateAreaTarget(area)}
                          className="min-h-[36px] text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Nested Sections List */}
                  <CardContent className="p-4 pt-3 space-y-2">
                    {areaSections.length === 0 ? (
                      <div className="py-4 px-2 text-xs text-muted-foreground italic">
                        {t("areas.noSections")}
                      </div>
                    ) : (
                      areaSections.map((sec, secIdx, secArr) => (
                        <div
                          key={sec.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/80 hover:border-border transition"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: sec.color }}
                            />
                            <span className="text-xs font-bold text-foreground">{sec.name}</span>
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-muted border border-border">
                              {sec.section_type || "INDOOR"}
                            </span>
                            {!sec.is_active && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-destructive/10 text-destructive border border-destructive/20">
                                Inactive
                              </span>
                            )}
                          </div>

                          {canManage && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={secIdx === 0 || actionLoading}
                                onClick={() => handleReorderSection(sec, "up")}
                                aria-label={t("areas.reorderUp")}
                                className="min-h-[32px] p-1.5"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={secIdx === secArr.length - 1 || actionLoading}
                                onClick={() => handleReorderSection(sec, "down")}
                                aria-label={t("areas.reorderDown")}
                                className="min-h-[32px] p-1.5"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditSection(sec)}
                                className="min-h-[32px] p-1.5"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeactivateSectionTarget(sec)}
                                className="min-h-[32px] p-1.5 text-destructive hover:bg-destructive/10"
                                title="Deactivate Section"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      {/* Add Area Dialog */}
      <Dialog
        open={isAreaAddOpen}
        onOpenChange={(open) =>
          !open && (!isFormDirty || window.confirm("Discard changes?")) && setIsAreaAddOpen(false)
        }
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveAddArea}>
            <DialogHeader>
              <DialogTitle>{t("areas.addArea")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("areas.areaName")} *
                </label>
                <input
                  required
                  value={areaForm.name}
                  onChange={(e) => {
                    setAreaForm({ ...areaForm, name: e.target.value });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                  placeholder="e.g. Ground Floor Dining"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("areas.areaType")} *
                </label>
                <select
                  value={areaForm.area_type}
                  onChange={(e) => {
                    setAreaForm({ ...areaForm, area_type: e.target.value });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                >
                  <option value="DINING">Dining Hall</option>
                  <option value="OUTDOOR">Outdoor / Patio</option>
                  <option value="BAR">Bar / Lounge</option>
                  <option value="ROOM_SERVICE">Room Service</option>
                  <option value="TAKEOUT">Takeout Counter</option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("areas.serviceCharge")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  value={areaForm.service_charge_bps / 100}
                  onChange={(e) => {
                    setAreaForm({
                      ...areaForm,
                      service_charge_bps: Math.round(Number(e.target.value) * 100),
                    });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                  placeholder="0"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAreaAddOpen(false)}>
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

      {/* Edit Area Dialog */}
      <Dialog
        open={isAreaEditOpen}
        onOpenChange={(open) =>
          !open && (!isFormDirty || window.confirm("Discard changes?")) && setIsAreaEditOpen(false)
        }
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveEditArea}>
            <DialogHeader>
              <DialogTitle>{t("areas.editArea")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("areas.areaName")} *
                </label>
                <input
                  required
                  value={areaForm.name}
                  onChange={(e) => {
                    setAreaForm({ ...areaForm, name: e.target.value });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("areas.areaType")} *
                </label>
                <select
                  value={areaForm.area_type}
                  onChange={(e) => {
                    setAreaForm({ ...areaForm, area_type: e.target.value });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                >
                  <option value="DINING">Dining Hall</option>
                  <option value="OUTDOOR">Outdoor / Patio</option>
                  <option value="BAR">Bar / Lounge</option>
                  <option value="ROOM_SERVICE">Room Service</option>
                  <option value="TAKEOUT">Takeout Counter</option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("areas.serviceCharge")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  value={areaForm.service_charge_bps / 100}
                  onChange={(e) => {
                    setAreaForm({
                      ...areaForm,
                      service_charge_bps: Math.round(Number(e.target.value) * 100),
                    });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAreaEditOpen(false)}>
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

      {/* Add Section Dialog */}
      <Dialog
        open={isSectionAddOpen}
        onOpenChange={(open) =>
          !open &&
          (!isFormDirty || window.confirm("Discard changes?")) &&
          setIsSectionAddOpen(false)
        }
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveAddSection}>
            <DialogHeader>
              <DialogTitle>
                {t("areas.addSection")} ({selectedAreaForSection?.name})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("areas.sectionName")} *
                </label>
                <input
                  required
                  value={sectionForm.name}
                  onChange={(e) => {
                    setSectionForm({ ...sectionForm, name: e.target.value });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                  placeholder="e.g. AC Section / Family Hall"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">Section Type *</label>
                <select
                  value={sectionForm.section_type}
                  onChange={(e) => {
                    setSectionForm({ ...sectionForm, section_type: e.target.value as any });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                >
                  <option value="INDOOR">Indoor</option>
                  <option value="OUTDOOR">Outdoor</option>
                  <option value="VIP">VIP</option>
                  <option value="PRIVATE_ROOM">Private Room</option>
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("areas.sectionColor")}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={sectionForm.color}
                    onChange={(e) => {
                      setSectionForm({ ...sectionForm, color: e.target.value });
                      setIsFormDirty(true);
                    }}
                    className="w-10 h-10 rounded border border-border cursor-pointer p-0.5"
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {sectionForm.color}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSectionAddOpen(false)}>
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

      {/* Edit Section Dialog */}
      <Dialog
        open={isSectionEditOpen}
        onOpenChange={(open) =>
          !open &&
          (!isFormDirty || window.confirm("Discard changes?")) &&
          setIsSectionEditOpen(false)
        }
      >
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveEditSection}>
            <DialogHeader>
              <DialogTitle>{t("areas.editSection")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 text-xs">
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("areas.sectionName")} *
                </label>
                <input
                  required
                  value={sectionForm.name}
                  onChange={(e) => {
                    setSectionForm({ ...sectionForm, name: e.target.value });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">Section Type *</label>
                <select
                  value={sectionForm.section_type}
                  onChange={(e) => {
                    setSectionForm({ ...sectionForm, section_type: e.target.value as any });
                    setIsFormDirty(true);
                  }}
                  className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
                >
                  <option value="INDOOR">Indoor</option>
                  <option value="OUTDOOR">Outdoor</option>
                  <option value="VIP">VIP</option>
                  <option value="PRIVATE_ROOM">Private Room</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="section-active-toggle"
                  checked={sectionForm.is_active}
                  onChange={(e) => {
                    setSectionForm({ ...sectionForm, is_active: e.target.checked });
                    setIsFormDirty(true);
                  }}
                  className="w-4 h-4 rounded border-border"
                />
                <label
                  htmlFor="section-active-toggle"
                  className="font-semibold text-foreground cursor-pointer"
                >
                  Active Section
                </label>
              </div>
              <div>
                <label className="font-semibold block mb-1 text-foreground">
                  {t("areas.sectionColor")}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={sectionForm.color}
                    onChange={(e) => {
                      setSectionForm({ ...sectionForm, color: e.target.value });
                      setIsFormDirty(true);
                    }}
                    className="w-10 h-10 rounded border border-border cursor-pointer p-0.5"
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {sectionForm.color}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSectionEditOpen(false)}>
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

      {/* Deactivate Area Confirm */}
      <ConfirmDialog
        open={Boolean(deactivateAreaTarget)}
        onOpenChange={(open) => !open && setDeactivateAreaTarget(null)}
        title={t("areas.deactivateArea")}
        description={t("areas.deactivateConfirm")}
        confirmLabel={t("common.confirm")}
        variant="destructive"
        isLoading={actionLoading}
        onConfirm={handleDeactivateArea}
      />

      {/* Deactivate Section Confirm */}
      <ConfirmDialog
        open={Boolean(deactivateSectionTarget)}
        onOpenChange={(open) => !open && setDeactivateSectionTarget(null)}
        title="Deactivate Section"
        description="Are you sure you want to deactivate this section? New tables cannot be created in an inactive section."
        confirmLabel={t("common.confirm")}
        variant="destructive"
        isLoading={actionLoading}
        onConfirm={handleDeactivateSection}
      />
    </div>
  );
};
