import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Boxes,
  Search,
  Plus,
  AlertTriangle,
  RefreshCw,
  Edit3,
  CheckCircle2,
  Package,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees, parseRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";

export interface IngredientItem {
  id: string;
  name: string;
  name_ta?: string;
  sku?: string;
  category: string;
  unit: string;
  cost_paise: number;
  current_stock: string;
  min_threshold: string;
  is_active: boolean;
  is_low_stock: boolean;
  stock_value_paise: number;
}

const CATEGORIES = [
  { value: "ALL", label: "All Categories" },
  { value: "DRY_GOODS", label: "Dry Goods & Grains" },
  { value: "DAIRY", label: "Dairy & Eggs" },
  { value: "MEAT", label: "Meat & Seafood" },
  { value: "VEGETABLE", label: "Vegetables & Produce" },
  { value: "BEVERAGE", label: "Beverages & Liquids" },
  { value: "SPICE_CONDIMENT", label: "Spices & Condiments" },
  { value: "PACKAGING", label: "Packaging & Disposables" },
  { value: "OTHER", label: "Other" },
];

const UNITS = ["KG", "GRAM", "LITER", "ML", "PIECE", "PACKET"];

export const StockOverviewPage: React.FC = () => {
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // Adjust stock modal
  const [adjustItem, setAdjustItem] = useState<IngredientItem | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  // New ingredient modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNameTa, setNewNameTa] = useState("");
  const [newCategory, setNewCategory] = useState("DRY_GOODS");
  const [newUnit, setNewUnit] = useState("KG");
  const [newCostRupees, setNewCostRupees] = useState("");
  const [newStock, setNewStock] = useState("");
  const [newMinThreshold, setNewMinThreshold] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchIngredients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = selectedCategory !== "ALL" ? { category: selectedCategory } : {};
      const res = await apiClient.get<ListResponse<IngredientItem>>(
        "/api/v1/inventory/ingredients/",
        {
          params,
        }
      );
      setIngredients(unwrapList(res.data));
    } catch {
      setError("Failed to load inventory stock levels.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  const filteredItems = useMemo(() => {
    return ingredients.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.name_ta && item.name_ta.includes(searchQuery)) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSearch;
    });
  }, [ingredients, searchQuery]);

  const metrics = useMemo(() => {
    const totalValuation = ingredients.reduce(
      (sum, item) => sum + (item.stock_value_paise || 0),
      0
    );
    const lowStockCount = ingredients.filter((item) => item.is_low_stock).length;
    return {
      totalItems: ingredients.length,
      totalValuation,
      lowStockCount,
    };
  }, [ingredients]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    setIsAdjusting(true);
    try {
      await apiClient.post(`/api/v1/inventory/ingredients/${adjustItem.id}/adjust-stock/`, {
        new_stock: adjustQty,
        notes: adjustNotes || "Manual Cycle Count",
      });
      setAdjustItem(null);
      setAdjustQty("");
      setAdjustNotes("");
      await fetchIngredients();
    } catch {
      setError("Failed to update stock quantity.");
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const costPaise = parseRupees(newCostRupees);
      await apiClient.post("/api/v1/inventory/ingredients/", {
        name: newName,
        name_ta: newNameTa,
        category: newCategory,
        unit: newUnit,
        cost_paise: costPaise,
        current_stock: newStock || "0.000",
        min_threshold: newMinThreshold || "0.000",
      });
      setShowAddModal(false);
      setNewName("");
      setNewNameTa("");
      setNewCostRupees("");
      setNewStock("");
      setNewMinThreshold("");
      await fetchIngredients();
    } catch {
      setError("Failed to create new ingredient.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Boxes className="w-7 h-7 text-emerald-600" />
            Inventory Stock Overview
            <span className="text-sm font-normal text-gray-500 font-tamil">(சரக்கு இருப்பு)</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time raw material balances, unit valuation, and automated low-stock reorder
            thresholds
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIngredients}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Add Ingredient
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Total Stock Value</span>
            <Package className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {formatRupees(metrics.totalValuation)}
          </div>
          <span className="text-xs text-gray-500 mt-1 block">
            Live physical asset holding in integer paise
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Active Raw Materials
            </span>
            <Boxes className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{metrics.totalItems} Items</div>
          <span className="text-xs text-gray-500 mt-1 block">
            Managed across all kitchen stations
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Low Stock Deficits
            </span>
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            {metrics.lowStockCount} {metrics.lowStockCount === 1 ? "Alert" : "Alerts"}
          </div>
          <span className="text-xs text-gray-500 mt-1 block">At or below reorder threshold</span>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search ingredients by name, Tamil name, or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stock Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Ingredient</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Current Stock</th>
                <th className="px-4 py-3 text-right">Min Alert</th>
                <th className="px-4 py-3 text-right">Unit Cost</th>
                <th className="px-4 py-3 text-right">Total Value</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading ingredient stock levels...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No ingredients found matching your search.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{item.name}</div>
                      {item.name_ta && (
                        <div className="text-xs text-gray-500 font-tamil">{item.name_ta}</div>
                      )}
                      {item.sku && <div className="text-xs text-gray-400">SKU: {item.sku}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {item.category.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {item.current_stock} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {item.min_threshold} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatRupees(item.cost_paise)} / {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatRupees(item.stock_value_paise || 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.is_low_stock ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3 h-3" />
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAdjustItem(item);
                          setAdjustQty(item.current_stock);
                        }}
                        className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1 ml-auto"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Adjust
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reconcile Stock: {adjustItem.name}</h3>
            <p className="text-xs text-gray-500">
              Current recorded level:{" "}
              <span className="font-semibold">
                {adjustItem.current_stock} {adjustItem.unit}
              </span>
              . Enter physical count verified on the kitchen shelf.
            </p>
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Verified Physical Count ({adjustItem.unit})
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Audit Notes / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. End of shift physical count"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdjustItem(null)}
                  disabled={isAdjusting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAdjusting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isAdjusting ? "Updating..." : "Save Count"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Ingredient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Add Raw Material</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Name (English)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Basmati Rice"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1 font-tamil">
                    Name (தமிழ்)
                  </label>
                  <input
                    type="text"
                    placeholder="பாசுமதி அரிசி"
                    value={newNameTa}
                    onChange={(e) => setNewNameTa(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-tamil"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CATEGORIES.filter((c) => c.value !== "ALL").map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit of Measure
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Unit Cost (₹)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="120.00"
                    value={newCostRupees}
                    onChange={(e) => setNewCostRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="50"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Min Alert Level
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="10"
                    value={newMinThreshold}
                    onChange={(e) => setNewMinThreshold(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreating}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isCreating ? "Saving..." : "Create Ingredient"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default StockOverviewPage;
