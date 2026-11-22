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
import {
  ordersApi,
  OrderItemPayload,
  ServiceRequest,
  BillInvoice,
  BillCalculation,
} from "../../api/orders";
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
import {
  generateClientOrderId,
  saveFloorReadCache,
  loadFloorReadCache,
  enqueueOfflineOrder,
} from "../../utils/offlineQueue";

interface DiningTableItem {
  id: string;
  label: string;
  capacity: number;
  status: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "BLOCKED";
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
  const { activeTenant, user, activeRole } = useAuth();
  const isWaiter = activeRole === "WAITER";

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
  const [mySectionIds, setMySectionIds] = useState<string[]>([]);
  const [myShiftLabel, setMyShiftLabel] = useState<string>("");
  const [tableScope, setTableScope] = useState<"MINE" | "ALL">("MINE");
  const [lastBillModalOpen, setLastBillModalOpen] = useState<boolean>(false);
  const [lastBillData, setLastBillData] = useState<
    | (BillInvoice & {
        found?: boolean;
        current_bill?: BillCalculation | null;
        last_bill?: BillInvoice | null;
      })
    | null
  >(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [qrTableLabels, setQrTableLabels] = useState<Set<string>>(new Set());
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
    // Look up active open session (s.table can be string UUID or {id: string})
    const openSess = sessions.find((s: any) => {
      const sessTableId = typeof s.table === "object" ? s.table?.id : s.table;
      return sessTableId === tbl.id && s.status === "OPEN";
    });
    if (openSess) {
      setSelectedSessionId(openSess.id);
    } else {
      setSelectedSessionId(null);
      if (tbl.status === "AVAILABLE" || (!tbl.status && !openSess)) {
        setGuestCount(tbl.capacity || 2);
        setSeatModalOpen(true);
      }
    }
  };

