import React, { useState, useEffect, useCallback } from "react";
import { ChefHat, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";

interface RecipeRow {
  id: string;
  menu_item: string | null;
  menu_item_name: string;
  variant_name: string;
  output_item_name: string;
  yield_portions: string;
  version: number;
  cost_per_portion_paise?: number;
  margin_percent?: string | null;
  lines: Array<{
    id: string;
    item_name: string;
    base_unit: string;
    quantity_per_portion: string;
    waste_percent: string;
  }>;
}

interface MenuItemOption {
  id: string;
  name: string;
}

interface InvItemOption {
  id: string;
  name: string;
  base_unit: string;
}

export const RecipesPage: React.FC = () => {
  const { can } = useAuth();
  const canManage = can("inventory.manage");
  const canSeeCosts = can("inventory.costs");

  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [invItems, setInvItems] = useState<InvItemOption[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [selectedIngId, setSelectedIngId] = useState("");
  const [qtyPerPortion, setQtyPerPortion] = useState("100");
  const [wastePct, setWastePct] = useState("0");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [recRes, menuRes, invRes] = await Promise.all([
        apiClient.get<ListResponse<RecipeRow>>("/inventory/recipes/"),
        apiClient.get<ListResponse<MenuItemOption>>("/menu/items/"),
        apiClient.get<ListResponse<InvItemOption>>("/inventory/items/"),
      ]);
      setRecipes(unwrapList(recRes.data));
      const mList = unwrapList(menuRes.data);
      const iList = unwrapList(invRes.data);
      setMenuItems(mList);
      setInvItems(iList);
      if (mList.length > 0) setSelectedMenuId((prev) => prev || mList[0].id);
      if (iList.length > 0) setSelectedIngId((prev) => prev || iList[0].id);
    } catch {
      setError("Failed to load recipes.");
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMenuId || !selectedIngId) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post("/inventory/recipes/", {
        menu_item: selectedMenuId,
        yield_portions: "1",
        lines: [
          {
            item: selectedIngId,
            quantity_per_portion: qtyPerPortion,
            waste_percent: wastePct || "0",
          },
        ],
      });
      setNotice("Recipe saved.");
      await fetchData();
    } catch {
      setError("Could not save recipe (a recipe for this dish may already exist).");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
          <ChefHat className="w-6 h-6 text-[#FF6A00]" />
          <span>Recipes</span>
          <span className="text-xs text-muted-foreground font-normal">செய்முறைகள்</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Link menu dishes and prepared bases to ingredients for automatic stock deduction and
          margin tracking.
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

      {canManage && (
        <form
          onSubmit={handleCreateRecipe}
          className="p-5 rounded-xl border border-border bg-card grid grid-cols-1 md:grid-cols-5 gap-3"
        >
          <select
            aria-label="Select menu dish"
            value={selectedMenuId}
            onChange={(e) => setSelectedMenuId(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          >
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Select ingredient"
            value={selectedIngId}
            onChange={(e) => setSelectedIngId(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          >
            {invItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.base_unit})
              </option>
            ))}
          </select>
          <input
            aria-label="Quantity per portion"
            type="number"
            step="0.001"
            min="0.001"
            value={qtyPerPortion}
            onChange={(e) => setQtyPerPortion(e.target.value)}
            placeholder="Qty per portion"
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
          <input
            aria-label="Waste percentage"
            type="number"
            step="0.1"
            min="0"
            max="99"
            value={wastePct}
            onChange={(e) => setWastePct(e.target.value)}
            placeholder="Waste %"
            className="px-3 py-2 text-sm rounded-lg border border-input bg-background min-h-[44px]"
          />
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Recipe
          </Button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recipes.map((rec) => (
          <div key={rec.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-base text-foreground">
                  {rec.menu_item_name || rec.output_item_name}
                  {rec.variant_name ? ` (${rec.variant_name})` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  Yield: {rec.yield_portions} • v{rec.version}
                </div>
              </div>
              {canSeeCosts && rec.cost_per_portion_paise !== undefined && (
                <div className="text-right">
                  <div className="text-sm font-black text-foreground">
                    {formatRupees(rec.cost_per_portion_paise)} / portion
                  </div>
                  {rec.margin_percent && (
                    <div className="text-xs font-bold text-emerald-600">
                      Margin: {rec.margin_percent}%
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1 text-xs border-t border-border pt-2">
              {rec.lines.map((ln) => (
                <div key={ln.id} className="flex justify-between">
                  <span>{ln.item_name}</span>
                  <span className="font-mono">
                    {ln.quantity_per_portion} {ln.base_unit}
                    {Number(ln.waste_percent) > 0 ? ` (+${ln.waste_percent}% waste)` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
