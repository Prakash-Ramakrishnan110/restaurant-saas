import { apiClient } from "./client";

export interface OrderItemPayload {
  menu_item_id: string;
  quantity: number;
  course?: "STARTER" | "MAIN" | "DESSERT" | "BEVERAGE";
  is_fired?: boolean;
  notes?: string;
}

export interface CreateOrderPayload {
  branch_id?: string;
  table_session_id?: string | null;
  token_number?: number | null;
  order_workflow?: "TABLE_SERVICE" | "COUNTER_TOKEN" | "ROOM_SERVICE" | "BAR_TAB";
  notes?: string;
  items: OrderItemPayload[];
}

export interface OrderItem {
  id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price_paise: number;
  subtotal_paise: number;
  course: string;
  is_fired: boolean;
  station: string;
  notes: string;
  status: string;
}

export interface Order {
  id: string;
  branch_id: string;
  table_session_id?: string;
  table_label?: string;
  order_workflow: string;
  token_number?: number;
  status: "PLACED" | "PREPARING" | "READY" | "SERVED" | "COMPLETED" | "CANCELLED";
  placed_at: string;
  ready_at?: string;
  served_at?: string;
  notes: string;
  items: OrderItem[];
  total_paise: number;
}

export interface KDSTicket extends Order {
  elapsed_minutes: number;
}

export interface BillItemSummary {
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
  net_subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  total_tax_paise: number;
  total_paise: number;
  is_inclusive: boolean;
}

export interface BillInvoice {
  id: string;
  branch_id: string;
  table_session_id?: string;
  table_label: string;
  invoice_number: string;
  subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  discount_paise: number;
  total_paise: number;
  payment_method: "CASH" | "UPI" | "CARD" | "ROOM_FOLIO" | "SPLIT";
  amount_tendered_paise: number;
  change_due_paise: number;
  is_settled: boolean;
  settled_at: string;
  notes: string;
}

export interface SettleBillPayload {
  payment_method: "CASH" | "UPI" | "CARD" | "ROOM_FOLIO" | "SPLIT";
  amount_tendered_paise?: number;
  discount_paise?: number;
  notes?: string;
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
  getOrders: (params?: { branch_id?: string; status?: string; session_id?: string }) =>
    apiClient.get<Order[]>("/orders/", { params }),

  createOrder: (data: CreateOrderPayload) => apiClient.post<Order>("/orders/", data),

  cancelOrder: (orderId: string) =>
    apiClient.post<{ status: string; order_id: string }>(`/orders/${orderId}/cancel/`),

  fireMains: (orderId: string) =>
    apiClient.post<{ fired_count: number; order_id: string }>(`/orders/${orderId}/fire-mains/`),

  getKDSTickets: (station?: string) =>
    apiClient.get<KDSTicket[]>("/orders/kds/", { params: { station } }),

  bumpKDSTicket: (orderId: string) =>
    apiClient.post<{ order_id: string; status: string }>(`/orders/kds/${orderId}/bump/`),

  getSessionBill: (sessionId: string) =>
    apiClient.get<BillCalculation>(`/orders/billing/session/${sessionId}/`),

  settleBill: (sessionId: string, data: SettleBillPayload) =>
    apiClient.post<BillInvoice>(`/orders/billing/session/${sessionId}/settle/`, data),

  getInvoices: () => apiClient.get<BillInvoice[]>("/orders/billing/invoices/"),

  getServiceRequests: (status?: string) =>
    apiClient.get<ServiceRequest[]>("/orders/service-requests/", { params: { status } }),

  acknowledgeServiceRequest: (id: string) =>
    apiClient.post<{ id: string; status: string }>(`/orders/service-requests/${id}/acknowledge/`),
};
