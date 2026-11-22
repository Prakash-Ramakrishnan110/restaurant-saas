# ServeMyFood Walkthrough Audit Summary (`WALK_SUMMARY`)

Generated strictly by [generate_reports.py](../../../scripts/audit/walk/generate_reports.py) from raw walkthrough outputs, CSVs, and latest gate artifacts.

## 1. Flow Walkthrough Counts (28 Flows, 185 Screen Steps)

- **Flow-level status (28 flows):** PASS = **21**, FAIL = **2**, BLOCKED = **5**
- **Step-level status (185 steps):** PASS = **176**, FAIL = **3**, BLOCKED = **6**

| Flow | Overall Status |
|---|---|
| F-01 | **PASS** |
| F-02 | **BLOCKED** |
| F-03 | **BLOCKED** |
| F-04 | **PASS** |
| F-05 | **PASS** |
| F-06 | **BLOCKED** |
| F-07 | **FAIL** |
| F-08 | **PASS** |
| F-09 | **BLOCKED** |
| F-10 | **PASS** |
| F-11 | **PASS** |
| F-12 | **FAIL** |
| F-13 | **PASS** |
| F-14 | **PASS** |
| F-15 | **PASS** |
| F-16 | **BLOCKED** |
| F-17 | **PASS** |
| F-18 | **PASS** |
| F-19 | **PASS** |
| F-20 | **PASS** |
| F-21 | **PASS** |
| F-22 | **PASS** |
| F-23 | **PASS** |
| F-24 | **PASS** |
| F-25 | **PASS** |
| F-26 | **PASS** |
| F-27 | **PASS** |
| F-28 | **PASS** |

## 2. Bugs by Severity

- **Total Bugs Logged:** **22**
- `crash`: **1**
- `layout`: **8**
- `security`: **3**
- `wording`: **4**
- `wrong data`: **6**

## 3. Step 3 Rule Violation Counts (Across 185 Screen Captures)

- Horizontal scroll: **0** screens
- Small tap targets (`< 56px` mobile / `< 48px` desktop): **181** screens (**5335** elements)
- Text `< 12px`: **174** screens (**3010** elements)
- Axe `serious`/`critical` violations: **152** screens
- Contrast `< 4.5:1`: **151** screens
- Orange used as text/warnings/status: **155** screens
- White text on `#FF6A00`: **0** screens
- Broken images / empty frames (`naturalWidth === 0`): **2** screens
- Skeleton/spinner still active after 10s: **5** screens
- Zeros shown after failed request: **0** screens
- Forbidden visible words (EN/TA): **58** screens
- Word `table` on counter-only venue: **4** screens
- Missing Tamil strings / raw keys: **10** screens

## 4. Scope vs Plan — Ahead-of-Plan & Not-Allowed Features

### Not Allowed (Against Recorded Decisions)
- **Tax wording on bills, receipts & branding** — **H-15 / H-16 (`ADVICE`)**, **DEV-012 / ADR 0021**, **problem-register §6**
- **PMS and Night Audit wording** — **H-05 (`link LATER`)**, **problem-register §6**
- **`MAINTENANCE` table/room status** — **OpenAPI `TableStatus`** (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `BLOCKED`)

### Ahead of Plan (Implemented Ahead of Target Phase)
- **Customer receipts & PDF/HTML bill** — Planned: **G-01..G-04 (`P2`)**, **backlog #4**
- **Customer / guest profiles & `/customers`** — Planned: **H-24 (`P2`)**, **sidebar-map `Customers`** (`Guests = P2`, `Loyalty & Rewards = LATER`)
- **Feedback & suggestion types** — Planned: **H-14 (`LATER`)**, **sidebar-map (`Feedback = LATER`)**
- **Service requests (`CALL_WAITER`, `WATER`, `REQUEST_BILL`, `CUTLERY`)** — Planned: **P2 QR Guest**
- **Takeaway & pickup codes** — Planned: **R-09 (`P1, code P2`)**, **sidebar-map (`own page P2`)**, **backlog #2**
- **Room service & Room charges** — Planned: **H-05 / H-06 (`P2`)**, **sidebar-map (`P2`)**
- **Platform Admin Support, Leads, Announcements, Health** — Planned: **A-04, A-05, A-06, A-08 (`P2`)**

## 5. Routes Reachable by URL Only (Not in Sidebar: 34 of 82 Routes)

