import React, { useState, useEffect, useCallback } from "react";
import {
  Boxes,
  Search,
  Plus,
  Minus,
  AlertTriangle,
  RefreshCw,
  ClipboardPaste,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";

export interface InventoryItemRow {
  id: string;
  name: string;
  name_ta?: string;
  item_type: string;
  base_unit: string;
  category: string;
  is_active: boolean;
  reorder_level: string;
  par_level: string;
  current_quantity: string;
  weighted_avg_cost_paise?: number;
  stock_value_paise?: number;
  is_low_stock: boolean;
  is_negative_stock: boolean;
}

interface FailedDeduction {
  deduction_id: string;
  order_number: string;
  item_name: string;
  error_message: string;
  attempts: number;
}

interface PastePreview {
  valid_count: number;
  error_count: number;
  rows: Array<{
    row: number;
    name: string;
    quantity: string;
    unit: string;
    unit_cost_paise: number;
    exists: boolean;
  }>;
  errors: Array<{ row: number; message: string }>;
}

const CATEGORIES = [
  { value: "ALL", label: "All Categories" },
  { value: "PRODUCE", label: "Produce & Vegetables" },
  { value: "DAIRY", label: "Dairy & Milk" },
  { value: "MEAT_POULTRY", label: "Meat & Poultry" },
  { value: "SPICES_MASALA", label: "Spices & Masala" },
  { value: "GRAINS_FLOUR", label: "Grains, Rice & Flour" },
  { value: "OIL_GHEE", label: "Oil & Ghee" },
  { value: "BEVERAGES", label: "Tea, Coffee & Beverages" },
  { value: "BAKERY", label: "Bakery & Sweets" },
  { value: "PREPARED", label: "Prepared Bases" },
  { value: "PACKAGING", label: "Packaging & Cups" },
  { value: "CLEANING", label: "Cleaning & Supplies" },
  { value: "OTHER", label: "Other" },
];

export const StockOverviewPage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can("inventory.manage");
  const canCount = can("inventory.count");
  const canApprove = can("inventory.approve");
  const canSeeCosts = can("inventory.costs");

  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [failedDeductions, setFailedDeductions] = useState<FailedDeduction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Quick update keypad modal
  const [quickItem, setQuickItem] = useState<InventoryItemRow | null>(null);
  const [quickSign, setQuickSign] = useState<1 | -1>(1);
  const [quickAmount, setQuickAmount] = useState("1");
  const [quickReason, setQuickReason] = useState("CORRECTION");
  const [quickSaving, setQuickSaving] = useState(false);

  // Add item modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNameTa, setNewNameTa] = useState("");
  const [newType, setNewType] = useState("INGREDIENT");
  const [newBaseUnit, setNewBaseUnit] = useState("g");
  const [newCategory, setNewCategory] = useState("OTHER");
  const [newReorder, setNewReorder] = useState("0");
  const [newPar, setNewPar] = useState("0");
  const [isCreating, setIsCreating] = useState(false);

  // Paste modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pastePreview, setPastePreview] = useState<PastePreview | null>(null);
  const [pasteLoading, setPasteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (selectedCategory !== "ALL") params.category = selectedCategory;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const [itemsRes, healthRes] = await Promise.all([
        apiClient.get<ListResponse<InventoryItemRow>>("/inventory/items/", { params }),
        apiClient
          .get<{ failed_deductions?: FailedDeduction[] }>("/inventory/health/")
          .catch(() => ({ data: { failed_deductions: [] } })),
      ]);
      setItems(unwrapList(itemsRes.data));
      setFailedDeductions(healthRes.data?.failed_deductions || []);
    } catch {
      setError("Failed to load stock items.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleQuickConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickItem) return;
    const val = Number(quickAmount);
    if (!Number.isFinite(val) || val <= 0) {
      setError("Enter a valid positive number.");
      return;
    }
    setQuickSaving(true);
    setError(null);
    try {
      await apiClient.post(`/inventory/items/${quickItem.id}/quick-update/`, {
        delta_quantity: String(quickSign * val),
        unit_name: quickItem.base_unit,
        reason_code: quickReason,
      });
      setNotice(`Updated stock for ${quickItem.name}.`);
      setQuickItem(null);
      await fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Could not update stock.";
      setError(msg);
    } finally {
      setQuickSaving(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      await apiClient.post("/inventory/items/", {
        name: newName.trim(),
        name_ta: newNameTa.trim(),
        item_type: newType,
        base_unit: newBaseUnit,
        category: newCategory,
        reorder_level: newReorder || "0",
        par_level: newPar || "0",
      });
      setShowAddModal(false);
      setNewName("");
      setNewNameTa("");
      setNotice("Item added to stock list.");
      await fetchData();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message || "Failed to add stock item.";
      setError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePastePreview = async () => {
    if (!pasteText.trim()) return;
    setPasteLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<PastePreview>("/inventory/items/paste-preview/", {
        raw_text: pasteText,
      });
      setPastePreview(res.data);
    } catch {
      setError("Failed to preview pasted rows.");
    } finally {
      setPasteLoading(false);
    }
  };

  const handlePasteApply = async () => {
    setPasteLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<{ created_items: number; movements_posted: number }>(
        "/inventory/items/paste-apply/",
        { raw_text: pasteText }
      );
      setShowPasteModal(false);
      setPasteText("");
      setPastePreview(null);
      setNotice(
        `Imported ${res.data.movements_posted} stock rows (${res.data.created_items} new items).`
      );
      await fetchData();
    } catch {
      setError("Fix all row errors before importing.");
    } finally {
      setPasteLoading(false);
    }
  };

  const handleRetryDeduction = async (deductionId: string) => {
    try {
      await apiClient.post("/inventory/health/", { deduction_id: deductionId });
      setNotice("Deduction retried successfully.");
      await fetchData();
    } catch {
      setError("Retry failed. Check recipe ingredients.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#FF6A00]" />
            <span>Stock</span>
            <span className="text-xs text-muted-foreground font-normal">சரக்கு இருப்பு</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Track ingredients, prepared bases, finished items, and packaging in real time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={fetchData} className="min-h-[44px]">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canManage && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setPastePreview(null);
                  setShowPasteModal(true);
                }}
                className="min-h-[44px]"
              >
                <ClipboardPaste className="w-4 h-4 mr-1.5" />
                Paste Spreadsheet
              </Button>
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[44px]"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Item
              </Button>
            </>
          )}
        </div>
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

      {/* Stock Health: Failed Deductions */}
      {failedDeductions.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 dark:bg-amber-950/30 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-900 dark:text-amber-200">
            <Activity className="w-4 h-4" />
            <span>Stock Health: {failedDeductions.length} failed deduction(s)</span>
          </div>
          <div className="space-y-1.5">
            {failedDeductions.map((fd) => (
              <div
                key={fd.deduction_id}
                className="flex items-center justify-between gap-2 text-xs bg-card p-2.5 rounded-lg border border-border"
              >
                <div>
                  <span className="font-bold text-foreground">{fd.order_number}</span> —{" "}
                  <span>{fd.item_name}</span>
                  <div className="text-muted-foreground">{fd.error_message}</div>
                </div>
                {canApprove && (
                  <Button
                    size="sm"
                    onClick={() => handleRetryDeduction(fd.deduction_id)}
                    className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[36px]"
                  >
                    Retry
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-input bg-card min-h-[44px]"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          aria-label="Filter by category"
          className="px-3 py-2 text-sm rounded-lg border border-input bg-card min-h-[44px]"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Stock List */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Item</th>
              <th className="p-3">Type</th>
              <th className="p-3">On Hand</th>
              <th className="p-3">Reorder</th>
              {canSeeCosts && <th className="p-3">Avg Cost</th>}
              {canSeeCosts && <th className="p-3">Value</th>}
              <th className="p-3">Status</th>
              {canCount && <th className="p-3 text-right">Quick Update</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={canSeeCosts ? 8 : 6}
                  className="p-8 text-center text-muted-foreground text-sm"
                >
                  {isLoading
                    ? "Loading stock..."
                    : "No stock items yet. Add your first item above."}
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="hover:bg-muted/10">
                  <td className="p-3">
                    <div className="font-bold text-foreground">{it.name}</div>
                    {it.name_ta && (
                      <div className="text-xs text-muted-foreground">{it.name_ta}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{it.item_type}</td>
                  <td
                    className={`p-3 font-mono font-bold ${
                      it.is_negative_stock ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {it.current_quantity} {it.base_unit}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {it.reorder_level} {it.base_unit}
                  </td>
                  {canSeeCosts && (
                    <td className="p-3 font-mono text-xs">
                      {it.weighted_avg_cost_paise !== undefined
                        ? formatRupees(it.weighted_avg_cost_paise)
                        : "—"}
                    </td>
                  )}
                  {canSeeCosts && (
                    <td className="p-3 font-mono font-semibold text-xs">
                      {it.stock_value_paise !== undefined
                        ? formatRupees(it.stock_value_paise)
                        : "—"}
                    </td>
                  )}
                  <td className="p-3">
                    {it.is_negative_stock ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-destructive/15 text-destructive">
                        Negative
                      </span>
                    ) : it.is_low_stock ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                        Low Stock
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                        In Stock
                      </span>
                    )}
                  </td>
                  {canCount && (
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setQuickItem(it);
                          setQuickSign(1);
                          setQuickAmount("1");
                          setQuickReason("CORRECTION");
                        }}
                        className="min-h-[40px]"
                      >
                        Update
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Update Keypad Modal */}
      {quickItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleQuickConfirm}
            className="bg-card border border-border rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl"
          >
            <h2 className="text-lg font-bold text-foreground">
              Quick Update: {quickItem.name} ({quickItem.base_unit})
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQuickSign(1)}
                className={`min-h-[56px] rounded-xl font-bold flex items-center justify-center gap-2 border ${
                  quickSign === 1
                    ? "bg-[#FF6A00] text-[#0B1F3B] border-transparent"
                    : "bg-muted text-foreground border-border"
                }`}
              >
                <Plus className="w-5 h-5" /> Add
              </button>
              <button
                type="button"
                onClick={() => setQuickSign(-1)}
                className={`min-h-[56px] rounded-xl font-bold flex items-center justify-center gap-2 border ${
                  quickSign === -1
                    ? "bg-destructive text-white border-transparent"
                    : "bg-muted text-foreground border-border"
                }`}
              >
                <Minus className="w-5 h-5" /> Remove
              </button>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Quantity ({quickItem.base_unit})
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                className="w-full px-3 py-3 text-lg font-mono font-bold rounded-xl border border-input bg-background min-h-[56px]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Reason
              </label>
              <select
                value={quickReason}
                onChange={(e) => setQuickReason(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-input bg-background min-h-[48px]"
              >
                <option value="CORRECTION">Stock Correction</option>
                <option value="OPENING">Opening Count</option>
                <option value="PURCHASE_QUICK">Cash Purchase</option>
                <option value="SPILL">Spill / Loss</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickItem(null)}
                className="min-h-[48px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={quickSaving}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[48px] px-6"
              >
                {quickSaving ? "Saving..." : "Confirm"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateItem}
            className="bg-card border border-border rounded-2xl max-w-md w-full p-5 space-y-3 shadow-xl"
          >
            <h2 className="text-lg font-bold text-foreground">Add Stock Item</h2>
            <input
              required
              placeholder="Item Name (English)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
            />
            <input
              placeholder="Item Name (Tamil / தமிழ்)"
              value={newNameTa}
              onChange={(e) => setNewNameTa(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
              >
                <option value="INGREDIENT">Ingredient</option>
                <option value="PREPARED">Prepared Base</option>
                <option value="FINISHED">Finished</option>
                <option value="PACKAGING">Packaging</option>
                <option value="SUPPLY">Supply</option>
              </select>
              <select
                value={newBaseUnit}
                onChange={(e) => setNewBaseUnit(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
              >
                <option value="g">Grams (g)</option>
                <option value="ml">Milliliters (ml)</option>
                <option value="piece">Piece</option>
              </select>
            </div>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
            >
              {CATEGORIES.filter((c) => c.value !== "ALL").map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="Reorder Level"
                value={newReorder}
                onChange={(e) => setNewReorder(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
              />
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="Par Level"
                value={newPar}
                onChange={(e) => setNewPar(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddModal(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[44px]"
              >
                {isCreating ? "Adding..." : "Save Item"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Spreadsheet Paste Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-foreground">Paste Opening Stock</h2>
            <p className="text-xs text-muted-foreground">
              Paste rows from Excel or Google Sheets: <code>name, quantity, unit, cost_rupees</code>
            </p>
            <textarea
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Assam Tea Dust, 5, kg, 450\nFarm Fresh Milk, 20, l, 60"}
              className="w-full p-3 text-xs font-mono rounded-lg border border-input bg-background"
            />
            {pastePreview && (
              <div className="text-xs space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                <div className="font-bold">
                  Valid rows: {pastePreview.valid_count} | Errors: {pastePreview.error_count}
                </div>
                {pastePreview.errors.map((e) => (
                  <div key={e.row} className="text-destructive">
                    Row {e.row}: {e.message}
                  </div>
                ))}
                {pastePreview.rows.map((r) => (
                  <div key={r.row} className="flex justify-between text-foreground">
                    <span>
                      Row {r.row}: {r.name}
                    </span>
                    <span className="font-mono">
                      {r.quantity} {r.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPasteModal(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handlePastePreview}
                disabled={pasteLoading}
                className="min-h-[44px]"
              >
                Preview
              </Button>
              <Button
                onClick={handlePasteApply}
                disabled={
                  pasteLoading ||
                  !pastePreview ||
                  pastePreview.error_count > 0 ||
                  pastePreview.valid_count === 0
                }
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[44px]"
              >
                Confirm Import
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
