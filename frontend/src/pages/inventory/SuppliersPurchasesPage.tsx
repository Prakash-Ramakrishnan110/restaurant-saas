import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sparkles,
  PackageCheck,
  Send,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees, parseRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";

interface SupplierRow {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
}

interface InventoryItemRow {
  id: string;
  name: string;
  base_unit: string;
}

interface PurchaseOrderRow {
  id: string;
  order_number: string;
  supplier: string | null;
  supplier_name: string;
  status: "DRAFT" | "SENT" | "PARTIAL" | "RECEIVED" | "CANCELLED";
  total_cost_paise: number;
  notes: string;
  created_at: string;
  lines: Array<{
    id: string;
    item: string;
    item_name: string;
    quantity_ordered: string;
    quantity_received: string;
    unit_name: string;
    unit_cost_paise: number;
    line_total_paise: number;
  }>;
}

interface PriceJumpAlert {
  item_id: string;
  item_name: string;
  previous_wac_paise: number;
  received_unit_cost_paise: number;
  jump_percent: string;
}

export const SuppliersPurchasesPage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can("inventory.manage");

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [priceJumpAlerts, setPriceJumpAlerts] = useState<PriceJumpAlert[]>([]);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Stage D2: Purchase Order form state
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poItemId, setPoItemId] = useState("");
  const [poQuantity, setPoQuantity] = useState("10");
  const [poUnitCostRupees, setPoUnitCostRupees] = useState("120");
  const [poNotes, setPoNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [supRes, itemRes, poRes] = await Promise.all([
        apiClient.get<ListResponse<SupplierRow>>("/inventory/suppliers/"),
        apiClient
          .get<ListResponse<InventoryItemRow>>("/inventory/items/")
          .catch(() => ({ data: [] })),
        apiClient
          .get<ListResponse<PurchaseOrderRow>>("/inventory/purchase-orders/")
          .catch(() => ({ data: [] })),
      ]);
      const supList = unwrapList<SupplierRow>(supRes.data);
      const itemList = unwrapList<InventoryItemRow>(itemRes.data);
      const poList = unwrapList<PurchaseOrderRow>(poRes.data);

      setSuppliers(supList);
      setItems(itemList);
      setPurchaseOrders(poList);

      if (supList.length > 0) {
        setPoSupplierId((prev) => prev || supList[0].id);
      }
      if (itemList.length > 0) {
        setPoItemId((prev) => prev || itemList[0].id);
      }
    } catch {
      setError("Failed to load suppliers.");
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/inventory/suppliers/", {
        name: name.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      setName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
      setNotice("Supplier added.");
      await fetchAll();
    } catch {
      setError("Could not add supplier.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poItemId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const unitCostPaise = parseRupees(poUnitCostRupees) || 0;
      await apiClient.post("/inventory/purchase-orders/", {
        supplier: poSupplierId || null,
        notes: poNotes.trim(),
        lines: [
          {
            item: poItemId,
            quantity_ordered: poQuantity,
            unit_cost_paise: unitCostPaise,
          },
        ],
      });
      setNotice("Purchase Order created in DRAFT status.");
      setPoNotes("");
      await fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not create Purchase Order.");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoDraftLowStockPO = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post<PurchaseOrderRow>(
        "/inventory/purchase-orders/auto-draft-low-stock/",
        {
          supplier: poSupplierId || null,
        }
      );
      setNotice(`Auto-drafted Purchase Order ${res.data.order_number} from low-stock items.`);
      await fetchAll();
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ||
          "No items are currently below reorder level to auto-draft."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSendPO = async (poId: string) => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/inventory/purchase-orders/${poId}/send/`);
      setNotice("Purchase Order marked as SENT to supplier.");
      await fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Could not send Purchase Order.");
    } finally {
      setSaving(false);
    }
  };

  const handleReceivePO = async (poId: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await apiClient.post<{
        purchase_order: PurchaseOrderRow;
        price_jump_alerts: PriceJumpAlert[];
      }>(`/inventory/purchase-orders/${poId}/receive/`, {});
      setPriceJumpAlerts(res.data.price_jump_alerts || []);
      setNotice(
        `Converted ${res.data.purchase_order.order_number} to Goods Receipt & updated stock levels.`
      );
      await fetchAll();
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message || "Could not convert Purchase Order to Goods Receipt."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#FF6A00]" />
          <span>Suppliers &amp; Orders</span>
          <span className="text-xs text-muted-foreground font-normal">சப்ளையர்கள்</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your regular vendors, formal Purchase Orders, and one-click Goods Receipt
          conversions (Stage D2).
        </p>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {priceJumpAlerts.length > 0 && (
        <div
          data-testid="price-jump-alert-banner"
          className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1"
        >
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Supplier Price Jump Alert (&gt;15% Increase Detected)
          </div>
          {priceJumpAlerts.map((a) => (
            <div key={a.item_id}>
              • <strong>{a.item_name}</strong> jumped by <strong>+{a.jump_percent}%</strong> (from{" "}
              {formatRupees(a.previous_wac_paise)} to {formatRupees(a.received_unit_cost_paise)})
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <form
          onSubmit={handleAddSupplier}
          className="p-5 rounded-xl border border-border bg-card grid grid-cols-1 md:grid-cols-5 gap-3"
        >
          <input
            required
            placeholder="Supplier Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
          <input
            placeholder="Contact Person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
          <input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Supplier
          </Button>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Supplier</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td className="p-3 font-bold">{s.name}</td>
                <td className="p-3 text-xs">{s.contact_person || "—"}</td>
                <td className="p-3 text-xs font-mono">{s.phone || "—"}</td>
                <td className="p-3 text-xs">{s.email || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stage D2: Purchase Orders & One-Click Convert to Goods Receipt */}
      <div className="p-5 rounded-xl border border-border bg-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FF6A00]" />
              Purchase Orders &amp; One-Click Goods Receipt
            </h2>
            <p className="text-xs text-muted-foreground">
              Draft supplier purchase orders manually or from low-stock alerts, then convert to an
              inward Goods Receipt in one click.
            </p>
          </div>
          {canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="auto-draft-po-btn"
              disabled={saving}
              onClick={() => void handleAutoDraftLowStockPO()}
              className="text-xs font-bold border-[#FF6A00] text-foreground gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FF6A00]" />
              Auto-Draft PO from Low Stock
            </Button>
          )}
        </div>

        {canManage && (
          <form
            onSubmit={handleCreatePO}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs pt-1"
          >
            <div>
              <label
                htmlFor="po-supplier"
                className="font-semibold text-muted-foreground block mb-1"
              >
                Supplier
              </label>
              <select
                id="po-supplier"
                aria-label="Purchase Order Supplier"
                value={poSupplierId}
                onChange={(e) => setPoSupplierId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-input bg-background min-h-[38px]"
              >
                <option value="">Any Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="po-item" className="font-semibold text-muted-foreground block mb-1">
                Inventory Item
              </label>
              <select
                id="po-item"
                aria-label="Purchase Order Item"
                value={poItemId}
                onChange={(e) => setPoItemId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-input bg-background min-h-[38px]"
              >
                <option value="">Select item...</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.base_unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="po-qty" className="font-semibold text-muted-foreground block mb-1">
                Quantity Ordered
              </label>
              <input
                id="po-qty"
                aria-label="Quantity Ordered"
                type="number"
                min="0.001"
                step="any"
                value={poQuantity}
                onChange={(e) => setPoQuantity(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-input bg-background min-h-[38px]"
              />
            </div>

            <div>
              <label htmlFor="po-cost" className="font-semibold text-muted-foreground block mb-1">
                Unit Cost (₹)
              </label>
              <input
                id="po-cost"
                aria-label="Unit Cost Rupees"
                type="number"
                min="0"
                step="0.01"
                value={poUnitCostRupees}
                onChange={(e) => setPoUnitCostRupees(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-input bg-background min-h-[38px]"
              />
            </div>

            <div>
              <label htmlFor="po-notes" className="font-semibold text-muted-foreground block mb-1">
                Notes
              </label>
              <input
                id="po-notes"
                aria-label="PO Notes"
                type="text"
                placeholder="Morning delivery"
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg border border-input bg-background min-h-[38px]"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                data-testid="create-po-btn"
                disabled={saving || !poItemId}
                className="w-full min-h-[38px] bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create PO
              </Button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border uppercase text-muted-foreground">
              <tr>
                <th className="p-2.5">PO Number</th>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5">Items (Ordered / Received)</th>
                <th className="p-2.5 text-right">Total Cost</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No purchase orders created yet.
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="p-2.5 font-mono font-bold text-foreground">{po.order_number}</td>
                    <td className="p-2.5 font-semibold">{po.supplier_name || "Direct Vendor"}</td>
                    <td className="p-2.5 font-mono">
                      {(po.lines || [])
                        .map(
                          (l) =>
                            `${l.item_name}: ${l.quantity_received}/${l.quantity_ordered} ${l.unit_name}`
                        )
                        .join(", ")}
                    </td>
                    <td className="p-2.5 font-mono font-bold text-right">
                      {formatRupees(po.total_cost_paise)}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          po.status === "RECEIVED"
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                            : po.status === "PARTIAL" || po.status === "SENT"
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className="p-2.5 text-right space-x-2">
                      {po.status === "DRAFT" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          data-testid="send-po-btn"
                          disabled={saving}
                          onClick={() => void handleSendPO(po.id)}
                          className="h-7 text-[11px] font-semibold"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Mark Sent
                        </Button>
                      )}
                      {po.status !== "RECEIVED" && po.status !== "CANCELLED" && (
                        <Button
                          type="button"
                          size="sm"
                          data-testid="receive-po-btn"
                          disabled={saving}
                          onClick={() => void handleReceivePO(po.id)}
                          className="h-7 text-[11px] bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold"
                        >
                          <PackageCheck className="w-3.5 h-3.5 mr-1" />
                          Convert to Goods Receipt
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
