import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  X,
  WifiOff,
  AlertCircle,
  Lock,
  Sparkles,
  Trash2,
} from "lucide-react";
import { publicQrApi, PublicQRMenuResponse, PublicMenuItem, FoodType } from "../../api/publicQr";
import { formatRupees } from "../../utils/currency";
import { evaluateBrandColor } from "../../lib/colorUtils";
import {
  PUBLIC_QR_COPY,
  CustomerLang,
  pickLocalized,
  getCustomerInitialLang,
} from "./publicQrStrings";

interface StoredCartItem {
  menu_item_id: string;
  variant_id: string | null;
  option_ids: string[];
  quantity: number;
  notes: string;
}

interface StoredCart {
  items: StoredCartItem[];
  notes: string;
}

function getCartStorageKey(token: string): string {
  return `smf_qr_cart_${token}`;
}

function readCartFromSession(token: string): StoredCart {
  try {
    const raw = sessionStorage.getItem(getCartStorageKey(token));
    if (!raw) return { items: [], notes: "" };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) return { items: [], notes: "" };
    return {
      items: parsed.items.map((it: any) => ({
        menu_item_id: String(it.menu_item_id || ""),
        variant_id: it.variant_id ? String(it.variant_id) : null,
        option_ids: Array.isArray(it.option_ids) ? it.option_ids.map(String) : [],
        quantity: Math.max(1, Math.min(10, Number(it.quantity) || 1)),
        notes: typeof it.notes === "string" ? it.notes.slice(0, 200) : "",
      })),
      notes: typeof parsed.notes === "string" ? parsed.notes.slice(0, 300) : "",
    };
  } catch {
    return { items: [], notes: "" };
  }
}

function writeCartToSession(token: string, cart: StoredCart): void {
  try {
    sessionStorage.setItem(getCartStorageKey(token), JSON.stringify(cart));
  } catch {
    // Ignore storage quota errors
  }
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `qr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function FoodTypeBadge({ foodType, lang }: { foodType: FoodType; lang: CustomerLang }) {
  const copy = PUBLIC_QR_COPY[lang];
  const isNonVeg = foodType === "NON_VEG";
  const isEgg = foodType === "EGG";
  const label = isNonVeg ? copy.nonVeg : isEgg ? copy.egg : copy.veg;
  const borderClass = isNonVeg
    ? "border-red-600 text-red-700 dark:text-red-400"
    : isEgg
      ? "border-amber-600 text-amber-800 dark:text-amber-300"
      : "border-emerald-700 text-emerald-800 dark:text-emerald-300";
  const dotClass = isNonVeg ? "bg-red-600" : isEgg ? "bg-amber-600" : "bg-emerald-700";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center w-4 h-4 rounded-sm border ${borderClass}`}
      >
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
      </span>
      <span className={borderClass.split(" ").slice(1).join(" ")}>{label}</span>
    </span>
  );
}

