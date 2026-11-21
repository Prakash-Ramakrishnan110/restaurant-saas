import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  saveFloorReadCache,
  loadFloorReadCache,
  getOfflineOrderQueue,
  enqueueOfflineOrder,
  replayOfflineOrders,
  removeConflictItemsAndRetry,
} from "../utils/offlineQueue";
import { BranchLiveStreamClient } from "../utils/liveStream";
import { ordersApi } from "../api/orders";

describe("Stage C: Offline Order Queue, Conflict Resolution & WebSocket Fallback", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves and restores floor read cache per tenant", () => {
    saveFloorReadCache("tenant-1", {
      tables: [{ id: "t1", label: "T-01" }],
      categories: [{ id: "c1", name: "Starters" }],
      menuItems: [{ id: "m1", name: "Paneer Tikka", base_price_paise: 24000 }],
      activeSessions: [{ id: "s1", status: "OPEN" }],
      cachedAt: "2026-11-21T10:00:00Z",
    });

    const loaded = loadFloorReadCache("tenant-1");
    expect(loaded).not.toBeNull();
    expect(loaded?.tables[0].label).toBe("T-01");
    expect(loaded?.menuItems[0].name).toBe("Paneer Tikka");
    expect(loadFloorReadCache("tenant-2")).toBeNull();
  });

  it("enqueues offline orders and replays them in FIFO order with Idempotency-Key", async () => {
    const createOrderSpy = vi.spyOn(ordersApi, "createOrder").mockResolvedValue({
      data: { id: "ord-server-1", status: "PLACED" } as any,
    } as any);

    enqueueOfflineOrder({
      client_order_id: "idem-uuid-1",
      tenant_id: "tenant-1",
      table_label: "T-01",
      created_at: "2026-11-21T09:00:00Z",
      payload: {
        table_session_id: "sess-1",
        order_workflow: "TABLE_SERVICE",
        items: [{ menu_item_id: "item-1", quantity: 2 }],
      },
    });

    enqueueOfflineOrder({
      client_order_id: "idem-uuid-2",
      tenant_id: "tenant-1",
      table_label: "T-02",
      created_at: "2026-11-21T09:01:00Z",
      payload: {
        table_session_id: "sess-2",
        order_workflow: "TABLE_SERVICE",
        items: [{ menu_item_id: "item-2", quantity: 1 }],
      },
    });

    expect(getOfflineOrderQueue()).toHaveLength(2);

    const result = await replayOfflineOrders();
    expect(result).toEqual({ synced: 2, conflicts: 0 });
    expect(getOfflineOrderQueue()).toHaveLength(0);
    expect(createOrderSpy).toHaveBeenCalledTimes(2);
    expect(createOrderSpy.mock.calls[0][0].idempotency_key).toBe("idem-uuid-1");
    expect(createOrderSpy.mock.calls[1][0].idempotency_key).toBe("idem-uuid-2");
  });

  it("marks 86'd item rejection as CONFLICT and retries remaining items cleanly", async () => {
    const createOrderSpy = vi
      .spyOn(ordersApi, "createOrder")
      .mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: {
              code: "ITEM_UNAVAILABLE",
              message: "One or more selected items are currently sold out.",
              details: { item_ids: ["item-86"] },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: { id: "ord-server-recovered", status: "PLACED" } as any,
      } as any);

    enqueueOfflineOrder({
      client_order_id: "idem-conflict-1",
      tenant_id: "tenant-1",
      table_label: "T-04",
      payload: {
        table_session_id: "sess-4",
        order_workflow: "TABLE_SERVICE",
        items: [
          { menu_item_id: "item-86", quantity: 1 },
          { menu_item_id: "item-available", quantity: 2 },
        ],
      },
    });

    const firstReplay = await replayOfflineOrders();
    expect(firstReplay).toEqual({ synced: 0, conflicts: 1 });

    const queueAfterConflict = getOfflineOrderQueue();
    expect(queueAfterConflict).toHaveLength(1);
    expect(queueAfterConflict[0].status).toBe("CONFLICT");
    expect(queueAfterConflict[0].conflict_item_ids).toEqual(["item-86"]);

    const retryResult = await removeConflictItemsAndRetry("idem-conflict-1");
    expect(retryResult).toEqual({ synced: 1, conflicts: 0 });
    expect(getOfflineOrderQueue()).toHaveLength(0);
    expect(createOrderSpy).toHaveBeenCalledTimes(2);
    expect(createOrderSpy.mock.calls[1][0].items).toEqual([
      { menu_item_id: "item-available", quantity: 2 },
    ]);
  });

  it("falls back to HTTP polling after 2 failed WebSocket connections and stops fallback on reconnect", () => {
    vi.useFakeTimers();
    const events: any[] = [];
    const onFallbackPoll = vi.fn();
    const sockets: any[] = [];

    const client = new BranchLiveStreamClient({
      branchId: "branch-123",
      token: "jwt-token-xyz",
      wsBaseUrl: "ws://localhost:8000",
      onEvent: (ev) => events.push(ev),
      onFallbackPoll,
      fallbackIntervalMs: 5000,
      maxRetriesBeforeFallback: 2,
      webSocketFactory: (url: string) => {
        const fakeWs: any = {
          url,
          readyState: 0,
          send: vi.fn(),
          close: vi.fn(),
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
        };
        sockets.push(fakeWs);
        return fakeWs as WebSocket;
      },
    });

    client.start();
    expect(sockets).toHaveLength(1);

    // 1st failure
    sockets[0].onclose();
    expect(client.isUsingFallback).toBe(false);

    // Advance timer for 1st reconnect attempt
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);

    // 2nd failure triggers HTTP fallback polling
    sockets[1].onclose();
    expect(client.isUsingFallback).toBe(true);
    expect(onFallbackPoll).toHaveBeenCalledTimes(1);

    // Advance 2nd reconnect timer and simulate successful open + event
    vi.advanceTimersByTime(2000);
    expect(sockets).toHaveLength(3);
    sockets[2].readyState = 1;
    sockets[2].onopen();
    expect(client.isUsingFallback).toBe(false);

    sockets[2].onmessage({
      data: JSON.stringify({
        event: "order.created",
        branch_id: "branch-123",
        data: { order_number: "ORD-101" },
      }),
    });
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("order.created");

    client.stop();
    vi.useRealTimers();
  });
});
