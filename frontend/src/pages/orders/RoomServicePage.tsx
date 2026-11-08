import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BellRing,
  Clock,
  AlertTriangle,
  CheckCircle2,
  UtensilsCrossed,
  RefreshCw,
  Send,
  Search,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { Button } from "../../components/ui/button";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  notes?: string;
}

interface RoomServiceOrder {
  id: string;
  order_number: string;
  order_workflow: string;
  status: "PLACED" | "CONFIRMED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "CANCELLED";
  table_label?: string;
  guest_notes?: string;
  placed_at: string;
  ready_at?: string | null;
  items: OrderItem[];
}

export const RoomServicePage: React.FC = () => {
  const [orders, setOrders] = useState<RoomServiceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Update clock every 30 seconds for live timer accuracy
  useEffect(() => {
    setCurrentTime(Date.now());
    const timer = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ListResponse<RoomServiceOrder>>("/orders/");
      const allOrders = unwrapList(res.data);

      // Filter for Room Service orders or orders with Room in table label
      const rsOrders = allOrders.filter(
        (o) =>
          o.order_workflow === "ROOM_SERVICE" ||
          (o.table_label && o.table_label.toLowerCase().includes("room"))
      );
      setOrders(rsOrders);
    } catch {
      setError("Failed to load room service orders.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 20000); // 20s polling
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId: string, nextStatus: RoomServiceOrder["status"]) => {
    try {
      await apiClient.post(`/orders/${orderId}/transition/`, { status: nextStatus });
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: nextStatus } : ord))
      );
    } catch {
      setError("Failed to update room service delivery status.");
    }
  };

  const activeOrders = useMemo(() => {
    return orders.filter(
      (o) => o.status !== "COMPLETED" && o.status !== "CANCELLED" && o.status !== "SERVED"
    );
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return activeOrders;
    const q = searchQuery.toLowerCase();
    return activeOrders.filter(
      (o) =>
        (o.table_label && o.table_label.toLowerCase().includes(q)) ||
        o.order_number.toLowerCase().includes(q) ||
        (o.guest_notes && o.guest_notes.toLowerCase().includes(q))
    );
  }, [activeOrders, searchQuery]);

  // Calculate elapsed minutes and urgency
  const getOrderTimerInfo = useCallback(
    (placedAtStr: string) => {
      const placed = new Date(placedAtStr).getTime();
      const now = currentTime || Date.now();
      const diffMins = Math.max(0, Math.floor((now - placed) / 60000));

      let urgency: "normal" | "warning" | "late" = "normal";
      if (diffMins >= 25) {
        urgency = "late";
      } else if (diffMins >= 15) {
        urgency = "warning";
      }

      return { diffMins, urgency };
    },
    [currentTime]
  );

  const lateOrdersCount = useMemo(() => {
    return activeOrders.filter((o) => getOrderTimerInfo(o.placed_at).urgency === "late").length;
  }, [activeOrders, getOrderTimerInfo]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-[#FF6A00]" />
            Room Service Dispatch
          </h1>
          <p className="text-sm text-muted-foreground">
            Live room service order tracking with late delivery alerts and fulfillment timers (H-05,
            H-06).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchOrders} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Late Alert Banner */}
      {lateOrdersCount > 0 && (
        <div className="p-4 rounded-xl border border-red-300 dark:border-red-800 bg-red-500/15 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1 text-sm font-semibold text-red-700 dark:text-red-300">
            {lateOrdersCount} Room Service {lateOrdersCount === 1 ? "order is" : "orders are"}{" "}
            running past 25 minutes! Expedite delivery immediately to prevent cold food complaints.
          </div>
        </div>
      )}

      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border">
        <div className="relative flex-1 sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search room number or ticket..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
          <div>
            Active Tickets: <span className="text-foreground">{activeOrders.length}</span>
          </div>
          <div>
            Late &gt;25m:{" "}
            <span
              className={
                lateOrdersCount > 0 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"
              }
            >
              {lateOrdersCount}
            </span>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      {isLoading && orders.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading room service orders...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-xl">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/70 mb-3" />
          <p className="text-sm font-semibold text-foreground">No active room service orders</p>
          <p className="text-xs text-muted-foreground mt-1">
            All guest orders have been delivered hot and on time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((ord) => {
            const timer = getOrderTimerInfo(ord.placed_at);
            const isLate = timer.urgency === "late";
            const isWarning = timer.urgency === "warning";

            return (
              <div
                key={ord.id}
                className={`p-5 rounded-xl border bg-card shadow-sm flex flex-col justify-between transition-all ${
                  isLate
                    ? "border-red-400 dark:border-red-700 ring-2 ring-red-500/30"
                    : isWarning
                      ? "border-amber-300 dark:border-amber-700"
                      : "border-border"
                }`}
              >
                <div>
                  {/* Top Bar: Room & Timer */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-lg font-bold text-foreground">
                        {ord.table_label || "Room Order"}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        Ticket #{ord.order_number}
                      </div>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${
                        isLate
                          ? "bg-red-500/15 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800"
                          : isWarning
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timer.diffMins} min</span>
                      {isLate && <span className="uppercase text-[10px] tracking-wide">Late</span>}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-4">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-muted text-muted-foreground uppercase">
                      Status: {ord.status}
                    </span>
                  </div>

                  {/* Guest Notes */}
                  {ord.guest_notes && (
                    <div className="p-2 mb-3 rounded bg-amber-500/10 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
                      <strong>Note:</strong> {ord.guest_notes}
                    </div>
                  )}

                  {/* Items List */}
                  <div className="space-y-1.5 mb-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">
                      Ordered Items ({ord.items.length})
                    </div>
                    {ord.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0"
                      >
                        <span className="font-medium text-foreground">
                          {item.quantity}x {item.item_name}
                        </span>
                        {item.notes && (
                          <span className="text-[11px] text-muted-foreground italic truncate max-w-[120px]">
                            {item.notes}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bump Actions */}
                <div className="pt-4 border-t border-border flex items-center justify-between gap-2">
                  {ord.status === "PLACED" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(ord.id, "PREPARING")}
                      className="w-full bg-[#0B1F3B] text-white hover:bg-[#0B1F3B]/90 font-semibold text-xs"
                    >
                      Start Preparing
                    </Button>
                  )}
                  {ord.status === "PREPARING" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(ord.id, "READY")}
                      className="w-full bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90 font-semibold text-xs"
                    >
                      <BellRing className="w-3.5 h-3.5 mr-1.5" />
                      Ready for Room Dispatch
                    </Button>
                  )}
                  {ord.status === "READY" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(ord.id, "SERVED")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Mark Delivered to Room
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
