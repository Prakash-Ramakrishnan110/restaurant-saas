import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Utensils,
  Plus,
  Minus,
  Send,
  Receipt,
  Search,
  Bell,
  CheckCircle2,
  Layers,
  ArrowRightLeft,
  Users,
  Zap,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { ordersApi, OrderItemPayload, ServiceRequest } from "../../api/orders";
import { unwrapList } from "../../api/pagination";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";
import { formatRupees } from "../../utils/currency";

interface DiningTableItem {
  id: string;
  label: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "BILLING" | "DIRTY";
  section?: { name: string };
  sessions?: { id: string; status: string; guest_count: number }[];
}

interface MenuItemData {
  id: string;
  name: string;
  name_ta?: string;
  category: { id: string; name: string };
  base_price_paise: number;
  food_type: "VEG" | "NON_VEG" | "EGG" | "VEGAN";
  is_active: boolean;
  prep_minutes?: number;
}

interface CartItem extends OrderItemPayload {
  id: string;
  name: string;
  unit_price_paise: number;
  course: "STARTER" | "MAIN" | "DESSERT" | "BEVERAGE";
}

export const FloorPOSPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeTenant } = useAuth();

  const usesTables = useMemo(() => {
    const tenant = activeTenant as
      | (typeof activeTenant & {
          uses_tables?: boolean;
          business_type?: string;
          venue_profile?: string;
        })
      | null;
    if (!tenant) return true;
    return !(
      tenant.uses_tables === false ||
      tenant.business_type === "TEA_SHOP" ||
      tenant.venue_profile === "QUICK_SERVICE" ||
      tenant.business_type === "FOOD_COURT"
    );
  }, [activeTenant]);

  // Data states
  const [tables, setTables] = useState<DiningTableItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);

  // Selection states
  const [selectedTable, setSelectedTable] = useState<DiningTableItem | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [counterToken, setCounterToken] = useState<number>(101);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFoodType, setSelectedFoodType] = useState<string>("ALL");

  // Cart & Pacing
  const [cart, setCart] = useState<CartItem[]>([]);
  const [holdMains] = useState<boolean>(false);
  const [orderNotes, setOrderNotes] = useState<string>("");

  // Modals
  const [seatModalOpen, setSeatModalOpen] = useState<boolean>(false);
  const [guestCount, setGuestCount] = useState<number>(2);
  const [transferModalOpen, setTransferModalOpen] = useState<boolean>(false);
  const [targetTableId, setTargetTableId] = useState<string>("");

  // Loading & Notification states
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const handleSelectTable = (tbl: DiningTableItem, sessionList?: any[]) => {
    setSelectedTable(tbl);
    const sessions = sessionList || activeSessions;
    // Look up active open session
    const openSess = sessions.find((s: any) => s.table?.id === tbl.id && s.status === "OPEN");
    if (openSess) {
      setSelectedSessionId(openSess.id);
    } else {
      setSelectedSessionId(null);
      if (tbl.status === "AVAILABLE") {
        setGuestCount(tbl.capacity || 2);
        setSeatModalOpen(true);
      }
    }
  };

  // Fetch initial floor data
  const fetchData = async () => {
    if (!activeTenant) return;
    try {
      const [tblRes, catRes, itemRes, sessRes, srvRes, availRes] = await Promise.all([
        usesTables ? apiClient.get<any>("/tables/") : Promise.resolve({ data: [] }),
        apiClient.get<any>("/menu/categories/"),
        apiClient.get<any>("/menu/items/"),
        apiClient.get<any>("/sessions/").catch(() => ({ data: [] })),
        ordersApi.getServiceRequests("PENDING").catch(() => ({ data: [] })),
        apiClient.get<any>("/menu/availability/").catch(() => ({ data: [] })),
      ]);

      const tblData = tblRes.data?.results || tblRes.data || [];
      const sessData = sessRes.data?.results || sessRes.data || [];
      setTables(tblData);
      setCategories(catRes.data?.results || catRes.data || []);
      setMenuItems(itemRes.data?.results || itemRes.data || []);
      setActiveSessions(sessData);
      setServiceRequests(srvRes.data || []);

      const availList = availRes.data?.results || availRes.data || [];
      const aMap: Record<string, boolean> = {};
      availList.forEach((a: any) => {
        aMap[a.item_id || a.item?.id] = a.is_available;
      });
      setAvailabilityMap(aMap);

      // If preselected table in URL
      const preselect = searchParams.get("table");
      if (preselect && tblData.length > 0) {
        const found = tblData.find(
          (t: DiningTableItem) => t.id === preselect || t.label === preselect
        );
        if (found) handleSelectTable(found, sessData);
      }
    } catch {
      setErrorToast("Failed to load live floor operations.");
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      ordersApi
        .getServiceRequests("PENDING")
        .then((res) => {
          setServiceRequests(unwrapList<ServiceRequest>(res.data));
        })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTenant?.tenant_id, usesTables]);

  const handleSeatGuests = async () => {
    if (!selectedTable) return;
    setSubmitting(true);
    try {
      const res = await apiClient.post<any>("/sessions/", {
        table_id: selectedTable.id,
        guest_count: guestCount,
      });
      setSelectedSessionId(res.data.id);
      setSeatModalOpen(false);
      setSuccessToast(`Table ${selectedTable.label} seated with ${guestCount} guests.`);
      await fetchData();
    } catch {
      setErrorToast("Could not seat guests at this table.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransferTable = async () => {
    if (!selectedSessionId || !targetTableId) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/sessions/${selectedSessionId}/transfer/`, {
        new_table_id: targetTableId,
      });
      setTransferModalOpen(false);
      setSuccessToast("Table session successfully transferred.");
      await fetchData();
    } catch {
      setErrorToast("Could not transfer table session.");
    } finally {
      setSubmitting(false);
    }
  };

  const addToCart = (item: MenuItemData) => {
    const isAvail = availabilityMap[item.id] !== false && item.is_active;
    if (!isAvail) {
      setErrorToast(`'${item.name}' is sold out.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.menu_item_id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menu_item_id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: item.id,
          menu_item_id: item.id,
          name: item.name,
          unit_price_paise: item.base_price_paise,
          quantity: 1,
          course: "MAIN",
          notes: "",
        },
      ];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(
      (prev) =>
        prev
          .map((i) => {
            if (i.menu_item_id === itemId) {
              const newQty = i.quantity + delta;
              return newQty > 0 ? { ...i, quantity: newQty } : null;
            }
            return i;
          })
          .filter(Boolean) as CartItem[]
    );
  };

  const updateCourse = (itemId: string, course: "STARTER" | "MAIN" | "DESSERT" | "BEVERAGE") => {
    setCart((prev) => prev.map((i) => (i.menu_item_id === itemId ? { ...i, course } : i)));
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    setCart((prev) => prev.map((i) => (i.menu_item_id === itemId ? { ...i, notes } : i)));
  };

  const cartTotalPaise = useMemo(
    () => cart.reduce((sum, item) => sum + item.unit_price_paise * item.quantity, 0),
    [cart]
  );

  const handleFireOrder = async () => {
    if (cart.length === 0) return;
    if (usesTables && !selectedSessionId) {
      setErrorToast("Please select and seat an active table first.");
      return;
    }

    setSubmitting(true);
    try {
      const itemsPayload = cart.map((i) => ({
        menu_item_id: i.menu_item_id,
        quantity: i.quantity,
        course: i.course,
        is_fired: !(holdMains && i.course === "MAIN"),
        notes: i.notes,
      }));

      await ordersApi.createOrder({
        table_session_id: usesTables ? selectedSessionId : null,
        token_number: !usesTables ? counterToken : null,
        order_workflow: usesTables ? "TABLE_SERVICE" : "COUNTER_TOKEN",
        notes: orderNotes,
        items: itemsPayload,
      });

      setSuccessToast(
        usesTables
          ? `Order fired to kitchen for Table ${selectedTable?.label}!`
          : `Counter Order fired for Token #${counterToken}!`
      );
      setCart([]);
      setOrderNotes("");
      if (!usesTables) setCounterToken((prev) => prev + 1);
      await fetchData();
    } catch (err: any) {
      setErrorToast(err?.response?.data?.items || "Failed to dispatch order.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (selectedCategory !== "ALL" && item.category?.id !== selectedCategory) return false;
      if (selectedFoodType !== "ALL" && item.food_type !== selectedFoodType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesTa = item.name_ta?.toLowerCase().includes(q);
        if (!matchesName && !matchesTa) return false;
      }
      return true;
    });
  }, [menuItems, selectedCategory, selectedFoodType, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden font-sans">
      {/* Toast notifications */}
      {successToast && (
        <div className="fixed top-16 right-6 z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-semibold">{successToast}</span>
          <button onClick={() => setSuccessToast(null)} className="ml-2 font-bold">
            ×
          </button>
        </div>
      )}
      {errorToast && (
        <div className="fixed top-16 right-6 z-50 bg-destructive text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top">
          <span className="text-sm font-semibold">{errorToast}</span>
          <button onClick={() => setErrorToast(null)} className="ml-2 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Call Bell Alert Bar - Hidden per scope trim */}
      {false && serviceRequests.length > 0 && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-xs font-bold animate-pulse">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>
              {serviceRequests.length} active service call(s): Table{" "}
              {serviceRequests[0].table_label} requested {serviceRequests[0].request_type}
            </span>
          </div>
          <button
            onClick={async () => {
              await ordersApi.acknowledgeServiceRequest(serviceRequests[0].id);
              fetchData();
            }}
            className="bg-black/20 hover:bg-black/40 px-2.5 py-1 rounded text-white text-[11px]"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Main 3-Column Split Screen */}
      <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden">
        {/* COLUMN 1: Tables or Counter Selector (3 of 12 cols) */}
        <div className="col-span-12 md:col-span-3 border-r border-border bg-card/60 p-4 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              {usesTables ? (
                <Layers className="h-4 w-4 text-[#FF6A00]" />
              ) : (
                <Zap className="h-4 w-4 text-[#FF6A00]" />
              )}
              {usesTables ? "Floor Tables" : "Counter Orders"}
            </h2>
            {usesTables && selectedSessionId && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setTransferModalOpen(true)}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
              </Button>
            )}
          </div>

          {usesTables ? (
            <div className="flex-1 overflow-y-auto pt-3 grid grid-cols-2 gap-2.5 pr-1">
              {tables.map((tbl) => {
                const isSelected = selectedTable?.id === tbl.id;
                const isOccupied = tbl.status === "OCCUPIED";
                return (
                  <button
                    key={tbl.id}
                    onClick={() => handleSelectTable(tbl)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all min-h-[76px] ${
                      isSelected
                        ? "border-[#FF6A00] ring-2 ring-[#FF6A00]/20 bg-orange-50/50 dark:bg-orange-950/20"
                        : isOccupied
                          ? "border-red-300 bg-red-50/40 dark:bg-red-950/20 hover:border-red-400"
                          : "border-border bg-card hover:border-[#FF6A00]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-heading font-extrabold text-base text-foreground">
                        {tbl.label}
                      </span>
                      <Badge
                        variant={isOccupied ? "destructive" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {isOccupied ? "Occupied" : "Free"}
                      </Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Users className="h-3 w-3" /> {tbl.capacity} seats
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 pt-4">
              <div className="p-4 rounded-xl border border-border bg-card text-center">
                <span className="text-xs text-muted-foreground">Active Daily Token</span>
                <div className="text-3xl font-extrabold text-[#FF6A00] mt-1">#{counterToken}</div>
                <span className="text-xs text-muted-foreground">Chai Corner Takeaway Counter</span>
              </div>
              <Button
                variant="outline"
                className="w-full text-xs font-semibold"
                onClick={() => setCounterToken((prev) => prev + 1)}
              >
                + Next Token Sequence
              </Button>
            </div>
          )}
        </div>

        {/* COLUMN 2: Menu Catalog Picker (5 of 12 cols) */}
        <div className="col-span-12 md:col-span-5 border-r border-border p-4 flex flex-col h-full overflow-hidden bg-background">
          {/* Search & Food Type Filter */}
          <div className="flex gap-2 pb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search dish or தமிழ்..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <select
              value={selectedFoodType}
              onChange={(e) => setSelectedFoodType(e.target.value)}
              className="h-9 px-2.5 rounded-md border border-input bg-card text-xs font-semibold"
            >
              <option value="ALL">All Diets</option>
              <option value="VEG">Veg Only</option>
              <option value="NON_VEG">Non-Veg</option>
              <option value="EGG">Egg</option>
            </select>
          </div>

          {/* Categories Tab Rail */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === "ALL"
                  ? "bg-[#0A192F] text-white dark:bg-white dark:text-black"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All Items
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === c.id
                    ? "bg-[#0A192F] text-white dark:bg-white dark:text-black"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          <div className="flex-1 overflow-y-auto pt-2 grid grid-cols-2 gap-2.5 pr-1">
            {filteredMenuItems.map((item) => {
              const isAvail = availabilityMap[item.id] !== false && item.is_active;
              return (
                <div
                  key={item.id}
                  onClick={() => isAvail && addToCart(item)}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-all cursor-pointer ${
                    !isAvail
                      ? "opacity-50 bg-muted/40 cursor-not-allowed border-dashed"
                      : "bg-card hover:border-[#FF6A00] hover:shadow-sm"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          item.food_type === "VEG"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.food_type}
                      </span>
                      {!isAvail && (
                        <span className="text-[10px] font-bold text-destructive">SOLD OUT</span>
                      )}
                    </div>
                    <h3 className="font-bold text-xs text-foreground mt-1.5 line-clamp-1">
                      {item.name}
                    </h3>
                    {item.name_ta && (
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {item.name_ta}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                    <span className="font-extrabold text-sm text-[#FF6A00]">
                      {formatRupees(item.base_price_paise)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 rounded-full"
                      disabled={!isAvail}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMN 3: Cart, Ticket Pacing & Dispatch (4 of 12 cols) */}
        <div className="col-span-12 md:col-span-4 bg-card/40 p-4 flex flex-col h-full overflow-hidden">
          {/* Header Anchor */}
          <div className="pb-3 border-b border-border flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold text-muted-foreground">
                Order Target
              </span>
              <h3 className="text-base font-extrabold font-heading text-foreground">
                {usesTables
                  ? selectedTable
                    ? `Table ${selectedTable.label}`
                    : "No Table Selected"
                  : `Counter Token #${counterToken}`}
              </h3>
            </div>
            {usesTables && selectedSessionId && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => navigate(`/billing?session_id=${selectedSessionId}`)}
              >
                <Receipt className="h-3.5 w-3.5 text-[#FF6A00]" /> Checkout
              </Button>
            )}
          </div>

          {/* Cart Item Lines */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                <Utensils className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-semibold">Cart is empty.</p>
                <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                  Tap dishes from the menu to add to this order.
                </p>
              </div>
            ) : (
              cart.map((line) => (
                <div
                  key={line.menu_item_id}
                  className="p-2.5 rounded-lg border border-border bg-card flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground line-clamp-1">
                      {line.name}
                    </span>
                    <span className="font-extrabold text-xs text-[#FF6A00]">
                      {formatRupees(line.unit_price_paise * line.quantity)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={line.course}
                        onChange={(e) =>
                          updateCourse(
                            line.menu_item_id,
                            e.target.value as "STARTER" | "MAIN" | "DESSERT" | "BEVERAGE"
                          )
                        }
                        className="h-6 text-[11px] px-1 rounded border border-input bg-card font-semibold"
                      >
                        <option value="STARTER">Starter</option>
                        <option value="MAIN">Main</option>
                        <option value="DESSERT">Dessert</option>
                        <option value="BEVERAGE">Beverage</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(line.menu_item_id, -1)}
                        className="h-6 w-6 rounded bg-muted flex items-center justify-center hover:bg-muted/80"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-bold text-xs min-w-[14px] text-center">
                        {line.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(line.menu_item_id, 1)}
                        className="h-6 w-6 rounded bg-muted flex items-center justify-center hover:bg-muted/80"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Special instructions (e.g. less spicy)..."
                    value={line.notes || ""}
                    onChange={(e) => updateItemNotes(line.menu_item_id, e.target.value)}
                    className="h-6 text-[11px] px-2 rounded border border-input/60 bg-transparent text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              ))
            )}
          </div>

          {/* Footer Controls & Pacing */}
          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{cart.length} item(s) in cart</span>
              <span className="text-[11px] font-medium">Server calculates final bill</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-muted-foreground">Estimated Total:</span>
              <span className="font-extrabold text-lg text-foreground font-heading">
                {formatRupees(cartTotalPaise)}
              </span>
            </div>

            <Button
              className="w-full min-h-[48px] text-sm font-bold bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-white gap-2 shadow-sm"
              disabled={cart.length === 0 || submitting}
              onClick={handleFireOrder}
            >
              <Send className="h-4 w-4" />
              {submitting ? "Firing..." : "Fire Order to Kitchen"}
            </Button>
          </div>
        </div>
      </div>

      {/* Seating Guest Count Modal */}
      <Dialog open={seatModalOpen} onOpenChange={setSeatModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seat Guests at Table {selectedTable?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Party Size (Number of Guests)
            </label>
            <div className="flex items-center gap-3">
              {[1, 2, 4, 6, 8].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setGuestCount(count)}
                  className={`flex-1 py-2 rounded-lg border font-bold text-sm ${
                    guestCount === count
                      ? "border-[#FF6A00] bg-orange-50 dark:bg-orange-950/30 text-[#FF6A00]"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeatModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSeatGuests}
              disabled={submitting}
              className="bg-[#FF6A00] text-white"
            >
              Open Dining Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Table Modal */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Session from Table {selectedTable?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Select New Physical Table
            </label>
            <select
              value={targetTableId}
              onChange={(e) => setTargetTableId(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-card text-sm"
            >
              <option value="">-- Choose Target Table --</option>
              {tables
                .filter((t) => t.id !== selectedTable?.id && t.status === "AVAILABLE")
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    Table {t.label} ({t.capacity} seats)
                  </option>
                ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferTable}
              disabled={!targetTableId || submitting}
              className="bg-[#FF6A00] text-white"
            >
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
