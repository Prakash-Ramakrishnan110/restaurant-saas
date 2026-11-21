import { ordersApi, CreateOrderPayload } from "../api/orders";

export interface OfflineOrderQueueEntry {
  client_order_id: string;
  tenant_id: string;
  branch_id?: string;
  table_label?: string;
  payload: CreateOrderPayload;
  status: "QUEUED" | "SYNCING" | "CONFLICT";
  conflict_reason?: string;
  conflict_item_ids?: string[];
  created_at: string;
}

export interface FloorReadCacheData {
  tables: any[];
  categories: any[];
  menuItems: any[];
  activeSessions: any[];
  cachedAt: string;
}

const QUEUE_STORAGE_KEY = "smf_offline_order_queue_v1";
const FLOOR_CACHE_PREFIX = "smf_floor_cache_v1_";
const IDB_NAME = "servemyfood_offline_v1";
const IDB_STORE_QUEUE = "order_queue";

function emitQueueUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("smf-offline-queue-updated"));
  }
}

function syncQueueToIndexedDB(entries: OfflineOrderQueueEntry[]): void {
  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    return;
  }
  try {
    const req = window.indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_QUEUE)) {
        db.createObjectStore(IDB_STORE_QUEUE, { keyPath: "client_order_id" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(IDB_STORE_QUEUE, "readwrite");
      const store = tx.objectStore(IDB_STORE_QUEUE);
      store.clear();
      entries.forEach((entry) => store.put(entry));
      tx.oncomplete = () => db.close();
    };
  } catch {
    // Fallback to localStorage already persisted
  }
}

export function generateClientOrderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function saveFloorReadCache(tenantId: string, data: FloorReadCacheData): void {
  if (!tenantId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${FLOOR_CACHE_PREFIX}${tenantId}`, JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
}

export function loadFloorReadCache(tenantId: string): FloorReadCacheData | null {
  if (!tenantId || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${FLOOR_CACHE_PREFIX}${tenantId}`);
    if (!raw) return null;
    return JSON.parse(raw) as FloorReadCacheData;
  } catch {
    return null;
  }
}

export function getOfflineOrderQueue(): OfflineOrderQueueEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOfflineOrderQueue(entries: OfflineOrderQueueEntry[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(entries));
  syncQueueToIndexedDB(entries);
  emitQueueUpdated();
}

export function enqueueOfflineOrder(
  entry: Omit<OfflineOrderQueueEntry, "client_order_id" | "status" | "created_at"> & {
    client_order_id?: string;
    status?: "QUEUED" | "SYNCING" | "CONFLICT";
    created_at?: string;
  }
): OfflineOrderQueueEntry {
  const queue = getOfflineOrderQueue();
  const clientOrderId =
    entry.client_order_id || entry.payload.idempotency_key || generateClientOrderId();
  const existingIdx = queue.findIndex((q) => q.client_order_id === clientOrderId);

  const normalized: OfflineOrderQueueEntry = {
    client_order_id: clientOrderId,
    tenant_id: entry.tenant_id,
    branch_id: entry.branch_id,
    table_label: entry.table_label,
    payload: {
      ...entry.payload,
      idempotency_key: clientOrderId,
    },
    status: entry.status || "QUEUED",
    conflict_reason: entry.conflict_reason,
    conflict_item_ids: entry.conflict_item_ids,
    created_at: entry.created_at || new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    queue[existingIdx] = normalized;
  } else {
    queue.push(normalized);
  }
  saveOfflineOrderQueue(queue);
  return normalized;
}

export function removeOfflineOrder(clientOrderId: string): void {
  const queue = getOfflineOrderQueue().filter((e) => e.client_order_id !== clientOrderId);
  saveOfflineOrderQueue(queue);
}

export async function removeConflictItemsAndRetry(
  clientOrderId: string
): Promise<{ synced: number; conflicts: number }> {
  const queue = getOfflineOrderQueue();
  const target = queue.find((e) => e.client_order_id === clientOrderId);
  if (!target) {
    return { synced: 0, conflicts: 0 };
  }

  const badIds = new Set((target.conflict_item_ids || []).map(String));
  const remainingItems = target.payload.items.filter(
    (item) => !badIds.has(String(item.menu_item_id))
  );

  if (remainingItems.length === 0) {
    removeOfflineOrder(clientOrderId);
    return { synced: 0, conflicts: 0 };
  }

  target.payload = {
    ...target.payload,
    items: remainingItems,
  };
  target.status = "QUEUED";
  target.conflict_reason = undefined;
  target.conflict_item_ids = undefined;
  saveOfflineOrderQueue(queue);

  return replayOfflineOrders();
}

let isReplaying = false;

export async function replayOfflineOrders(): Promise<{ synced: number; conflicts: number }> {
  if (isReplaying) {
    return { synced: 0, conflicts: 0 };
  }
  isReplaying = true;
  let synced = 0;
  let conflicts = 0;

  try {
    const queue = getOfflineOrderQueue().sort((a, b) => a.created_at.localeCompare(b.created_at));

    for (const entry of [...queue]) {
      if (entry.status === "CONFLICT") {
        conflicts += 1;
        continue;
      }

      entry.status = "SYNCING";
      saveOfflineOrderQueue(queue);

      try {
        await ordersApi.createOrder({
          ...entry.payload,
          idempotency_key: entry.client_order_id,
        });
        const idx = queue.findIndex((q) => q.client_order_id === entry.client_order_id);
        if (idx >= 0) {
          queue.splice(idx, 1);
        }
        synced += 1;
        saveOfflineOrderQueue(queue);
      } catch (err: any) {
        if (!err?.response) {
          // Network still unreachable: revert to QUEUED and stop FIFO replay
          entry.status = "QUEUED";
          saveOfflineOrderQueue(queue);
          break;
        }

        const errData = err.response.data;
        const errCode = errData?.error?.code || errData?.code;
        const itemIds = errData?.error?.details?.item_ids || errData?.details?.item_ids || [];

        entry.status = "CONFLICT";
        entry.conflict_reason =
          errCode === "ITEM_UNAVAILABLE"
            ? errData?.error?.message ||
              "One or more selected items are currently sold out or unavailable."
            : errData?.error?.message ||
              errData?.detail ||
              "Order could not be synced due to a validation conflict.";
        entry.conflict_item_ids = Array.isArray(itemIds) ? itemIds.map(String) : [];
        conflicts += 1;
        saveOfflineOrderQueue(queue);
      }
    }
  } finally {
    isReplaying = false;
  }

  return { synced, conflicts };
}
