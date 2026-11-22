# ServeMyFood Scope vs Plan & Specification Diff Audit

Compares implemented features, UI wording, schemas, routes, enums, and permission codes against [problem-register.md](../../product/problem-register.md), [sidebar-map.md](../../product/sidebar-map.md), [backlog.md](../../product/backlog.md), [deviations.md](../../deviations.md), and [openapi.json](../../openapi.json).

**Labels:** `ON PLAN` | `AHEAD OF PLAN (<phase>)` | `NOT ALLOWED (<recorded decision>)`

---

## 1. Feature & Module Classification

| Feature / Surface | Code Location | Status vs Plan | Planned Phase / Decision | Audit Notes |
|---|---|---|---|---|
| **Tax wording on bills, receipts & branding** | `BrandingSettingsPage.tsx`, `RoomChargesPage.tsx`, `DeviceSettingsPage.tsx`, `BillingPage.tsx`, `InvoicesHistoryPage.tsx`, `OnboardingWizardPage.tsx` | **NOT ALLOWED** | **H-15 / H-16 (`ADVICE`)**, **DEV-012 / ADR 0021**, **problem-register §6** | Receipts print `"DEMO RECEIPT - NOT A TAX INVOICE"` (explicit mention of `"TAX"`), `BrandingSettingsPage` exposes `"Legal & GST Details"`, `"GSTIN"`, `"Registered commercial address for tax invoices"`, and `RoomChargesPage` footer states `"NOT A TAX INVOICE"`. Per `problem-register.md` §6 and `DEV-012`, tax formats/GST rules are `ADVICE` and deferred. |
| **Customer receipts & PDF/HTML bill** | `PublicOrderTrackerPage.tsx` | **AHEAD OF PLAN (P2 / tax backlog)** | **G-01..G-04 (`P2`)**, **backlog #4** | Order tracker generates printable bill (`window.print()`) and client-side downloadable `.html` receipt (`Save PDF / Print`, `Download HTML`) in Guest QR flow. No tax lines appear, but printable receipt/history falls in P2/backlog area. |
| **Customer / guest profiles & `/customers`** | `CustomersPage.tsx` (`/customers`) | **AHEAD OF PLAN (P2 & LATER)** | **H-24 (`P2`)**, **sidebar-map `Customers`** (`Guests = P2`, `Loyalty & Rewards = LATER`) | `/customers` implements Guest Profiles CRM **and** `VIP Loyalty` (`loyalty_points`, `lifetime_points_earned`, `lifetime_points_redeemed`). Guests CRM is `P2` and **Loyalty & Rewards** is `LATER` (url-only reachable, hidden from sidebar). |
| **PMS and Night Audit wording** | `RoomChargesPage.tsx` (`/billing/room-charges`), `VenueLayoutHubPage.tsx` | **NOT ALLOWED** | **H-05 (`link LATER`)**, **problem-register §6** | `RoomChargesPage` displays `"ready for Front Desk / PMS posting and night audit (H-05)"` and button `"Print Night Audit"`. `problem-register.md` §6 explicitly states: *"What we do NOT promise yet: Connection to the hotel's front-office system"*. |
| **`MAINTENANCE` table/room status** | `RoomsPage.tsx` (`/venue/rooms`) | **NOT ALLOWED** | **OpenAPI `TableStatus`** (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `BLOCKED`) | `RoomsPage.tsx` includes `"MAINTENANCE"` in `RoomTable["status"]`, which does not exist in backend `TableStatus` enum (also `FloorPOSPage.tsx` includes `"BILLING"` and `"DIRTY"`). |
| **Feedback & suggestion types** | `PublicOrderTrackerPage.tsx`, `FeedbackPage.tsx` (`/customers/feedback`) | **AHEAD OF PLAN (LATER)** & **SCHEMA MISMATCH** | **H-14 (`LATER`)**, **sidebar-map (`Feedback = LATER`)** | Feedback submission + `/customers/feedback` management page (and sidebar entry `Daily work > Feedback`!) are live even though `problem-register.md` H-14 and `sidebar-map.md` schedule Feedback in **`LATER`**. Furthermore, UI `suggestionType` uses `TASTE \| PORTION \| SPEED \| SERVICE \| OTHER`, violating OpenAPI `SuggestionTypeEnum` (`FOOD \| SERVICE \| CLEANLINESS \| PRICE \| OTHER`). |
| **Reorder history storage & guest consent** | `PublicQRPage.tsx` (`smf_qr_history_optin`, `smf_qr_history_<token>`) | **ON PLAN (G-04) / AHEAD OF PLAN (P2)** | **G-04 (`P2`, Privacy)** | Explicitly asks guest opt-in before storing (`"Remember my orders on this phone (saved on this device only)"` + **Enable** button, default `false` in `localStorage["smf_qr_history_optin"]`). When opted in, stores `{ order_number, tracking_token, created_at, items: [{ menu_item_id, variant_id, quantity, name }] }` (max 10 entries, 30-day TTL) in `localStorage`; active cart (`menu_item_id, variant_id, option_ids, quantity, notes`) stored in `sessionStorage`. No phone number or PII stored. |
| **Service requests (`CALL_WAITER`, `WATER`, `REQUEST_BILL`, `CUTLERY`)** | `PublicQRPage.tsx`, `ReadyToServePage.tsx`, `publicQr.ts` | **AHEAD OF PLAN (P2) + ENUM BUG** | **P2 QR Guest** | Live in QR page and Ready-to-Serve, but `PublicQRPage.tsx` sends `"REQUEST_BILL"`, whereas OpenAPI `RequestTypeEnum` requires `"BILL"`, causing live `HTTP 400` failures (`F-07`). |
| **Takeaway & pickup codes** | `TakeawayPage.tsx` (`/takeaway`) | **AHEAD OF PLAN (P2)** | **R-09 (`P1, code P2`)**, **sidebar-map (`own page P2`)**, **backlog #2** | Dedicated `/takeaway` page with packing checklist and 4-digit `pickup_code` verification modal is routed (hidden from sidebar) ahead of P2, and calls unstandardized `/orders/{id}/transition/`. |
| **Room service & Room charges** | `RoomServicePage.tsx` (`/room-service`), `RoomChargesPage.tsx` (`/billing/room-charges`), `RoomsPage.tsx` (`/venue/rooms`) | **AHEAD OF PLAN (P2)** | **H-05 / H-06 (`P2`)**, **sidebar-map (`P2`)** | All three pages are routed (URL-only reachable, hidden from sidebar). `RoomServicePage` calls non-OpenAPI `/orders/{id}/transition/`. |
| **Inventory pages (8 routes)** | `StockOverviewPage.tsx`, `ReceiveStockPage.tsx`, `WastagePage.tsx`, `StockCountsPage.tsx`, `RecipesPage.tsx`, `SuppliersPurchasesPage.tsx`, `InventoryReportsPage.tsx`, `InventorySettingsPage.tsx` | **ON PLAN (P3 / Stage A)** | **H-11 (`P3`)**, **sidebar-map (`NOW` Stage A)** | All 8 routes live under `/inventory/*` and in sidebar (`I O M K`); `WastagePage` calls `/inventory/reports/wastage/` which is missing from `docs/openapi.json`. |
| **Menu Translations (`/menu/translations`)** | `MenuTranslationsPage.tsx` (`/menu/translations`) | **ON PLAN (R-08) / PARTIAL** | **R-08 (`NOW`)**, **backlog #7** | Supports EN/TA content authoring (plus other languages in backend prep per `backlog.md #7`), added to `navigation.ts` (`Menu > Translations`) even though omitted from `sidebar-map.md`. Calls `/menu/translations/{action}/` absent from `docs/openapi.json`. |
| **Reports (`/reports/*`)** | `SalesReportsPage.tsx`, `ItemReportsPage.tsx`, `PaymentReportsPage.tsx`, `ExceptionsReportPage.tsx`, `StaffReportPage.tsx`, `OutletComparisonPage.tsx` | **AHEAD OF PLAN (`P1/P2` hidden from sidebar)** | **H-01, H-17, H-21, H-22, R-04** (`P1`/`P2`/`ADVICE`) | All 6 pages exist at `/reports/*` (`URL-only` reachable, not in `navigation.ts`). Exceptions/Staff/Outlets are `P2` while `Sales`/`Items`/`Payments` are `P1`. |
| **Core Dine-In & Counter OPS (`/pos`, `/orders`, `/serve`, `/kds`, `/billing`, `/billing/bills`, `/billing/closeout`)** | `FloorPOSPage.tsx`, `LiveOrdersPage.tsx`, `ReadyToServePage.tsx`, `KDSPage.tsx`, `BillingPage.tsx`, `InvoicesHistoryPage.tsx`, `ShiftCloseoutPage.tsx` | **ON PLAN (`NOW / P1`)** | **sidebar-map `Daily work` (`P1`)** | Core POS, KDS, Billing, Shift Close, and Bills History are wired to live APIs (with wording/UX/RBAC defects logged in `bugs.md`). |
| **Platform Admin Support, Leads, Announcements, Health** | `PlatformSupportPage.tsx`, `PlatformLeadsPage.tsx`, `PlatformAnnouncementsPage.tsx`, `PlatformHealthPage.tsx`, `PlatformPlansPage.tsx` | **AHEAD OF PLAN (`P2`)** | **A-04, A-05, A-06, A-08 (`P2`)** | Built and exposed directly in Platform Admin sidebar ahead of P2. |