  // Fetch initial floor data
  const fetchData = async () => {
    if (!activeTenant) return;
    try {
      const tblPromise = usesTables
        ? apiClient.get<any>("/tables/").then((res) => {
            const data = res.data?.results || res.data || [];
            setTables(data);
            return data;
          })
        : Promise.resolve([]);

      const canCheckAvailability = ["OWNER", "MANAGER", "KITCHEN"].includes(
        (activeTenant.role || "").toUpperCase()
      );
      const [tblData, catRes, itemRes, sessRes, srvRes, availRes, ordRes, assignRes] =
        await Promise.all([
          tblPromise,
          apiClient.get<any>("/menu/categories/"),
          apiClient.get<any>("/menu/items/"),
          apiClient.get<any>("/sessions/").catch(() => ({ data: [] })),
          ordersApi.getServiceRequests("PENDING").catch(() => ({ data: [] })),
          canCheckAvailability
            ? apiClient.get<any>("/menu/availability/").catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          ordersApi.getOrders().catch(() => ({ data: [] })),
          apiClient.get<any>("/staff-assignments/").catch(() => ({ data: [] })),
        ]);
      const assigns = assignRes.data?.results || assignRes.data || [];
      if (Array.isArray(assigns) && user?.email) {
        const myAssigns = assigns.filter((a: any) => a.user_email === user.email);
        setMySectionIds(myAssigns.map((a: any) => String(a.section)));
        if (myAssigns[0]?.shift_name) {
          const s = myAssigns[0];
          setMyShiftLabel(
            `${String(s.shift_name).replace(/_/g, " ")}${s.shift_start && s.shift_end ? ` (${s.shift_start}-${s.shift_end})` : ""}`
          );
        }
      }

      const sessData = sessRes.data?.results || sessRes.data || [];
      const rawOrd = ordRes.data as { results?: any[] } | any[];
      const ordData = Array.isArray(rawOrd) ? rawOrd : rawOrd?.results || [];
      const qrLabels = new Set<string>(
        ordData
          .filter(
            (o: any) =>
              o.source === "QR" &&
              o.status !== "BILLED" &&
              o.status !== "CANCELLED" &&
              o.table_number
          )
          .map((o: any) => String(o.table_number))
      );
      const catList = catRes.data?.results || catRes.data || [];
      const itemList = itemRes.data?.results || itemRes.data || [];
      setQrTableLabels(qrLabels);
      setTables(tblData);
      setCategories(catList);
      setMenuItems(itemList);
      setActiveSessions(sessData);
      setServiceRequests(srvRes.data || []);

      saveFloorReadCache(activeTenant.tenant_id, {
        tables: tblData,
        categories: catList,
        menuItems: itemList,
        activeSessions: sessData,
        cachedAt: new Date().toISOString(),
      });

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
      const cached = loadFloorReadCache(activeTenant.tenant_id);
      if (cached) {
        setTables(cached.tables || []);
        setCategories(cached.categories || []);
        setMenuItems(cached.menuItems || []);
        setActiveSessions(cached.activeSessions || []);
      } else {
        setErrorToast("Failed to load live floor operations.");
      }
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
      const res = await apiClient.post<any>("/table-sessions/open/", {
        table_id: selectedTable.id,
        guest_count: guestCount,
      });
      setSelectedSessionId(res.data.id);
      setSeatModalOpen(false);
      setSuccessToast(`Table ${selectedTable.label} seated with ${guestCount} guests.`);
      await fetchData();
    } catch (err: any) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.detail ||
        "Could not seat guests at this table.";
      setErrorToast(msg);
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

  const updateSeatNumber = (itemId: string, seatNumber: number | null) => {
    setCart((prev) =>
      prev.map((i) => (i.menu_item_id === itemId ? { ...i, seat_number: seatNumber } : i))
    );
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
    const clientOrderId = generateClientOrderId();
    const itemsPayload = cart.map((i) => ({
      menu_item_id: i.menu_item_id,
      quantity: i.quantity,
      course: i.course,
      seat_number: i.seat_number || null,
      is_fired: !(holdMains && i.course === "MAIN"),
      notes: i.notes,
    }));
    const orderPayload = {
      table_session_id: usesTables ? selectedSessionId : null,
      token_number: !usesTables ? counterToken : null,
      order_workflow: (usesTables ? "TABLE_SERVICE" : "COUNTER_TOKEN") as
        "TABLE_SERVICE" | "COUNTER_TOKEN",
      notes: orderNotes,
      idempotency_key: clientOrderId,
      items: itemsPayload,
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueOfflineOrder({
        client_order_id: clientOrderId,
        tenant_id: activeTenant?.tenant_id || "default",
        table_label: usesTables ? selectedTable?.label : `Token #${counterToken}`,
        payload: orderPayload,
      });
      setSuccessToast("Offline: Order queued and will sync automatically when online.");
      setCart([]);
      setOrderNotes("");
      if (!usesTables) setCounterToken((prev) => prev + 1);
      setSubmitting(false);
      return;
    }

    try {
      await ordersApi.createOrder(orderPayload);

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
      if (!err?.response) {
        enqueueOfflineOrder({
          client_order_id: clientOrderId,
          tenant_id: activeTenant?.tenant_id || "default",
          table_label: usesTables ? selectedTable?.label : `Token #${counterToken}`,
          payload: orderPayload,
        });
        setSuccessToast("Offline: Order queued and will sync automatically when online.");
        setCart([]);
        setOrderNotes("");
        if (!usesTables) setCounterToken((prev) => prev + 1);
      } else {
        setErrorToast(
          err?.response?.data?.error?.message ||
            err?.response?.data?.items ||
            "Failed to dispatch order."
        );
      }
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
    <div className="flex flex-col md:h-[calc(100vh-4rem)] md:overflow-hidden pb-20 md:pb-0 font-sans">
      {/* Toast notifications */}
      {successToast && (
        <div
          role="status"
          className="fixed top-20 right-4 max-w-[calc(100vw-2rem)] z-50 bg-emerald-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold">{successToast}</span>
          <button
            type="button"
            aria-label="Dismiss success notification"
            onClick={() => setSuccessToast(null)}
            className="ml-2 font-bold min-h-[36px] min-w-[36px] flex items-center justify-center rounded hover:bg-white/15"
          >
            ×
          </button>
        </div>
      )}
      {errorToast && (
        <div
          role="alert"
          className="fixed top-20 right-4 max-w-[calc(100vw-2rem)] z-50 bg-destructive text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top"
        >
          <span className="text-sm font-semibold">{errorToast}</span>
          <button
            type="button"
            aria-label="Dismiss error notification"
            onClick={() => setErrorToast(null)}
            className="ml-2 font-bold min-h-[36px] min-w-[36px] flex items-center justify-center rounded hover:bg-white/15"
          >
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
      <div className="flex-1 grid grid-cols-12 gap-0 md:overflow-hidden">
        {/* COLUMN 1: Tables or Counter Selector (3 of 12 cols) */}
        <div className="col-span-12 md:col-span-3 md:border-r border-b md:border-b-0 border-border bg-card/60 p-4 flex flex-col md:h-full md:overflow-hidden">
          <div className="flex flex-col gap-2 pb-3 border-b border-border">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                {usesTables ? (
                  <Layers className="h-4 w-4 text-[#C2410C] dark:text-[#FF6A00]" />
                ) : (
                  <Zap className="h-4 w-4 text-[#C2410C] dark:text-[#FF6A00]" />
                )}
                {usesTables ? "Floor Tables" : "Counter Orders"}
              </h2>
              {usesTables && selectedSessionId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[36px] text-xs gap-1"
                  onClick={() => setTransferModalOpen(true)}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
                </Button>
              )}
            </div>
            {myShiftLabel && (
              <div className="px-2.5 py-1 rounded bg-[#FF6A00]/10 border border-[#FF6A00]/30 text-xs font-semibold text-[#0B1F3B] dark:text-amber-200 w-fit">
                Shift: {myShiftLabel}
              </div>
            )}
          </div>

          {usesTables ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {mySectionIds.length > 0 && (
                <div className="flex items-center gap-1 pt-2">
                  <button
                    type="button"
                    onClick={() => setTableScope("MINE")}
                    className={`flex-1 py-1 rounded text-xs font-semibold min-h-[30px] border ${
                      tableScope === "MINE"
                        ? "bg-[#FF6A00] text-[#0B1F3B] border-[#FF6A00]"
                        : "bg-card text-muted-foreground border-border"
                    }`}
                  >
                    My Sections
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableScope("ALL")}
                    className={`flex-1 py-1 rounded text-xs font-semibold min-h-[30px] border ${
                      tableScope === "ALL"
                        ? "bg-[#FF6A00] text-[#0B1F3B] border-[#FF6A00]"
                        : "bg-card text-muted-foreground border-border"
                    }`}
                  >
                    All Tables
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto pt-3 grid grid-cols-2 content-start auto-rows-max gap-2.5 pr-1">
                {(mySectionIds.length > 0 && tableScope === "MINE"
                  ? tables.filter(
                      (t: any) => !t.section || mySectionIds.includes(String(t.section))
                    )
                  : tables
                ).map((tbl) => {
                  const isSelected = selectedTable?.id === tbl.id;
                  const hasOpenSession = Boolean(
                    activeSessions.find((s: any) => {
                      const sessTableId = typeof s.table === "object" ? s.table?.id : s.table;
                      return sessTableId === tbl.id && s.status === "OPEN";
                    })
                  );
                  const isOccupied = tbl.status === "OCCUPIED" || hasOpenSession;
                  const isCleaning = tbl.status === "CLEANING";
                  return (
                    <button
                      key={tbl.id}
                      onClick={() => handleSelectTable(tbl)}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all min-h-[76px] ${
                        isSelected
                          ? "border-[#FF6A00] ring-2 ring-[#FF6A00]/20 bg-orange-50/50 dark:bg-orange-950/20"
                          : isOccupied
                            ? "border-red-300 bg-red-50/40 dark:bg-red-950/20 hover:border-red-400"
                            : isCleaning
                              ? "border-blue-300 bg-blue-50/40 dark:bg-blue-950/20 hover:border-blue-400"
                              : "border-border bg-card hover:border-[#FF6A00]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-heading font-extrabold text-base text-foreground flex items-center gap-1.5">
                          <span>{tbl.label}</span>
                          {qrTableLabels.has(tbl.label) && (
                            <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded bg-[#FF6A00] text-[#0B1F3B]">
                              QR
                            </span>
                          )}
                        </span>
                        <Badge
                          variant={
                            isOccupied ? "destructive" : isCleaning ? "outline" : "secondary"
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {isOccupied ? "Occupied" : isCleaning ? "Cleaning" : "Free"}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Users className="h-3 w-3" /> {tbl.capacity} seats
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-4 pt-4">
              <div className="p-4 rounded-xl border border-border bg-card text-center">
                <span className="text-xs text-muted-foreground">Active Daily Token</span>
                <div className="text-3xl font-extrabold text-[#0B1F3B] dark:text-[#FF6A00] mt-1">
                  #{counterToken}
                </div>
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
        <div className="col-span-12 md:col-span-5 md:border-r border-b md:border-b-0 border-border p-4 flex flex-col md:h-full md:overflow-hidden bg-background">
          {/* Search & Food Type Filter */}
          <div className="flex gap-2 pb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search menu items"
                placeholder="Search dish or தமிழ்..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 text-xs"
              />
            </div>
            <select
              aria-label="Filter menu by diet type"
              value={selectedFoodType}
              onChange={(e) => setSelectedFoodType(e.target.value)}
              className="h-10 px-2.5 rounded-md border border-input bg-card text-xs font-semibold"
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
          <div className="flex-1 overflow-y-auto pt-2 grid grid-cols-2 content-start auto-rows-max gap-2.5 pr-1">
            {filteredMenuItems.map((item) => {
              const isAvail = availabilityMap[item.id] !== false && item.is_active;
              return (
                <div
                  key={item.id}
                  onClick={() => isAvail && addToCart(item)}
                  className={`p-3 rounded-xl border flex flex-col justify-between min-h-[104px] transition-all cursor-pointer ${
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
                    {!isWaiter ? (
                      <span className="font-extrabold text-sm text-[#0B1F3B] dark:text-[#FF6A00]">
                        {formatRupees(item.base_price_paise)}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-muted-foreground">
                        Tap to add
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Add ${item.name} to order`}
                      className="h-9 w-9 p-0 rounded-full"
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
        <div className="col-span-12 md:col-span-4 bg-card/40 p-4 flex flex-col md:h-full md:overflow-hidden">
          {/* Header Anchor */}
          <div className="pb-3 border-b border-border space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] uppercase font-bold text-muted-foreground block">
                  Order Target
                </span>
                <h3 className="text-base font-extrabold font-heading text-foreground truncate">
                  {usesTables
                    ? selectedTable
                      ? `Table ${selectedTable.label}`
                      : "No Table Selected"
                    : `Counter Token #${counterToken}`}
                </h3>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {usesTables &&
                selectedTable &&
                !selectedSessionId &&
                selectedTable.status === "CLEANING" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800"
                    disabled={submitting}
                    onClick={async () => {
                      try {
                        setSubmitting(true);
                        await apiClient.post(`/tables/${selectedTable.id}/status/`, {
                          status: "AVAILABLE",
                          reason: "Marked free from Floor POS",
                        });
                        setSuccessToast(`Table ${selectedTable.label} is now Free.`);
                        await fetchData();
                        setSelectedTable((prev) =>
                          prev ? { ...prev, status: "AVAILABLE" } : null
                        );
                      } catch (err: any) {
                        setErrorToast(
                          err?.response?.data?.error?.message || "Could not mark table free."
                        );
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    Mark Free
                  </Button>
                )}
              {usesTables && selectedTable && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  disabled={submitting}
                  onClick={async () => {
                    try {
                      const res = await ordersApi.getLastBillForTable(selectedTable.id);
                      setLastBillData(res.data);
                      setLastBillModalOpen(true);
                    } catch {
                      setErrorToast("Could not load last bill.");
                    }
                  }}
                >
                  <Receipt className="h-3.5 w-3.5 text-[#FF6A00]" />
                  Current / Last Bill
                </Button>
              )}
              {usesTables && selectedSessionId && (
                <>
                  {isWaiter && selectedTable && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1 border-[#FF6A00] text-[#0B1F3B] dark:text-amber-200"
                      disabled={submitting}
                      onClick={async () => {
                        try {
                          setSubmitting(true);
                          await ordersApi.requestServiceCall(selectedTable.id, "BILL");
                          setSuccessToast(
                            `Payment requested from Cashier for Table ${selectedTable.label}.`
                          );
                        } catch {
                          setErrorToast("Could not send payment request.");
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                    >
                      <Bell className="h-3.5 w-3.5 text-[#FF6A00]" /> Request Payment
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                    disabled={submitting}
                    onClick={async () => {
                      try {
                        setSubmitting(true);
                        await apiClient.post(`/sessions/${selectedSessionId}/close/`);
                        setSelectedSessionId(null);
                        setSelectedTable(null);
                        setCart([]);
                        setSuccessToast("Table freed.");
                        await fetchData();
                      } catch (err: any) {
                        setErrorToast(
                          err?.response?.data?.error?.message ||
                            err?.response?.data?.detail ||
                            "Cannot free table with active orders."
                        );
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    Free Table
                  </Button>
                  {!isWaiter && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={() => navigate(`/billing?session_id=${selectedSessionId}`)}
                    >
                      <Receipt className="h-3.5 w-3.5 text-[#FF6A00]" /> Checkout
                    </Button>
                  )}
                </>
              )}
            </div>
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
                    {!isWaiter && (
                      <span className="font-extrabold text-xs text-foreground">
                        {formatRupees(line.unit_price_paise * line.quantity)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label={`Course for ${line.name}`}
                        value={line.course}
                        onChange={(e) =>
                          updateCourse(
                            line.menu_item_id,
                            e.target.value as "STARTER" | "MAIN" | "DESSERT" | "BEVERAGE"
                          )
                        }
                        className="h-9 text-xs px-2 rounded border border-input bg-card font-semibold"
                      >
                        <option value="STARTER">Starter</option>
                        <option value="MAIN">Main</option>
                        <option value="DESSERT">Dessert</option>
                        <option value="BEVERAGE">Beverage</option>
                      </select>

                      {usesTables && selectedTable && (
                        <select
                          value={line.seat_number ?? ""}
                          onChange={(e) =>
                            updateSeatNumber(
                              line.menu_item_id,
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                          aria-label="Assign to chair"
                          className="h-9 text-xs px-2 rounded border border-input bg-card font-semibold text-muted-foreground"
                        >
                          <option value="">Table Shared</option>
                          {Array.from(
                            { length: selectedTable.capacity || 4 },
                            (_, idx) => idx + 1
                          ).map((cNum) => (
                            <option key={cNum} value={cNum}>
                              Chair #{cNum}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${line.name}`}
                        onClick={() => updateQuantity(line.menu_item_id, -1)}
                        className="h-10 w-10 rounded bg-muted flex items-center justify-center hover:bg-muted/80"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-bold text-xs min-w-[16px] text-center">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${line.name}`}
                        onClick={() => updateQuantity(line.menu_item_id, 1)}
                        className="h-10 w-10 rounded bg-muted flex items-center justify-center hover:bg-muted/80"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    aria-label={`Special instructions for ${line.name}`}
                    placeholder="Special instructions (e.g. less spicy)..."
                    value={line.notes || ""}
                    onChange={(e) => updateItemNotes(line.menu_item_id, e.target.value)}
                    className="h-9 text-xs px-2 rounded border border-input/60 bg-transparent text-foreground placeholder:text-muted-foreground/70"
                  />
                </div>
              ))
            )}
          </div>

          {/* Footer Controls & Pacing */}
          <div className="pt-3 pb-20 md:pb-0 border-t border-border space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{cart.length} item(s) in cart</span>
              {!isWaiter && (
                <span className="text-xs font-medium">Server calculates final bill</span>
              )}
            </div>

            {!isWaiter && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-muted-foreground">Estimated Total:</span>
                <span className="font-extrabold text-lg text-foreground font-heading">
                  {formatRupees(cartTotalPaise)}
                </span>
              </div>
            )}

            <Button
              className="w-full min-h-[56px] md:min-h-[48px] text-sm font-bold bg-[#FF6A00] hover:bg-[#FF6A00]/90 text-[#0B1F3B] gap-2 shadow-sm"
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
                  className={`flex-1 min-h-[44px] py-2 rounded-lg border font-bold text-sm ${
                    guestCount === count
                      ? "border-[#FF6A00] bg-orange-50 dark:bg-orange-950/30 text-[#0B1F3B] dark:text-[#FF6A00]"
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
              className="bg-[#FF6A00] text-[#0B1F3B] font-bold"
            >
              Seat Guests
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
              aria-label="Target table for session transfer"
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
              className="bg-[#FF6A00] text-[#0B1F3B]"
            >
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Read-Only Current & Last Bill Check Modal (Waiter & Staff) */}
      <Dialog open={lastBillModalOpen} onOpenChange={setLastBillModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Table Bill — Table {selectedTable?.label || ""}</DialogTitle>
          </DialogHeader>
          {!lastBillData?.current_bill && !lastBillData?.found ? (
            <p className="text-xs text-muted-foreground py-4">
              No active or finalized bill found for this table yet.
            </p>
          ) : (
            <div className="space-y-4 py-2 text-xs">
              {lastBillData?.current_bill && (
                <div className="rounded-xl border border-[#FF6A00]/40 bg-[#FF6A00]/5 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Current Running Bill</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                      Open ({lastBillData.current_bill.session_code})
                    </span>
                  </div>
                  <div className="divide-y divide-border border-y border-border">
                    {lastBillData.current_bill.items.length === 0 ? (
                      <div className="py-2 text-muted-foreground">No items ordered yet.</div>
                    ) : (
                      lastBillData.current_bill.items.map((it, idx) => (
                        <div key={idx} className="py-1.5 flex items-center justify-between">
                          <span>
                            {it.quantity} × {it.item_name}
                          </span>
                          <span className="font-semibold">{formatRupees(it.subtotal_paise)}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center justify-between font-extrabold text-sm">
                    <span>Current Total</span>
                    <span className="text-[#FF6A00]">
                      {formatRupees(lastBillData.current_bill.total_paise)}
                    </span>
                  </div>
                </div>
              )}

              {(lastBillData?.last_bill || lastBillData?.found) && (
                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-mono font-bold text-foreground">
                      Last Paid: {(lastBillData.last_bill || lastBillData).invoice_number}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      {(lastBillData.last_bill || lastBillData).payment_method} • Paid
                    </span>
                  </div>
                  <div className="divide-y divide-border border-y border-border">
                    {(
                      (lastBillData.last_bill || lastBillData).items ||
                      (lastBillData.last_bill || lastBillData).snapshot_lines ||
                      []
                    ).map((it, idx) => (
                      <div key={idx} className="py-1.5 flex items-center justify-between">
                        <span>
                          {it.quantity} × {it.item_name}
                        </span>
                        <span className="font-semibold">
                          {formatRupees(it.subtotal_paise || it.unit_price_paise * it.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between font-extrabold text-sm pt-1">
                    <span>Final Bill Total</span>
                    <span className="text-[#FF6A00]">
                      {formatRupees((lastBillData.last_bill || lastBillData).total_paise)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLastBillModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
