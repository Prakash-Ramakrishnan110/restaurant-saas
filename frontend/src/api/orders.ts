import { apiClient } from "./client";

export interface OrderItemPayload {
  menu_item_id: string;
  quantity: number;
  course?: "STARTER" | "MAIN" | "DESSERT" | "BEVERAGE";
  seat_number?: number | null;
  is_fired?: boolean;
  notes?: string;
}

export interface CreateOrderPayload {
  branch_id?: string;
  table_session_id?: string | null;
  token_number?: number | null;
  order_workflow?: "TABLE_SERVICE" | "COUNTER_TOKEN" | "ROOM_SERVICE" | "BAR_TAB";
  notes?: string;
  idempotency_key?: string;
  items: OrderItemPayload[];
}

export interface OrderItem {
  id: string;
  menu_item_id: string;
  item_name: string;
  variant_name?: string;
  options_snapshot?: Array<{
    id: string;
    name: string;
    name_ta?: string;
    price_delta_paise: number;
  }>;
  quantity: number;
  unit_price_paise: number;
  subtotal_paise: number;
  course: string;
  seat_number?: number | null;
  is_fired: boolean;
  station: string;
  notes: string;
  status: string;
}

export interface Order {
  id: string;
  order_number?: string;
  branch_id: string;
  table_session_id?: string;
  table_label?: string;
  table_number?: string;
  order_workflow?: string;
  order_type?: string;
  token_number?: number;
  daily_token?: number;
  status:
    | "PENDING_APPROVAL"
    | "AWAITING_PAYMENT"
    | "PLACED"
    | "NEW"
    | "PREPARING"
    | "READY"
    | "SERVED"
    | "COMPLETED"
    | "BILLED"
    | "CANCELLED";
  source?: "STAFF" | "QR";
  payment_status?: "UNPAID" | "PAID";
  rejected_reason?: string;
  placed_at?: string;
  created_at?: string;
  ready_at?: string;
  served_at?: string;
  notes?: string;
  items?: OrderItem[];
  subtotal_paise?: number;
  total_paise?: number;
}

export interface KDSTicket extends Order {
  elapsed_minutes: number;
}

export interface BillItemSummary {
  id?: string;
  order_id?: string;
  item_name: string;
  quantity: number;
  unit_price_paise: number;
  subtotal_paise: number;
  course: string;
}

export interface BillCalculation {
  table_label: string;
  session_code: string;
  items: BillItemSummary[];
  items_count: number;
  subtotal_paise: number;
  discount_paise?: number;
  total_paise: number;
}

export interface InvoiceRefundRecord {
  id: string;
  branch_id?: string;
  invoice_id: string;
  invoice_number?: string;
  refund_number: string;
  amount_paise: number;
  reason_code:
    "ITEM_RETURNED" | "QUALITY_ISSUE" | "WRONG_ITEM" | "OVERCHARGED" | "CUSTOMER_CANCELLED";
  refund_method: "CASH" | "UPI" | "CARD" | "ROOM_FOLIO";
  restock_action: "NONE" | "RESTOCK" | "WASTE";
  refunded_lines?: Array<{
    item_name: string;
    quantity: number;
    amount_paise: number;
  }>;
  notes?: string;
  processed_by_name?: string;
  approved_by_name?: string | null;
  created_at: string;
}

export interface CreateInvoiceRefundPayload {
  amount_paise: number;
  reason_code:
    "ITEM_RETURNED" | "QUALITY_ISSUE" | "WRONG_ITEM" | "OVERCHARGED" | "CUSTOMER_CANCELLED";
  refund_method?: "CASH" | "UPI" | "CARD" | "ROOM_FOLIO";
  restock_action?: "NONE" | "RESTOCK" | "WASTE";
  refunded_lines?: Array<{
    item_name: string;
    quantity: number;
    amount_paise: number;
  }>;
  notes?: string;
}

export interface CashMovementRecord {
  id: string;
  shift_id: string;
  movement_type: "FLOAT_IN" | "CASH_DROP" | "PETTY_CASH_OUT" | "REFUND_CASH_OUT";
  amount_paise: number;
  reason: string;
  recorded_by_name?: string;
  created_at: string;
}

