import React, { useState, useEffect } from "react";
import { Settings2, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/button";

interface InvSettings {
  mode: "SIMPLE" | "STANDARD" | "ADVANCED";
  auto_sold_out: boolean;
  adjustment_approval_threshold_paise?: number;
  target_margin_percent: string;
  price_jump_alert_percent: string;
  expiry_alert_days: number;
}

export const InventorySettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<InvSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<InvSettings>("/inventory/settings/")
      .then((res) => setSettings(res.data))
      .catch(() => setError("Failed to load inventory settings."));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.patch<InvSettings>("/inventory/settings/", settings);
      setSettings(res.data);
      setNotice("Inventory settings saved.");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Failed to save settings.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <div className="p-6 text-sm text-muted-foreground">Loading inventory settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-[#FF6A00]" />
          <span>Inventory Settings</span>
          <span className="text-xs text-muted-foreground font-normal">சரக்கு அமைப்புகள்</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Choose the tracking level, automatic sold-out behavior, and alert thresholds for this
          branch.
        </p>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="p-5 rounded-xl border border-border bg-card space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Branch Tracking Mode
          </label>
          <select
            value={settings.mode}
            onChange={(e) =>
              setSettings({ ...settings, mode: e.target.value as InvSettings["mode"] })
            }
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          >
            <option value="SIMPLE">Simple (Stock, Receive, Wastage, Counts, Reports)</option>
            <option value="STANDARD">Standard (+ Recipes, Auto-Deduction, Costs, Suppliers)</option>
            <option value="ADVANCED">Advanced (+ Multiple Locations, Expiry Batches)</option>
          </select>
        </div>

        <label className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background cursor-pointer">
          <input
            type="checkbox"
            checked={settings.auto_sold_out}
            onChange={(e) => setSettings({ ...settings, auto_sold_out: e.target.checked })}
          />
          <div>
            <div className="text-sm font-bold text-foreground">
              Auto-mark dish sold out when an ingredient hits zero
            </div>
            <div className="text-xs text-muted-foreground">
              Off by default. Every automatic sold-out change is recorded in the activity log.
            </div>
          </div>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Target Margin (%)
            </label>
            <input
              type="number"
              step="0.5"
              value={settings.target_margin_percent}
              onChange={(e) => setSettings({ ...settings, target_margin_percent: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Expiry Alert Window (Days)
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={settings.expiry_alert_days}
              onChange={(e) =>
                setSettings({ ...settings, expiry_alert_days: Number(e.target.value) || 7 })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[48px] px-6"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
};