| Route | Component | Roles Allowed by URL | Data Source | Test Coverage |
|---|---|---|---|---|
| `/q/:token` | `PublicQRPage` | PUBLIC | API | Y |
| `/q/:token/o/:trackingToken` | `PublicOrderTrackerPage` | PUBLIC | API | Y |
| `/orders/floor` | `FloorPOSPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN | API | Y |
| `/orders/live` | `LiveOrdersPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN; CASHIER | API | N |
| `/orders/ready` | `ReadyToServePage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN; CASHIER | API | Y |
| `/room-service` | `RoomServicePage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN; CASHIER | API | Y |
| `/takeaway` | `TakeawayPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN; CASHIER | API | Y |
| `/orders/kds` | `KDSPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN; CASHIER | API | N |
| `/orders/billing` | `BillingPage` | OWNER; BRANCH_MANAGER; KITCHEN; CASHIER | API | Y |
| `/billing/invoices` | `InvoicesHistoryPage` | OWNER; BRANCH_MANAGER; KITCHEN; CASHIER | API | Y |
| `/billing/room-charges` | `RoomChargesPage` | OWNER; BRANCH_MANAGER; KITCHEN; CASHIER | API | Y |
| `/reports/sales` | `SalesReportsPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN | API | Y |
| `/reports/items` | `ItemReportsPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN | API | Y |
| `/reports/payments` | `PaymentReportsPage` | OWNER; BRANCH_MANAGER; KITCHEN | API | Y |
| `/reports/exceptions` | `ExceptionsReportPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN | API | Y |
| `/reports/staff` | `StaffReportPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN | API | Y |
| `/reports/outlets` | `OutletComparisonPage` | OWNER; BRANCH_MANAGER; KITCHEN | API | Y |
| `/activity` | `ActivityLogPage` | OWNER; BRANCH_MANAGER; KITCHEN | API | N |
| `/menu/options` | `MenuOptionsPage` | OWNER; BRANCH_MANAGER; KITCHEN; CASHIER | API | Y |
| `/settings/sound` | `SoundSettingsPage` | OWNER; BRANCH_MANAGER; CASHIER | LOCAL | Y |
| `/settings/devices` | `DeviceSettingsPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN; CASHIER | LOCAL | Y |
| `/admin/tenants/:id` | `CustomerDetailPage` | PLATFORM_ADMIN | API | N |
| `/admin/dashboard` | `PlatformAdminPage` | PLATFORM_ADMIN | API | Y |
| `/venue/layout` | `VenueLayoutHubPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN; CASHIER | LOCAL | N |
| `/venue/branches` | `BranchesPage` | OWNER; BRANCH_MANAGER; WAITER | API | Y |
| `/venue/areas` | `AreasPage` | OWNER; BRANCH_MANAGER | API | Y |
| `/venue/tables` | `TablesPage` | OWNER; BRANCH_MANAGER; KITCHEN | API | Y |
| `/venue/rooms` | `RoomsPage` | OWNER; BRANCH_MANAGER | API | Y |
| `/venue/counters` | `CountersPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN | API | Y |
| `/venue/floor` | `FloorPlanPage` | OWNER; BRANCH_MANAGER; KITCHEN | API | Y |
| `/venue/floor-plan` | `FloorPlanPage` | OWNER; BRANCH_MANAGER; CASHIER | API | Y |
| `/customers` | `CustomersPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN; CASHIER | API | Y |
| `/team/roles` | `RolesGuidePage` | OWNER; BRANCH_MANAGER; WAITER; CASHIER | LOCAL | Y |
| `/settings/account` | `AccountPage` | OWNER; BRANCH_MANAGER; WAITER; KITCHEN; CASHIER | API | Y |

## 6. Flow Timing & Tap Counts

| Flow | Viewport | Taps | Duration (ms) |
|---|---|---:|---:|
| F-01 | mobile | 1 | 5113 |
| F-02 | mobile | 3 | 12253 |
| F-03 | mobile | 4 | 15771 |
| F-04 | mobile | 5 | 22762 |
| F-05 | mobile | 2 | 17168 |
| F-06 | mobile | 5 | 12760 |
| F-07 | mobile | 6 | 37366 |
| F-08 | mobile | 0 | 3755 |
| F-09 | mobile | 7 | 23178 |
| F-11 | mobile | 2 | 32773 |
| F-12 | mobile | 1 | 9208 |
| F-14 | mobile | 4 | 8294 |
| F-17 | mobile | 6 | 12049 |
| F-22 | mobile | 3 | 16825 |
| F-01 | desktop | 1 | 11939 |
| F-02 | desktop | 3 | 14216 |
| F-03 | desktop | 4 | 11697 |
| F-04 | desktop | 4 | 24169 |
| F-05 | desktop | 0 | 3904 |
| F-06 | desktop | 8 | 11369 |
| F-07 | desktop | 5 | 32153 |
| F-08 | desktop | 0 | 5110 |
| F-09 | desktop | 6 | 23899 |
| F-11 | desktop | 2 | 31739 |
| F-12 | desktop | 1 | 9555 |
| F-14 | desktop | 4 | 11659 |
| F-17 | desktop | 6 | 14651 |
| F-22 | desktop | 3 | 15499 |

## 7. Git Tags & Latest Gate Records (Unmodified / Not Rerun)

- **Git tags (31):** `v0.2`, `v0.2.1`, `v0.2.2`, `v0.2.3`, `v0.2.4`, `v0.2.5`, `v0.2.6`, `v0.2.7`, `v0.2.8`, `v0.2.9`, `v0.3.1`, `v0.3.2`, `v0.3.3`, `v0.3.4`, `v0.4.0`, `v0.4.1`, `v0.5.0`, `v0.5.1`, `v0.6.0`, `v0.6.1`, `v0.7.0`, `v0.8.0`, `v0.9.0`, `v1.1.0-qr-ordering`, `v1.2.0-inventory-a`, `v1.3.0-menu-tools`, `v1.3.0-ops-b`, `v1.4.0-print-help`, `v1.4.0-resilience-c`, `v1.5.0-qr-guest`, `v1.5.0-scale-d`
- **Latest `SUMMARY.txt` (`docs/evidence/SUMMARY.txt`, 2026-11-21):**
  - Overall Result: **`FAIL`** (18/19 gates PASS; Playwright Browser E2E Suite **`FAIL`**)
  - `docs/evidence/backend-pytest.txt`: `584 passed in 463.88s (0:07:43) =======================` (92.07% coverage)
  - `docs/evidence/frontend-vitest.txt`: `22 passed (22)` files, `132 passed (132)`
  - `docs/evidence/e2e-report.txt`: `6 failed`, `130 passed (18.9m)`
- **Earlier `docs/audit/raw/` gate snapshot (2026-11-12):**
  - `docs/audit/raw/backend-pytest.txt`: `2 failed, 534 passed in 345.07s (0:05:45)`
  - `docs/audit/raw/frontend-vitest.txt`: `16/16` failed assertions in Vitest failure summary
  - `docs/audit/raw/playwright-run.txt`: `22 failed`, `122 passed (24.4m)`
