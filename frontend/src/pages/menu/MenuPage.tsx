import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/client";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { FormField } from "../../components/ui/form-field";
import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { FoodTypeBadge } from "../../components/menu/FoodTypeBadge";
import { ItemEditorSheet } from "../../components/menu/ItemEditorSheet";
import { QuickAddDialog } from "../../components/menu/QuickAddDialog";
import { formatPaise } from "../../lib/money";
import {
  UtensilsCrossed,
  Plus,
  Search,
  FileSpreadsheet,
  Edit2,
  Trash2,
  Layers,
  CheckCircle2,
  AlertCircle,
  Flame,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

export const MenuPage: React.FC = () => {
  const { activeTenant, can } = useAuth();

  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [optionGroups, setOptionGroups] = useState<any[]>([]);
  const [entitlements, setEntitlements] = useState<any>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFoodType, setSelectedFoodType] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Category Modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [catName, setCatName] = useState("");
  const [catNameTa, setCatNameTa] = useState("");

  // Item Editor Sheet
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Quick Add Dialog
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Delete Confirm Dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const canManage = can("menu.manage");

  const fetchData = async () => {
    if (!activeTenant) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      const [catsRes, itemsRes, optRes, entRes] = await Promise.all([
        apiClient.get<any>("/menu/categories/"),
        apiClient.get<any>("/menu/items/"),
        apiClient.get<any>("/menu/option-groups/"),
        apiClient.get<any>("/subscriptions/entitlements/"),
      ]);
      setCategories(catsRes.data.results || catsRes.data || []);
      setItems(itemsRes.data.results || itemsRes.data || []);
      setOptionGroups(optRes.data.results || optRes.data || []);
      setEntitlements(entRes.data?.limits || null);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed to load menu data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenant?.tenant_id]);

  const handleReorderCategory = async (
    e: React.MouseEvent,
    index: number,
    direction: "up" | "down"
  ) => {
    e.stopPropagation();
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newCats = [...categories];
    const temp = newCats[index];
    newCats[index] = newCats[targetIndex];
    newCats[targetIndex] = temp;

    setCategories(newCats);

    const orders = newCats.map((cat, idx) => ({
      id: cat.id,
      sort_order: idx + 1,
    }));

    try {
      await apiClient.post("/menu/categories/reorder/", { orders });
    } catch {
      await fetchData();
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setIsLoading(true);
    try {
      if (editingCategory) {
        await apiClient.patch(`/menu/categories/${editingCategory.id}/`, {
          name: catName.trim(),
          name_ta: catNameTa.trim(),
        });
        setSuccessMsg(`Category "${catName}" updated.`);
      } else {
        await apiClient.post("/menu/categories/", {
          name: catName.trim(),
          name_ta: catNameTa.trim(),
          sort_order: categories.length + 1,
        });
        setSuccessMsg(`Category "${catName}" created.`);
      }
      setCategoryModalOpen(false);
      setEditingCategory(null);
      setCatName("");
      setCatNameTa("");
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed to save category.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveItem = async (
    payload: any,
    imageFile?: File | null,
    focusCoords?: { x: number; y: number }
  ) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      let savedItem: any;
      if (editingItem) {
        const res = await apiClient.patch(`/menu/items/${editingItem.id}/`, payload);
        savedItem = res.data;
        // update option groups
        if (payload.group_ids) {
          await apiClient.put(`/menu/items/${editingItem.id}/option-groups/`, {
            group_ids: payload.group_ids,
          });
        }
        // update variants
        if (payload.variants) {
          await apiClient.put(`/menu/items/${editingItem.id}/variants/`, {
            variants: payload.variants,
          });
        }
        setSuccessMsg(`Item "${savedItem.name}" updated successfully.`);
      } else {
        const res = await apiClient.post("/menu/items/", payload);
        savedItem = res.data;
        if (payload.group_ids && payload.group_ids.length > 0) {
          await apiClient.put(`/menu/items/${savedItem.id}/option-groups/`, {
            group_ids: payload.group_ids,
          });
        }
        if (payload.variants && payload.variants.length > 0) {
          await apiClient.put(`/menu/items/${savedItem.id}/variants/`, {
            variants: payload.variants,
          });
        }
        setSuccessMsg(`Item "${savedItem.name}" created successfully.`);
      }

      // Upload image if provided
      if (imageFile && savedItem?.id) {
        const formData = new FormData();
        formData.append("image", imageFile);
        if (focusCoords) {
          formData.append("focus_x", String(focusCoords.x));
          formData.append("focus_y", String(focusCoords.y));
        }
        await apiClient.post(`/menu/items/${savedItem.id}/image/`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      setItemSheetOpen(false);
      setEditingItem(null);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed to save menu item.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkImport = async (bulkItems: any[]) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await apiClient.post("/menu/items/bulk-create/", {
        items: bulkItems,
      });
      setSuccessMsg(
        `Successfully imported ${res.data?.created_count || bulkItems.length} menu items!`
      );
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Bulk import failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    setIsLoading(true);
    try {
      await apiClient.delete(`/menu/items/${itemToDelete.id}/`);
      setSuccessMsg(`Item "${itemToDelete.name}" deleted.`);
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || "Failed to delete item.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered items computation
  const filteredItems = items.filter((it) => {
    if (selectedCategoryId !== "ALL" && it.category !== selectedCategoryId) {
      return false;
    }
    if (selectedFoodType !== "ALL" && it.food_type !== selectedFoodType) {
      return false;
    }
    if (selectedStatus === "ACTIVE" && !it.is_active) return false;
    if (selectedStatus === "INACTIVE" && it.is_active) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = it.name?.toLowerCase().includes(q);
      const matchTa = it.name_ta?.toLowerCase().includes(q);
      const matchDesc = it.description?.toLowerCase().includes(q);
      if (!matchName && !matchTa && !matchDesc) return false;
    }
    return true;
  });

  const totalItemLimit = entitlements?.max_menu_items?.limit ?? 100;
  const currentItemCount = items.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-[#FF6A00]" />
            Menu Management
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Add your dishes, prices, photos and veg or non-veg marks.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Plan Usage Indicator — neutral below 80%, amber 80-99%, red 100%+ */}
          {(() => {
            const usagePct = totalItemLimit > 0 ? (currentItemCount / totalItemLimit) * 100 : 0;
            const dotColor =
              usagePct >= 100
                ? "bg-red-500"
                : usagePct >= 80
                  ? "bg-amber-500"
                  : "bg-muted-foreground";
            return (
              <div className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border bg-muted/40 text-foreground flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                <span>
                  {currentItemCount} of {totalItemLimit} items used
                </span>
              </div>
            );
          })()}

          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickAddOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#FF6A00]" />
                Quick Add (Paste)
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setItemSheetOpen(true);
                }}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-xs font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

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

      {/* Layout Grid: Categories Left, Items Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Categories Sidebar */}
        <div className="lg:col-span-1 border border-border rounded-xl p-4 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-wide uppercase text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#FF6A00]" />
              Categories
            </h3>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingCategory(null);
                  setCatName("");
                  setCatNameTa("");
                  setCategoryModalOpen(true);
                }}
                className="h-7 text-xs px-2 text-[#FF6A00] hover:bg-[#FF6A00]/10 font-semibold"
              >
                + New
              </Button>
            )}
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setSelectedCategoryId("ALL")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedCategoryId === "ALL"
                  ? "bg-[#FF6A00] text-[#0B1F3B] font-bold shadow-sm"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <span>All Categories</span>
              <span className="text-[11px] opacity-80">{items.length}</span>
            </button>

            {categories.map((cat, idx) => {
              const count = items.filter((it) => it.category === cat.id).length;
              const isSelected = selectedCategoryId === cat.id;
              return (
                <div
                  key={cat.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#FF6A00] text-[#0B1F3B] font-bold shadow-sm"
                      : "hover:bg-muted text-foreground"
                  }`}
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  <div className="truncate mr-2">
                    <span>{cat.name}</span>
                    {cat.name_ta && (
                      <span
                        className={`block text-[10px] ${isSelected ? "text-[#0B1F3B]/80" : "text-muted-foreground"}`}
                      >
                        {cat.name_ta}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] opacity-80 mr-1">{count}</span>
                    {canManage && (
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => handleReorderCategory(e, idx, "up")}
                          className={`p-1 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed ${
                            isSelected ? "text-[#0B1F3B]" : "text-muted-foreground"
                          }`}
                          title="Move category up"
                          aria-label="Move category up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === categories.length - 1}
                          onClick={(e) => handleReorderCategory(e, idx, "down")}
                          className={`p-1 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed ${
                            isSelected ? "text-[#0B1F3B]" : "text-muted-foreground"
                          }`}
                          title="Move category down"
                          aria-label="Move category down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategory(cat);
                            setCatName(cat.name);
                            setCatNameTa(cat.name_ta || "");
                            setCategoryModalOpen(true);
                          }}
                          className={`p-1 hover:text-foreground ${
                            isSelected ? "text-[#0B1F3B]" : "text-muted-foreground"
                          }`}
                          title="Edit category"
                          aria-label="Edit category"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Items Main Column */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-3 rounded-xl border border-border">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <Input
                placeholder="Search items by name, tamil name, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedFoodType}
                onChange={(e) => setSelectedFoodType(e.target.value)}
                className="h-9 px-2.5 rounded-md border border-input bg-background text-xs focus:ring-1 focus:ring-[#FF6A00]"
              >
                <option value="ALL">All Types</option>
                <option value="VEG">Veg Only</option>
                <option value="NON_VEG">Non-Veg Only</option>
                <option value="EGG">Egg Only</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-9 px-2.5 rounded-md border border-input bg-background text-xs focus:ring-1 focus:ring-[#FF6A00]"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          {/* Items Grid */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-xl bg-card">
              <UtensilsCrossed className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-semibold">No menu items found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {items.length === 0
                  ? "Your menu is currently empty. Add items manually or paste an entire spreadsheet with Quick Add."
                  : "No items match your active filters or search criteria."}
              </p>
              {canManage && items.length === 0 && (
                <Button
                  size="sm"
                  onClick={() => setQuickAddOpen(true)}
                  className="mt-4 bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-semibold"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Quick Add (Paste)
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-border rounded-xl bg-card overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  {/* Item Image / Fallback */}
                  <div className="relative h-36 bg-muted/30 overflow-hidden">
                    {item.image_card || item.image_thumb ? (
                      <img
                        src={item.image_card || item.image_thumb}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted/40">
                        <UtensilsCrossed className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                    )}

                    {/* Food Type Badge floating top-left */}
                    <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm px-2 py-0.5 rounded-full border border-border shadow-sm">
                      <FoodTypeBadge type={item.food_type} />
                    </div>

                    {/* Bestseller Badge */}
                    {item.is_bestseller && (
                      <div className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                        <Flame className="w-3 h-3 fill-white" /> Bestseller
                      </div>
                    )}
                  </div>

                  {/* Item Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-sm text-foreground leading-tight">
                            {item.name}
                          </h4>
                          {item.name_ta && (
                            <span className="text-[11px] text-muted-foreground font-medium block">
                              {item.name_ta}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-sm text-foreground">
                          {formatPaise(item.base_price_paise)}
                        </span>
                      </div>

                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-2 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Metadata & Actions */}
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        {item.variants && item.variants.length > 0 && (
                          <span className="bg-muted px-2 py-0.5 rounded font-mono text-[10px] text-muted-foreground">
                            {item.variants.length} sizes
                          </span>
                        )}
                        {!item.is_active && (
                          <span className="text-destructive font-medium">Inactive</span>
                        )}
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setItemSheetOpen(true);
                            }}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit Item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setItemToDelete(item);
                              setDeleteConfirmOpen(true);
                            }}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Delete Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Add/Edit Modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Menu Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCategory} className="space-y-4">
            <FormField label="Category Name (English)" required>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Starters, Hot Beverages"
                required
              />
            </FormField>
            <FormField label="Category Name (Tamil)">
              <Input
                value={catNameTa}
                onChange={(e) => setCatNameTa(e.target.value)}
                placeholder="உதாரணம்: தொடக்க உணவுகள்"
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !catName.trim()}
                className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-semibold"
              >
                {isLoading ? "Saving..." : "Save Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Item Editor Side Sheet */}
      <ItemEditorSheet
        open={itemSheetOpen}
        onOpenChange={setItemSheetOpen}
        item={editingItem}
        categories={categories}
        optionGroups={optionGroups}
        onSave={handleSaveItem}
        isLoading={isLoading}
      />

      {/* Quick Add Dialog */}
      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onImport={handleBulkImport}
        isLoading={isLoading}
        existingCategories={categories}
        currentItemCount={currentItemCount}
        totalItemLimit={totalItemLimit}
      />

      {/* Delete Item Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Menu Item"
        description={`Are you sure you want to permanently delete "${itemToDelete?.name}"? Any uploaded photos will be removed.`}
        confirmLabel="Delete Item"
        variant="destructive"
        onConfirm={handleDeleteItem}
        isLoading={isLoading}
      />
    </div>
  );
};
