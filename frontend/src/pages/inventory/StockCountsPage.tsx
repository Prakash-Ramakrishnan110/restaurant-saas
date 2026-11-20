import React, { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";

interface CountLine {
  id: string;
  item: string;
  item_name: string;
  base_unit: string;
  expected_quantity: string | null;
  counted_quantity: string | null;
  variance_quantity: string;
}

interface StockCountRow {
  id: string;
  count_type: string;
  is_blind: boolean;
  status: "DRAFT" | "SUBMITTED" | "APPROVED";
  created_at: string;
  lines: CountLine[];
}

export const StockCountsPage: React.FC = () => {
  const { can } = useAuth();
  const canApprove = can("inventory.approve");

  const [counts, setCounts] = useState<StockCountRow[]>([]);
  const [activeCount, setActiveCount] = useState<StockCountRow | null>(null);
  const [countedMap, setCountedMap] = useState<Record<string, string>>({});
  const [isBlind, setIsBlind] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await apiClient.get<ListResponse<StockCountRow>>("/inventory/counts/");
      const list = unwrapList(res.data);
      setCounts(list);
      if (activeCount) {
        const updated = list.find((c) => c.id === activeCount.id) || null;
        setActiveCount(updated);
      }
    } catch {
      setError("Failed to load stock counts.");
    }
  }, [activeCount]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleStartCount = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.post<StockCountRow>("/inventory/counts/", {
        count_type: "FULL",
        is_blind: isBlind,
      });
      setActiveCount(res.data);
      const initial: Record<string, string> = {};
      res.data.lines.forEach((ln) => {
        initial[ln.item] = ln.expected_quantity ?? "0";
      });
      setCountedMap(initial);
      await fetchCounts();
    } catch {
      setError("Could not start a new stock count.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitCount = async () => {
    if (!activeCount) return;
    setSaving(true);
    setError(null);
    try {
      const lines = activeCount.lines.map((ln) => ({
        item_id: ln.item,
        counted_quantity: countedMap[ln.item] || "0",
      }));
      const res = await apiClient.post<StockCountRow>(
        `/inventory/counts/${activeCount.id}/submit/`,
        { lines }
      );
      setActiveCount(res.data);
      setNotice("Stock count submitted for manager approval.");
      await fetchCounts();
    } catch {
      setError("Failed to submit stock count.");
    } finally {
      setSaving(false);
    }
  };

  const handleApproveCount = async (countId: string) => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/inventory/counts/${countId}/approve/`);
      setNotice("Count approved and stock variances posted.");
      await fetchCounts();
    } catch {
      setError("Failed to approve stock count.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#FF6A00]" />
            <span>Stock Counts</span>
            <span className="text-xs text-muted-foreground font-normal">சரக்கு கணக்கெடுப்பு</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Count physical stock on hand, review variances, and approve adjustments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              checked={isBlind}
              onChange={(e) => setIsBlind(e.target.checked)}
            />
            Blind Count
          </label>
          <Button
            onClick={handleStartCount}
            disabled={saving}
            className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[48px]"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Count
          </Button>
        </div>
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

      {activeCount && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-base text-foreground">
              Active Count ({activeCount.status}) {activeCount.is_blind ? "• Blind" : ""}
            </h2>
            {activeCount.status === "DRAFT" && (
              <Button
                onClick={handleSubmitCount}
                disabled={saving}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[48px]"
              >
                Submit Count
              </Button>
            )}
            {activeCount.status === "SUBMITTED" && canApprove && (
              <Button
                onClick={() => handleApproveCount(activeCount.id)}
                disabled={saving}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[48px]"
              >
                Approve &amp; Post Variance
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {activeCount.lines.map((ln) => (
              <div
                key={ln.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-background"
              >
                <div>
                  <div className="font-bold text-sm text-foreground">{ln.item_name}</div>
                  {ln.expected_quantity !== null && (
                    <div className="text-xs text-muted-foreground">
                      Expected: {ln.expected_quantity} {ln.base_unit}
                    </div>
                  )}
                </div>
                {activeCount.status === "DRAFT" ? (
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={countedMap[ln.item] ?? ""}
                    onChange={(e) =>
                      setCountedMap((prev) => ({ ...prev, [ln.item]: e.target.value }))
                    }
                    className="w-40 px-3 py-2 font-mono font-bold text-base rounded-lg border border-input bg-card min-h-[56px]"
                  />
                ) : (
                  <div className="text-xs font-mono">
                    Counted: <strong>{ln.counted_quantity}</strong> {ln.base_unit} (Variance:{" "}
                    <strong>{ln.variance_quantity}</strong>)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Items</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {counts.map((c) => (
              <tr key={c.id}>
                <td className="p-3 text-xs">{new Date(c.created_at).toLocaleString()}</td>
                <td className="p-3 text-xs">{c.count_type}</td>
                <td className="p-3 font-bold text-xs">{c.status}</td>
                <td className="p-3 text-xs">{c.lines.length}</td>
                <td className="p-3 text-right space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setActiveCount(c);
                      const m: Record<string, string> = {};
                      c.lines.forEach((ln) => {
                        m[ln.item] = ln.counted_quantity ?? ln.expected_quantity ?? "0";
                      });
                      setCountedMap(m);
                    }}
                  >
                    Open
                  </Button>
                  {c.status === "SUBMITTED" && canApprove && (
                    <Button
                      size="sm"
                      onClick={() => handleApproveCount(c.id)}
                      className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold"
                    >
                      Approve
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
