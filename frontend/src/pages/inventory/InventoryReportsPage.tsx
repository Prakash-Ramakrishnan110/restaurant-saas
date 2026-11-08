import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart,
  RefreshCw,
  AlertTriangle,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ShieldAlert,
  Search,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";

export interface IngredientBreakdown {
  ingredient_id: string;
  name: string;
  category: string;
  unit: string;
  cost_paise: number;
  current_stock: number;
  inward_purchased_qty: number;
  theoretical_used_qty: number;
  wasted_qty: number;
  theoretical_cost_paise: number;
  wastage_cost_paise: number;
  stock_value_paise: number;
  is_low_stock: boolean;
}

export interface VarianceReportData {
  total_food_sales_paise: number;
  theoretical_cogs_paise: number;
  total_wastage_loss_paise: number;
  total_purchases_paise: number;
  effective_cogs_paise: number;
  food_cost_percentage: number;
  ingredients_breakdown: IngredientBreakdown[];
}

export interface LowStockAlert {
  ingredient_id: string;
  ingredient_name: string;
  ingredient_name_ta?: string;
  category: string;
  unit: string;
  current_stock: number;
  min_threshold: number;
  deficit: number;
  recommended_reorder_qty: number;
  cost_paise: number;
  estimated_reorder_cost_paise: number;
}

export const InventoryReportsPage: React.FC = () => {
  const [report, setReport] = useState<VarianceReportData | null>(null);
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<"TODAY" | "7D" | "30D">("30D");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [reportRes, alertsRes] = await Promise.all([
        apiClient.get<VarianceReportData>("/api/v1/inventory/reports/variance/"),
        apiClient.get<LowStockAlert[]>("/api/v1/inventory/reports/low-stock/"),
      ]);
      setReport(reportRes.data);
      setAlerts(alertsRes.data);
    } catch {
      setError("Failed to load inventory variance and low-stock telemetry.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredBreakdown = useMemo(() => {
    if (!report) return [];
    return report.ingredients_breakdown.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [report, searchQuery]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PieChart className="w-7 h-7 text-emerald-600" />
            Inventory Variance & Food Cost Analysis
            <span className="text-sm font-normal text-gray-500 font-tamil">
              (உணவு செலவு & பயன்பாட்டு அறிக்கை)
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare theoretical recipe consumption against actual physical consumption, calculate
            food cost %, and manage stock reorder alerts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1 text-xs font-medium text-gray-600">
            {(["TODAY", "7D", "30D"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  timeRange === range
                    ? "bg-white text-gray-900 shadow-sm font-bold"
                    : "hover:text-gray-900"
                }`}
              >
                {range === "TODAY" ? "Today" : range === "7D" ? "Past 7 Days" : "Past 30 Days"}
              </button>
            ))}
          </div>
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
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Food Cost %</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                (report?.food_cost_percentage || 0) <= 32
                  ? "bg-emerald-100 text-emerald-800"
                  : (report?.food_cost_percentage || 0) <= 38
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {(report?.food_cost_percentage || 0) <= 32
                ? "Optimal"
                : (report?.food_cost_percentage || 0) <= 38
                  ? "Elevated"
                  : "High Loss"}
            </span>
          </div>
          <div className="text-3xl font-extrabold text-gray-900 mt-2">
            {report?.food_cost_percentage || 0}%
          </div>
          <span className="text-xs text-gray-500 mt-1 block">Effective COGS / Revenue</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Food Sales Revenue
            </span>
            <DollarSign className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {formatRupees(report?.total_food_sales_paise || 0)}
          </div>
          <span className="text-xs text-gray-500 mt-1 block">Settled order revenue</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">Theoretical COGS</span>
            <ArrowUpRight className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {formatRupees(report?.theoretical_cogs_paise || 0)}
          </div>
          <span className="text-xs text-gray-500 mt-1 block">Calculated via bill recipe items</span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500">
              Wastage / Spoilage
            </span>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600 mt-2">
            {formatRupees(report?.total_wastage_loss_paise || 0)}
          </div>
          <span className="text-xs text-gray-500 mt-1 block">Damaged & expired stock loss</span>
        </div>
      </div>

      {/* Low-Stock Replenishment Section */}
      {alerts.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Low-Stock Replenishment Alerts ({alerts.length} Items Pending Reorder)
            </div>
            <span className="text-xs text-amber-800 font-medium">
              Action recommended before evening service
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map((alert) => (
              <div
                key={alert.ingredient_id}
                className="bg-white rounded-lg p-3.5 border border-amber-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {alert.ingredient_name}
                      </h4>
                      {alert.ingredient_name_ta && (
                        <div className="text-xs text-gray-500 font-tamil">
                          {alert.ingredient_name_ta}
                        </div>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">
                      Deficit: {alert.deficit} {alert.unit}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    Current:{" "}
                    <span className="font-bold text-red-600">
                      {alert.current_stock} {alert.unit}
                    </span>{" "}
                    (Min: {alert.min_threshold} {alert.unit})
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    Suggested Reorder:{" "}
                    <span className="font-medium text-gray-900">
                      {alert.recommended_reorder_qty} {alert.unit}
                    </span>
                  </span>
                  <span className="font-bold text-emerald-700">
                    {formatRupees(alert.estimated_reorder_cost_paise)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Breakdown Table */}
      <div className="space-y-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search ingredient breakdown..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm focus:outline-none"
          />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Ingredient</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Physical Stock</th>
                  <th className="px-4 py-3 text-right">Inward Added</th>
                  <th className="px-4 py-3 text-right">Recipe Used</th>
                  <th className="px-4 py-3 text-right">Wasted</th>
                  <th className="px-4 py-3 text-right">Usage Cost</th>
                  <th className="px-4 py-3 text-right">Wastage Loss</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      Loading inventory variance breakdown...
                    </td>
                  </tr>
                ) : filteredBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      No raw material telemetry found for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredBreakdown.map((item) => (
                    <tr key={item.ingredient_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-900">{item.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {item.category.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {item.current_stock} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {item.inward_purchased_qty} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700">
                        {item.theoretical_used_qty} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {item.wasted_qty > 0 ? `${item.wasted_qty} ${item.unit}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {formatRupees(item.theoretical_cost_paise)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        {item.wastage_cost_paise > 0
                          ? formatRupees(item.wastage_cost_paise)
                          : "₹0.00"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.is_low_stock ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" />
                            Low
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Normal
                          </span>
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
    </div>
  );
};
export default InventoryReportsPage;
