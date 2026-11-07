import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { FoodTypeBadge } from "../../components/menu/FoodTypeBadge";
import { formatPaise } from "../../lib/money";
import { Clock, AlertCircle, Undo2, Check, X, Layers, UtensilsCrossed } from "lucide-react";

interface ItemAvailabilityRecord {
  id: string;
  name: string;
  name_ta?: string;
  category_id: string;
  category_name: string;
  base_price_paise: number;
  food_type: "VEG" | "NON_VEG" | "EGG";
  image_thumb?: string;
  is_available: boolean;
}

export const MenuAvailabilityPage: React.FC = () => {
  const { activeTenant, can } = useAuth();

  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [items, setItems] = useState<ItemAvailabilityRecord[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Undo Toast state
  const [lastAction, setLastAction] = useState<{
    itemId: string;
    itemName: string;
    previousState: boolean;
  } | null>(null);

  const canEditAvailability = can("menu.availability");

  const loadData = async () => {
    if (!activeTenant) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      const [branchRes, catRes] = await Promise.all([
        apiClient.get<any>("/branches/"),
        apiClient.get<any>("/menu/categories/"),
      ]);
      const branchList = branchRes.data.results || branchRes.data || [];
      setBranches(branchList);
      setCategories(catRes.data.results || catRes.data || []);

      const branchId = selectedBranchId || branchList[0]?.id || "";
      if (!selectedBranchId && branchId) {
        setSelectedBranchId(branchId);
      }

      if (branchId) {
        await loadItemsForBranch(branchId);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed to load availability data.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadItemsForBranch = async (branchId: string) => {
    try {
      const res = await apiClient.get<any>(`/menu/items/?branch=${branchId}`);
      const rawItems = res.data.results || res.data || [];
      const mapped: ItemAvailabilityRecord[] = rawItems.map((it: any) => ({
        id: it.id,
        name: it.name,
        name_ta: it.name_ta,
        category_id: it.category,
        category_name: it.category_name,
        base_price_paise: it.base_price_paise,
        food_type: it.food_type,
        image_thumb: it.image_thumb || it.image_card,
        is_available: it.is_available !== false,
      }));
      setItems(mapped);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed to load branch items.");
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenant?.tenant_id]);

  const handleBranchChange = async (bId: string) => {
    setSelectedBranchId(bId);
    await loadItemsForBranch(bId);
  };

  const handleToggle = async (item: ItemAvailabilityRecord) => {
    if (!selectedBranchId || !canEditAvailability) return;
    const nextState = !item.is_available;

    // Optimistic update
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, is_available: nextState } : it))
    );

    setLastAction({
      itemId: item.id,
      itemName: item.name,
      previousState: item.is_available,
    });

    try {
      await apiClient.post("/menu/availability/toggle/", {
        branch: selectedBranchId,
        item: item.id,
        is_available: nextState,
      });
    } catch {
      // Revert on error
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, is_available: item.is_available } : it))
      );
      setErrorMsg("Failed to update availability.");
    }
  };

  const handleUndo = async () => {
    if (!lastAction || !selectedBranchId) return;
    const { itemId, previousState } = lastAction;

    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, is_available: previousState } : it))
    );
    setLastAction(null);

    try {
      await apiClient.post("/menu/availability/toggle/", {
        branch: selectedBranchId,
        item: itemId,
        is_available: previousState,
      });
    } catch {
      setErrorMsg("Failed to undo availability change.");
    }
  };

  const handleBulkCategoryToggle = async (categoryId: string, isAvailable: boolean) => {
    if (!selectedBranchId || !canEditAvailability) return;
    const targetItems = items.filter((it) => it.category_id === categoryId);
    if (targetItems.length === 0) return;

    const itemIds = targetItems.map((it) => it.id);

    // Optimistic update
    setItems((prev) =>
      prev.map((it) => (it.category_id === categoryId ? { ...it, is_available: isAvailable } : it))
    );

    try {
      await apiClient.post("/menu/availability/bulk-toggle/", {
        branch: selectedBranchId,
        item_ids: itemIds,
        is_available: isAvailable,
      });
    } catch {
      await loadItemsForBranch(selectedBranchId);
      setErrorMsg("Failed to bulk update items.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#FF6A00]" />
            Today's Availability
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Quickly mark sold-out items across outlets. Waiters and cashiers immediately see
            changes.
          </p>
        </div>

        {/* Branch Selector */}
        {branches.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Outlet:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-xs font-semibold focus:ring-2 focus:ring-[#FF6A00]"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg("")} className="text-xs font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Undo Toast Notification */}
      {lastAction && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl border border-border bg-card flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3">
          <div className="text-xs">
            <span className="font-semibold">{lastAction.itemName}</span> is now marked as{" "}
            <span
              className={`font-bold ${lastAction.previousState ? "text-destructive" : "text-emerald-600"}`}
            >
              {lastAction.previousState ? "Sold Out" : "Available"}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleUndo}
            className="h-8 text-xs font-semibold gap-1.5 border-[#FF6A00] text-[#FF6A00] hover:bg-[#FF6A00]/10"
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </Button>
        </div>
      )}

      {/* Categories & Items Accordion */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const catItems = items.filter((it) => it.category_id === cat.id);
          if (catItems.length === 0) return null;

          const availableCount = catItems.filter((it) => it.is_available).length;

          return (
            <div key={cat.id} className="border border-border rounded-xl bg-card overflow-hidden">
              {/* Category Header Bar */}
              <div className="px-5 py-3.5 bg-muted/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-[#FF6A00]" />
                  <h3 className="font-bold text-sm text-foreground">{cat.name}</h3>
                  {cat.name_ta && (
                    <span className="text-xs text-muted-foreground">({cat.name_ta})</span>
                  )}
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground ml-2">
                    {availableCount}/{catItems.length} available
                  </span>
                </div>

                {canEditAvailability && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBulkCategoryToggle(cat.id, true)}
                      className="h-7 text-[11px] px-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 whitespace-nowrap"
                    >
                      <Check className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="hidden sm:inline">All </span>Available
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBulkCategoryToggle(cat.id, false)}
                      className="h-7 text-[11px] px-2 text-destructive hover:bg-destructive/10 whitespace-nowrap"
                    >
                      <X className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="hidden sm:inline">All </span>Sold Out
                    </Button>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="divide-y divide-border">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* Thumbnail or Fallback Icon */}
                      <div className="w-12 h-12 rounded-lg bg-muted/40 border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {item.image_thumb ? (
                          <img
                            src={item.image_thumb}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UtensilsCrossed className="w-5 h-5 text-muted-foreground/40" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <FoodTypeBadge type={item.food_type} showLabel={false} />
                          <h4 className="font-semibold text-sm text-foreground break-words">
                            {item.name}
                          </h4>
                        </div>
                        {item.name_ta && (
                          <div className="text-xs text-muted-foreground mt-0.5">{item.name_ta}</div>
                        )}
                        <span className="font-mono text-xs text-muted-foreground font-medium">
                          {formatPaise(item.base_price_paise)}
                        </span>
                      </div>
                    </div>

                    {/* One-Tap Availability Toggle */}
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          item.is_available
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                      >
                        {item.is_available ? "Available" : "Sold Out"}
                      </span>

                      {canEditAvailability && (
                        <Switch
                          checked={item.is_available}
                          onCheckedChange={() => handleToggle(item)}
                          disabled={isLoading}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
