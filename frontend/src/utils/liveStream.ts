export interface BranchStreamEvent {
  type?: string;
  event?:
    | "order.created"
    | "order.status_changed"
    | "table.updated"
    | "menu.availability_changed"
    | "stock.alert"
    | string;
  branch_id?: string;
  data?: Record<string, any>;
}

export interface BranchLiveStreamOptions {
  branchId: string;
  token: string;
  wsBaseUrl?: string;
  onEvent: (event: BranchStreamEvent) => void;
  onFallbackPoll: () => void;
  fallbackIntervalMs?: number;
  maxRetriesBeforeFallback?: number;
  webSocketFactory?: (url: string) => WebSocket;
}

export class BranchLiveStreamClient {
  private options: Required<
    Pick<BranchLiveStreamOptions, "fallbackIntervalMs" | "maxRetriesBeforeFallback">
  > &
    BranchLiveStreamOptions;
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private failedAttempts = 0;
  private stopped = false;
  public isUsingFallback = false;

  constructor(options: BranchLiveStreamOptions) {
    this.options = {
      fallbackIntervalMs: 5000,
      maxRetriesBeforeFallback: 2,
      ...options,
    };
  }

  private buildWsUrl(): string {
    const base =
      this.options.wsBaseUrl ||
      (typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`
        : "ws://localhost:8000");
    const encodedToken = encodeURIComponent(this.options.token);
    return `${base}/ws/v1/branch/${this.options.branchId}/stream/?token=${encodedToken}`;
  }

  public start(): void {
    this.stopped = false;
    this.connect();
  }

  public connect(): void {
    if (this.stopped) return;
    const url = this.buildWsUrl();
    try {
      const factory = this.options.webSocketFactory || ((u: string) => new WebSocket(u));
      const socket = factory(url);
      this.ws = socket;

      socket.onopen = () => {
        this.failedAttempts = 0;
        this.stopFallbackPolling();
        this.startHeartbeat();
      };

      socket.onmessage = (msgEvent: MessageEvent) => {
        try {
          const parsed = JSON.parse(String(msgEvent.data)) as BranchStreamEvent;
          if (parsed.type === "pong") {
            return;
          }
          this.options.onEvent(parsed);
        } catch {
          // Ignore malformed frame
        }
      };

      socket.onerror = () => {
        // Handled by onclose
      };

      socket.onclose = () => {
        this.stopHeartbeat();
        if (this.stopped) return;
        this.handleConnectionFailure();
      };
    } catch {
      this.handleConnectionFailure();
    }
  }

  private handleConnectionFailure(): void {
    this.failedAttempts += 1;
    if (this.failedAttempts >= this.options.maxRetriesBeforeFallback) {
      this.startFallbackPolling();
    }
    const backoffMs = Math.min(30000, 1000 * Math.pow(2, this.failedAttempts - 1));
    this.reconnectTimer = setTimeout(() => {
      if (!this.stopped) {
        this.connect();
      }
    }, backoffMs);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === 1) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startFallbackPolling(): void {
    if (this.isUsingFallback) return;
    this.isUsingFallback = true;
    this.options.onFallbackPoll();
    this.fallbackTimer = setInterval(() => {
      if (!this.stopped) {
        this.options.onFallbackPoll();
      }
    }, this.options.fallbackIntervalMs);
  }

  private stopFallbackPolling(): void {
    this.isUsingFallback = false;
    if (this.fallbackTimer) {
      clearInterval(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  public stop(): void {
    this.stopped = true;
    this.stopHeartbeat();
    this.stopFallbackPolling();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }
}