export interface ShiftCloseoutState {
  id: string;
  branch_id: string;
  cashier_name: string;
  status: "OPEN" | "CLOSED";
  is_locked: boolean;
  opened_at: string;
  closed_at?: string | null;
  opening_cash_paise: number;
  cash_sales_paise: number;
  cash_in_paise: number;
  cash_out_paise: number;
  cash_refunds_paise: number;
  expected_cash_paise: number | null;
  actual_cash_paise: number;
  cash_variance_paise: number | null;
  variance_threshold_paise: number;
  variance_reason_code?: string;
  denominations_snapshot?: Record<string, number>;
  upi_total_paise: number;
  card_total_paise: number;
  total_settled_paise: number;
  total_invoices_count: number;
  notes?: string;
  cash_movements?: CashMovementRecord[];
}

export interface SplitBillPreviewResponse {
  mode: "EQUAL" | "ITEMS";
  total_paise: number;
  shares?: number;
  selected_paise?: number;
  remaining_paise?: number;
  splits: Array<{
    share_index: number;
    label: string;
    amount_paise: number;
    items_count?: number;
  }>;
}

export interface BillInvoice {
  id: string;
  branch_id?: string;
  table_session_id?: string;
  order_id?: string;
  table_label?: string;
  table_number?: string;
  invoice_number: string;
  subtotal_paise: number;
  discount_paise?: number;
  total_paise: number;
  refunded_paise?: number;
  net_total_paise?: number;
  refunds?: InvoiceRefundRecord[];
  payment_method: "CASH" | "UPI" | "CARD" | "ROOM_FOLIO";
  amount_tendered_paise?: number;
  change_due_paise?: number;
  is_settled?: boolean;
  settled_at?: string;
  created_at?: string;
  notes?: string;
  items?: Array<{
    item_name: string;
    quantity: number;
    unit_price_paise: number;
    subtotal_paise?: number;
  }>;
  snapshot_lines?: Array<{
    item_name: string;
    quantity: number;
    unit_price_paise: number;
    subtotal_paise: number;
  }>;
}

export interface SettleBillPayload {
  payment_method: "CASH" | "UPI" | "CARD" | "ROOM_FOLIO";
  amount_tendered_paise?: number;
  discount_paise?: number;
  notes?: string;
}

export interface RangeReportResponse {
  start_date: string;
  end_date: string;
  sales_paise: number;
  gross_sales_paise?: number;
  refunds_paise?: number;
  net_sales_paise?: number;
  orders_count: number;
  settled_invoices_count: number;
  average_order_value_paise: number;
  sales_by_payment_method: Record<string, number>;
  daily_breakdown: Array<{
    date: string;
    sales_paise: number;
    invoices_count: number;
  }>;
  top_items: Array<{
    item_name: string;
    quantity: number;
    total_paise: number;
  }>;
  top_categories: Array<{
    category_name: string;
    quantity: number;
    total_paise: number;
  }>;
}

export interface ServiceRequest {
  id: string;
  table_id?: string;
  table_session_id?: string;
  table_label: string;
  request_type: "WATER" | "NAPKINS" | "CALL_WAITER" | "BILL";
  status: "PENDING" | "ACKNOWLEDGED" | "RESOLVED";
  created_at: string;
  acknowledged_at?: string;
}

