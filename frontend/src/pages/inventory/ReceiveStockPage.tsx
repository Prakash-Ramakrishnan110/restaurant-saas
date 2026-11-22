import React, { useState, useEffect, useCallback } from "react";
import { Truck, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees, parseRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";

interface InvItem {
  id: string;
  name: string;
  base_unit: string;
}

interface SupplierRow {
  id: string;
  name: string;
}

interface ReceiptRow {
  id: string;
  supplier_name: string;
  supplier_invoice_number: string;
  total_paid_paise?: number;
  received_at: string;
  lines: Array<{ id: string; item_name: string; quantity: string; unit_name: string }>;
}

export const ReceiveStockPage: React.FC = () => {
  const { can } = useAuth();
  const canSeeCosts = can("inventory.costs");

  const [items, setItems] = useState<InvItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitName, setUnitName] = useState("kg");
  const [costRupees, setCostRupees] = useState("0");
  const [expiryDate, setExpiryDate] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [itRes, supRes, recRes] = await Promise.all([
        apiClient.get<ListResponse<InvItem>>("/inventory/items/"),
        apiClient.get<ListResponse<SupplierRow>>("/inventory/suppliers/"),
        apiClient.get<ListResponse<ReceiptRow>>("/inventory/receipts/"),
      ]);
      const itList = unwrapList(itRes.data);
      setItems(itList);
      if (itList.length > 0 && !selectedItemId) {
        setSelectedItemId(itList[0].id);
        setUnitName(itList[0].base_unit);
      }
      setSuppliers(unwrapList(supRes.data));
      setReceipts(unwrapList(recRes.data));
    } catch {
      setError("Failed to load receiving data.");
    }
  }, [selectedItemId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const submitReceipt = async (confirmDuplicate: boolean) => {
    if (!selectedItemId) return;
    setSaving(true);
    setError(null);
    setDuplicateWarning(false);
    try {
      await apiClient.post("/inventory/receipts/", {
        supplier: supplierId || null,
        supplier_invoice_number: invoiceNo.trim(),
        confirm_duplicate: confirmDuplicate,
        lines: [
          {
            item: selectedItemId,
            quantity,
            unit_name: unitName,
            unit_cost_paise: parseRupees(costRupees || "0"),
            expiry_date: expiryDate || null,
          },
        ],
      });
      setNotice("Stock received and average cost updated.");
      setInvoiceNo("");
      setQuantity("1");
      await fetchData();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setDuplicateWarning(true);
      } else {
        setError("Could not record stock receipt.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Truck className="w-6 h-6 text-[#FF6A00]" />
          <span>Receive Stock</span>
          <span className="text-xs text-muted-foreground font-normal">சரக்கு வரவு</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Record incoming supplier deliveries to update stock levels and weighted average cost.
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
      {duplicateWarning && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 text-sm space-y-2">
          <div className="font-bold text-amber-900 dark:text-amber-200">
            This invoice number from this supplier was already received. Receive again?
          </div>
          <Button
            onClick={() => submitReceipt(true)}
            className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[44px]"
          >
            Confirm Duplicate Receipt
          </Button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitReceipt(false);
        }}
        className="p-5 rounded-xl border border-border bg-card grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Supplier (optional)
          </label>
          <select
            aria-label="Supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          >
            <option value="">Direct / Cash Purchase</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Supplier Bill / Reference #
          </label>
          <input
            aria-label="Supplier bill or reference number"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="e.g. SUP-2026-01"
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Item *</label>
          <select
            aria-label="Stock item"
            required
            value={selectedItemId}
            onChange={(e) => {
              setSelectedItemId(e.target.value);
              const found = items.find((i) => i.id === e.target.value);
              if (found) setUnitName(found.base_unit);
            }}
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
            aria-label="Quantity received"
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
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Unit *</label>
          <input
            aria-label="Measurement unit"
            required
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            placeholder="g, kg, ml, l, piece"
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Unit Cost (₹)
          </label>
          <input
            aria-label="Unit cost in rupees"
            type="number"
            step="0.01"
            min="0"
            value={costRupees}
            onChange={(e) => setCostRupees(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">
            Expiry Date (optional)
          </label>
          <input
            aria-label="Expiry date"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
        </div>
        <div className="md:col-span-2 flex items-end justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[48px] px-6"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {saving ? "Receiving..." : "Receive Stock"}
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Supplier</th>
              <th className="p-3">Reference #</th>
              <th className="p-3">Items</th>
              {canSeeCosts && <th className="p-3 text-right">Total Paid</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={canSeeCosts ? 5 : 4} className="p-6 text-center text-muted-foreground">
                  No stock receipts recorded yet.
                </td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 text-xs text-muted-foreground">
                    {new Date(r.received_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 font-semibold">{r.supplier_name || "Direct Purchase"}</td>
                  <td className="p-3 font-mono text-xs">{r.supplier_invoice_number || "—"}</td>
                  <td className="p-3 text-xs">
                    {r.lines.map((l) => `${l.item_name} (${l.quantity} ${l.unit_name})`).join(", ")}
                  </td>
                  {canSeeCosts && (
                    <td className="p-3 text-right font-mono font-bold">
                      {r.total_paid_paise !== undefined ? formatRupees(r.total_paid_paise) : "—"}
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
