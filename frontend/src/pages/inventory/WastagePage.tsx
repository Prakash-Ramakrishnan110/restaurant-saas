import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Trash2,
  Plus,
  RefreshCw,
  AlertOctagon,
  Search,
  DollarSign,
  TrendingDown,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";

export interface WastageRecord {
  id: string;
  ingredient: string;
  ingredient_name?: string;
  ingredient_unit?: string;
  quantity: string;
  reason: "EXPIRED" | "SPOILED" | "BURNT_PREP" | "SPILLAGE" | "OTHER";
  cost_loss_paise: number;
  notes?: string;
  logged_by_name?: string;
  created_at: string;
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  cost_paise: number;
}

const WASTAGE_REASONS = [
  { value: "EXPIRED", label: "Expired / Date Passed", color: "bg-red-100 text-red-800" },
  { value: "SPOILED", label: "Spoiled / Quality Degraded", color: "bg-amber-100 text-amber-800" },
  { value: "BURNT_PREP", label: "Burnt / Prep Error", color: "bg-orange-100 text-orange-800" },
  { value: "SPILLAGE", label: "Spillage / Handling Drop", color: "bg-blue-100 text-blue-800" },
  { value: "OTHER", label: "Other", color: "bg-gray-100 text-gray-800" },
];

export const WastagePage: React.FC = () => {
  const [wastageLogs, setWastageLogs] = useState<WastageRecord[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reasonFilter, setReasonFilter] = useState("ALL");

  // Log Wastage Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [wastedQty, setWastedQty] = useState("");
  const [selectedReason, setSelectedReason] = useState("SPOILED");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [wRes, ingRes] = await Promise.all([
        apiClient.get<ListResponse<WastageRecord>>("/api/v1/inventory/wastage/"),
        apiClient.get<ListResponse<IngredientOption>>("/api/v1/inventory/ingredients/"),
      ]);
      setWastageLogs(unwrapList(wRes.data));
      setIngredients(unwrapList(ingRes.data));
    } catch {
      setError("Failed to load kitchen wastage logs.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openLogModal = () => {
    setSelectedIngredient(ingredients[0]?.id || "");
    setWastedQty("1.000");
    setSelectedReason("SPOILED");
    setNotes("");
    setShowModal(true);
  };

  const calculatedLoss = useMemo(() => {
    const ing = ingredients.find((i) => i.id === selectedIngredient);
    if (!ing) return 0;
    const qty = parseFloat(wastedQty) || 0;
    return Math.round(qty * ing.cost_paise);
  }, [selectedIngredient, wastedQty, ingredients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIngredient || !wastedQty) return;
    setIsSubmitting(true);
    try {
      await apiClient.post("/api/v1/inventory/wastage/", {
        ingredient: selectedIngredient,
        quantity: wastedQty,
        reason: selectedReason,
        notes,
      });
      setShowModal(false);
      await fetchData();
    } catch {
      setError("Failed to record wastage write-off.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const metrics = useMemo(() => {
    const totalLossPaise = wastageLogs.reduce((sum, item) => sum + item.cost_loss_paise, 0);
    const incidentCount = wastageLogs.length;
    return { totalLossPaise, incidentCount };
  }, [wastageLogs]);

  const filteredLogs = useMemo(() => {
    return wastageLogs.filter((log) => {
      const matchSearch =
        (log.ingredient_name &&
          log.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (log.notes && log.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchReason = reasonFilter === "ALL" || log.reason === reasonFilter;
      return matchSearch && matchReason;
    });
  }, [wastageLogs, searchQuery, reasonFilter]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trash2 className="w-7 h-7 text-red-600" />
            Kitchen Wastage & Spoilage Log
            <span className="text-sm font-normal text-gray-500 font-tamil">
              (கழிவு & சேத பதிவேடு)
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track spoiled, expired, or dropped raw materials, calculate financial cost losses, and
            identify leakages
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={openLogModal}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            <Plus className="w-4 h-4" />
            Log Wastage
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Total Financial Loss
            </span>
            <DollarSign className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 mt-2">
            {formatRupees(metrics.totalLossPaise)}
          </div>
          <span className="text-xs text-gray-500 mt-1 block">
            Cumulative loss from spoiled & expired stock
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Recorded Incidents
            </span>
            <AlertOctagon className="w-5 h-5 text-amber-700" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {metrics.incidentCount} {metrics.incidentCount === 1 ? "Incident" : "Incidents"}
          </div>
          <span className="text-xs text-gray-500 mt-1 block">
            Logged by kitchen supervisors & head chef
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search wastage entries by ingredient or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="ALL">All Reasons</option>
          {WASTAGE_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Log Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Ingredient</th>
                <th className="px-4 py-3 text-right">Quantity Wasted</th>
                <th className="px-4 py-3 text-center">Reason</th>
                <th className="px-4 py-3 text-right">Financial Loss</th>
                <th className="px-4 py-3">Logged By</th>
                <th className="px-4 py-3">Audit Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-600" />
                    Loading wastage audit logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No wastage entries found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const reasonObj = WASTAGE_REASONS.find((r) => r.value === log.reason);
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {log.ingredient_name}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {log.quantity} {log.ingredient_unit}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            reasonObj?.color || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {reasonObj?.label || log.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        {formatRupees(log.cost_loss_paise)}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">
                        {log.logged_by_name || "Manager"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs italic">{log.notes || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Wastage Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-red-600" />
              Write-Off Damaged / Expired Stock
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Ingredient
                </label>
                <select
                  value={selectedIngredient}
                  onChange={(e) => setSelectedIngredient(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({formatRupees(i.cost_paise)} / {i.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Wasted Quantity
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={wastedQty}
                    onChange={(e) => setWastedQty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reason</label>
                  <select
                    value={selectedReason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {WASTAGE_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Audit Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Broken cold chain / dropped pan during peak rush"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Calculated Financial Loss Callout */}
              <div className="bg-red-50 p-3 rounded-lg flex items-center justify-between text-sm border border-red-100">
                <span className="text-red-800 font-medium flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" />
                  Calculated Cost Loss:
                </span>
                <span className="font-bold text-red-900 text-base">
                  {formatRupees(calculatedLoss)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isSubmitting ? "Submitting..." : "Confirm Write-Off"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default WastagePage;