---

## 2. Enum, Route, Permission & API Path Diffs vs `docs/deviations.md` and `docs/openapi.json`

### A. Enum Discrepancies
1. **`TableStatus` (`openapi.json`: `["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING", "BLOCKED"]`)**
   - `RoomsPage.tsx` line 29 includes `"MAINTENANCE"` (absent in OpenAPI).
   - `FloorPOSPage.tsx` line 49 includes `"BILLING"` and `"DIRTY"` (absent in OpenAPI).
2. **`SuggestionTypeEnum` (`openapi.json`: `["FOOD", "SERVICE", "CLEANLINESS", "PRICE", "OTHER"]`)**
   - `PublicOrderTrackerPage.tsx` line 52 uses `"TASTE" | "PORTION" | "SPEED" | "SERVICE" | "OTHER"`.
3. **`RequestTypeEnum` (`openapi.json`: `["WATER", "NAPKINS", "CALL_WAITER", "BILL", "CUTLERY"]`)**
   - `PublicQRPage.tsx` line 745 & `publicQr.ts` line 189 send `"REQUEST_BILL"` instead of `"BILL"`, causing live `HTTP 400` in `F-07`.
4. **`TenantStatus` (`openapi.json`: `["ACTIVE", "SUSPENDED"]`)**
   - `PlatformAdminPage.tsx` line 42 types `status: "ACTIVE" | "SUSPENDED" | "TRIAL"`.
