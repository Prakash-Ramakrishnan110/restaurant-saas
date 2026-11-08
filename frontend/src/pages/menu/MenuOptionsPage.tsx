import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal, Plus, Trash2, X, UtensilsCrossed } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { formatRupees, parseRupees } from "../../utils/currency";

interface OptionItem {
  id?: string;
  name: string;
  name_ta?: string;
  price_delta_paise: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

interface OptionGroup {
  id: string;
  name: string;
  name_ta?: string;
  min_select: number;
  max_select: number;
  sort_order: number;
  is_active: boolean;
  options: OptionItem[];
}

export const MenuOptionsPage: React.FC = () => {
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formNameTa, setFormNameTa] = useState("");
  const [formMinSelect, setFormMinSelect] = useState(0);
  const [formMaxSelect, setFormMaxSelect] = useState(1);
  const [formOptions, setFormOptions] = useState<
    Array<{ name: string; name_ta: string; price_text: string; is_default: boolean }>
  >([
    { name: "Regular", name_ta: "", price_text: "0", is_default: true },
    { name: "Large", name_ta: "", price_text: "20", is_default: false },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOptionGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ListResponse<OptionGroup>>("/menu/option-groups/");
      const list = unwrapList<OptionGroup>(res.data);
      setGroups(list);
    } catch {
      setError("Failed to load option groups. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOptionGroups();
  }, []);

  const openCreateModal = () => {
    setEditingGroupId(null);
    setFormName("");
    setFormNameTa("");
    setFormMinSelect(0);
    setFormMaxSelect(1);
    setFormOptions([
      { name: "Mild", name_ta: "குறைவான காரம்", price_text: "0", is_default: true },
      { name: "Medium", name_ta: "நடுத்தர காரம்", price_text: "0", is_default: false },
      { name: "Spicy", name_ta: "அதிக காரம்", price_text: "0", is_default: false },
    ]);
    setIsModalOpen(true);
  };

  const handleAddOptionRow = () => {
    setFormOptions((prev) => [
      ...prev,
      { name: "", name_ta: "", price_text: "0", is_default: false },
    ]);
  };

  const handleRemoveOptionRow = (index: number) => {
    setFormOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: formName.trim(),
      name_ta: formNameTa.trim(),
      min_select: formMinSelect,
      max_select: formMaxSelect,
      sort_order: 0,
      is_active: true,
      options: formOptions
        .filter((opt) => opt.name.trim().length > 0)
        .map((opt, idx) => ({
          name: opt.name.trim(),
          name_ta: opt.name_ta.trim(),
          price_delta_paise: parseRupees(opt.price_text),
          is_default: opt.is_default,
          is_active: true,
          sort_order: idx,
        })),
    };

    try {
      if (editingGroupId) {
        await apiClient.put(`/menu/option-groups/${editingGroupId}/`, payload);
      } else {
        await apiClient.post("/menu/option-groups/", payload);
      }
      setIsModalOpen(false);
      fetchOptionGroups();
    } catch {
      setError("Failed to save option group. Please check required fields.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete modifier group "${name}"?`)) return;
    try {
      await apiClient.delete(`/menu/option-groups/${id}/`);
      fetchOptionGroups();
    } catch {
      alert("Failed to delete option group.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-primary" />
            Add-ons & Options{" "}
            <span className="text-xs text-muted-foreground font-normal">கூடுதல் தேர்வுகள்</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure modifier groups (spice levels, portion sizes, add-ons) and extra charges in
            integer paise.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/menu">
            <Button variant="outline" size="sm" className="gap-2">
              <UtensilsCrossed className="w-4 h-4" />
              Menu Items
            </Button>
          </Link>
          <Button size="sm" className="gap-2" onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            New Option Group
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {/* Option Groups Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">No Option Groups Defined</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Option groups let your guests customize dishes with spice levels, beverage sizes, or
              extra cheese.
            </p>
            <Button size="sm" onClick={openCreateModal} className="mt-2">
              Create First Group
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((grp) => (
            <Card key={grp.id} className="flex flex-col justify-between shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">
                      {grp.name}
                    </CardTitle>
                    {grp.name_ta && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {grp.name_ta}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteGroup(grp.id, grp.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <CardDescription className="text-xs">
                  {grp.min_select === 0 ? "Optional" : `Min: ${grp.min_select}`} • Max:{" "}
                  {grp.max_select} selection(s)
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5 border-t pt-2">
                  {grp.options && grp.options.length > 0 ? (
                    grp.options.map((opt) => (
                      <div
                        key={opt.name}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/50"
                      >
                        <div className="flex items-center gap-1.5">
                          {opt.is_default && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                          <span className="font-semibold text-foreground">{opt.name}</span>
                          {opt.name_ta && (
                            <span className="text-muted-foreground">({opt.name_ta})</span>
                          )}
                        </div>
                        <span className="font-mono font-medium text-foreground">
                          {opt.price_delta_paise > 0
                            ? `+${formatRupees(opt.price_delta_paise)}`
                            : "Free"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      No choices configured
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingGroupId ? "Edit Option Group" : "Create Option Group"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Define custom choices and optional price deltas
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmitGroup} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Group Name (English)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Spice Level"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Tamil Name (தமிழ்)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. கார நிலை"
                      value={formNameTa}
                      onChange={(e) => setFormNameTa(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground">Min Selection</label>
                    <input
                      type="number"
                      min={0}
                      value={formMinSelect}
                      onChange={(e) => setFormMinSelect(parseInt(e.target.value) || 0)}
                      className="w-full mt-1 px-3 py-1.5 text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[10px] text-muted-foreground">0 = Optional choice</span>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground">Max Selection</label>
                    <input
                      type="number"
                      min={1}
                      value={formMaxSelect}
                      onChange={(e) => setFormMaxSelect(parseInt(e.target.value) || 1)}
                      className="w-full mt-1 px-3 py-1.5 text-xs border rounded-md bg-background focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      1 = Single choice radio
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Modifier Choices (விருப்பங்கள்)
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-primary"
                      onClick={handleAddOptionRow}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Choice
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {formOptions.map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-muted/30 p-2 rounded-md border"
                      >
                        <input
                          type="text"
                          placeholder="Name"
                          value={opt.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormOptions((prev) =>
                              prev.map((o, i) => (i === idx ? { ...o, name: val } : o))
                            );
                          }}
                          className="flex-1 px-2 py-1 text-xs border rounded bg-background"
                          required
                        />
                        <input
                          type="text"
                          placeholder="₹ Extra"
                          value={opt.price_text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormOptions((prev) =>
                              prev.map((o, i) => (i === idx ? { ...o, price_text: val } : o))
                            );
                          }}
                          className="w-20 px-2 py-1 text-xs border rounded bg-background font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveOptionRow(idx)}
                          className="p-1 text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t flex justify-end gap-2 bg-muted/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Option Group"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
