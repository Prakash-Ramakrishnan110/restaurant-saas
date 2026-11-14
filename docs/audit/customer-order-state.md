# Customer QR Ordering — Current State Audit (S0)

**Date:** 2026-11-14  
**Scope:** Inspection of existing backend and frontend capabilities for guest QR ordering (`PublicQRPage`, public QR endpoints, `qr_ordering_mode`, `qr_session_policy`, `TableSession`, order sources/statuses, and signed session tokens). No code was modified during S0.

---

## 1. What Already Exists

### 1.1 Backend Models & Configuration (`backend/apps/venues/`)
- **`QROrderingMode`** (`apps/venues/constants.py`): `DISABLED`, `BROWSE_ONLY`, `ORDER_WITH_APPROVAL` (default), `ORDER_DIRECT`.
- **`QRSessionPolicy`** (`apps/venues/constants.py`): `CUSTOMER_CAN_OPEN` (default), `STAFF_ONLY`.
- **`PaymentTiming`** (`apps/venues/constants.py`): `PAY_FIRST`, `PAY_LATER`, `EITHER`.
- **`BranchCapabilities`** (`apps/venues/models.py`): Stores `allows_qr_ordering`, `qr_ordering_mode`, `qr_session_policy`, `payment_timing`, and `order_workflow` per branch.
- **`TableSession`** (`apps/venues/models.py`): Tracks `OPEN`/`CLOSED` table sessions with `session_code` and `opened_via` (`QR_CUSTOMER` supported).
- **`QRCode`** (`apps/venues/models.py`): Uses random `public_token`, `is_active`, `target_type` (`TABLE`, `COUNTER`, `ROOM`, `AREA`), and supports rotation/deactivation.

### 1.2 Existing Public Endpoints (`backend/apps/venues/views.py` & `urls.py`)
- **`GET /api/v1/public/qr/<token>/`** (`PublicQRDetailView`):
  - `AllowAny`, `AnonRateThrottle`.
  - Validates `qr.is_active` and `is_tenant_allowed(tenant)` (returns generic 404 otherwise).
  - Returns restaurant branding (`display_name`, `logo_url`, `brand_primary_color`), location labels (`branch_name`, `area_name`, `table_label`), `ordering_mode`, `active_session_status`, `can_open_session`, and `open_table_requires_staff`.
- **`POST /api/v1/public/qr/<token>/session/`** (`PublicQROpenSessionView`):
  - `AllowAny`, `AnonRateThrottle`.
  - Enforces `QRSessionPolicy.STAFF_ONLY` (`403 STAFF_ACTION_REQUIRED`) and `allows_qr_ordering`.
  - Opens or rejoins an `OPEN` `TableSession` for `qr.table` and signs `session.session_code` with `TimestampSigner(salt="qr-session")` -> returns `session_token`.

### 1.3 Existing Order Models (`backend/apps/orders/models.py`)
- **`OrderStatus`**: `PLACED`, `PREPARING`, `READY`, `SERVED`, `COMPLETED`, `CANCELLED`.
- **`Order`**: Has `branch`, `table_session`, `order_number`, `order_workflow`, `token_number`, `status`, `notes`, `placed_at`, `ready_at`, `served_at`.
- **`OrderItem`**: Snapshots `item_name`, `quantity`, `unit_price_paise`, `subtotal_paise`, `course`, `seat_number`.

### 1.4 Existing Frontend (`frontend/src/pages/public/PublicQRPage.tsx`)
- Route `/q/:token` renders a branded landing card with *"Online Ordering Coming Soon"* and handles invalid/inactive tokens with a generic not-found view.
- `evaluateBrandColor` safely picks navy (`#0B1F3B`) or white text for contrast.

---

## 2. What Is Missing

### 2.1 Backend Gaps
1. **Order Fields & Statuses**:
   - `OrderStatus.PENDING_APPROVAL` and `OrderStatus.AWAITING_PAYMENT` (or separate `payment_status` field on `Order`).
   - `Order.source` (`STAFF`, `QR`) to distinguish QR orders from staff orders.
   - `Order.tracking_token` (128-bit random token) + `completed_at` / 12-hour tracking expiry.
   - `Order.rejected_reason` / `cancelled_reason` for staff rejections and cancellations.
   - `OrderItem` variant & selected options snapshot (`variant_name`, `options_snapshot`) and `notes` per line.
   - Idempotency key storage (`Idempotency-Key` header) on public QR order creation.
2. **Public Endpoints**:
   - `GET /api/v1/public/qr/<token>/menu/` — active branch menu (EN/TA), variants, option groups, `is_available`, ETag + short cache headers, zero hidden/cost/staff fields.
   - `POST /api/v1/public/qr/<token>/orders/` — server-priced order creation reusing `orders/services.py`, supporting table/counter/room QR targets, `TimestampSigner` session token validation, abuse limits, and `Idempotency-Key`.
   - `GET /api/v1/public/orders/<trackingToken>/` — read-only customer tracker (throttled, expires 12h after completion).
3. **Staff Approval & Branch Switch**:
   - `POST /api/v1/orders/<id>/approve/` and `POST /api/v1/orders/<id>/reject/` (reason required, audited).
   - `GET /api/v1/orders/?status=PENDING_APPROVAL`.
   - Branch capability toggle to switch customer ordering off/on (audited).
   - Cashier payment release for `AWAITING_PAYMENT` orders -> transitions to `PLACED` for KDS.

### 2.2 Frontend Gaps
- Replace *"Online Ordering Coming Soon"* in `PublicQRPage.tsx` with full mobile-first menu, search (EN/TA), item customization bottom sheet, `sessionStorage` cart, `Place Order` flow, closed/error states, and `/q/:token/o/:trackingToken` live tracker.
- Staff UI additions: `QR` badge in KDS/Live Orders/Tables/Floor POS, `Needs Approval` list + sidebar count badge + sound alert, and `AWAITING_PAYMENT` orders in Cashier Billing.

---

## 3. Code to Remove or Rename
- **`frontend/src/pages/auth/LoginPage.tsx`**: Contains `Demo Customer (Table T4)` (`linkUrl: "/q/demo-spice-t4"`) in `DEMO_ACCOUNTS`. Even though the panel is wrapped in `import.meta.env.DEV`, remove the demo customer shortcut from `DEMO_ACCOUNTS` so zero customer QR shortcuts ship in production bundles.
- **`frontend/src/pages/public/PublicQRPage.tsx`**: `PublicQRResponse` currently expects `table_identifier` while `PublicQRDetailView` returns `table_label` — align field naming to `table_label` / `target_label` / `target_type` consistently.
