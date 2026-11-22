import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "/api/v1";

// Dedicated public client that never reads or writes auth tokens from storage
const publicHttp = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export type FoodType = "VEG" | "NON_VEG" | "EGG" | string;
export type QROrderingMode = "DISABLED" | "BROWSE_ONLY" | "ORDER_WITH_APPROVAL" | "ORDER_DIRECT";
export type PaymentTiming = "PAY_FIRST" | "PAY_LATER";

export interface PublicMenuVariant {
  id: string;
  name: string;
  name_ta: string;
  price_paise: number;
  is_default: boolean;
}

export interface PublicMenuOption {
  id: string;
  name: string;
  name_ta: string;
  price_delta_paise: number;
  is_default: boolean;
}

export interface PublicMenuOptionGroup {
  id: string;
  name: string;
  name_ta: string;
  min_select: number;
  max_select: number;
  options: PublicMenuOption[];
}

export interface PublicMenuItem {
  id: string;
  name: string;
  name_ta: string;
  description: string;
  description_ta: string;
  price_paise: number;
  food_type: FoodType;
  is_bestseller: boolean;
  ingredients_note?: string;
  allergen_note?: string;
  image_card: string;
  image_thumb: string;
  is_available: boolean;
  variants: PublicMenuVariant[];
  option_groups: PublicMenuOptionGroup[];
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  name_ta: string;
  items: PublicMenuItem[];
}

export interface PublicQRMenuResponse {
  display_name: string;
  logo_url: string;
  brand_primary_color: string;
  branch_name: string;
  area_name: string;
  target_type: "TABLE" | "COUNTER" | "ROOM" | string;
  target_label: string;
  ordering_mode: QROrderingMode;
  payment_timing: PaymentTiming;
  session_policy: "CUSTOMER_CAN_OPEN" | "STAFF_ONLY" | string;
  active_session_open: boolean;
  allows_service_requests?: boolean;
  categories: PublicMenuCategory[];
}

export interface PublicOrderCreateItem {
  menu_item_id: string;
  variant_id?: string | null;
  option_ids?: string[];
  quantity: number;
  notes?: string;
}

export interface PublicOrderCreatePayload {
  items: PublicOrderCreateItem[];
  notes?: string;
  guest_label?: string;
  session_token?: string;
}

export interface PublicOrderCreateResponse {
  order_number: string;
  token_number: number | null;
  status: string;
  payment_status: string;
  customer_message_key: string;
  tracking_token: string;
  tracking_url: string;
}

export interface PublicOrderTrackerItem {
  item_name: string;
  variant_name: string;
  options: Array<{ name: string; price_delta_paise: number }>;
  quantity: number;
  notes: string;
  unit_price_paise: number;
  subtotal_paise: number;
}

export interface PublicOrderTrackerResponse {
  display_name?: string;
  logo_url?: string;
  branch_name?: string;
  order_number: string;
  status: string;
  status_key: string;
  payment_status: string;
  payment_timing: PaymentTiming;
  target_label: string;
  token_number: number | null;
  rejected_reason: string;
  total_paise: number;
  placed_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  items: PublicOrderTrackerItem[];
}

export const publicQrApi = {
  getMenu: (token: string) =>
    publicHttp.get<PublicQRMenuResponse>(`/public/qr/${encodeURIComponent(token)}/menu/`),

  openSession: (token: string, guestCount = 1) =>
    publicHttp.post<{ session_token: string; session_code: string }>(
      `/public/qr/${encodeURIComponent(token)}/session/`,
      { guest_count: guestCount }
    ),

  createOrder: (token: string, payload: PublicOrderCreatePayload, idempotencyKey: string) =>
    publicHttp.post<PublicOrderCreateResponse>(
      `/public/qr/${encodeURIComponent(token)}/orders/`,
      payload,
      {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      }
    ),

  trackOrder: (trackingToken: string) =>
    publicHttp.get<PublicOrderTrackerResponse>(
      `/public/orders/${encodeURIComponent(trackingToken)}/`
    ),

  reorderPreview: (
    token: string,
    items: Array<{
      menu_item_id: string;
      variant_id?: string | null;
      option_ids?: string[];
      quantity: number;
    }>
  ) =>
    publicHttp.post<{
      has_changes: boolean;
      items: Array<{
        menu_item_id: string;
        item_name: string;
        variant_id?: string | null;
        option_ids?: string[];
        quantity: number;
        is_available: boolean;
        price_changed?: boolean;
        reason?: string;
        current_unit_price_paise: number;
      }>;
    }>(`/public/qr/${encodeURIComponent(token)}/reorder-preview/`, { items }),

  submitServiceRequest: (
    token: string,
    requestType: "CALL_WAITER" | "WATER" | "BILL" | "CUTLERY"
  ) =>
    publicHttp.post<{ id: string; request_type: string; status: string }>(
      `/public/qr/${encodeURIComponent(token)}/service-requests/`,
      { request_type: requestType }
    ),

  submitFeedback: (
    trackingToken: string,
    payload: {
      food_rating: number;
      service_rating: number;
      suggestion_type?: "FOOD" | "SERVICE" | "CLEANLINESS" | "PRICE" | "OTHER" | "";
      comment?: string;
    }
  ) =>
    publicHttp.post<{ id: string; food_rating: number; service_rating: number }>(
      `/public/orders/${encodeURIComponent(trackingToken)}/feedback/`,
      payload
    ),
};