5. **`BusinessType` vs `DEV-008` / `BusinessTypeA80Enum`**
   - OpenAPI `BusinessType` includes `DHABA` and `CHAIN` alongside the 7 `DEV-008` presets (`TEA_SHOP`, `BAKERY`, `CAFE`, `RESTAURANT`, `FINE_DINING`, `HOTEL`, `FOOD_COURT`).

### B. API Paths Called in Frontend Missing from `docs/openapi.json`
Extracted by [compare_contracts.py](../../../scripts/audit/walk/compare_contracts.py) into `docs/audit/walk/raw/contracts_diff_raw.json`:
1. `POST /api/v1/orders/{id}/transition/` — called by `RoomServicePage.tsx` and `TakeawayPage.tsx` (absent from `docs/openapi.json`; backend order lifecycle uses `/approve/`, `/reject/`, `/serve/`, `/cancel/`, `/kds/{id}/bump/`).
2. `GET /api/v1/inventory/reports/wastage/` — called by `WastagePage.tsx` (OpenAPI has `/api/v1/inventory/reports/{report_type}/`).
3. `POST /api/v1/menu/translations/{action}/` — called by `MenuTranslationsPage.tsx` (`upsert`, `review`, `publish`; absent from `docs/openapi.json`).
4. `POST /api/v1/tenants/{id}/{endpoint}/` — dynamic endpoint in `CustomerDetailPage.tsx` / `TenantsDirectoryPage.tsx` (parameterized admin actions).

### C. Route Drift (`docs/product/sidebar-map.md` vs `frontend/src/app/navigation.ts` vs `StaffApp.tsx`)
- **In `navigation.ts` (shown in sidebar) but missing from `sidebar-map.md`:**
  `/customers/feedback`, `/help`, `/menu/translations`, `/venue`
- **In `sidebar-map.md` as sidebar items (or future phases) missing from `navigation.ts` (`URL-only` or unrouted):**
  - Routed (`URL-only`, hidden from sidebar): `/activity`, `/admin/tenants/:id`, `/billing/room-charges`, `/menu/options`, `/reports/exceptions`, `/reports/items`, `/reports/outlets`, `/reports/payments`, `/reports/sales`, `/reports/staff`, `/room-service`, `/settings/devices`, `/settings/sound`, `/takeaway`, `/team/roles`, `/venue/areas`, `/venue/counters`, `/venue/floor`, `/venue/rooms`, `/venue/tables`.
  - Unrouted (`LATER` / `P2` / `ADVICE` in `sidebar-map.md`): `/reservations`, `/events`, `/menu/import`, `/menu/prices`, `/offers`, `/reports/orders`, `/reports/taxes`, `/reports/feedback`, `/documents`, `/team/shifts`, `/team/assignments`, `/my-shift`, `/team/leave`, `/settings/approvals`, `/settings/customer-ordering`, `/settings/taxes`, `/settings/payments`, `/settings/notifications`, `/settings/integrations`, `/admin/subscriptions`, `/admin/templates`, `/admin/users`, `/admin/requests`, `/admin/settings`.

### D. Permission Code Drift (`DEV-007` & `backend/apps/rbac/constants.py` vs Frontend)
- Frontend checks `unknown.perm` (in test fixture/probe artifact scan) and only checks **14** distinct RBAC codes (`area.manage`, `billing.manage`, `branch.manage`, `business.manage`, `inventory.approve`, `inventory.costs`, `inventory.count`, `inventory.manage`, `menu.availability`, `menu.manage`, `staff.manage`, `table.manage`, `table.merge`, `table.status_update`).
- Meanwhile, **`StaffApp.tsx` applies `requiredPermission` ONLY on `/billing*` routes (`billing.manage`)**, leaving **23** backend RBAC permission codes (`area.view`, `audit.view`, `branch.view`, `business.view`, `floor.manage`, `inventory.receive`, `inventory.view`, `inventory.waste`, `invoice.refund`, `menu.view`, `order.cancel`, `order.create`, `platform.admin`, `printer.reprint`, `qr.manage`, `qr.view`, `report.view`, `staff.view`, `table.assign`, `table.view`, `table_session.close`, `table_session.open`, `tenant.manage`) unguarded at the `<ProtectedRoute>` URL router level (which is why Kitchen/Waiter/Cashier can open unpermitted URLs and trigger `403` API errors!).
