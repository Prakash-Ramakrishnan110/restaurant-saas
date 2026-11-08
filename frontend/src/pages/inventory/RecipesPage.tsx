import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChefHat,
  Search,
  Plus,
  RefreshCw,
  Edit3,
  UtensilsCrossed,
  TrendingUp,
  Percent,
  Trash2,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";

export interface RecipeItemData {
  id?: string;
  ingredient: string;
  ingredient_name?: string;
  ingredient_unit?: string;
  ingredient_cost_paise?: number;
  quantity: string;
  calculated_cost_paise?: number;
}

export interface RecipeData {
  id: string;
  menu_item: string;
  menu_item_name: string;
  menu_item_price_paise: number;
  yield_servings: string;
  preparation_instructions?: string;
  total_cost_paise: number;
  items: RecipeItemData[];
}

interface MenuItemOption {
  id: string;
  name: string;
  base_price_paise: number;
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  cost_paise: number;
}

export const RecipesPage: React.FC = () => {
  const [recipes, setRecipes] = useState<RecipeData[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [ingredients, setIngredients] = useState<IngredientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeData | null>(null);
  const [selectedMenuItem, setSelectedMenuItem] = useState("");
  const [yieldServings, setYieldServings] = useState("1.00");
  const [prepInstructions, setPrepInstructions] = useState("");
  const [formItems, setFormItems] = useState<{ ingredient: string; quantity: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [recRes, menuRes, ingRes] = await Promise.all([
        apiClient.get<ListResponse<RecipeData>>("/api/v1/inventory/recipes/"),
        apiClient.get<ListResponse<MenuItemOption>>("/api/v1/menu/items/"),
        apiClient.get<ListResponse<IngredientOption>>("/api/v1/inventory/ingredients/"),
      ]);
      setRecipes(unwrapList(recRes.data));
      setMenuItems(unwrapList(menuRes.data));
      setIngredients(unwrapList(ingRes.data));
    } catch {
      setError("Failed to load recipes and menu data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) =>
      r.menu_item_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [recipes, searchQuery]);

  const openCreateModal = () => {
    setEditingRecipe(null);
    setSelectedMenuItem(menuItems[0]?.id || "");
    setYieldServings("1.00");
    setPrepInstructions("");
    setFormItems([{ ingredient: ingredients[0]?.id || "", quantity: "0.200" }]);
    setShowModal(true);
  };

  const openEditModal = (recipe: RecipeData) => {
    setEditingRecipe(recipe);
    setSelectedMenuItem(recipe.menu_item);
    setYieldServings(recipe.yield_servings);
    setPrepInstructions(recipe.preparation_instructions || "");
    setFormItems(
      recipe.items.map((i) => ({
        ingredient: i.ingredient,
        quantity: i.quantity,
      }))
    );
    setShowModal(true);
  };

  const handleAddItemRow = () => {
    setFormItems((prev) => [...prev, { ingredient: ingredients[0]?.id || "", quantity: "0.100" }]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: "ingredient" | "quantity", value: string) => {
    setFormItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const calculatedFormCost = useMemo(() => {
    let total = 0;
    for (const item of formItems) {
      const ing = ingredients.find((i) => i.id === item.ingredient);
      if (ing) {
        const qty = parseFloat(item.quantity) || 0;
        total += Math.round(qty * ing.cost_paise);
      }
    }
    return total;
  }, [formItems, ingredients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuItem || formItems.length === 0) return;
    setIsSaving(true);
    try {
      const payload = {
        menu_item: selectedMenuItem,
        yield_servings: yieldServings,
        preparation_instructions: prepInstructions,
        items: formItems.map((item) => ({
          ingredient: item.ingredient,
          quantity: item.quantity,
        })),
      };

      if (editingRecipe) {
        await apiClient.put(`/api/v1/inventory/recipes/${editingRecipe.id}/`, payload);
      } else {
        await apiClient.post("/api/v1/inventory/recipes/", payload);
      }
      setShowModal(false);
      await fetchData();
    } catch {
      setError("Failed to save recipe formulation.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ChefHat className="w-7 h-7 text-emerald-600" />
            Recipe Formulations & Costing
            <span className="text-sm font-normal text-gray-500 font-tamil">(செய்முறை அட்டவணை)</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Standardized bills of materials, portion quantities, ingredient cost calculation, and
            margin analysis
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
            onClick={openCreateModal}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-4 h-4" />
            New Recipe
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search recipes by dish name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm focus:outline-none"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Recipes Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
          Loading recipe formulations...
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          No recipes found. Click "New Recipe" to link constituent ingredients to menu dishes.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredRecipes.map((recipe) => {
            const pricePaise = recipe.menu_item_price_paise || 0;
            const costPaise = recipe.total_cost_paise || 0;
            const profitPaise = pricePaise - costPaise;
            const marginPct = pricePaise > 0 ? Math.round((profitPaise / pricePaise) * 100) : 0;

            return (
              <div
                key={recipe.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 hover:border-emerald-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{recipe.menu_item_name}</h3>
                    <p className="text-xs text-gray-500">
                      Standard Batch Yield: {recipe.yield_servings} serving(s)
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(recipe)}
                    className="text-gray-500 hover:text-gray-900"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Financial KPI bar */}
                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100 text-center">
                  <div>
                    <span className="text-xs text-gray-500 block">Selling Price</span>
                    <span className="text-sm font-bold text-gray-900">
                      {formatRupees(pricePaise)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Food Cost</span>
                    <span className="text-sm font-bold text-emerald-700">
                      {formatRupees(costPaise)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Gross Margin</span>
                    <span className="text-sm font-bold text-blue-600 flex items-center justify-center gap-0.5">
                      <Percent className="w-3 h-3" />
                      {marginPct}%
                    </span>
                  </div>
                </div>

                {/* Ingredients table snippet */}
                <div>
                  <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">
                    Constituent Raw Materials ({recipe.items.length})
                  </h4>
                  <div className="space-y-1.5 text-xs text-gray-600">
                    {recipe.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0"
                      >
                        <span className="font-medium text-gray-800">
                          {item.quantity} {item.ingredient_unit} {item.ingredient_name}
                        </span>
                        <span className="text-gray-500 font-mono">
                          {formatRupees(item.calculated_cost_paise || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {recipe.preparation_instructions && (
                  <p className="text-xs text-gray-500 bg-emerald-50/50 p-2 rounded border border-emerald-100/50">
                    <span className="font-medium text-emerald-900">Notes:</span>{" "}
                    {recipe.preparation_instructions}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Recipe Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 my-8">
            <h3 className="text-lg font-bold text-gray-900">
              {editingRecipe ? "Edit Recipe Formulation" : "Create Recipe Formulation"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Select Menu Item
                  </label>
                  <select
                    disabled={!!editingRecipe}
                    value={selectedMenuItem}
                    onChange={(e) => setSelectedMenuItem(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {menuItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({formatRupees(item.base_price_paise)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Yield Servings
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={yieldServings}
                    onChange={(e) => setYieldServings(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Preparation Instructions / Chef Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Slow simmer 30 mins, add spices at the end"
                  value={prepInstructions}
                  onChange={(e) => setPrepInstructions(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Items Rows */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase text-gray-700">
                    Required Ingredients & Quantities
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItemRow}
                    className="text-xs h-7 text-emerald-700"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Raw Material
                  </Button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                  {formItems.map((row, idx) => {
                    const ing = ingredients.find((i) => i.id === row.ingredient);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={row.ingredient}
                          onChange={(e) => handleItemChange(idx, "ingredient", e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
                        >
                          {ingredients.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name} ({formatRupees(i.cost_paise)} / {i.unit})
                            </option>
                          ))}
                        </select>
                        <div className="w-28 flex items-center">
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            required
                            placeholder="Qty"
                            value={row.quantity}
                            onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs"
                          />
                          <span className="text-xs text-gray-500 ml-1.5 font-medium">
                            {ing?.unit || "KG"}
                          </span>
                        </div>
                        {formItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItemRow(idx)}
                            className="text-red-500 hover:text-red-700 p-1 h-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Estimated Formulation Cost */}
              <div className="bg-emerald-50 p-3 rounded-lg flex items-center justify-between text-sm">
                <span className="text-emerald-800 font-medium flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Estimated Batch Cost:
                </span>
                <span className="font-bold text-emerald-900 text-base">
                  {formatRupees(calculatedFormCost)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSaving ? "Saving..." : "Save Recipe"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default RecipesPage;
