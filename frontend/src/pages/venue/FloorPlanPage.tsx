import React, { useState, useEffect } from "react";
import { LayoutGrid, Utensils, Info, X, ArrowRight, Armchair } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import { mapBackendErrorCode } from "../../lib/errorMapper";
import { TableChairsVisual } from "../../components/venue/TableChairsVisual";

export interface FloorTable {
  id: string;
  label: string;
  label_prefix: string;
  label_number: number;
  capacity: number;
  shape: "SQUARE" | "ROUND" | "RECTANGLE";
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "BLOCKED";
  is_active: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
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

export const FloorPlanPage: React.FC = () => {
  const { t } = useTranslation();
  const { can, activeTenant } = useAuth();
  const canUpdateStatus = can("table.status_update");

  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Side sheet state
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null);
  const [selectedChair, setSelectedChair] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [secRes, tblRes] = await Promise.all([
        apiClient.get<any>("/sections/"),
        apiClient.get<any>("/tables/"),
      ]);

      const secList = secRes.data?.results || secRes.data || [];
      setSections(secList);
      if (secList.length > 0 && !selectedSectionId) {
        setSelectedSectionId(secList[0].id);
      }

      const allTables: FloorTable[] = tblRes.data?.results || tblRes.data || [];
      setTables(allTables.filter((t) => t.is_active));
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenant?.tenant_id]);

  const activeSectionTables = tables.filter(
    (t) => !selectedSectionId || t.section?.id === selectedSectionId
  );

  const statusThemes: Record<string, { bg: string; border: string; text: string; label: string }> =
    {
      AVAILABLE: {
        bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
        border: "border-emerald-500/40",
        text: "text-emerald-700 dark:text-emerald-400",
        label: t("floorPlan.legendAvailable"),
      },
      OCCUPIED: {
        bg: "bg-blue-500/10 hover:bg-blue-500/20",
        border: "border-blue-500/40",
        text: "text-blue-700 dark:text-blue-400",
        label: t("floorPlan.legendOccupied"),
      },
      RESERVED: {
        bg: "bg-purple-500/10 hover:bg-purple-500/20",
        border: "border-purple-500/40",
        text: "text-purple-700 dark:text-purple-400",
        label: t("floorPlan.legendReserved"),
      },
      CLEANING: {
        bg: "bg-amber-500/10 hover:bg-amber-500/20",
        border: "border-amber-500/40",
        text: "text-amber-700 dark:text-amber-400",
        label: t("floorPlan.legendCleaning", "Cleaning"),
      },
      BLOCKED: {
        bg: "bg-slate-500/10 hover:bg-slate-500/20",
        border: "border-slate-500/40",
        text: "text-slate-700 dark:text-slate-400",
        label: t("floorPlan.legendBlocked", "Blocked"),
      },
    };

  const allowedTransitions: Record<string, string[]> = {
    AVAILABLE: ["OCCUPIED", "RESERVED", "BLOCKED"],
    OCCUPIED: ["CLEANING", "AVAILABLE"],
    CLEANING: ["AVAILABLE"],
    RESERVED: ["OCCUPIED", "AVAILABLE"],
    BLOCKED: ["AVAILABLE"],
  };

  const handleStatusTransition = async (newStatus: string) => {
    if (!selectedTable) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.post(`/tables/${selectedTable.id}/status/`, {
        status: newStatus,
        reason: "Updated via Floor Plan Side Sheet",
      });
      const updatedTable: FloorTable = res.data;
      setTables(tables.map((t) => (t.id === updatedTable.id ? updatedTable : t)));
      setSelectedTable(updatedTable);
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("floorPlan.title")}
        description={t("floorPlan.subtitle")}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: t("floorPlan.title") }]}
      />

      {/* Header notice: Drag-and-drop comes later */}
      <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center gap-3 text-xs text-foreground font-medium">
        <Info className="w-4 h-4 text-[#FF6A00] shrink-0" />
        <span>{t("floorPlan.dragDropNotice")}</span>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Interactive Legend Bar */}
      <div className="p-3.5 rounded-xl border border-border bg-card flex flex-wrap items-center gap-4 text-xs font-semibold">
        <span className="text-muted-foreground mr-1">Legend:</span>
        {Object.entries(statusThemes).map(([stat, theme]) => (
          <span key={stat} className="inline-flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full border ${theme.border} ${theme.bg}`} />
            <span className={theme.text}>{theme.label}</span>
          </span>
        ))}
      </div>

      {/* Section Selector Tabs */}
      {sections.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {sections.map((sec) => (
            <Button
              key={sec.id}
              variant={selectedSectionId === sec.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSectionId(sec.id)}
              className={`min-h-[44px] font-bold text-xs ${
                selectedSectionId === sec.id ? "bg-[#FF6A00] text-navy hover:bg-[#E55F00]" : ""
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full mr-2"
                style={{ backgroundColor: sec.color }}
              />
              {sec.name}
            </Button>
          ))}
        </div>
      )}

      {/* Floor Plan Visual Grid */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : activeSectionTables.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <LayoutGrid className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-foreground">No tables in this section</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Configure dining tables under the Tables menu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="p-6 rounded-2xl border border-border bg-card/60 shadow-inner min-h-[450px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 items-center justify-items-center">
            {activeSectionTables.map((table) => {
              const isSelected = selectedTable?.id === table.id;

              return (
                <div
                  key={table.id}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                    isSelected
                      ? "border-[#FF6A00] bg-primary/5 shadow-md scale-105"
                      : "border-border/60 bg-card hover:border-border hover:shadow-sm"
                  }`}
                >
                  <TableChairsVisual
                    label={table.label}
                    shape={table.shape}
                    capacity={table.capacity}
                    status={table.status}
                    isSelected={isSelected}
                    size="md"
                    onTableClick={() => {
                      setSelectedTable(table);
                      setSelectedChair(null);
                    }}
                    onChairClick={(chairNum) => {
                      setSelectedTable(table);
                      setSelectedChair(chairNum);
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between w-full px-1 text-[11px] font-semibold text-muted-foreground">
                    <span className="truncate max-w-[90px]">{table.section?.name}</span>
                    {table.group ? (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-primary text-navy">
                        {table.group.label}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        {table.capacity === 4
                          ? "4-Seater"
                          : table.capacity === 6
                            ? "6-Seater"
                            : `${table.capacity} Seats`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Side Sheet Table Details Drawer */}
      {selectedTable && (
        <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-card border-l border-border shadow-2xl p-6 z-50 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[#FF6A00]" />
                <h3 className="text-lg font-bold text-foreground">{t("floorPlan.tableDetails")}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTable(null)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4 py-6 text-xs">
              <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Table Label</span>
                  <span className="text-xl font-black text-foreground font-mono">
                    {selectedTable.label}
                  </span>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    statusThemes[selectedTable.status]?.border
                  } ${statusThemes[selectedTable.status]?.bg} ${
                    statusThemes[selectedTable.status]?.text
                  }`}
                >
                  {selectedTable.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-muted-foreground">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="block text-[11px] font-semibold">Seating Capacity</span>
                  <span className="text-base font-bold text-foreground mt-0.5 block">
                    {selectedTable.capacity} guests
                  </span>
                </div>
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="block text-[11px] font-semibold">Shape</span>
                  <span className="text-base font-bold text-foreground mt-0.5 block">
                    {selectedTable.shape}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-border bg-card text-muted-foreground">
                <span className="block text-[11px] font-semibold">Section & Area</span>
                <span className="text-xs font-bold text-foreground mt-0.5 block">
                  {selectedTable.section?.name} •{" "}
                  {selectedTable.section?.service_area?.name || "Main Area"}
                </span>
              </div>

              {selectedTable.group && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <span className="block text-[11px] font-semibold">Joined Group</span>
                  <span className="text-sm font-bold block mt-0.5">
                    {selectedTable.group.label}
                  </span>
                </div>
              )}

              {/* Seating Layout & Chair Breakdown */}
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <Armchair className="w-4 h-4 text-[#FF6A00]" />
                    Chairs & Seating ({selectedTable.capacity} Chairs)
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {selectedTable.capacity === 4
                      ? "4-Seater Format"
                      : selectedTable.capacity === 6
                        ? "6-Seater Format"
                        : `${selectedTable.capacity}-Chair Custom`}
                  </span>
                </div>

                {/* Mini Visual Preview */}
                <div className="flex justify-center py-2 bg-muted/20 rounded-lg border border-border/40">
                  <TableChairsVisual
                    label={selectedTable.label}
                    shape={selectedTable.shape}
                    capacity={selectedTable.capacity}
                    status={selectedTable.status}
                    selectedChair={selectedChair}
                    onChairClick={(chairNum) => setSelectedChair(chairNum)}
                    size="sm"
                  />
                </div>

                {/* Chair Selection Pills */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {Array.from({ length: selectedTable.capacity }, (_, idx) => idx + 1).map(
                    (chairNum) => (
                      <button
                        key={chairNum}
                        type="button"
                        onClick={() => setSelectedChair(chairNum)}
                        className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                          selectedChair === chairNum
                            ? "border-[#FF6A00] bg-[#FF6A00]/10 text-foreground font-bold shadow-xs"
                            : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60"
                        }`}
                      >
                        <span className="block text-[10px] font-semibold">Seat</span>
                        <span className="block text-sm font-black font-mono">#{chairNum}</span>
                      </button>
                    )
                  )}
                </div>

                {selectedChair ? (
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-[11px] text-foreground flex items-center justify-between">
                    <span>
                      Selected: <strong>Chair #{selectedChair}</strong>
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedChair(null)}
                      className="h-6 px-1.5 text-xs text-muted-foreground"
                    >
                      Clear
                    </Button>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground italic text-center">
                    Click any chair node to inspect or assign individual seat orders.
                  </p>
                )}
              </div>

              {/* Status Update Actions */}
              {canUpdateStatus && (
                <div className="pt-2">
                  <label className="font-bold text-foreground block mb-2">
                    {t("floorPlan.updateStatus")}:
                  </label>
                  <div className="space-y-2">
                    {allowedTransitions[selectedTable.status]?.map((nextStat) => (
                      <Button
                        key={nextStat}
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => handleStatusTransition(nextStat)}
                        className="w-full justify-between min-h-[44px] text-xs font-bold"
                      >
                        <span>Mark as {nextStat}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-2" />
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <Button
              variant="outline"
              className="w-full min-h-[44px]"
              onClick={() => setSelectedTable(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
