import React, { useState, useEffect, useCallback } from "react";
import { Trash2, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";

interface InvItem {
  id: string;
  name: string;
  base_unit: string;
}

interface WasteMovement {
  id: string;
  item_name: string;
  base_unit: string;
  quantity: string;
  reason_code: string;
  value_paise?: number;
  notes: string;
  created_at: string;
}

interface WasteReasonRow {
  reason_code: string;
  total_quantity: string;
  total_value_paise?: number;
}

const REASONS = [
  { value: "SPOILED", label: "Spoiled" },
  { value: "EXPIRED", label: "Expired" },
  { value: "DROPPED", label: "Dropped" },
  { value: "COOKING_ERROR", label: "Cooking Error" },
  { value: "STAFF_MEAL", label: "Staff Meal" },
  { value: "COMPLIMENTARY", label: "Complimentary" },
  { value: "RETURNED_BY_GUEST", label: "Returned by Guest" },
  { value: "UNSOLD", label: "Unsold" },
  { value: "OTHER", label: "Other" },
];

export const WastagePage: React.FC = () => {
  const { can } = useAuth();
  const canSeeCosts = can("inventory.costs");

  const [items, setItems] = useState<InvItem[]>([]);
  const [logs, setLogs] = useState<WasteMovement[]>([]);
  const [byReason, setByReason] = useState<WasteReasonRow[]>([]);
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reasonCode, setReasonCode] = useState("SPOILED");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [itRes, logRes, repRes] = await Promise.all([
        apiClient.get<ListResponse<InvItem>>("/inventory/items/"),
        apiClient.get<ListResponse<WasteMovement>>("/inventory/wastage/"),
        apiClient.get<{ by_reason: WasteReasonRow[] }>("/inventory/reports/wastage/"),
      ]);
      const itList = unwrapList(itRes.data);
      setItems(itList);
      if (itList.length > 0 && !itemId) setItemId(itList[0].id);
      setLogs(unwrapList(logRes.data));
      setByReason(repRes.data?.by_reason || []);
    } catch {
      setError("Failed to load wastage records.");
    }
  }, [itemId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/inventory/wastage/", {
        item: itemId,
        quantity,
        reason_code: reasonCode,
        notes: notes.trim(),
      });
      setNotice("Wastage logged and stock updated.");
      setQuantity("1");
      setNotes("");
      await fetchData();
    } catch {
      setError("Failed to log wastage.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Trash2 className="w-6 h-6 text-[#FF6A00]" />
          <span>Wastage</span>
          <span className="text-xs text-muted-foreground font-normal">வீணாகும் பொருட்கள்</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Record spoiled, expired, dropped, or kitchen wastage to keep stock accurate.
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

      <form
        onSubmit={handleSubmit}
        className="p-5 rounded-xl border border-border bg-card grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Item *</label>
          <select
            required
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          >
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} ({it.base_unit})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Quantity *
          </label>
          <input
            type="number"
            step="0.001"
            min="0.001"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Reason *</label>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            disabled={saving}
            className="w-full bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {saving ? "Saving..." : "Log Wastage"}
          </Button>
        </div>
        <div className="md:col-span-4">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
        </div>
      </form>

      {byReason.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {byReason.map((r) => (
            <div key={r.reason_code} className="p-3 rounded-xl border border-border bg-card">
              <div className="text-xs font-bold text-muted-foreground">{r.reason_code}</div>
              <div className="text-base font-black text-foreground mt-1">{r.total_quantity}</div>
              {canSeeCosts && r.total_value_paise !== undefined && (
                <div className="text-xs text-destructive font-semibold">
                  {formatRupees(r.total_value_paise)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Item</th>
              <th className="p-3">Quantity</th>
              <th className="p-3">Reason</th>
              {canSeeCosts && <th className="p-3 text-right">Value</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={canSeeCosts ? 5 : 4} className="p-6 text-center text-muted-foreground">
                  No wastage recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="p-3 font-semibold">{l.item_name}</td>
                  <td className="p-3 font-mono text-destructive font-bold">
                    {l.quantity} {l.base_unit}
                  </td>
                  <td className="p-3 text-xs">{l.reason_code}</td>
                  {canSeeCosts && (
                    <td className="p-3 text-right font-mono">
                      {l.value_paise !== undefined ? formatRupees(Math.abs(l.value_paise)) : "—"}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
