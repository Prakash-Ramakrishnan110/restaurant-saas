import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Search,
  RefreshCw,
  Utensils,
  Zap,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Receipt,
} from "lucide-react";
import { ordersApi, Order } from "../../api/orders";
import { unwrapList } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
  PREPARING:
    "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  READY:
    "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  SERVED:
    "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
  BILLED:
    "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
  CANCELLED:
    "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
};

export const LiveOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await ordersApi.getOrders();
      setOrders(unwrapList<Order>(res.data));
    } catch (err) {
      console.error("Failed to load orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const openOrderDetail = async (order: Order) => {
    setSelectedOrder(order);
    setDrawerOpen(true);
    try {
      const res = await ordersApi.getOrder(order.id);
      setSelectedOrder(res.data);
    } catch {
      // Keep existing order if single fetch fails
    }
  };

  const handleMarkServed = async (orderId: string) => {
    try {
      setActionLoading(true);
      await ordersApi.serveOrder(orderId);
      await fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: "SERVED" } : null));
      }
    } catch (err: any) {
      alert("Failed to mark order as served: " + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    try {
      setActionLoading(true);
      await ordersApi.cancelOrder(selectedOrder.id, cancelReason || "Customer cancelled");
      setCancelModalOpen(false);
      setCancelReason("");
      setDrawerOpen(false);
      await fetchOrders();
    } catch (err: any) {
      alert("Failed to cancel order: " + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const orderList = Array.isArray(orders) ? orders : [];
  const filteredOrders = orderList.filter((ord) => {
    if (filterStatus !== "ALL" && ord.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const numMatch = ord.order_number?.toLowerCase().includes(q);
      const tableMatch = ord.table_number?.toLowerCase().includes(q);
      const tokenMatch = ord.daily_token?.toString().includes(q);
      if (!numMatch && !tableMatch && !tokenMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-[#FF6A00]" />
            Live Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time kitchen, counter, and table service pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="min-h-[40px] text-xs font-semibold"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => navigate("/pos")}
            className="min-h-[40px] text-xs font-bold bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B]"
          >
            <Utensils className="h-4 w-4 mr-1.5" />
            New Order
          </Button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0">
          {["ALL", "NEW", "PREPARING", "READY", "SERVED", "BILLED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap min-h-[36px] ${
                filterStatus === st
                  ? "bg-[#0B1F3B] text-white dark:bg-white dark:text-[#0B1F3B] shadow"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {st === "ALL" ? "All Orders" : st}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by order #, table or token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-card border border-input rounded-md focus:ring-2 focus:ring-[#FF6A00] outline-none min-h-[40px]"
          />
        </div>
      </div>

      {/* Orders Grid / List */}
      {loading && orderList.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin" />
          Loading active orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-xs border-dashed">
          <Utensils className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          No orders matching this filter.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((ord) => {
            const itemCount = ord.items?.reduce((sum, it) => sum + it.quantity, 0) || 0;
            return (
              <Card
                key={ord.id}
                onClick={() => openOrderDetail(ord)}
                className="hover:border-[#FF6A00]/50 transition-all cursor-pointer shadow-sm hover:shadow"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono font-bold text-sm text-foreground">
                        {ord.order_number}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        {ord.table_number ? (
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <Utensils className="h-3 w-3 text-[#FF6A00]" /> Table {ord.table_number}
                          </span>
                        ) : ord.daily_token ? (
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <Zap className="h-3 w-3 text-[#FF6A00]" /> Token #{ord.daily_token}
                          </span>
                        ) : (
                          <span>Takeaway</span>
                        )}
                        <span>•</span>
                        <span>{ord.order_type}</span>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        STATUS_COLORS[ord.status] || "bg-muted"
                      }`}
                    >
                      {ord.status}
                    </span>
                  </div>

                  {/* Items summary */}
                  <div className="text-xs text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded">
                    {ord.items && ord.items.length > 0 ? (
                      ord.items.map((it) => `${it.quantity}x ${it.item_name}`).join(", ")
                    ) : (
                      <span>{itemCount} item(s)</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {ord.created_at || ord.placed_at
                          ? new Date(
                              (ord.created_at || ord.placed_at) as string
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-foreground">
                      {formatRupees(ord.total_paise || 0)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Side Drawer for Order Details */}
      {drawerOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-card h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-mono font-bold text-base text-foreground">
                  {selectedOrder.order_number}
                </h3>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  {selectedOrder.table_number && `Table ${selectedOrder.table_number} • `}
                  {selectedOrder.daily_token && `Token #${selectedOrder.daily_token} • `}
                  {selectedOrder.order_type}
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Status Badge */}
              <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg">
                <span className="text-xs font-semibold text-muted-foreground">Current Status</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    STATUS_COLORS[selectedOrder.status] || "bg-muted"
                  }`}
                >
                  {selectedOrder.status}
                </span>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Order Items
                </h4>
                <div className="divide-y divide-border border border-border rounded-lg bg-card">
                  {(selectedOrder.items || []).map((it, idx) => (
                    <div key={idx} className="p-3 flex items-start justify-between text-xs">
                      <div>
                        <div className="font-semibold text-foreground">
                          {it.quantity}x {it.item_name}
                        </div>
                        {it.notes && (
                          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                            Note: {it.notes}
                          </div>
                        )}
                      </div>
                      <div className="font-bold text-foreground">
                        {formatRupees(it.subtotal_paise || it.unit_price_paise * it.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Server Computed Total</span>
                  <span className="font-bold text-foreground text-sm">
                    {formatRupees(selectedOrder.total_paise || 0)}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Order placed at{" "}
                  {selectedOrder.created_at || selectedOrder.placed_at
                    ? new Date(
                        (selectedOrder.created_at || selectedOrder.placed_at) as string
                      ).toLocaleTimeString()
                    : "—"}
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="p-4 border-t border-border bg-card space-y-2">
              {selectedOrder.status === "READY" && (
                <Button
                  onClick={() => handleMarkServed(selectedOrder.id)}
                  disabled={actionLoading}
                  className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Mark Order as Served
                </Button>
              )}

              {selectedOrder.status !== "BILLED" && selectedOrder.status !== "CANCELLED" && (
                <Button
                  onClick={() => navigate("/billing")}
                  className="w-full min-h-[44px] bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold text-xs"
                >
                  <Receipt className="h-4 w-4 mr-1.5" />
                  Go to Billing
                </Button>
              )}

              {(selectedOrder.status === "NEW" || selectedOrder.status === "PREPARING") && (
                <Button
                  variant="outline"
                  onClick={() => setCancelModalOpen(true)}
                  disabled={actionLoading}
                  className="w-full min-h-[40px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-semibold"
                >
                  <AlertTriangle className="h-4 w-4 mr-1.5" />
                  Cancel Order
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Dialog */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Are you sure you want to cancel order{" "}
              <span className="font-bold text-foreground">{selectedOrder?.order_number}</span>?
            </p>
            <div>
              <label className="text-xs font-semibold block mb-1">Reason for Cancellation</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer changed mind, wrong item ordered..."
                className="w-full p-2.5 text-xs bg-background border border-input rounded-md min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
              className="text-xs min-h-[40px]"
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleCancelOrder}
              disabled={actionLoading}
              className="text-xs min-h-[40px]"
            >
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
