import React, { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Search, Upload, UtensilsCrossed } from "lucide-react";
import { apiClient } from "../../api/client";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

interface CatalogItem {
  id: string;
  item_code: string;
  name: string;
  name_ta: string;
  main_category: string;
  subcategory: string;
  cuisine: string;
  food_type: "VEG" | "NON_VEG" | "EGG";
  description: string;
  default_price_paise: number | null;
  image_card: string;
  image_thumb: string;
}

interface CatalogResponse {
  count: number;
  unique_image_count: number;
  categories: string[];
  results: CatalogItem[];
}

const PAGE_SIZE = 36;

export const PlatformCatalogPage: React.FC = () => {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [uniqueCount, setUniqueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [foodType, setFoodType] = useState("");
  const [uniqueOnly, setUniqueOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState<Record<string, number>>({});

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        offset,
      };
      if (query.trim()) params.q = query.trim();
      if (selectedCategory) params.category = selectedCategory;
      if (foodType) params.food_type = foodType;
      if (uniqueOnly) params.unique_only = "1";

      const res = await apiClient.get<CatalogResponse>("/menu/catalog/", { params });
      setItems(Array.isArray(res.data?.results) ? res.data.results : []);
      setCategories(Array.isArray(res.data?.categories) ? res.data.categories : []);
      setTotalCount(res.data?.count || 0);
      setUniqueCount(res.data?.unique_image_count || 0);
    } catch {
      setError(
        "Could not load food catalogue. Make sure the backend and PostgreSQL database are running."
      );
    } finally {
      setLoading(false);
    }
  }, [offset, query, selectedCategory, foodType, uniqueOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadCatalog();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadCatalog]);

  const handleImageUpload = async (itemId: string, file: File) => {
    setUploadingId(itemId);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await apiClient.post<CatalogItem>(`/menu/catalog/${itemId}/upload-image/`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setItems((prev) => prev.map((it) => (it.id === itemId ? res.data : it)));
      setCacheBust((prev) => ({ ...prev, [itemId]: Date.now() }));
    } finally {
      setUploadingId(null);
    }
  };

  const foodBadge = (ft: CatalogItem["food_type"]) => {
    if (ft === "VEG") {
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">VEG</Badge>;
    }
    if (ft === "EGG") {
      return <Badge className="bg-amber-50 text-amber-700 border-amber-200">EGG</Badge>;
    }
    return <Badge className="bg-rose-50 text-rose-700 border-rose-200">NON-VEG</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            Master Food Catalogue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount.toLocaleString()} items shown · {uniqueCount.toLocaleString()} with unique
            dish photos
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setOffset(0);
                setQuery(e.target.value);
              }}
              placeholder="Search dish, Tamil name, code..."
              className="w-full h-10 pl-9 pr-3 rounded-md border bg-background text-sm"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => {
              setOffset(0);
              setSelectedCategory(e.target.value);
            }}
            className="h-10 px-3 rounded-md border bg-background text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={foodType}
            onChange={(e) => {
              setOffset(0);
              setFoodType(e.target.value);
            }}
            className="h-10 px-3 rounded-md border bg-background text-sm"
          >
            <option value="">All Food Types</option>
            <option value="VEG">Vegetarian (VEG)</option>
            <option value="NON_VEG">Non-Vegetarian (NON_VEG)</option>
            <option value="EGG">Contains Egg (EGG)</option>
          </select>

          <label className="flex items-center gap-2 text-sm px-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={uniqueOnly}
              onChange={(e) => {
                setOffset(0);
                setUniqueOnly(e.target.checked);
              }}
              className="h-4 w-4 rounded border"
            />
            <span>Unique dish photos only</span>
          </label>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="py-12 text-center text-destructive">{error}</CardContent>
        </Card>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="h-72 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No food items match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => {
            const bust = cacheBust[item.id] ? `?v=${cacheBust[item.id]}` : "";
            const isUnique = item.image_card.includes(`/${item.item_code}_card.webp`);
            return (
              <Card key={item.id} className="overflow-hidden flex flex-col">
                <div className="relative aspect-[4/3] bg-muted flex items-center justify-center">
                  {item.image_card ? (
                    <img
                      src={`${item.image_card}${bust}`}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground/60">
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-xs">No photo</span>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[11px] font-mono text-white">
                    {item.item_code}
                  </span>
                  <span
                    className={`absolute top-2 right-2 rounded px-2 py-0.5 text-[11px] font-medium ${
                      isUnique
                        ? "bg-emerald-600 text-white"
                        : item.image_card
                          ? "bg-slate-800/80 text-white"
                          : "bg-muted-foreground/70 text-white"
                    }`}
                  >
                    {isUnique ? "Unique photo" : item.image_card ? "Category photo" : "No photo"}
                  </span>
                </div>
                <CardContent className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-base leading-snug">{item.name}</h2>
                      {foodBadge(item.food_type)}
                    </div>
                    {item.name_ta && (
                      <p className="text-xs text-muted-foreground font-medium">{item.name_ta}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {item.main_category}
                      {item.subcategory ? ` · ${item.subcategory}` : ""}
                    </p>
                    <p className="text-xs text-foreground/80 line-clamp-2">{item.description}</p>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {item.default_price_paise
                        ? `₹${Math.round(item.default_price_paise / 100)}`
                        : "Set price"}
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border hover:bg-muted cursor-pointer">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{uploadingId === item.id ? "Uploading..." : "Replace photo"}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={uploadingId === item.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void handleImageUpload(item.id, f);
                        }}
                      />
                    </label>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <Button
            variant="outline"
            disabled={offset + PAGE_SIZE >= totalCount}
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};