export const PublicQRPage: React.FC = () => {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [lang, setLang] = useState<CustomerLang>(() => getCustomerInitialLang());
  const [menu, setMenu] = useState<PublicQRMenuResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [invalidQR, setInvalidQR] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("ALL");
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  // Cart persisted in sessionStorage (item ids & quantities only)
  const [cart, setCart] = useState<StoredCart>(() => readCartFromSession(token));
  // Signed table session token kept strictly in React memory (never localStorage/sessionStorage)
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  // Item customization bottom sheet
  const [sheetItem, setSheetItem] = useState<PublicMenuItem | null>(null);
  const [sheetVariantId, setSheetVariantId] = useState<string | null>(null);
  const [sheetOptionIds, setSheetOptionIds] = useState<string[]>([]);
  const [sheetQty, setSheetQty] = useState<number>(1);
  const [sheetNote, setSheetNote] = useState<string>("");
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Cart sheet & submission state
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [staffRequiredBanner, setStaffRequiredBanner] = useState<boolean>(false);
  const idempotencyKeyRef = useRef<string>(generateIdempotencyKey());

  const copy = PUBLIC_QR_COPY[lang];

  // Offline listener
  useEffect(() => {
    const onOffline = () => setIsOffline(true);
    const onOnline = () => setIsOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  // Load cart when token changes
  useEffect(() => {
    setCart(readCartFromSession(token));
  }, [token]);

  // Persist cart to sessionStorage
  useEffect(() => {
    if (token) {
      writeCartToSession(token, cart);
    }
  }, [token, cart]);

  const fetchMenu = useCallback(async () => {
    if (!token) {
      setInvalidQR(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await publicQrApi.getMenu(token);
      setMenu(res.data);
      setInvalidQR(false);
      setLoadError(false);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setInvalidQR(true);
      } else {
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Contrast-checked brand primary colors (never white on #FF6A00)
  const brandTheme = useMemo(() => {
    const raw = menu?.brand_primary_color || "#FF6A00";
    const check = evaluateBrandColor(raw);
    if (check.isValidHex && check.passesThreshold) {
      const bg = raw.startsWith("#") ? raw.toUpperCase() : `#${raw.toUpperCase()}`;
      return {
        bg,
        text: check.recommendedTextHex,
      };
    }
    return {
      bg: "#FF6A00",
      text: "#0B1F3B",
    };
  }, [menu?.brand_primary_color]);

  // Lookup map for computing estimate prices from live menu
  const itemLookup = useMemo(() => {
    const map = new Map<string, PublicMenuItem>();
    menu?.categories.forEach((cat) => {
      cat.items.forEach((it) => map.set(it.id, it));
    });
    return map;
  }, [menu]);

  const computeCartLinePaise = useCallback(
    (line: StoredCartItem): number => {
      const item = itemLookup.get(line.menu_item_id);
      if (!item) return 0;
      let unitPaise = item.price_paise;
      if (line.variant_id && item.variants.length > 0) {
        const variant = item.variants.find((v) => v.id === line.variant_id);
        if (variant) unitPaise = variant.price_paise;
      }
      if (line.option_ids.length > 0 && item.option_groups.length > 0) {
        const optSet = new Set(line.option_ids);
        item.option_groups.forEach((grp) => {
          grp.options.forEach((opt) => {
            if (optSet.has(opt.id)) {
              unitPaise += opt.price_delta_paise;
            }
          });
        });
      }
      return unitPaise * line.quantity;
    },
    [itemLookup]
  );

  const cartEstimatePaise = useMemo(
    () => cart.items.reduce((sum, it) => sum + computeCartLinePaise(it), 0),
    [cart.items, computeCartLinePaise]
  );

  const totalCartCount = useMemo(
    () => cart.items.reduce((sum, it) => sum + it.quantity, 0),
    [cart.items]
  );

  const visibleCategories = useMemo(() => {
    if (!menu) return [];
    const q = searchQuery.trim().toLowerCase();
    return menu.categories
      .map((cat) => {
        const items = q
          ? cat.items.filter(
              (it) =>
                it.name.toLowerCase().includes(q) ||
                (it.name_ta && it.name_ta.toLowerCase().includes(q)) ||
                (it.description && it.description.toLowerCase().includes(q)) ||
                (it.description_ta && it.description_ta.toLowerCase().includes(q))
            )
          : cat.items;
        return { ...cat, items };
      })
      .filter((cat) => cat.items.length > 0);
  }, [menu, searchQuery]);

  const displayedCategories = useMemo(() => {
    if (activeCategoryId === "ALL") return visibleCategories;
    return visibleCategories.filter((c) => c.id === activeCategoryId);
  }, [visibleCategories, activeCategoryId]);

  const resetIdempotencyKey = () => {
    idempotencyKeyRef.current = generateIdempotencyKey();
  };

  const openItemSheet = (item: PublicMenuItem) => {
    if (!item.is_available || menu?.ordering_mode === "BROWSE_ONLY") return;
    const defaultVariant = item.variants.find((v) => v.is_default) || item.variants[0] || null;
    const defaultOptionIds: string[] = [];
    item.option_groups.forEach((grp) => {
      grp.options.forEach((opt) => {
        if (opt.is_default) defaultOptionIds.push(opt.id);
      });
    });
    setSheetItem(item);
    setSheetVariantId(defaultVariant ? defaultVariant.id : null);
    setSheetOptionIds(defaultOptionIds);
    setSheetQty(1);
    setSheetNote("");
    setSheetError(null);
  };

  const handleQuickAdd = (item: PublicMenuItem) => {
    if (!item.is_available || menu?.ordering_mode === "BROWSE_ONLY") return;
    if (item.variants.length > 0 || item.option_groups.length > 0) {
      openItemSheet(item);
      return;
    }
    resetIdempotencyKey();
    setCart((prev) => {
      const idx = prev.items.findIndex(
        (it) =>
          it.menu_item_id === item.id &&
          it.variant_id === null &&
          it.option_ids.length === 0 &&
          !it.notes
      );
      if (idx >= 0) {
        const next = [...prev.items];
        next[idx] = { ...next[idx], quantity: Math.min(10, next[idx].quantity + 1) };
        return { ...prev, items: next };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            menu_item_id: item.id,
            variant_id: null,
            option_ids: [],
            quantity: 1,
            notes: "",
          },
        ],
      };
    });
  };

  const handleToggleOption = (groupId: string, optionId: string, maxSelect: number) => {
    if (!sheetItem) return;
    const group = sheetItem.option_groups.find((g) => g.id === groupId);
    if (!group) return;
    const groupOptionIds = new Set(group.options.map((o) => o.id));

    setSheetOptionIds((prev) => {
      const others = prev.filter((id) => !groupOptionIds.has(id));
      const inGroup = prev.filter((id) => groupOptionIds.has(id));
      if (inGroup.includes(optionId)) {
        return [...others, ...inGroup.filter((id) => id !== optionId)];
      }
      if (maxSelect === 1) {
        return [...others, optionId];
      }
      if (inGroup.length >= maxSelect) {
        return [...others, ...inGroup.slice(1), optionId];
      }
      return [...others, ...inGroup, optionId];
    });
    setSheetError(null);
  };

  const sheetEstimatePaise = useMemo(() => {
    if (!sheetItem) return 0;
    return computeCartLinePaise({
      menu_item_id: sheetItem.id,
      variant_id: sheetVariantId,
      option_ids: sheetOptionIds,
      quantity: sheetQty,
      notes: sheetNote,
    });
  }, [sheetItem, sheetVariantId, sheetOptionIds, sheetQty, sheetNote, computeCartLinePaise]);

  const handleConfirmSheet = () => {
    if (!sheetItem) return;
    for (const grp of sheetItem.option_groups) {
      const groupOptSet = new Set(grp.options.map((o) => o.id));
      const count = sheetOptionIds.filter((id) => groupOptSet.has(id)).length;
      if (count < grp.min_select) {
        setSheetError(
          copy.minSelectionError(pickLocalized(grp.name, grp.name_ta, lang), grp.min_select)
        );
        return;
      }
    }

    const sortedOpts = [...sheetOptionIds].sort();
    resetIdempotencyKey();
    setCart((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          menu_item_id: sheetItem.id,
          variant_id: sheetVariantId,
          option_ids: sortedOpts,
          quantity: sheetQty,
          notes: sheetNote.trim().slice(0, 200),
        },
      ],
    }));
    setSheetItem(null);
  };

  const updateCartItemQty = (index: number, delta: number) => {
    resetIdempotencyKey();
    setCart((prev) => {
      const next = [...prev.items];
      const item = next[index];
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        next.splice(index, 1);
      } else {
        next[index] = { ...item, quantity: Math.min(10, newQty) };
      }
      return { ...prev, items: next };
    });
  };

  const handlePlaceOrder = async () => {
    if (!menu || cart.items.length === 0 || submitting) return;
    setSubmitting(true);
    setOrderError(null);
    setStaffRequiredBanner(false);

    try {
      let activeToken = sessionToken;
      if (menu.target_type === "TABLE" && !activeToken) {
        if (menu.session_policy === "STAFF_ONLY" && !menu.active_session_open) {
          setStaffRequiredBanner(true);
          setSubmitting(false);
          return;
        }
        if (menu.session_policy === "CUSTOMER_CAN_OPEN") {
          const sessRes = await publicQrApi.openSession(token, 1);
          activeToken = sessRes.data.session_token;
          setSessionToken(activeToken);
        }
      }

      const res = await publicQrApi.createOrder(
        token,
        {
          items: cart.items,
          notes: cart.notes.trim().slice(0, 300),
          ...(activeToken ? { session_token: activeToken } : {}),
        },
        idempotencyKeyRef.current
      );

      // Clear cart from sessionStorage and navigate to tracker
      setCart({ items: [], notes: "" });
      try {
        sessionStorage.removeItem(getCartStorageKey(token));
      } catch {
        // Ignore
      }
      setCartOpen(false);
      navigate(`/q/${encodeURIComponent(token)}/o/${encodeURIComponent(res.data.tracking_token)}`);
    } catch (err: any) {
      const code = err?.response?.data?.error?.code || err?.response?.data?.code;
      const msg = err?.response?.data?.error?.message || err?.response?.data?.detail;
      if (code === "STAFF_ACTION_REQUIRED") {
        setStaffRequiredBanner(true);
        setOrderError(copy.staffRequiredBody);
      } else if (code === "ITEM_UNAVAILABLE") {
        setOrderError(copy.soldOutError);
        fetchMenu();
      } else if (code === "TOO_MANY_OPEN_ORDERS" || err?.response?.status === 429) {
        setOrderError(copy.tooManyBody);
      } else {
        setOrderError(msg || copy.genericOrderError);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatTargetBadge = (data: PublicQRMenuResponse) => {
    if (data.target_type === "ROOM") return copy.roomLabel(data.target_label);
    if (data.target_type === "COUNTER") return copy.counterLabel(data.target_label);
    return copy.tableLabel(data.target_label);
  };

  const formatGroupRule = (minSelect: number, maxSelect: number) => {
    if (minSelect > 0 && minSelect === maxSelect) return copy.chooseExactly(minSelect);
    if (minSelect > 0 && maxSelect > minSelect) return copy.chooseBetween(minSelect, maxSelect);
    if (minSelect === 0 && maxSelect > 0) return copy.chooseUpTo(maxSelect);
    return copy.optional;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-8 h-8 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin motion-reduce:animate-none" />
        </main>
      </div>
    );
  }

  if (invalidQR) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-xl font-extrabold">{copy.invalidTitle}</h1>
          <p className="text-sm text-muted-foreground">{copy.invalidBody}</p>
          <button
            type="button"
            onClick={() => setLang((p) => (p === "en" ? "ta" : "en"))}
            className="min-h-[56px] px-6 rounded-xl border border-border bg-card font-bold text-sm"
          >
            {copy.langToggleLabel}
          </button>
        </main>
        <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
          {copy.poweredBy}
        </footer>
      </div>
    );
  }

  if (loadError || !menu) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-extrabold">{copy.invalidTitle}</h1>
          <button
            type="button"
            onClick={fetchMenu}
            className="min-h-[56px] px-6 rounded-xl font-bold text-base"
            style={{ backgroundColor: brandTheme.bg, color: brandTheme.text }}
          >
            {copy.retry}
          </button>
        </main>
        <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
          {copy.poweredBy}
        </footer>
      </div>
    );
  }

  if (menu.ordering_mode === "DISABLED") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="bg-[#0B1F3B] text-white px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-base truncate">{menu.display_name}</span>
          <button
            type="button"
            onClick={() => setLang((p) => (p === "en" ? "ta" : "en"))}
            className="min-h-[44px] px-3.5 rounded-lg bg-white/15 text-white text-xs font-bold"
          >
            {copy.langToggleLabel}
          </button>
        </header>
        <main className="flex-1 max-w-md w-full mx-auto px-4 py-12 flex flex-col items-center justify-center text-center space-y-4">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <h1 className="text-xl font-extrabold">{copy.disabledTitle}</h1>
          <p className="text-sm text-muted-foreground">{copy.disabledBody}</p>
        </main>
        <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
          {copy.poweredBy}
        </footer>
      </div>
    );
  }

  const isBrowseOnly = menu.ordering_mode === "BROWSE_ONLY";
  const isStaffBlocked =
    menu.target_type === "TABLE" &&
    menu.session_policy === "STAFF_ONLY" &&
    !menu.active_session_open;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col pb-28">
      {/* Restaurant Header */}
      <header className="bg-[#0B1F3B] text-white px-4 py-3.5 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {menu.logo_url ? (
              <img
                src={menu.logo_url}
                alt={menu.display_name}
                className="w-11 h-11 rounded-xl object-cover bg-white shrink-0"
              />
            ) : (
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0"
                style={{ backgroundColor: brandTheme.bg, color: brandTheme.text }}
              >
                {getInitials(menu.display_name)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-extrabold text-base leading-tight truncate">
                {menu.display_name}
              </h1>
              <div className="flex items-center gap-2 mt-1 min-w-0">
                <span
                  className="inline-block px-2 py-0.5 rounded text-[11px] font-bold whitespace-nowrap shrink-0"
                  style={{ backgroundColor: brandTheme.bg, color: brandTheme.text }}
                >
                  {formatTargetBadge(menu)}
                </span>
                {menu.branch_name && (
                  <span className="text-xs text-white/80 truncate">{menu.branch_name}</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLang((p) => (p === "en" ? "ta" : "en"))}
            className="min-h-[44px] px-3.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold shrink-0"
          >
            {copy.langToggleLabel}
          </button>
        </div>
      </header>

      {/* Banners */}
      <div className="max-w-lg w-full mx-auto px-4 pt-3 space-y-2">
        {isOffline && (
          <div
            role="status"
            className="rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2"
          >
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>{copy.offlineBanner}</span>
          </div>
        )}

        {isBrowseOnly && (
          <div
            role="status"
            className="rounded-xl border border-border bg-muted/60 px-3.5 py-3 text-sm font-semibold text-foreground text-center"
          >
            {copy.browseOnlyNotice}
          </div>
        )}

        {(isStaffBlocked || staffRequiredBanner) && !isBrowseOnly && (
          <div
            role="status"
            className="rounded-xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 px-3.5 py-3 text-xs space-y-1"
          >
            <div className="font-bold text-foreground">{copy.staffRequiredTitle}</div>
            <div className="text-muted-foreground">{copy.staffRequiredBody}</div>
          </div>
        )}
      </div>

      {/* Sticky Search & Category Tabs */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border mt-2">
        <div className="max-w-lg mx-auto px-4 py-2.5 space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
              className="w-full min-h-[48px] pl-10 pr-4 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
            />
          </div>

          {visibleCategories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveCategoryId("ALL")}
                className={`h-9 px-4 rounded-full text-xs font-bold whitespace-nowrap border ${
                  activeCategoryId === "ALL"
                    ? "border-transparent shadow-sm"
                    : "bg-card text-foreground/80 border-border hover:text-foreground"
                }`}
                style={
                  activeCategoryId === "ALL"
                    ? { backgroundColor: brandTheme.bg, color: brandTheme.text }
                    : undefined
                }
              >
                {copy.allCategories}
              </button>
              {visibleCategories.map((cat) => {
                const selected = activeCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`h-9 px-4 rounded-full text-xs font-bold whitespace-nowrap border ${
                      selected
                        ? "border-transparent shadow-sm"
                        : "bg-card text-foreground/80 border-border hover:text-foreground"
                    }`}
                    style={
                      selected
                        ? { backgroundColor: brandTheme.bg, color: brandTheme.text }
                        : undefined
                    }
                  >
                    {pickLocalized(cat.name, cat.name_ta, lang)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Menu Sections */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-4 space-y-6">
        {displayedCategories.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {searchQuery.trim() ? copy.noResults : copy.emptyMenu}
          </div>
        ) : (
          displayedCategories.map((cat) => (
            <section key={cat.id} className="space-y-3">
              <h2 className="text-base font-extrabold text-foreground">
                {pickLocalized(cat.name, cat.name_ta, lang)}
              </h2>
              <div className="space-y-3">
                {cat.items.map((item) => {
                  const title = pickLocalized(item.name, item.name_ta, lang);
                  const desc = pickLocalized(item.description, item.description_ta, lang);
                  const imgUrl = item.image_thumb || item.image_card;
                  const canOrder = item.is_available && !isBrowseOnly && !isStaffBlocked;

                  return (
                    <article
                      key={item.id}
                      onClick={() => canOrder && openItemSheet(item)}
                      className={`rounded-2xl border border-border bg-card p-3.5 flex items-center justify-between gap-3.5 shadow-sm hover:border-[#FF6A00]/40 ${
                        !item.is_available ? "opacity-60 grayscale" : "cursor-pointer"
                      }`}
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <FoodTypeBadge foodType={item.food_type} lang={lang} />
                          {item.is_bestseller && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 text-[10px] font-bold">
                              <Sparkles className="h-2.5 w-2.5" />
                              {copy.bestseller}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-[15px] text-foreground leading-snug">
                          {title}
                        </h3>
                        {desc && (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {desc}
                          </p>
                        )}
                        <div className="pt-1 font-extrabold text-sm text-foreground">
                          {formatRupees(item.price_paise)}
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center shrink-0 w-[92px]">
                        {imgUrl && (
                          <img
                            src={imgUrl}
                            alt={title}
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                            className="w-[92px] h-[84px] rounded-xl object-cover bg-muted border border-border/50"
                          />
                        )}
                        {!item.is_available ? (
                          <span
                            className={`px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground text-[11px] font-bold whitespace-nowrap ${
                              imgUrl ? "-mt-3 relative z-10 border border-border shadow-xs" : ""
                            }`}
                          >
                            {copy.soldOut}
                          </span>
                        ) : !isBrowseOnly && !isStaffBlocked ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAdd(item);
                            }}
                            className={`h-9 min-w-[78px] px-3 rounded-lg font-bold text-xs shadow-sm flex items-center justify-center gap-1 whitespace-nowrap active:scale-95 transition-transform ${
                              imgUrl ? "-mt-3.5 relative z-10 ring-2 ring-card" : ""
                            }`}
                            style={{ backgroundColor: brandTheme.bg, color: brandTheme.text }}
                          >
                            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                            <span>{copy.add}</span>
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
        {copy.poweredBy}
      </footer>

      {/* Sticky Cart Bar */}
      {!isBrowseOnly && totalCartCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 p-3 bg-background/95 backdrop-blur border-t border-border">
          <div className="max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => {
                setOrderError(null);
                setCartOpen(true);
              }}
              className="w-full min-h-[56px] px-4 rounded-2xl shadow-lg flex items-center justify-between font-bold text-base"
              style={{ backgroundColor: brandTheme.bg, color: brandTheme.text }}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                <span>{copy.itemsInCart(totalCartCount)}</span>
              </span>
              <span>
                {copy.estimate}: {formatRupees(cartEstimatePaise)} • {copy.viewCart}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Item Customization Bottom Sheet */}
      {sheetItem && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={pickLocalized(sheetItem.name, sheetItem.name_ta, lang)}
        >
          <div className="w-full max-w-lg bg-card text-foreground rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <FoodTypeBadge foodType={sheetItem.food_type} lang={lang} />
                <h2 className="font-extrabold text-lg truncate mt-1">
                  {pickLocalized(sheetItem.name, sheetItem.name_ta, lang)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSheetItem(null)}
                aria-label={copy.close}
                className="min-w-[56px] min-h-[56px] flex items-center justify-center rounded-full hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Variants */}
              {sheetItem.variants.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{copy.sizeOrPortion}</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {copy.required}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {sheetItem.variants.map((v) => {
                      const selected = sheetVariantId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSheetVariantId(v.id)}
                          className={`w-full min-h-[56px] px-4 rounded-xl border flex items-center justify-between text-sm font-semibold ${
                            selected
                              ? "border-[#FF6A00] bg-orange-50/60 dark:bg-orange-950/30"
                              : "border-border bg-background"
                          }`}
                        >
                          <span>{pickLocalized(v.name, v.name_ta, lang)}</span>
                          <span>{formatRupees(v.price_paise)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Option Groups */}
              {sheetItem.option_groups.map((grp) => (
                <div key={grp.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">
                      {pickLocalized(grp.name, grp.name_ta, lang)}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {grp.min_select > 0 ? `${copy.required} • ` : ""}
                      {formatGroupRule(grp.min_select, grp.max_select)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {grp.options.map((opt) => {
                      const selected = sheetOptionIds.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleToggleOption(grp.id, opt.id, grp.max_select)}
                          className={`w-full min-h-[56px] px-4 rounded-xl border flex items-center justify-between text-sm font-semibold ${
                            selected
                              ? "border-[#FF6A00] bg-orange-50/60 dark:bg-orange-950/30"
                              : "border-border bg-background"
                          }`}
                        >
                          <span>{pickLocalized(opt.name, opt.name_ta, lang)}</span>
                          <span>
                            {opt.price_delta_paise > 0
                              ? `+${formatRupees(opt.price_delta_paise)}`
                              : "+₹0"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Line Note */}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold" htmlFor="sheet-note">
                  {copy.specialNote}
                </label>
                <input
                  id="sheet-note"
                  type="text"
                  maxLength={200}
                  value={sheetNote}
                  onChange={(e) => setSheetNote(e.target.value)}
                  placeholder={copy.notePlaceholder}
                  className="w-full min-h-[48px] px-3.5 rounded-xl border border-input bg-background text-sm"
                />
              </div>

              {sheetError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold"
                >
                  {sheetError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center gap-3">
              <div className="flex items-center border border-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setSheetQty((q) => Math.max(1, q - 1))}
                  className="min-w-[56px] min-h-[56px] flex items-center justify-center hover:bg-muted"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-extrabold text-base">{sheetQty}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setSheetQty((q) => Math.min(10, q + 1))}
                  className="min-w-[56px] min-h-[56px] flex items-center justify-center hover:bg-muted"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleConfirmSheet}
                className="flex-1 min-h-[56px] px-4 rounded-xl font-bold text-base flex items-center justify-center"
                style={{ backgroundColor: brandTheme.bg, color: brandTheme.text }}
              >
                {copy.addToCart} • {copy.estimate} {formatRupees(sheetEstimatePaise)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Sheet */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={copy.yourOrder}
        >
          <div className="w-full max-w-lg bg-card text-foreground rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-extrabold text-lg">{copy.yourOrder}</h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    resetIdempotencyKey();
                    setCart({ items: [], notes: "" });
                    setCartOpen(false);
                  }}
                  className="min-h-[56px] px-3 text-xs font-semibold text-muted-foreground hover:text-destructive flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>{copy.clearCart}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCartOpen(false)}
                  aria-label={copy.close}
                  className="min-w-[56px] min-h-[56px] flex items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {cart.items.map((line, idx) => {
                const item = itemLookup.get(line.menu_item_id);
                const variant =
                  line.variant_id && item
                    ? item.variants.find((v) => v.id === line.variant_id)
                    : null;
                const optNames: string[] = [];
                if (item && line.option_ids.length > 0) {
                  const set = new Set(line.option_ids);
                  item.option_groups.forEach((g) =>
                    g.options.forEach((o) => {
                      if (set.has(o.id)) optNames.push(pickLocalized(o.name, o.name_ta, lang));
                    })
                  );
                }

                return (
                  <div
                    key={`${line.menu_item_id}-${idx}`}
                    className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">
                        {item ? pickLocalized(item.name, item.name_ta, lang) : line.menu_item_id}
                        {variant ? ` (${pickLocalized(variant.name, variant.name_ta, lang)})` : ""}
                      </div>
                      {optNames.length > 0 && (
                        <div className="text-xs text-muted-foreground">{optNames.join(", ")}</div>
                      )}
                      {line.notes && (
                        <div className="text-xs text-muted-foreground italic">"{line.notes}"</div>
                      )}
                      <div className="text-xs font-bold mt-1">
                        {formatRupees(computeCartLinePaise(line))}
                      </div>
                    </div>

                    <div className="flex items-center border border-border rounded-xl overflow-hidden shrink-0">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => updateCartItemQty(idx, -1)}
                        className="min-w-[48px] min-h-[48px] flex items-center justify-center hover:bg-muted"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-7 text-center font-bold text-sm">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => updateCartItemQty(idx, 1)}
                        className="min-w-[48px] min-h-[48px] flex items-center justify-center hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1.5 pt-2">
                <label className="block text-sm font-bold" htmlFor="order-note">
                  {copy.orderNote}
                </label>
                <textarea
                  id="order-note"
                  rows={2}
                  maxLength={300}
                  value={cart.notes}
                  onChange={(e) => {
                    resetIdempotencyKey();
                    setCart((prev) => ({ ...prev, notes: e.target.value }));
                  }}
                  placeholder={copy.orderNotePlaceholder}
                  className="w-full p-3 rounded-xl border border-input bg-background text-sm"
                />
              </div>

              {orderError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold"
                >
                  {orderError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between text-base font-extrabold">
                <span>{copy.estimate}</span>
                <span>{formatRupees(cartEstimatePaise)}</span>
              </div>
              <button
                type="button"
                disabled={submitting || cart.items.length === 0 || isOffline}
                onClick={handlePlaceOrder}
                className="w-full min-h-[56px] rounded-2xl font-bold text-base disabled:opacity-50"
                style={{ backgroundColor: brandTheme.bg, color: brandTheme.text }}
              >
                {submitting ? copy.placingOrder : copy.placeOrder}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
