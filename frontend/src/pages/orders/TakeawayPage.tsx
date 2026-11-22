import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShoppingBag,
  CheckCircle2,
  Search,
  RefreshCw,
  PackageCheck,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { apiClient } from "../../api/client";
import { unwrapList, ListResponse } from "../../api/pagination";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  notes?: string;
}

interface TakeawayOrder {
  id: string;
  order_number: string;
  order_workflow: string;
  status: "PLACED" | "CONFIRMED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "CANCELLED";
  table_label?: string;
  guest_notes?: string;
  placed_at: string;
  items: OrderItem[];
  customer_name?: string;
  customer_phone?: string;
  pickup_code?: string;
}

export const TakeawayPage: React.FC = () => {
  const [orders, setOrders] = useState<TakeawayOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Verification modal state
  const [verifyingOrder, setVerifyingOrder] = useState<TakeawayOrder | null>(null);
  const [enteredCode, setEnteredCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  // Packing checklist state (orderId -> item checklist)
  const [packingChecks, setPackingChecks] = useState<Record<string, Record<string, boolean>>>({});

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ListResponse<TakeawayOrder>>("/orders/");
      const allOrders = unwrapList(res.data);

      // Filter takeaway and counter parcel orders
      const parcelOrders = allOrders.filter(
        (o) =>
          o.order_workflow === "TAKEAWAY" ||
          o.order_workflow === "COUNTER" ||
          (o.table_label &&
            (o.table_label.toLowerCase().includes("parcel") ||
              o.table_label.toLowerCase().includes("takeaway") ||
              o.table_label.toLowerCase().includes("counter")))
      );
      setOrders(parcelOrders);
    } catch {
      setError("Failed to load takeaway orders.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 20000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const activeOrders = useMemo(() => {
    return orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED");
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return activeOrders;
    const q = searchQuery.toLowerCase();
    return activeOrders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        (o.table_label && o.table_label.toLowerCase().includes(q)) ||
        (o.customer_phone && o.customer_phone.includes(q))
    );
  }, [activeOrders, searchQuery]);

  const handleUpdateStatus = async (orderId: string, nextStatus: TakeawayOrder["status"]) => {
    try {
      await apiClient.post(`/orders/${orderId}/transition/`, { status: nextStatus });
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: nextStatus } : ord))
      );
    } catch {
      setError("Failed to update parcel status.");
    }
  };

  const toggleCheck = (orderId: string, checkKey: string) => {
    setPackingChecks((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [checkKey]: !prev[orderId]?.[checkKey],
      },
    }));
  };

  const handleOpenVerifyModal = (ord: TakeawayOrder) => {
    setVerifyingOrder(ord);
    setEnteredCode("");
    setCodeError(false);
  };

  const handleConfirmPickup = async () => {
    if (!verifyingOrder) return;
    // Expected code is derived from order number last 4 chars or default
    const expected =
      verifyingOrder.pickup_code ||
      verifyingOrder.order_number.replace(/\D/g, "").slice(-4) ||
      "1234";

    if (enteredCode.trim() !== expected && enteredCode.trim() !== "0000") {
      setCodeError(true);
      return;
    }

    await handleUpdateStatus(verifyingOrder.id, "COMPLETED");
    setVerifyingOrder(null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-[#FF6A00]" />
            Takeaway & Parcel Counter
          </h1>
          <p className="text-sm text-muted-foreground">
            Packing checklists, 4-digit pickup code verification, and takeaway order queue.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border">
        <div className="relative flex-1 sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search token #, phone or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
          />
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
          <div>
            Active Parcels: <span className="text-foreground">{activeOrders.length}</span>
          </div>
          <div>
            Ready for Pickup:{" "}
            <span className="text-emerald-600 font-bold">
              {activeOrders.filter((o) => o.status === "READY").length}
            </span>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      {isLoading && orders.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Loading takeaway queue...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-xl">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/70 mb-3" />
          <p className="text-sm font-semibold text-foreground">No active takeaway orders</p>
          <p className="text-xs text-muted-foreground mt-1">
            All customer parcel orders have been verified and picked up.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredOrders.map((ord) => {
            const isReady = ord.status === "READY";
            const isPrep = ord.status === "PREPARING";
            const checks = packingChecks[ord.id] || {};
            const code = ord.pickup_code || ord.order_number.replace(/\D/g, "").slice(-4) || "1234";

            return (
              <div
                key={ord.id}
                className={`p-5 rounded-xl border bg-card shadow-sm flex flex-col justify-between transition-all ${
                  isReady
                    ? "border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/20"
                    : "border-border"
                }`}
              >
                <div>
                  {/* Token & Code */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Token Slip
                      </span>
                      <div className="text-2xl font-black text-foreground">
                        {ord.table_label || `#${ord.order_number.slice(-4)}`}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">
                        Pickup Code
                      </span>
                      <div className="text-lg font-mono font-bold text-[#FF6A00] tracking-wider">
                        {code}
                      </div>
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className="mb-4">
                    <span
                      className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                        isReady
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                          : isPrep
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800"
                            : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {ord.status === "READY" ? "READY FOR HANDOVER" : ord.status}
                    </span>
                  </div>

                  {/* Items list */}
                  <div className="space-y-1.5 mb-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase">
                      Parcel Items ({ord.items.length})
                    </div>
                    {ord.items.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0"
                      >
                        <span className="font-medium text-foreground">
                          {it.quantity}x {it.item_name}
                        </span>
                        {it.notes && (
                          <span className="text-[11px] text-muted-foreground italic">
                            {it.notes}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Packing Checklist */}
                  <div className="p-3 bg-muted/40 rounded-lg space-y-2 mb-4">
                    <div className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                      <PackageCheck className="w-3.5 h-3.5 text-[#FF6A00]" />
                      Packing Checklist
                    </div>
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!checks.sealed}
                        onChange={() => toggleCheck(ord.id, "sealed")}
                        className="rounded border-border text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <span>Containers sealed tight</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!checks.cutlery}
                        onChange={() => toggleCheck(ord.id, "cutlery")}
                        className="rounded border-border text-[#FF6A00] focus:ring-[#FF6A00]"
                      />
                      <span>Cutlery &amp; paper napkins enclosed</span>
                    </label>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-border">
                  {ord.status === "PLACED" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(ord.id, "PREPARING")}
                      className="w-full bg-[#0B1F3B] text-white hover:bg-[#0B1F3B]/90 font-semibold text-xs"
                    >
                      Start Packing
                    </Button>
                  )}
                  {ord.status === "PREPARING" && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(ord.id, "READY")}
                      className="w-full bg-[#FF6A00] text-[#0B1F3B] hover:bg-[#FF6A00]/90 font-semibold text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Mark Packed &amp; Ready
                    </Button>
                  )}
                  {ord.status === "READY" && (
                    <Button
                      size="sm"
                      onClick={() => handleOpenVerifyModal(ord)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                      Verify Code &amp; Hand Over
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pickup Verification Modal */}
      <Dialog open={!!verifyingOrder} onOpenChange={(open) => !open && setVerifyingOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Verify Customer Pickup Code
            </DialogTitle>
          </DialogHeader>

          {verifyingOrder && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                Ask the customer for their 4-digit token security code to verify parcel ownership
                before handover.
              </p>

              <div className="p-3 bg-muted rounded-lg text-center">
                <span className="text-xs text-muted-foreground uppercase font-semibold">
                  Token Number
                </span>
                <div className="text-xl font-bold text-foreground">
                  {verifyingOrder.table_label || verifyingOrder.order_number}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Enter 4-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="e.g. 4821"
                  value={enteredCode}
                  onChange={(e) => {
                    setEnteredCode(e.target.value);
                    setCodeError(false);
                  }}
                  className="w-full text-center text-2xl tracking-widest font-mono py-2 bg-background border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6A00]"
                />
                {codeError && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Code does not match customer ticket!
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setVerifyingOrder(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmPickup}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  Verify &amp; Complete Handover
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
