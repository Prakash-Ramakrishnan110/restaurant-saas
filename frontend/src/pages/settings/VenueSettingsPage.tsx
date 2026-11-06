import React, { useState, useEffect } from "react";
import { RotateCcw, Lock, Check, Save } from "lucide-react";
import { PageHeader } from "../../components/app/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import { mapBackendErrorCode } from "../../lib/errorMapper";

export interface CapabilitiesState {
  uses_tables: boolean;
  uses_token_numbers: boolean;
  uses_kds: boolean;
  supports_courses: boolean;
  allows_takeaway: boolean;
  allows_room_service: boolean;
  allows_room_charge: boolean;
  has_sections: boolean;
  has_seat_ordering: boolean;
  allows_table_transfer: boolean;
  allows_qr_ordering: boolean;
  payment_timing: "PAY_FIRST" | "PAY_LATER" | "EITHER";
  qr_ordering_mode: "BROWSE_ONLY" | "ORDER_WITH_APPROVAL" | "ORDER_DIRECT";
  qr_session_policy: "CUSTOMER_CAN_OPEN" | "STAFF_ONLY";
  order_workflow: "TABLE_SERVICE" | "COUNTER_TOKEN" | "BAR_TAB";
}

export const VenueSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { can, activeTenant, activeRole } = useAuth();
  const canEdit = can("business.manage") && activeRole === "OWNER";

  const [branchId, setBranchId] = useState<string>("");
  const [venueProfile, setVenueProfile] = useState<string>("CASUAL_DINING");

  const [capabilities, setCapabilities] = useState<CapabilitiesState>({
    uses_tables: true,
    uses_token_numbers: false,
    uses_kds: false,
    supports_courses: false,
    allows_takeaway: true,
    allows_room_service: false,
    allows_room_charge: false,
    has_sections: false,
    has_seat_ordering: false,
    allows_table_transfer: true,
    allows_qr_ordering: true,
    payment_timing: "EITHER",
    qr_ordering_mode: "ORDER_DIRECT",
    qr_session_policy: "CUSTOMER_CAN_OPEN",
    order_workflow: "TABLE_SERVICE",
  });

  const [entitlements, setEntitlements] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [branchRes, entRes] = await Promise.all([
        apiClient.get<any>("/branches/"),
        apiClient.get<any>("/entitlements/").catch(() => ({ data: { entitlements: {} } })),
      ]);

      const branches = branchRes.data?.results || branchRes.data || [];
      const primaryBranch = branches[0];
      if (primaryBranch) {
        setBranchId(primaryBranch.id);
        setVenueProfile(primaryBranch.venue_profile || "CASUAL_DINING");

        const capRes = await apiClient.get<any>(`/branches/${primaryBranch.id}/capabilities/`);
        setCapabilities(capRes.data);
      }

      setEntitlements(entRes.data?.entitlements || {});
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTenant?.tenant_id]);

  const handleToggle = (key: keyof CapabilitiesState, value: any) => {
    if (!canEdit) return;
    setCapabilities({ ...capabilities, [key]: value });
    setSuccessMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !branchId) return;
    setSaveLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await apiClient.patch(`/branches/${branchId}/capabilities/`, capabilities);
      setSuccessMessage(t("settings.saveSuccess"));
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setSaveLoading(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!canEdit || !branchId) return;
    setSaveLoading(true);
    setErrorMessage(null);
    try {
      const presetsRes = await apiClient.get<any>("/venues/presets/");
      const presetData = presetsRes.data?.[venueProfile] || {};
      if (presetData) {
        await apiClient.patch(`/branches/${branchId}/capabilities/`, presetData);
        setCapabilities(presetData);
        setSuccessMessage("Capabilities successfully reset to venue defaults.");
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      setErrorMessage(mapBackendErrorCode(err));
    } finally {
      setSaveLoading(false);
      setIsResetConfirmOpen(false);
    }
  };

  const renderSwitch = (
    key: keyof CapabilitiesState,
    title: string,
    description: string,
    lockedByPlan = false
  ) => {
    const isChecked = Boolean(capabilities[key]);
    const disabled = !canEdit || lockedByPlan;

    return (
      <div className="flex items-start justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/10 transition gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-foreground">{title}</span>
            {lockedByPlan && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <Lock className="w-3 h-3" />
                {t("settings.planLocked")}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>

        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={disabled}
            onChange={(e) => handleToggle(key, e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF6A00] peer-disabled:opacity-50" />
        </label>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.subtitle")}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: t("settings.title") },
        ]}
        actions={
          canEdit && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={loading || saveLoading}
                onClick={() => setIsResetConfirmOpen(true)}
                className="min-h-[44px] text-xs font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                {t("settings.resetDefaults")}
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading || saveLoading}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-navy font-bold min-h-[44px]"
              >
                <Save className="w-4 h-4 mr-1.5" />
                {saveLoading ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          )
        }
      />

      {successMessage && (
        <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive text-sm font-medium">
          {errorMessage}
        </div>
      )}

      {!canEdit && (
        <div className="p-3.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
          You are viewing these settings in read-only mode. Only the restaurant owner can modify operational capabilities.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Group 1: Dining & Floor Layout */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              {t("settings.groupDining")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {renderSwitch("uses_tables", "Dining Tables", "Enable table seating, table numbers, and waitstaff dining service.")}
            {renderSwitch("uses_token_numbers", "Token Numbers", "Generate sequential queue tokens for customer takeaway and counter pickup.")}
            {renderSwitch("has_sections", "Area Sections", "Subdivide dining areas into AC, Non-AC, Outdoor, or Family sections.")}
            {renderSwitch("has_seat_ordering", "Seat-Level Ordering", "Allow waiters to assign menu items to specific seat positions at a table.")}
            {renderSwitch("allows_table_transfer", "Table Transfers", "Allow active dining tabs to be transferred between different tables.")}
          </CardContent>
        </Card>

        {/* Group 2: Ordering & Workflow */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              {t("settings.groupOrdering")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {renderSwitch("allows_takeaway", "Takeaway & Parcel Orders", "Support takeaway orders packaged for takeout.")}
            {renderSwitch("allows_qr_ordering", "Guest QR Self-Ordering", "Allow guests to view the digital menu and submit orders from their phones.")}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-xl border border-border bg-card">
                <label className="font-bold text-xs text-foreground block mb-1">QR Ordering Mode</label>
                <select
                  disabled={!canEdit}
                  value={capabilities.qr_ordering_mode}
                  onChange={(e) => handleToggle("qr_ordering_mode", e.target.value)}
                  className="w-full rounded-md border border-input bg-card p-2 text-xs min-h-[40px]"
                >
                  <option value="BROWSE_ONLY">Browse Menu Only (No In-App Ordering)</option>
                  <option value="ORDER_WITH_APPROVAL">Order with Waiter Approval</option>
                  <option value="ORDER_DIRECT">Order Directly to Kitchen</option>
                </select>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card">
                <label className="font-bold text-xs text-foreground block mb-1">QR Session Policy</label>
                <select
                  disabled={!canEdit}
                  value={capabilities.qr_session_policy}
                  onChange={(e) => handleToggle("qr_session_policy", e.target.value)}
                  className="w-full rounded-md border border-input bg-card p-2 text-xs min-h-[40px]"
                >
                  <option value="CUSTOMER_CAN_OPEN">Guests Can Open Dining Session</option>
                  <option value="STAFF_ONLY">Staff Only Can Open Session</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Group 3: Kitchen & Preparation */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              {t("settings.groupKitchen")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {renderSwitch("uses_kds", "Kitchen Display Screen (KDS)", "Route live order tickets to digital display screens for kitchen staff.")}
            {renderSwitch(
              "supports_courses",
              "Course Management",
              "Manage order timing by courses (Starters, Mains, Desserts).",
              !entitlements?.courses
            )}
            {renderSwitch("allows_room_service", "Room Service", "Allow room-delivery orders for hotel operations.")}
            {renderSwitch("allows_room_charge", "Room Billing Charges", "Charge dining bills directly to guest hotel room tabs.")}
          </CardContent>
        </Card>

        {/* Group 4: Payment & Invoicing */}
        <Card className="border border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground">
              {t("settings.groupPayment")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 rounded-xl border border-border bg-card">
              <label className="font-bold text-xs text-foreground block mb-1">Payment Timing Policy</label>
              <select
                disabled={!canEdit}
                value={capabilities.payment_timing}
                onChange={(e) => handleToggle("payment_timing", e.target.value)}
                className="w-full rounded-md border border-input bg-card p-2 text-xs min-h-[40px]"
              >
                <option value="PAY_FIRST">Pay First (Quick Service / Counter)</option>
                <option value="PAY_LATER">Pay Later (Dine-In Table Billing)</option>
                <option value="EITHER">Either (Flexible Payment Timing)</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        open={isResetConfirmOpen}
        onOpenChange={setIsResetConfirmOpen}
        title={t("settings.resetDefaults")}
        description={t("settings.resetConfirm")}
        confirmLabel="Reset to Defaults"
        variant="destructive"
        isLoading={saveLoading}
        onConfirm={handleResetToDefaults}
      />
    </div>
  );
};
