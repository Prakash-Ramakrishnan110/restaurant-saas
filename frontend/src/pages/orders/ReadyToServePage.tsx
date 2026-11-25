import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, RefreshCw, Utensils, Zap, Clock, Bell, Check, Volume2 } from "lucide-react";
import { ordersApi, Order, ServiceRequest } from "../../api/orders";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { unwrapList } from "../../api/pagination";
import { playOrderAlert, playWaiterCallAlert } from "../../utils/soundAlerts";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

export const ReadyToServePage: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [servingId, setServingId] = useState<string | null>(null);
  const [callingId, setCallingId] = useState<string | null>(null);
  const [mySectionIds, setMySectionIds] = useState<string[]>([]);
  const [tableSectionMap, setTableSectionMap] = useState<Record<string, string>>({});
  const [sectionScope, setSectionScope] = useState<"MINE" | "ALL">("MINE");
  const prevReadyIdsRef = useRef<Set<string> | null>(null);
  const prevReqIdsRef = useRef<Set<string> | null>(null);

  const fetchReadyOrders = async () => {
    try {
      setLoading(true);
      const [res, reqRes, assignRes, tblRes] = await Promise.all([
        ordersApi.getOrders({ status: "READY" }),
        ordersApi.getServiceRequests("PENDING").catch(() => ({ data: [] })),
        apiClient.get<any>("/staff-assignments/").catch(() => ({ data: [] })),
        apiClient.get<any>("/tables/").catch(() => ({ data: [] })),
      ]);
      const nextOrders = unwrapList<Order>(res.data);
      const nextReqs = unwrapList<ServiceRequest>(reqRes.data);

      const nextReadyIds = new Set(nextOrders.map((o) => o.id));
      if (prevReadyIdsRef.current !== null) {
        const newlyReady = nextOrders.find((o) => !prevReadyIdsRef.current!.has(o.id));
        if (newlyReady) {
          playOrderAlert(newlyReady.table_number ? `Table ${newlyReady.table_number}` : "Pickup");
        }
      }
      prevReadyIdsRef.current = nextReadyIds;

      const nextReqIds = new Set(nextReqs.map((r) => r.id));
      if (prevReqIdsRef.current !== null) {
        const newReq = nextReqs.find((r) => !prevReqIdsRef.current!.has(r.id));
        if (newReq) {
          playWaiterCallAlert(newReq.table_label ? `Table ${newReq.table_label}` : undefined);
        }
      }
      prevReqIdsRef.current = nextReqIds;

      setOrders(nextOrders);
      setServiceRequests(nextReqs);
      const assigns = assignRes.data?.results || assignRes.data || [];
      const mine = Array.isArray(assigns)
        ? assigns
            .filter((a: any) => user?.email && a.user_email === user.email)
            .map((a: any) => String(a.section))
        : [];
      setMySectionIds(mine);
      const tbls = tblRes.data?.results || tblRes.data || [];
      if (Array.isArray(tbls)) {
        const map: Record<string, string> = {};
        tbls.forEach((t: any) => {
          if (t.label && t.section) map[String(t.label)] = String(t.section);
        });
        setTableSectionMap(map);
      }
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      alert("Failed to mark order as served: " + message);
    } finally {
      setServingId(null);
    }
  };

  const handleCallToken = async (orderId: string, tokenNum: number) => {
    try {
      setCallingId(orderId);
      await ordersApi.callToken(orderId);
      playOrderAlert(`Token #${tokenNum}`);
      await fetchReadyOrders();
    } catch {
      // ignore transient error
    } finally {
      setCallingId(null);
    }
  };

  const allReadyOrders = Array.isArray(orders) ? orders : [];
  const hasAssignments = mySectionIds.length > 0;
  const orderList =
    hasAssignments && sectionScope === "MINE"
      ? allReadyOrders.filter((o) => {
          if (!o.table_number) return true;
          const secId = tableSectionMap[o.table_number];
          return !secId || mySectionIds.includes(secId);
        })
      : allReadyOrders;

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
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                {orderList.length} Ready
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Kitchen items prepared and waiting for waiter or counter pickup
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {hasAssignments && (
            <div className="flex items-center gap-1 rounded-md border border-input bg-card p-1">
              <button
                type="button"
                onClick={() => setSectionScope("MINE")}
                className={`px-2.5 py-1 rounded text-xs font-semibold min-h-[32px] ${
                  sectionScope === "MINE"
                    ? "bg-[#FF6A00] text-[#0B1F3B]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                My Sections
              </button>
              <button
                type="button"
                onClick={() => setSectionScope("ALL")}
                className={`px-2.5 py-1 rounded text-xs font-semibold min-h-[32px] ${
                  sectionScope === "ALL"
                    ? "bg-[#FF6A00] text-[#0B1F3B]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All Sections
              </button>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReadyOrders}
            disabled={loading}
            className="min-h-[44px] text-xs font-semibold"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Guest Service Requests (Call waiter, Water, Bill, Cutlery) */}
      {serviceRequests.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-200">
            <Bell className="h-4 w-4 text-[#FF6A00]" />
            <span>Guest Table Requests ({serviceRequests.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {serviceRequests
              .filter((r) => {
                if (!hasAssignments || sectionScope !== "MINE" || !r.table_label) return true;
                const secId = tableSectionMap[r.table_label];
                return !secId || mySectionIds.includes(secId);
              })
              .map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-card p-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-foreground">
                      Table {req.table_label || "—"} • {req.request_type.replace(/_/g, " ")}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      await ordersApi.resolveServiceRequest(req.id);
                      await fetchReadyOrders();
                    }}
                    className="h-8 px-3 bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] font-bold"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Done
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}

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
                          <span className="text-xs text-amber-800 dark:text-amber-300 italic">
                            ({it.notes})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Big Touch-Friendly Buttons (56px) */}
                <div className="flex flex-col sm:flex-row gap-2">
                  {(ord.token_number || ord.daily_token) && (
                    <Button
                      type="button"
                      onClick={() =>
                        handleCallToken(ord.id, Number(ord.token_number || ord.daily_token))
                      }
                      disabled={callingId === ord.id}
                      data-testid="call-token-btn"
                      className="sm:w-auto min-h-[56px] px-4 text-sm font-bold bg-[#FF6A00] hover:bg-[#E55F00] text-[#0B1F3B] gap-2"
                    >
                      <Volume2 className="h-5 w-5" />
                      Call #{ord.token_number || ord.daily_token}
                    </Button>
                  )}
                  <Button
                    onClick={() => handleMarkServed(ord.id)}
                    disabled={servingId === ord.id}
                    className="flex-1 min-h-[56px] text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-transform active:scale-[0.98]"
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
