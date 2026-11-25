import React, { useState, useEffect, useRef } from "react";
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
  Volume2,
  Check,
  Ban,
  Printer,
} from "lucide-react";
import { ordersApi, Order } from "../../api/orders";
import { useAuth } from "../../context/AuthContext";
import { unwrapList } from "../../api/pagination";
import { formatRupees } from "../../utils/currency";
import { playOrderAlert } from "../../utils/soundAlerts";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { TokenSlipModal } from "../../components/orders/TokenSlipModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../components/ui/dialog";

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL:
    "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-700",
  AWAITING_PAYMENT:
    "bg-yellow-100 text-yellow-900 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-200 dark:border-yellow-700",
  PLACED:
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
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

const STATUS_LABELS: Record<string, string> = {
  ALL: "All Orders",
  PENDING_APPROVAL: "Needs approval",
  AWAITING_PAYMENT: "Awaiting payment",
};

function getLocalDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const LiveOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRole, activeTenant } = useAuth();
  const isWaiter = activeRole === "WAITER";
  const [orders, setOrders] = useState<Order[]>([]);
  const [slipOrder, setSlipOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selectedDate, setSelectedDate] = useState<string>(() => getLocalDateString(0));
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [cancelModalOpen, setCancelModalOpen] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectTarget, setRejectTarget] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [soundStarted, setSoundStarted] = useState<boolean>(false);
  const prevApprovalIdsRef = useRef<Set<string>>(new Set());
  const soundStartedRef = useRef<boolean>(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await ordersApi.getOrders(selectedDate ? { date: selectedDate } : undefined);
      const fetched = unwrapList<Order>(res.data);
      const pendingApprovals = fetched.filter((o) => o.status === "PENDING_APPROVAL");
      const currentIds = new Set(pendingApprovals.map((o) => o.id));
      if (soundStartedRef.current) {
        const newlyArrived = pendingApprovals.filter((o) => !prevApprovalIdsRef.current.has(o.id));
        if (newlyArrived.length > 0) {
          const first = newlyArrived[0];
          const targetLabel = first.table_number
            ? `Table ${first.table_number}`
            : first.daily_token
              ? `Token ${first.daily_token}`
              : "Counter";
          playOrderAlert(targetLabel);
        }
      }
      prevApprovalIdsRef.current = currentIds;
      setOrders(fetched);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

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

  const handleApproveOrder = async (orderId: string) => {
    try {
      setActionLoading(true);
      await ordersApi.approveOrder(orderId);
      await fetchOrders();
      if (selectedOrder?.id === orderId) {
        const res = await ordersApi.getOrder(orderId);
        setSelectedOrder(res.data);
      }
    } catch (err: any) {
      alert("Failed to approve order: " + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (order: Order) => {
    setRejectTarget(order);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const handleRejectOrder = async () => {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) return;
    try {
      setActionLoading(true);
      await ordersApi.rejectOrder(rejectTarget.id, reason);
      setRejectModalOpen(false);
      setRejectReason("");
      setRejectTarget(null);
      if (selectedOrder?.id === rejectTarget.id) {
        setDrawerOpen(false);
      }
      await fetchOrders();
    } catch (err: any) {
      alert("Failed to reject order: " + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const orderList = Array.isArray(orders) ? orders : [];
  const pendingApprovalCount = orderList.filter((o) => o.status === "PENDING_APPROVAL").length;
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
            variant={soundStarted ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              soundStartedRef.current = true;
              setSoundStarted(true);
              playOrderAlert();
            }}
            className="min-h-[40px] text-xs font-semibold"
          >
            <Volume2 className="h-4 w-4 mr-1.5" />
            {soundStarted ? "Sound On" : "Start sound"}
          </Button>
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
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto lg:flex-wrap pb-2 lg:pb-0">
          {[
            "ALL",
            "PENDING_APPROVAL",
            "AWAITING_PAYMENT",
            "NEW",
            "PREPARING",
            "READY",
            "SERVED",
            "BILLED",
            "CANCELLED",
          ].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap min-h-[36px] flex items-center gap-1.5 ${
                filterStatus === st
                  ? "bg-[#0B1F3B] text-white dark:bg-white dark:text-[#0B1F3B] shadow"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <span>{STATUS_LABELS[st] || st}</span>
              {st === "PENDING_APPROVAL" && pendingApprovalCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#FF6A00] text-[#0B1F3B]">
                  {pendingApprovalCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-input bg-card p-1">
            {[
              { label: "Today", value: getLocalDateString(0) },
              { label: "Yesterday", value: getLocalDateString(-1) },
              { label: "All Dates", value: "" },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedDate(opt.value)}
                className={`px-2.5 py-1 rounded text-xs font-semibold min-h-[32px] transition-colors ${
                  selectedDate === opt.value
                    ? "bg-[#FF6A00] text-[#0B1F3B]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            aria-label="Filter orders by date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-card border border-input rounded-md focus:ring-2 focus:ring-[#FF6A00] outline-none min-h-[40px]"
          />
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-sm text-foreground flex items-center gap-1.5 whitespace-nowrap">
                        <span>{ord.order_number}</span>
                        {ord.source === "QR" && (
                          <span className="px-1.5 py-0.5 text-[10px] font-extrabold rounded bg-[#FF6A00] text-[#0B1F3B] shrink-0">
                            QR
                          </span>
                        )}
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
                        {ord.order_type && (
                          <>
                            <span>•</span>
                            <span>{ord.order_type}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap shrink-0 ${
                        STATUS_COLORS[ord.status] || "bg-muted"
                      }`}
                    >
                      {STATUS_LABELS[ord.status] || ord.status}
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
                    {!isWaiter ? (
                      <div className="font-bold text-sm text-foreground">
                        {formatRupees(ord.total_paise || 0)}
                      </div>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          ord.payment_status === "PAID"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                        }`}
                      >
                        {ord.payment_status === "PAID" ? "Payment Completed" : "Payment Pending"}
                      </span>
                    )}
                  </div>
                  {ord.status === "PENDING_APPROVAL" && (
                    <div
                      className="flex items-center gap-2 pt-2 border-t border-border"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleApproveOrder(ord.id)}
                        className="flex-1 min-h-[38px] text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading}
                        onClick={() => openRejectModal(ord)}
                        className="flex-1 min-h-[38px] text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
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
                        <div className="font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                          <span>
                            {it.quantity}x {it.item_name}
                          </span>
                          {it.seat_number ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-foreground">
                              Chair #{it.seat_number}
                            </span>
                          ) : null}
                        </div>
                        {it.notes && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                            Note: {it.notes}
                          </div>
                        )}
                      </div>
                      {!isWaiter && (
                        <div className="font-bold text-foreground">
                          {formatRupees(it.subtotal_paise || it.unit_price_paise * it.quantity)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div className="bg-muted/30 p-4 rounded-lg space-y-2 text-xs">
                {!isWaiter && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Server Computed Total</span>
                    <span className="font-bold text-foreground text-sm">
                      {formatRupees(selectedOrder.total_paise || 0)}
                    </span>
                  </div>
                )}
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
              {selectedOrder.status === "PENDING_APPROVAL" && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleApproveOrder(selectedOrder.id)}
                    disabled={actionLoading}
                    className="flex-1 min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    Accept Order
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => openRejectModal(selectedOrder)}
                    disabled={actionLoading}
                    className="flex-1 min-h-[48px] text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-semibold text-xs"
                  >
                    <Ban className="h-4 w-4 mr-1.5" />
                    Reject
                  </Button>
                </div>
              )}

              {selectedOrder.token_number != null && (
                <div className="flex items-center gap-2">
                  {["PLACED", "PREPARING", "READY"].includes(selectedOrder.status) && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          const res = await ordersApi.callToken(selectedOrder.id);
                          setSelectedOrder(res.data);
                          await fetchOrders();
                        } catch {
                          // ignore
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      disabled={actionLoading}
                      className="flex-1 min-h-[44px] text-xs font-bold gap-1.5"
                    >
                      <Volume2 className="h-4 w-4 text-[#FF6A00]" />
                      Call Token #{selectedOrder.token_number}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setSlipOrder(selectedOrder)}
                    className="flex-1 min-h-[44px] text-xs font-bold gap-1.5"
                  >
                    <Printer className="h-4 w-4" />
                    Token Slip
                  </Button>
                </div>
              )}

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

      {/* Reject QR Order Dialog */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject QR Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Provide a reason to show the customer for rejecting{" "}
              <span className="font-bold text-foreground">{rejectTarget?.order_number}</span>:
            </p>
            <div>
              <label className="text-xs font-semibold block mb-1">Reason (required)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Dish just sold out, please choose another item"
                className="w-full p-2.5 text-xs bg-background border border-input rounded-md min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectModalOpen(false)}
              className="text-xs min-h-[40px]"
            >
              Back
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRejectOrder}
              disabled={actionLoading || !rejectReason.trim()}
              className="text-xs min-h-[40px]"
            >
              Reject Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TokenSlipModal
        open={!!slipOrder}
        onOpenChange={(open) => !open && setSlipOrder(null)}
        restaurantName={activeTenant?.tenant_name || "ServeMyFood"}
        order={slipOrder}
      />
    </div>
  );
};
