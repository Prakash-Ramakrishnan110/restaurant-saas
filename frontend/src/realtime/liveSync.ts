import { useEffect, useRef } from "react";
import { getAccessToken, refreshAccessToken } from "../api/client";
import { getApiBaseUrl } from "../native/bridge";

export interface LiveSyncEvent {
  type?: string;
  event_type?: string;
  order_id?: string;
  table_id?: string;
  [key: string]: unknown;
}

export const LIVE_SYNC_EVENT = "smf:live-sync";

export function triggerLiveSync(detail?: LiveSyncEvent): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LIVE_SYNC_EVENT, { detail: detail || {} }));
}

function buildStreamUrl(branchId: string, token: string): string {
  const apiBase = getApiBaseUrl();
  let wsOrigin: string;
  if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
    const parsed = new URL(apiBase);
    const proto = parsed.protocol === "https:" ? "wss:" : "ws:";
    wsOrigin = `${proto}//${parsed.host}`;
  } else {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    wsOrigin = `${proto}//${window.location.host}`;
  }
  return `${wsOrigin}/ws/v1/branch/${branchId}/stream/?token=${encodeURIComponent(token)}`;
}

/**
 * Maintains a WebSocket connection to `/ws/v1/branch/<branchId>/stream/`
 * and broadcasts `smf:live-sync` events for sub-second UI updates across
 * the Android Waiter App and Web Dashboard.
 */
export function connectBranchLiveSync(
  branchId: string,
  onStatusChange?: (connected: boolean) => void
): () => void {
  if (typeof window === "undefined" || typeof WebSocket === "undefined" || !branchId) {
    return () => undefined;
  }

  let closed = false;
  let ws: WebSocket | null = null;
  let retryDelay = 1500;
  let retryTimer: number | null = null;

  const connect = async () => {
    if (closed) return;
    let token = getAccessToken();
    if (!token) {
      token = await refreshAccessToken();
    }
    if (!token || closed) {
      onStatusChange?.(false);
      return;
    }

    try {
      ws = new WebSocket(buildStreamUrl(branchId, token));
    } catch {
      onStatusChange?.(false);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      retryDelay = 1500;
      onStatusChange?.(true);
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as LiveSyncEvent;
        triggerLiveSync(data);
      } catch {
        triggerLiveSync({});
      }
    };

    ws.onclose = () => {
      onStatusChange?.(false);
      if (!closed) {
        scheduleReconnect();
      }
    };

    ws.onerror = () => {
      onStatusChange?.(false);
    };
  };

  const scheduleReconnect = () => {
    if (closed || retryTimer !== null) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      retryDelay = Math.min(8000, Math.round(retryDelay * 1.5));
      void connect();
    }, retryDelay);
  };

  void connect();

  return () => {
    closed = true;
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
    }
    if (ws) {
      try {
        ws.close();
      } catch {
        // Ignore close errors
      }
    }
  };
}

/**
 * Subscribe any page/component to instant WebSocket (`smf:live-sync`) and
 * Android app resume (`smf:native-resume`) refreshes.
 */
export function useLiveSync(callback: () => void): void {
  const cbRef = useRef(callback);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handler = () => {
      cbRef.current();
    };
    window.addEventListener(LIVE_SYNC_EVENT, handler);
    window.addEventListener("smf:native-resume", handler);
    return () => {
      window.removeEventListener(LIVE_SYNC_EVENT, handler);
      window.removeEventListener("smf:native-resume", handler);
    };
  }, []);
}
