import React, { useState, useEffect } from "react";
import { CheckCircle2, RefreshCw, Utensils, Zap, Clock } from "lucide-react";
import { ordersApi, Order } from "../../api/orders";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

export const ReadyToServePage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [servingId, setServingId] = useState<string | null>(null);

  const fetchReadyOrders = async () => {
    try {
      setLoading(true);
      const res = await ordersApi.getOrders({ status: "READY" });
      const raw = (res.data as any)?.results || res.data || [];
      setOrders(Array.isArray(raw) ? raw : []);
    } catch (err) {
      console.error("Failed to fetch ready orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadyOrders();
    const interval = setInterval(fetchReadyOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkServed = async (orderId: string) => {
    try {
      setServingId(orderId);
      await ordersApi.serveOrder(orderId);
      await fetchReadyOrders();
    } catch (err: any) {
      alert("Failed to mark order as served: " + (err.response?.data?.detail || err.message));
    } finally {
      setServingId(null);
    }
  };

  const orderList = Array.isArray(orders) ? orders : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              Ready to Serve
            </h1>
            {orderList.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 animate-pulse">
                {orderList.length} Ready
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Kitchen items prepared and waiting for waiter or counter pickup
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchReadyOrders}
          disabled={loading}
          className="min-h-[44px] text-xs font-semibold self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Queue
        </Button>
      </div>

      {/* Main Pickup Queue */}
      {loading && orderList.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground text-xs flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Checking ready orders...
        </div>
      ) : orderList.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500/40 mb-3" />
          <h3 className="text-sm font-bold text-foreground">All Orders Served</h3>
          <p className="text-xs text-muted-foreground mt-1">
            No dishes are currently waiting for table or counter delivery.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orderList.map((ord) => (
            <Card
              key={ord.id}
              className="border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm"
            >
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div>
                  {/* Top Bar: Table / Token & Time */}
                  <div className="flex items-start justify-between">
                    <div>
                      {ord.table_number ? (
                        <div className="text-xl font-black text-foreground flex items-center gap-2">
                          <Utensils className="h-5 w-5 text-[#FF6A00]" />
                          Table {ord.table_number}
                        </div>
                      ) : ord.daily_token ? (
                        <div className="text-xl font-black text-foreground flex items-center gap-2">
                          <Zap className="h-5 w-5 text-[#FF6A00]" />
                          Token #{ord.daily_token}
                        </div>
                      ) : (
                        <div className="text-xl font-black text-foreground">Takeaway Order</div>
                      )}
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {ord.order_number}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-800">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Ready Now</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="mt-4 space-y-1.5 bg-card/80 p-3 rounded-lg border border-border">
                    {(ord.items || []).map((it, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between text-xs text-foreground font-medium"
                      >
                        <span>
                          <span className="font-bold text-[#FF6A00] mr-1.5">{it.quantity}x</span>
                          {it.item_name}
                        </span>
                        {it.notes && (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                            ({it.notes})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Big Touch-Friendly Button (56px) */}
                <Button
                  onClick={() => handleMarkServed(ord.id)}
                  disabled={servingId === ord.id}
                  className="w-full min-h-[56px] text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-transform active:scale-[0.98]"
                >
                  {servingId === ord.id ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      Mark Served to Guest
                    </div>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
