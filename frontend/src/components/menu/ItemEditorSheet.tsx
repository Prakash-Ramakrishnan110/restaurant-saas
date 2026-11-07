import React, { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { FormField } from "../ui/form-field";
import { Switch } from "../ui/switch";
import { FoodType, FoodTypeBadge } from "./FoodTypeBadge";
import { formatPaise, parseRupeesToPaise } from "../../lib/money";
import { Upload, X, Plus, Trash2, Crosshair, Check } from "lucide-react";

interface VariantForm {
  id?: string;
  name: string;
  name_ta: string;
  price_rupees: string;
  is_default: boolean;
}

interface ItemEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: any | null;
  categories: any[];
  optionGroups: any[];
  onSave: (
    payload: any,
    imageFile?: File | null,
    focusCoords?: { x: number; y: number }
  ) => Promise<void>;
  isLoading?: boolean;
}

export const ItemEditorSheet: React.FC<ItemEditorSheetProps> = ({
  open,
  onOpenChange,
  item,
  categories,
  optionGroups,
  onSave,
  isLoading = false,
}) => {
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [nameTa, setNameTa] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionTa, setDescriptionTa] = useState("");
  const [priceRupees, setPriceRupees] = useState("");
  const [foodType, setFoodType] = useState<FoodType>("VEG");
  const [prepMinutes, setPrepMinutes] = useState("");
  const [isBestseller, setIsBestseller] = useState(false);
  const [isActive, setIsActive] = useState(true);

  // Variants state
  const [variants, setVariants] = useState<VariantForm[]>([]);

  // Option groups state (IDs selected)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Image & Focus coordinates
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [focusX, setFocusX] = useState<number>(0.5);
  const [focusY, setFocusY] = useState<number>(0.5);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (item) {
      setCategoryId(item.category || item.category_id || "");
      setName(item.name || "");
      setNameTa(item.name_ta || "");
      setDescription(item.description || "");
      setDescriptionTa(item.description_ta || "");
      setPriceRupees(item.base_price_paise ? String(Math.trunc(item.base_price_paise / 100)) : "");
      setFoodType(item.food_type || "VEG");
      setPrepMinutes(item.prep_minutes ? String(item.prep_minutes) : "");
      setIsBestseller(Boolean(item.is_bestseller));
      setIsActive(item.is_active !== false);
      setImagePreview(item.image_card || item.image_original || "");
      setFocusX(item.image_focus_x ?? 0.5);
      setFocusY(item.image_focus_y ?? 0.5);
      setImageFile(null);

      // Populate variants
      if (item.variants && item.variants.length > 0) {
        setVariants(
          item.variants.map((v: any) => ({
            id: v.id,
            name: v.name,
            name_ta: v.name_ta || "",
            price_rupees: String(Math.trunc(v.price_paise / 100)),
            is_default: Boolean(v.is_default),
          }))
        );
      } else {
        setVariants([]);
      }

      // Populate option groups
      if (item.option_groups) {
        setSelectedGroupIds(item.option_groups.map((g: any) => g.id));
      } else {
        setSelectedGroupIds([]);
      }
    } else {
      // Defaults for new item
      setCategoryId(categories[0]?.id || "");
      setName("");
      setNameTa("");
      setDescription("");
      setDescriptionTa("");
      setPriceRupees("");
      setFoodType("VEG");
      setPrepMinutes("");
      setIsBestseller(false);
      setIsActive(true);
      setVariants([]);
      setSelectedGroupIds([]);
      setImagePreview("");
      setImageFile(null);
      setFocusX(0.5);
      setFocusY(0.5);
    }
  }, [item, categories, open]);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setFocusX(Math.round(x * 100) / 100);
    setFocusY(Math.round(y * 100) / 100);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setFocusX(0.5);
      setFocusY(0.5);
    }
  };

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        name: "",
        name_ta: "",
        price_rupees: priceRupees || "0",
        is_default: prev.length === 0,
      },
    ]);
  };

  const handleRemoveVariant = (idx: number) => {
    setVariants((prev) => {
      const next = [...prev];
      next.splice(idx, 1);
      if (next.length > 0 && !next.some((v) => v.is_default)) {
        next[0].is_default = true;
      }
      return next;
    });
  };

  const handleSetDefaultVariant = (idx: number) => {
    setVariants((prev) =>
      prev.map((v, i) => ({
        ...v,
        is_default: i === idx,
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const basePaise = parseRupeesToPaise(priceRupees);

    const payload: any = {
      category: categoryId,
      name: name.trim(),
      name_ta: nameTa.trim(),
      description: description.trim(),
      description_ta: descriptionTa.trim(),
      base_price_paise: basePaise,
      food_type: foodType,
      prep_minutes: prepMinutes ? parseInt(prepMinutes, 10) : null,
      is_bestseller: isBestseller,
      is_active: isActive,
      group_ids: selectedGroupIds,
    };

    if (variants.length > 0) {
      payload.variants = variants.map((v, idx) => ({
        name: v.name.trim(),
        name_ta: v.name_ta.trim(),
        price_paise: parseRupeesToPaise(v.price_rupees),
        is_default: v.is_default,
        sort_order: idx + 1,
      }));
    }

    await onSave(payload, imageFile, { x: focusX, y: focusY });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto flex flex-col p-0">
        <SheetHeader className="p-6 border-b border-border sticky top-0 bg-background z-10">
          <SheetTitle className="text-lg font-bold">
            {item ? "Edit Menu Item" : "Add Menu Item"}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 flex-1">
          {/* Category */}
          <FormField label="Menu Category" required>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.name_ta ? `(${c.name_ta})` : ""}
                </option>
              ))}
            </select>
          </FormField>

          {/* Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Item Name (English)" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Masala Dosa"
                required
              />
            </FormField>
            <FormField label="Item Name (Tamil)">
              <Input
                value={nameTa}
                onChange={(e) => setNameTa(e.target.value)}
                placeholder="உதாரணம்: மசாலா தோசை"
              />
            </FormField>
          </div>

          {/* Descriptions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Description (English)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Crispy fermented crepe filled with spiced potato masala"
                rows={2}
                className="w-full p-2.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </FormField>
            <FormField label="Description (Tamil)">
              <textarea
                value={descriptionTa}
                onChange={(e) => setDescriptionTa(e.target.value)}
                placeholder="உருளைக்கிழங்கு மசாலாவுடன் கூடிய மொறுமொறுப்பான தோசை"
                rows={2}
                className="w-full p-2.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
              />
            </FormField>
          </div>

          {/* Price, Food Type & Prep Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="Base Price (₹)"
              required
              helperText={
                parseRupeesToPaise(priceRupees) > 0
                  ? `Guests will pay ${formatPaise(parseRupeesToPaise(priceRupees), { forceDecimals: true })}`
                  : "Enter price in rupees"
              }
            >
              <Input
                type="number"
                step="any"
                min="0"
                value={priceRupees}
                onChange={(e) => setPriceRupees(e.target.value)}
                placeholder="120"
                required
              />
            </FormField>

            <FormField label="Food Type" required>
              <div className="flex items-center gap-1.5 h-10">
                {(["VEG", "NON_VEG", "EGG"] as FoodType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFoodType(t)}
                    className={`flex-1 h-9 rounded-md border text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                      foodType === t
                        ? "border-[#FF6A00] bg-[#FF6A00]/10 text-foreground"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <FoodTypeBadge type={t} showLabel={false} />
                    <span>{t === "VEG" ? "Veg" : t === "NON_VEG" ? "Non-Veg" : "Egg"}</span>
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="Prep Time (mins)">
              <Input
                type="number"
                min="1"
                value={prepMinutes}
                onChange={(e) => setPrepMinutes(e.target.value)}
                placeholder="10"
              />
            </FormField>
          </div>

          {/* Photo & Focus Point */}
          <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Item Photo (JPEG, PNG, WebP)</span>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Crosshair className="w-3.5 h-3.5 text-[#FF6A00]" />
                Click photo to set crop focus
              </span>
            </div>

            {imagePreview ? (
              <div className="relative inline-block w-full max-h-48 rounded-lg overflow-hidden border border-border bg-black/5 dark:bg-white/5">
                <img
                  ref={imageRef}
                  src={imagePreview}
                  alt="Crop preview"
                  onClick={handleImageClick}
                  className="w-full h-44 object-cover cursor-crosshair select-none"
                />
                {/* Focus Point Reticle */}
                <div
                  className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full border-2 border-[#FF6A00] bg-[#FF6A00]/30 shadow-lg pointer-events-none flex items-center justify-center animate-pulse"
                  style={{ left: `${focusX * 100}%`, top: `${focusY * 100}%` }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview("");
                    setImageFile(null);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                <span className="text-xs font-medium text-foreground">Click to upload photo</span>
                <span className="text-[11px] text-muted-foreground">
                  Up to 5MB, EXIF auto-stripped
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Variants */}
          <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-semibold">Portions & Variants</h4>
                <p className="text-[11px] text-muted-foreground">
                  e.g. Half / Full, Small / Large. Default variant updates base price.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={handleAddVariant}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Variant
              </Button>
            </div>

            {variants.length > 0 && (
              <div className="space-y-2">
                {variants.map((v, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-background rounded-lg border border-border"
                  >
                    <input
                      type="radio"
                      name="default_variant"
                      checked={v.is_default}
                      onChange={() => handleSetDefaultVariant(idx)}
                      title="Mark as default"
                      className="text-[#FF6A00] focus:ring-[#FF6A00]"
                    />
                    <Input
                      value={v.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVariants((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                        );
                      }}
                      placeholder="Variant (e.g. Full)"
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      value={v.name_ta}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVariants((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, name_ta: val } : item))
                        );
                      }}
                      placeholder="தமிழ் பெயர்"
                      className="h-8 text-xs flex-1"
                    />
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      value={v.price_rupees}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVariants((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, price_rupees: val } : item))
                        );
                      }}
                      placeholder="₹"
                      className="h-8 text-xs w-20"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(idx)}
                      className="p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Option Groups */}
          {optionGroups.length > 0 && (
            <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
              <h4 className="text-xs font-semibold">Customizations & Option Groups</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {optionGroups.map((grp) => {
                  const isChecked = selectedGroupIds.includes(grp.id);
                  return (
                    <button
                      type="button"
                      key={grp.id}
                      onClick={() => {
                        setSelectedGroupIds((prev) =>
                          isChecked ? prev.filter((id) => id !== grp.id) : [...prev, grp.id]
                        );
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs text-left transition-colors ${
                        isChecked
                          ? "border-[#FF6A00] bg-[#FF6A00]/10 text-foreground font-medium"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <span>{grp.name}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-[#FF6A00]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Switches: Bestseller & Active */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Switch checked={isBestseller} onCheckedChange={setIsBestseller} id="bestseller" />
              <label htmlFor="bestseller" className="text-xs font-medium cursor-pointer">
                Chef's Bestseller
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="is_active" />
              <label htmlFor="is_active" className="text-xs font-medium cursor-pointer">
                Active on Menu
              </label>
            </div>
          </div>

          <SheetFooter className="p-0 pt-4 border-t border-border sticky bottom-0 bg-background">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !name.trim() || !categoryId}
              className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-semibold"
            >
              {isLoading ? "Saving..." : item ? "Update Item" : "Create Item"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
