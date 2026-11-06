import React, { useState, useEffect } from "react";
import { Zap, Plus, Edit2, Power, Bell, CheckCircle2, Clock, Sparkles } from "lucide-react";
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

export interface CounterItem {
  id: string;
  name: string;
  area_type: string;
  is_active: boolean;
  sort_order: number;
}

export interface LiveTokenItem {
  number: number;
  status: "PREPARING" | "READY" | "COLLECTED";
  counter_name: string;
  timestamp: string;
}

export const CountersPage: React.FC = () => {
  const { t } = useTranslation();
  const { can, activeTenant } = useAuth();
  const canManage = can("area.manage");

  const [counters, setCounters] = useState<CounterItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [editTarget, setEditTarget] = useState<CounterItem | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<CounterItem | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Forms
  const [counterName, setCounterName] = useState<string>("");
  const [activeBranchId, setActiveBranchId] = useState<string>("");

  // Live Token Queue State
  const [callingToken, setCallingToken] = useState<number>(101);
  const [liveTokens, setLiveTokens] = useState<LiveTokenItem[]>([
    { number: 101, status: "READY", counter_name: "Counter 1", timestamp: "Just now" },
    { number: 102, status: "PREPARING", counter_name: "Counter 1", timestamp: "2 mins ago" },
    { number: 103, status: "PREPARING", counter_name: "Counter 2", timestamp: "5 mins ago" },
  ]);

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [branchRes, areaRes] = await Promise.all([
        apiClient.get<any>("/branches/"),
        apiClient.get<any>("/service-areas/"),
      ]);

      const branches = branchRes.data?.results || branchRes.data || [];
      const branchId = branches[0]?.id || "";
      setActiveBranchId(branchId);

      const items: CounterItem[] = areaRes.data?.results || areaRes.data || [];
      setCounters(items);
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTenant?.tenant_id]);

  const handleOpenAdd = () => {
    setCounterName("");
    setIsAddOpen(true);
  };

  const handleOpenEdit = (counter: CounterItem) => {
    setEditTarget(counter);
    setCounterName(counter.name);
    setIsEditOpen(true);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranchId || !counterName.trim()) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.post("/service-areas/", {
        name: counterName.trim(),
        area_type: "TAKEOUT",
        branch: activeBranchId,
        sort_order: counters.length + 1,
      });
      setIsAddOpen(false);
      await fetchData();
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !counterName.trim()) return;
    setActionLoading(true);
    setErrorMessage(null);
    try {
      await apiClient.patch(`/service-areas/${editTarget.id}/`, {
        name: counterName.trim(),
      });
      setIsEditOpen(false);
      setEditTarget(null);
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
      await apiClient.patch(`/service-areas/${deactivateTarget.id}/`, {
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

  const handleCallNextToken = () => {
    const nextNum = callingToken + 1;
    setCallingToken(nextNum);
    setLiveTokens([
      {
        number: nextNum,
        status: "READY",
        counter_name: counters[0]?.name || "Main Counter",
        timestamp: "Just now",
      },
      ...liveTokens.slice(0, 4),
    ]);
  };

  const handleMarkCollected = (num: number) => {
    setLiveTokens(liveTokens.map((t) => (t.number === num ? { ...t, status: "COLLECTED" } : t)));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("counters.title")}
        description={t("counters.subtitle")}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: t("counters.title") }]}
        actions={
          canManage && (
            <Button
              onClick={handleOpenAdd}
              disabled={loading || !activeBranchId}
              className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t("counters.addCounter")}
            </Button>
          )
        }
      />

      {errorMessage && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {/* Live Token Calling Display Station */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-2 border-primary/30 bg-primary/5 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <span className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-[#FF6A00]" />
              {t("counters.sampleToken")}
            </span>
            <CardTitle className="text-2xl font-black text-foreground">
              {t("counters.nowServing")}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-6 text-center">
            <div className="inline-flex items-center justify-center p-6 rounded-2xl bg-card border border-border shadow-md">
              <span className="text-5xl font-black font-mono tracking-tight text-[#FF6A00]">
                #{callingToken}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-3 font-medium">
              Ready for Customer Handover
            </p>
          </CardContent>
          <div className="p-4 border-t border-border/60">
            <Button
              onClick={handleCallNextToken}
              className="w-full bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[48px]"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t("counters.callNext")}
            </Button>
          </div>
        </Card>

        {/* Live Token Queue List */}
        <Card className="lg:col-span-2 border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              {t("counters.liveTokens")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {liveTokens.map((tok) => (
                <div
                  key={tok.number}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-muted/10 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black font-mono text-foreground">
                      #{tok.number}
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-foreground block">
                        {tok.counter_name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{tok.timestamp}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        tok.status === "READY"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : tok.status === "COLLECTED"
                            ? "bg-muted text-muted-foreground border-border"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                      }`}
                    >
                      {tok.status}
                    </span>
                    {tok.status !== "COLLECTED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkCollected(tok.number)}
                        className="h-8 px-2 text-xs font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Handed Over
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Counters List */}
      <div>
        <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#FF6A00]" />
          <span>Active Counters</span>
        </h3>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">{t("common.loading")}</div>
        ) : counters.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground text-xs">
              No counters configured yet. Click "Add Counter" to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {counters.map((counter) => (
              <Card key={counter.id} className="border border-border">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base font-bold text-foreground">
                        {counter.name}
                      </CardTitle>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        Station: {counter.area_type}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        counter.is_active
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {counter.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </CardHeader>
                {canManage && (
                  <CardContent className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(counter)}
                      className="min-h-[40px] text-xs font-semibold"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                      {t("counters.renameCounter")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeactivateTarget(counter)}
                      className="min-h-[40px] text-xs font-semibold text-destructive hover:bg-destructive/10"
                    >
                      <Power className="w-3.5 h-3.5 mr-1.5" />
                      {counter.is_active ? t("counters.deactivateCounter") : "Activate"}
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Counter Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveAdd}>
            <DialogHeader>
              <DialogTitle>{t("counters.addCounter")}</DialogTitle>
            </DialogHeader>
            <div className="py-4 text-xs">
              <label className="font-semibold block mb-1 text-foreground">
                {t("counters.counterName")} *
              </label>
              <input
                required
                value={counterName}
                onChange={(e) => setCounterName(e.target.value)}
                placeholder="e.g. Tea & Snack Counter"
                className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
              />
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

      {/* Rename Counter Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>{t("counters.renameCounter")}</DialogTitle>
            </DialogHeader>
            <div className="py-4 text-xs">
              <label className="font-semibold block mb-1 text-foreground">
                {t("counters.counterName")} *
              </label>
              <input
                required
                value={counterName}
                onChange={(e) => setCounterName(e.target.value)}
                className="w-full rounded-md border border-input bg-card p-2.5 min-h-[44px]"
              />
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
        title={t("counters.deactivateCounter")}
        description={t("counters.deactivateConfirm")}
        confirmLabel={t("common.confirm")}
        variant="destructive"
        isLoading={actionLoading}
        onConfirm={handleDeactivate}
      />
    </div>
  );
};