export const ordersApi = {
  getOrders: (params?: {
    branch_id?: string;
    status?: string;
    session_id?: string;
    date?: string;
    q?: string;
  }) => apiClient.get<Order[]>("/orders/", { params }),

  getOrder: (orderId: string) => apiClient.get<Order>(`/orders/${orderId}/`),

  createOrder: (data: CreateOrderPayload) =>
    apiClient.post<Order>(
      "/orders/",
      data,
      data.idempotency_key ? { headers: { "Idempotency-Key": data.idempotency_key } } : undefined
    ),

  exportMyData: () =>
    apiClient.get<Blob>("/settings/export-my-data/", {
      responseType: "blob",
    }),

  cancelOrder: (orderId: string, reason?: string) =>
    apiClient.post<{ status: string; order_id: string }>(`/orders/${orderId}/cancel/`, { reason }),

  serveOrder: (orderId: string) =>
    apiClient.post<{ status: string; order_id: string }>(`/orders/${orderId}/serve/`),

  fireMains: (orderId: string) =>
    apiClient.post<{ fired_count: number; order_id: string }>(`/orders/${orderId}/fire-mains/`),

  approveOrder: (orderId: string) => apiClient.post<Order>(`/orders/${orderId}/approve/`),

  rejectOrder: (orderId: string, reason: string) =>
    apiClient.post<Order>(`/orders/${orderId}/reject/`, { reason }),

  getKDSTickets: (station?: string) =>
    apiClient.get<KDSTicket[]>("/orders/kds/", { params: { station } }),

  bumpKDSTicket: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/orders/kds/${orderId}/bump/`),

  getSessionBill: (sessionId: string) =>
    apiClient.get<BillCalculation>(`/orders/billing/session/${sessionId}/`),

  settleBill: (sessionId: string, data: SettleBillPayload) =>
    apiClient.post<BillInvoice>(`/orders/billing/session/${sessionId}/settle/`, data),

  settleOrder: (orderId: string, data: SettleBillPayload) =>
    apiClient.post<BillInvoice>(`/orders/billing/order/${orderId}/settle/`, data),

  getInvoices: (params?: {
    branch_id?: string;
    date?: string;
    payment_method?: string;
    q?: string;
  }) => apiClient.get<BillInvoice[]>("/invoices/", { params }),

  getInvoice: (id: string) => apiClient.get<BillInvoice>(`/invoices/${id}/`),

  getTodayReport: (params?: { branch_id?: string; date?: string }) =>
    apiClient.get<any>("/reports/today/", { params }),

  getRangeReport: (params?: { start_date?: string; end_date?: string; branch_id?: string }) =>
    apiClient.get<RangeReportResponse>("/reports/range/", { params }),

  getServiceRequests: (status?: string) =>
    apiClient.get<ServiceRequest[]>("/orders/service-requests/", { params: { status } }),

  acknowledgeServiceRequest: (id: string) =>
    apiClient.post<{ id: string; status: string }>(`/orders/service-requests/${id}/acknowledge/`),

  // Stage B: Shift Cash Handover, Partial Refunds, Split & Merge
  getCurrentShift: (branch_id?: string) =>
    apiClient.get<ShiftCloseoutState>("/orders/shifts/current/", {
      params: branch_id ? { branch_id } : undefined,
    }),

  recordCashMovement: (
    shiftId: string,
    data: {
      movement_type: "FLOAT_IN" | "CASH_DROP" | "PETTY_CASH_OUT";
      amount_paise: number;
      reason: string;
    }
  ) => apiClient.post<CashMovementRecord>(`/orders/shifts/${shiftId}/cash-movements/`, data),

  closeShift: (
    shiftId: string,
    data: {
      actual_cash_paise: number;
      opening_cash_paise?: number;
      denominations_snapshot?: Record<string, number>;
      variance_reason_code?: string;
      notes?: string;
    }
  ) => apiClient.post<ShiftCloseoutState>(`/orders/shifts/${shiftId}/close/`, data),

  getInvoiceRefunds: (invoiceId: string) =>
    apiClient.get<InvoiceRefundRecord[]>(`/orders/invoices/${invoiceId}/refunds/`),

  createInvoiceRefund: (invoiceId: string, data: CreateInvoiceRefundPayload) =>
    apiClient.post<InvoiceRefundRecord>(`/orders/invoices/${invoiceId}/refunds/`, data),

  previewSplitBill: (
    sessionId: string,
    data: { mode: "EQUAL" | "ITEMS"; shares?: number; item_ids?: string[] }
  ) =>
    apiClient.post<SplitBillPreviewResponse>(
      `/orders/billing/session/${sessionId}/split-preview/`,
      data
    ),

  moveSessionItems: (sessionId: string, data: { target_session_id: string; item_ids: string[] }) =>
    apiClient.post<{ source_session_id: string; target_session_id: string; moved_count: number }>(
      `/orders/billing/session/${sessionId}/move-items/`,
      data
    ),

  mergeTableSessions: (sessionId: string, data: { target_session_id: string }) =>
    apiClient.post<{ source_session_id: string; target_session_id: string; status: string }>(
      `/orders/billing/session/${sessionId}/merge/`,
      data
    ),
};
