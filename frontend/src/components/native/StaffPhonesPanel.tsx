import React, { useCallback, useEffect, useState } from "react";
import { LogOut, RefreshCw, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiClient } from "../../api/client";
import { Button } from "../ui/button";

interface StaffPhoneRow {
  id: string;
  user_id: string;
  user_email: string;
  user_full_name: string;
  short_device_id: string;
  platform: string;
  device_name: string;
  app_version: string;
  push_enabled: boolean;
  last_seen_at: string | null;
}

export const StaffPhonesPanel: React.FC = () => {
  const { i18n } = useTranslation();
  const isTa = i18n.language === "ta";
  const [devices, setDevices] = useState<StaffPhoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<StaffPhoneRow[]>("/devices/");
      setDevices(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await apiClient.post(`/devices/${id}/revoke/`, {
        reason: "Signed out by manager",
      });
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <section
      className="rounded-xl border border-border bg-card p-5 space-y-4"
      data-testid="staff-phones-panel"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-[#FF6A00]" />
          <div>
            <h2 className="text-base font-bold text-foreground">
              {isTa ? "ஊழியர் தொலைபேசிகள்" : "Staff Phones"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isTa
                ? "உள்நுழைந்த Android பணியாளர் தொலைபேசிகளை நிர்வகிக்கவும்."
                : "Active Android staff phones signed into this branch."}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={() => void loadDevices()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          {isTa ? "புதுப்பி" : "Refresh"}
        </Button>
      </div>

      {devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isTa
            ? "செயலில் உள்ள ஊழியர் தொலைபேசிகள் இல்லை."
            : "No active staff phones registered yet."}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {devices.map((dev) => (
            <div
              key={dev.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3"
            >
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-foreground">
                  {dev.user_full_name || dev.user_email}
                </div>
                <div className="text-xs text-muted-foreground">
                  {dev.device_name || "Android"} · v{dev.app_version || "1.0"} · ID{" "}
                  <span className="font-mono">{dev.short_device_id}</span>
                  {dev.last_seen_at ? ` · ${new Date(dev.last_seen_at).toLocaleString()}` : ""}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] text-rose-600 border-rose-200 hover:bg-rose-50"
                disabled={revokingId === dev.id}
                onClick={() => void handleRevoke(dev.id)}
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                {isTa ? "தொலைபேசியை வெளியேற்று" : "Sign out this phone"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
