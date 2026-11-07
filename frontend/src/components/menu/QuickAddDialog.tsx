import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { parseRupeesToPaise, formatPaise } from "../../lib/money";
import { FoodType, FoodTypeBadge } from "./FoodTypeBadge";
import { CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";

interface ParsedRow {
  index: number;
  category: string;
  name: string;
  pricePaise: number;
  foodType: FoodType;
  isValid: boolean;
  error?: string;
}

export interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: any[]) => Promise<void>;
  isLoading?: boolean;
  existingCategories?: { id: string; name: string }[];
  currentItemCount?: number;
  totalItemLimit?: number;
}

export const QuickAddDialog: React.FC<QuickAddDialogProps> = ({
  open,
  onOpenChange,
  onImport,
  isLoading = false,
  existingCategories,
  currentItemCount = 0,
  totalItemLimit = 100,
}) => {
  const [pasteText, setPasteText] = useState("");

  const parsedRows: ParsedRow[] = useMemo(() => {
    if (!pasteText.trim()) return [];

    const lines = pasteText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return lines.map((line, idx) => {
      // Determine delimiter: tab, pipe, or comma
      let parts: string[] = [];
      if (line.includes("\t")) {
        parts = line.split("\t");
      } else if (line.includes("|")) {
        parts = line.split("|");
      } else {
        parts = line.split(",");
      }
      parts = parts.map((s) => s.trim());

      const category = parts[0]?.trim() || "";
      const name = parts[1]?.trim() || "";
      const rawPrice = parts[2]?.trim() || "0";
      const rawType = (parts[3]?.trim() || "").toUpperCase();

      let foodType: FoodType = "VEG";
      if (rawType.includes("NON") || rawType.includes("MEAT") || rawType.includes("CHICKEN")) {
        foodType = "NON_VEG";
      } else if (rawType.includes("EGG")) {
        foodType = "EGG";
      }

      const pricePaise = parseRupeesToPaise(rawPrice);

      let isValid = true;
      let error = "";

      if (!category) {
        isValid = false;
        error = `Row ${idx + 1}: Category name is required`;
      } else if (
        existingCategories &&
        existingCategories.length > 0 &&
        !existingCategories.some(
          (c) => c.name.trim().toLowerCase() === category.toLowerCase() || c.id === category
        )
      ) {
        isValid = false;
        error = `Row ${idx + 1}: Category "${category}" not found`;
      } else if (!name) {
        isValid = false;
        error = `Row ${idx + 1}: Item name is required`;
      } else if (isNaN(pricePaise) || pricePaise <= 0) {
        isValid = false;
        error = `Row ${idx + 1}: Price must be a valid positive amount`;
      }

      return {
        index: idx + 1,
        category,
        name,
        pricePaise,
        foodType,
        isValid,
        error,
      };
    });
  }, [pasteText, existingCategories]);

  const validRows = parsedRows.filter((r) => r.isValid);
  const hasErrors = parsedRows.length > 0 && parsedRows.some((r) => !r.isValid);
  const projectedCount = currentItemCount + parsedRows.length;
  const exceedsLimit = totalItemLimit > 0 && projectedCount > totalItemLimit;

  const handleImport = async () => {
    if (parsedRows.length === 0 || hasErrors || exceedsLimit) return;
    const items = validRows.map((r) => ({
      category: r.category,
      name: r.name,
      base_price_paise: r.pricePaise,
      food_type: r.foodType,
    }));
    await onImport(items);
    setPasteText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#FF6A00]" />
            Quick Add Items from Spreadsheet
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Plan Usage & Impact Banner */}
          <div className="p-3 rounded-lg border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-semibold text-foreground">Plan usage: </span>
              <span className="text-muted-foreground">
                {currentItemCount} of {totalItemLimit} items used
              </span>
            </div>
            {parsedRows.length > 0 && (
              <div className="font-medium">
                {exceedsLimit ? (
                  <span className="text-destructive font-bold">
                    Importing {parsedRows.length} items would reach {projectedCount} of{" "}
                    {totalItemLimit} (exceeds limit!)
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Importing {parsedRows.length} items will reach {projectedCount} of{" "}
                    {totalItemLimit}
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Paste rows from Excel, Google Sheets, TSV, CSV, or pipe-separated (Category | Name |
              Price | Type):
            </label>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Starters	Paneer Tikka	250	Veg&#10;Starters | Chicken Wings | 320 | Non-Veg&#10;Beverages, Filter Coffee, 40, Veg"
              rows={4}
              className="w-full text-xs font-mono p-3 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
            />
          </div>

          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold">
                  Preview ({validRows.length} valid / {parsedRows.length} total)
                </span>
                {hasErrors && (
                  <span className="text-xs text-destructive flex items-center gap-1 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    All rows must be valid. Import creates nothing if any row fails.
                  </span>
                )}
              </div>

              <div className="border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground font-semibold sticky top-0">
                    <tr>
                      <th className="p-2 w-8">#</th>
                      <th className="p-2">Category</th>
                      <th className="p-2">Item Name</th>
                      <th className="p-2">Price</th>
                      <th className="p-2">Food Type</th>
                      <th className="p-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedRows.map((r) => (
                      <tr
                        key={r.index}
                        className={r.isValid ? "bg-background" : "bg-destructive/10"}
                      >
                        <td className="p-2 text-muted-foreground">{r.index}</td>
                        <td className="p-2 font-medium">{r.category}</td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2 font-mono">{formatPaise(r.pricePaise)}</td>
                        <td className="p-2">
                          <FoodTypeBadge type={r.foodType} />
                        </td>
                        <td className="p-2 text-right">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive font-medium">
                              <AlertCircle className="w-3.5 h-3.5" /> {r.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedRows.length === 0 || hasErrors || exceedsLimit || isLoading}
            className="bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-semibold"
          >
            {isLoading ? "Importing..." : `Import ${validRows.length} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
