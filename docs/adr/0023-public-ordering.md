# ADR 0023: Public Customer QR Ordering Architecture

**Status:** Accepted  
**Date:** 2026-11-14  
**Scope:** Guest QR ordering (`/q/:token`, `/q/:token/o/:trackingToken`) and corresponding staff approval/payment workflows.

---

## Context
Guests scan a table, counter, or room QR code on their phone to browse the branch menu and place orders without logging in, creating accounts, or entering phone numbers/OTPs. All pricing must be authoritative on the server, and restaurant operations must remain protected against abuse, duplicate taps, and cross-tenant data leakage.

---

## Decisions

### 1. Branch Ordering Modes
Each branch uses `BranchCapabilities.qr_ordering_mode`:
- **`DISABLED`**: QR page shows a generic unavailable/disabled message; menu and order endpoints return closed state.
- **`BROWSE_ONLY`**: Menu is visible, no cart or order placement; UI displays `"Please ask our staff to order"`.
- **`ORDER_WITH_APPROVAL`**: Guest order is created with status `PENDING_APPROVAL`. Kitchen does not see it until staff (`OWNER`, `BRANCH_MANAGER`, `CASHIER`, `WAITER`) explicitly approve it (moving to `PLACED` or `AWAITING_PAYMENT`) or reject it with a mandatory reason (`CANCELLED`).
- **`ORDER_DIRECT`**: Guest order bypasses approval and enters `PLACED` (or `AWAITING_PAYMENT` if pay-first).

### 2. Payment Timing (`PAY_FIRST` vs `PAY_LATER`)
- **`PAY_FIRST` branches**: Orders created via QR start in `AWAITING_PAYMENT` (or `PENDING_APPROVAL` first if `ORDER_WITH_APPROVAL`, then `AWAITING_PAYMENT` on approval). Customer tracker displays `"Please pay at the counter to start your order"` and the daily `token_number`. Kitchen sees the order only after the cashier marks it paid via the existing billing payment flow, transitioning it to `PLACED`.
- **`PAY_LATER` branches**: Orders join the active `TableSession` bill (or room entry). No online/customer payment is collected in this phase.

### 3. Table, Counter, and Room Policies
- **`CUSTOMER_CAN_OPEN`**: First valid scan may open an `OPEN` `TableSession` via `POST /api/v1/public/qr/<token>/session/` and receive a `TimestampSigner`-signed `session_token`.
- **`STAFF_ONLY`**: Public session opening returns `403 STAFF_ACTION_REQUIRED` until staff open the table session.
- **Counter QR codes**: Create `COUNTER_TOKEN` orders with a sequential daily `token_number` without requiring a `TableSession`.
- **Room QR codes**: Attach to the room / `TableSession` entry (`ROOM_SERVICE`).

### 4. Order Source & Separation of Statuses
- `Order.source` distinguishes `STAFF` vs `QR` (`OrderSource` enum).
- Order fulfilment status (`Order.status`: `PENDING_APPROVAL`, `AWAITING_PAYMENT`, `PLACED`, `PREPARING`, `READY`, `SERVED`, `COMPLETED`, `CANCELLED`) and payment status (`Order.payment_status`: `UNPAID`, `PAID`) remain separate fields.

### 5. Customer Order Tracking
- Each QR order receives a random 128-bit URL-safe `tracking_token` (`secrets.token_urlsafe(16)`), never exposing internal UUIDs or sequential order IDs in public URLs.
- `GET /api/v1/public/orders/<trackingToken>/` stops serving order details **12 hours** after `completed_at` (or `CANCELLED` timestamp), returning `404`.
- Tracking tokens live only in the URL (`/q/:token/o/:trackingToken`), never in `localStorage`.

### 6. Configurable Abuse & Payload Limits
All limits live in Django settings (`PUBLIC_QR_ORDER_LIMITS`) and are enforced server-side:
- Max **30** line items per order.
- Quantity **1 to 10** per line item.
- Line note max **200** characters; order-level note max **300** characters (stored as plain text, escaped on output).
- Max **3** unconfirmed/unfinished orders (`PENDING_APPROVAL`, `AWAITING_PAYMENT`, `PLACED`, `PREPARING`, `READY`) per `TableSession`.
- Max **5** QR orders per **10 minutes** per `TableSession` / QR token.
- Per-IP and per-QR-token rate throttling.
- Order total capped by `MAX_ORDER_TOTAL_PAISE` (default `1_000_000` paise = ₹10,000.00).

### 7. Idempotency
- `POST /api/v1/public/qr/<token>/orders/` requires an `Idempotency-Key` header (stored scoped to QR/branch + key).
- Repeating the same `Idempotency-Key` returns the existing order (`200 OK`) without creating a duplicate order or incrementing token numbers.

### 8. Privacy & Logging
- Zero personal data collected (no customer phone numbers, emails, or OTPs).
- Application logs never record order notes or IP addresses outside the ephemeral throttle cache.
- Public pages never store tokens in `localStorage`; cart state (item IDs, variant/option IDs, quantities, notes) may use `sessionStorage`.
