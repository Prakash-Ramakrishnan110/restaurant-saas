# ServeMyFood Walkthrough Bugs Catalog

All bugs observed directly from live Playwright execution against the Docker stack (`127.0.0.1:8000` + `127.0.0.1:5173`), role URL probes, network logs, and screenshot captures.

Severity levels: `crash` | `wrong data` | `security` | `wording` | `layout`

---

## Bug Catalog

### BUG-01 — Customer QR "Request bill" fails with HTTP 400 (`REQUEST_BILL` vs `BILL`)
- **Flow / Step:** `F-07` (`01-guest-requests`)
- **Role / Viewport:** `GUEST` @ `390x844` & `1440x900`
- **Severity:** `wrong data`
- **Steps to Reproduce:** Open `/q/<spice-garden-token>` and tap **Request bill** (and service request buttons).
- **Expected:** `POST /api/v1/public/qr/<token>/service-requests/` returns `201 Created` and queues alert for Waiter `/serve`.
- **Actual:** `POST /api/v1/public/qr/.../service-requests/` returns **`HTTP 400 Bad Request`** because `PublicQRPage.tsx` sends `"REQUEST_BILL"` while backend `RequestTypeEnum` only accepts `"BILL"`. (`F-07` logged HTTP 400 x3 mobile, x1 desktop).
- **Evidence:** [F-07 mobile shot](shots/F-07/mobile__01-guest-requests.png), [walk_raw.json](raw/walk_raw.json), [openapi.json](../../openapi.json)

### BUG-02 — Kitchen "Today's Availability" sidebar link fails with HTTP 403 `/api/v1/branches/`
- **Flow / Step:** `F-12` (`03-sold-out-switches`)
- **Role / Viewport:** `KITCHEN` (`kitchen@spicegarden.com`) @ `1440x900` & `390x844`
- **Severity:** `security`
- **Steps to Reproduce:** Log in as `KITCHEN`, click **Today's Availability** in Kitchen sidebar (`/menu/availability`).
- **Expected:** Kitchen staff see categories/dishes and toggle sold-out switches cleanly.
- **Actual:** Page shows red error banner **`"Failed to load availability data."`** because `MenuAvailabilityPage` requests `GET /api/v1/branches/`, which returns `HTTP 403 Forbidden` for `KITCHEN`.
- **Evidence:** [F-12 desktop shot](shots/F-12/desktop__03-sold-out-switches.png), [walk_raw.json](raw/walk_raw.json)

### BUG-03 — Route RBAC missing on `StaffApp.tsx` exposes unpermitted URLs (`403` bursts & cross-role access)
- **Flow / Step:** Step 4 Role Route Probe
- **Role / Viewport:** `WAITER`, `KITCHEN`, `CASHIER` @ `1440x900`
- **Severity:** `security`
- **Steps to Reproduce:** Logged in as `KITCHEN`, navigate by URL to `/pos`, `/serve`, `/room-service`, `/takeaway`, `/reports/sales`, `/reports/outlets`, `/settings/devices`, `/settings/plan`, `/staff`.
- **Expected:** `<ProtectedRoute requiredPermission="...">` blocks unauthorized roles cleanly to `/forbidden`.
- **Actual:** Only `/billing*` sets `requiredPermission` in `StaffApp.tsx`. Kitchen/Waiter/Cashier load `/pos`, `/takeaway`, `/room-service`, `/settings/devices`, `/settings/plan` completely, or render `/reports/*`, `/staff`, `/qr`, `/venue/*` and spam `403 Forbidden` API errors.
- **Evidence:** [routes.csv](routes.csv), [route_probe_raw.json](raw/route_probe_raw.json)

### BUG-04 — Full page reload / direct URL bookmark drops authenticated session (`401 /api/v1/auth/refresh/`)
- **Flow / Step:** `F-23` / direct `page.goto` reload behavior (observed on first pass `F-23`, `F-28`, and prior UX crawl)
- **Role / Viewport:** `OWNER` / `KITCHEN` / `PLATFORM_ADMIN` @ `390x844` & `1440x900`
- **Severity:** `security`
- **Steps to Reproduce:** Sign in (stores JWT access token only in RAM), then reload or open another authenticated route via browser URL bar rapidly.
- **Expected:** `POST /api/v1/auth/refresh/` refreshes the token transparently using the `httpOnly` cookie and preserves the user's screen.
- **Actual:** `inMemoryAccessToken` is lost on reload and `POST /api/v1/auth/refresh/` sporadically returns `401 Unauthorized`, causing `client.ts` to force `window.location.href = "/login?reason=session_expired"`.
- **Evidence:** [client.ts](../../../frontend/src/api/client.ts), [crawl_raw.txt](../raw/crawl_raw.txt)

### BUG-05 — Dish thumbnails fail to load (`naturalWidth === 0`) on Menu Manager & Menu Availability
- **Flow / Step:** `F-25` (`01-menu` mobile, `03-availability` desktop)
- **Role / Viewport:** `OWNER` @ `390x844` & `1440x900`
- **Severity:** `layout`
- **Steps to Reproduce:** Open `/menu` (mobile) or `/menu/availability` (desktop) as `owner@spicegarden.com`.
- **Expected:** Dish `thumb.webp` thumbnails decode and display cleanly.
- **Actual:** `<img>` tags for `/media/menu/.../thumb.webp` render broken-image icons with `naturalWidth === 0` (`F-25 01-menu [mobile]`: 1 broken img; `F-25 03-availability [desktop]`: 5 broken imgs).
- **Evidence:** [polish_16_f-25.png](crops/polish_16_f-25.png), [polish_17_f-25.png](crops/polish_17_f-25.png)

### BUG-06 — `RoomServicePage` and `TakeawayPage` call non-existent backend endpoint `/orders/{id}/transition/`
- **Flow / Step:** `F-19`, `F-20`
- **Role / Viewport:** `OWNER` / `CASHIER` @ `390x844` & `1440x900`
- **Severity:** `crash`
- **Steps to Reproduce:** Trigger a status progression button on `/room-service` or `/takeaway`.
- **Expected:** Uses live documented endpoints (`/orders/{id}/serve/`, `/kds/{id}/bump/`).
- **Actual:** Frontend calls `POST /api/v1/orders/${orderId}/transition/`, which does not exist in `docs/openapi.json` and causes `"Failed to update room service delivery status"` / `"Failed to update parcel status"`.
- **Evidence:** [RoomServicePage.tsx](../../../frontend/src/pages/orders/RoomServicePage.tsx), [TakeawayPage.tsx](../../../frontend/src/pages/orders/TakeawayPage.tsx), [contracts_diff_raw.json](raw/contracts_diff_raw.json)

### BUG-07 — Guest feedback `suggestionType` enum mismatch (`TASTE`/`PORTION`/`SPEED` vs OpenAPI `FOOD`/`CLEANLINESS`/`PRICE`)
- **Flow / Step:** `F-08` (`02-feedback-submitted`)
- **Role / Viewport:** `GUEST` @ `390x844` & `1440x900`
- **Severity:** `wrong data`
- **Steps to Reproduce:** Open `/q/<token>/o/<trackingToken>`, select topic `TASTE` or `PORTION` or `SPEED` and submit feedback.
- **Expected:** Frontend topic values align with backend `SuggestionTypeEnum` (`FOOD`, `SERVICE`, `CLEANLINESS`, `PRICE`, `OTHER`).
- **Actual:** `PublicOrderTrackerPage.tsx` uses `"TASTE" | "PORTION" | "SPEED" | "SERVICE" | "OTHER"`, mismatching OpenAPI schema.
- **Evidence:** [PublicOrderTrackerPage.tsx](../../../frontend/src/pages/public/PublicOrderTrackerPage.tsx), [scope-vs-plan.md](scope-vs-plan.md)

### BUG-08 — `RoomsPage` & `FloorPOSPage` include invalid `TableStatus` enum values (`MAINTENANCE`, `BILLING`, `DIRTY`)
- **Flow / Step:** `F-21` (`01-rooms-list`), `F-09`
- **Role / Viewport:** `OWNER` / `WAITER` @ `390x844` & `1440x900`
- **Severity:** `wrong data`
- **Steps to Reproduce:** Inspect room/table status filters and mutations on `/venue/rooms` and `/pos`.
- **Expected:** Status values match backend `TableStatus` (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `BLOCKED`).
- **Actual:** `RoomsPage.tsx` checks/patches `"MAINTENANCE"` and `FloorPOSPage.tsx` types `"BILLING"` and `"DIRTY"`.
- **Evidence:** [RoomsPage.tsx](../../../frontend/src/pages/venue/RoomsPage.tsx), [FloorPOSPage.tsx](../../../frontend/src/pages/orders/FloorPOSPage.tsx)

### BUG-09 — `seed_demo.py` branches (`kaveri-cafe`, `madras-chai`) created with `capabilities = None`
- **Flow / Step:** Seed / Capability Discovery (`F-14`, `F-22`)
- **Role / Viewport:** All staff roles on `kaveri-cafe` / `madras-chai`
- **Severity:** `wrong data`
- **Steps to Reproduce:** Inspect `Branch.capabilities` for tenants seeded by `seed_demo.py` (`T. Nagar Flagship`, `Express Kiosk`).
- **Expected:** Every branch has an initialized 15-field `BranchCapabilities` profile via `apply_preset`.
- **Actual:** Both `kaveri-cafe` and `madras-chai` have `capabilities = None` in PostgreSQL (`seed_context.json`), falling back to frontend defaults.
- **Evidence:** [seed_context.json](raw/seed_context.json)

### BUG-10 — Mobile Floor POS toast notification overlaps header and `Transfer` / `Shift` controls
- **Flow / Step:** `F-09` (`03-first-order-fired`), `F-10`
- **Role / Viewport:** `WAITER` @ `390x844`
- **Severity:** `layout`
- **Steps to Reproduce:** Seat a table on `/pos` at `390x844` mobile touch viewport.
- **Expected:** Confirmation toast floats without obscuring interactive header buttons (`Transfer`) or heading.
- **Actual:** Green toast `"Table T5 seated with 4 guests."` sits directly on top of `"FLOOR TABLES"`, `Transfer`, and `"Shift: FULL DAY"`. Also `T5` card still renders `Free` while toast confirms seating, and Waiter must scroll past 15+ stacked table cards to reach `Fire Order to Kitchen`.
- **Evidence:** [polish_06_f-09.png](crops/polish_06_f-09.png), [F-09 mobile shot](shots/F-09/mobile__03-first-order-fired.png)

### BUG-11 — Counter Orders mobile `Fire Order to Kitchen` CTA clipped behind fixed bottom navigation bar
- **Flow / Step:** `F-22` (`01-counter-pos`)
- **Role / Viewport:** `CASHIER` @ `390x844`
- **Severity:** `layout`
- **Steps to Reproduce:** Open `/pos` on Counter venue (`Chai Corner`) at `390x844`.
- **Expected:** Primary CTA is fully above the mobile bottom tab bar with bottom padding clearance.
- **Actual:** `Fire Order to Kitchen` button is partially covered by the fixed bottom navigation bar (`Billing / Orders / Availability / Bills / More`).
- **Evidence:** [polish_08_f-22.png](crops/polish_08_f-22.png), [F-22 mobile shot](shots/F-22/mobile__01-counter-pos.png)

### BUG-12 — Guest QR rapid order throttled with `HTTP 429` (`Too Many Requests`) blocking consecutive test/table orders
- **Flow / Step:** `F-02` (`02-tracker` mobile), `F-06` (`02-reorder-cart` mobile)
- **Role / Viewport:** `GUEST` @ `390x844`
- **Severity:** `wrong data`
- **Steps to Reproduce:** Submit multiple guest QR orders across tables from the same restaurant LAN/browser in short succession.
- **Expected:** Per-table or reasonable burst threshold permits normal multi-table QR ordering on shared café Wi-Fi/NAT.
- **Actual:** `POST /api/v1/public/qr/.../orders/` returns `HTTP 429`, blocking order placement (`F-02` & `F-06` mobile recorded `BLOCKED`).
- **Evidence:** [F-02 mobile tracker](shots/F-02/mobile__02-tracker.png), [F-06 mobile reorder](shots/F-06/mobile__02-reorder-cart.png)

### BUG-13 — Billing & Counter Checkout leaks forbidden word `"Table"` on Counter-only venue (`Foodie Plaza`)
- **Flow / Step:** `F-16` (`01-awaiting-list`, `02-settled`)
- **Role / Viewport:** `CASHIER` @ `390x844` & `1440x900`
- **Severity:** `wording`
- **Steps to Reproduce:** Log into counter-only venue `foodie-plaza` (`uses_tables = false`) and open `/billing`.
- **Expected:** Counter venues never contain the word `"table"` anywhere (`sidebar-map.md`, Step 3 rule).
- **Actual:** Billing screen displays `"Table"` / `"table"` across 4 captures (`F-16` mobile + desktop).
- **Evidence:** [polish_20_f-16.png](crops/polish_20_f-16.png), [walk_stats.json](raw/walk_stats.json)

### BUG-14 — Tax & GST claims present in active UI against ADR 0021 & problem-register H-15/H-16
- **Flow / Step:** `F-27` (`03-branding`, `06-devices`), `F-26` (`01-onboarding`, `08-qr-codes`), `F-17` (`02-room-charges-folio`)
- **Role / Viewport:** `OWNER` @ `390x844` & `1440x900`
- **Severity:** `wording`
- **Steps to Reproduce:** Open `/settings/branding`, `/settings/devices`, `/onboarding`, `/qr`, and `/billing/room-charges`.
- **Expected:** Zero `GST`, `GSTIN`, or `TAX` claims in UI.
- **Actual:** `BrandingSettingsPage` shows `"and GST billing credentials."`, `"GSTIN"`, `"tax invoices"`; receipts & `RoomChargesPage` display `"TAX"`; forbidden-word scan hit `tax` (8 screens), `gst` (7), `gstin` (2).
- **Evidence:** [polish_21_f-27.png](crops/polish_21_f-27.png), [F-27 mobile branding](shots/F-27/mobile__03-branding.png)

### BUG-15 — Technical & internal jargon exposed to end users (`tenant`, `session`, `paise`, `entitlement`, `preset`, `PMS`, `ledger`)
- **Flow / Step:** `F-09`, `F-10`, `F-14`, `F-15`, `F-16`, `F-17`, `F-21`, `F-23`, `F-25`, `F-26`, `F-27`, `F-28`
- **Role / Viewport:** All staff & admin roles @ `390x844` & `1440x900`
- **Severity:** `wording`
- **Steps to Reproduce:** Walk Floor POS, Billing, Room Charges, Dashboard, Reports, Options, Admin Dashboard.
- **Expected:** User-facing text never contains internal engineering terms (`tenant`, `entitlement`, `paise`, `preset`, `flag`, `ledger`, `session`, `canvas`, `PMS`, `H-03`, `H-05`).
- **Actual:** **58 captures** exposed forbidden words: `"Open Dining Session"`, `"ACTIVE DINING SESSIONS"`, `"Front Desk / PMS posting and night audit (H-05)"`, `"Tenants"` (instead of `Customers`), `"Preset"`, `"paise"`, `"entitlements"`, `"ledger"`.
- **Evidence:** [polish_07_f-09.png](crops/polish_07_f-09.png), [polish_12_f-17.png](crops/polish_12_f-17.png), [polish_22_f-28.png](crops/polish_22_f-28.png)

### BUG-16 — Orange `#FF6A00` used as low-contrast text (`2.87:1`), status colors, and warning indicators across 155 screens
- **Flow / Step:** `F-04`, `F-21`, `F-22`, `F-23`, `F-28` & `AppShell` header
- **Role / Viewport:** All roles @ `390x844` & `1440x900`
- **Severity:** `layout`
- **Steps to Reproduce:** Inspect `AppShell` header (`ServeMyFood` -> `"Food"` in `#FF6A00` on `#FFFFFF`), Counter POS (`#101`), QR Tracker (`#3`), Dashboard (`SPICE GARDEN`, `Occupied`, `View Floor →`).
- **Expected:** Orange reserved solely as surface accent with `#0B1F3B` text (`5.74:1`), never as text, warnings, or status colors; minimum `4.5:1` contrast.
- **Actual:** **155 captures** failed the orange-text/status rule and **151 captures** had `color-contrast` `< 4.5:1` / serious Axe contrast violations (starting with `"Food"` in the global navbar at `2.87:1`).
- **Evidence:** [polish_02_f-04.png](crops/polish_02_f-04.png), [polish_13_f-23.png](crops/polish_13_f-23.png), [polish_15_f-23.png](crops/polish_15_f-23.png)

### BUG-17 — Sub-minimum touch/click tap targets (`< 56px` mobile / `< 48px` desktop) across 181 screens
- **Flow / Step:** `F-01`..`F-28`
- **Role / Viewport:** All roles @ `390x844` & `1440x900`
- **Severity:** `layout`
- **Steps to Reproduce:** Inspect header toggles (`40x40px` hamburger menu, `44px` guest `தமிழ்` button, `32px` diet filter pills, `36px` POS `Last Bill` button).
- **Expected:** Interactive controls meet minimum `56px` in touch mode (`390x844`) and `48px` on desktop (`1440x900`).
- **Actual:** **181 of 185** captures contained undersized interactive elements (**5,335** total interactive element hits across walk).
- **Evidence:** [polish_03_f-01.png](crops/polish_03_f-01.png), [polish_14_f-23.png](crops/polish_14_f-23.png)

### BUG-18 — Sub-12px body/badge text (`10px`–`11px`) across 174 screens
- **Flow / Step:** `F-01`..`F-28`
- **Role / Viewport:** All roles @ `390x844` & `1440x900`
- **Severity:** `layout`
- **Steps to Reproduce:** Measure computed `fontSize` across visible text nodes on Customer QR header (`11px` `Table V1`), Bottom nav labels (`11px`), POS Shift badge (`11px`), Staff role badges (`11px`), and Receipts (`10px`).
- **Expected:** No readable text below `12px`.
- **Actual:** **174 of 185** captures contained text `< 12px` (**3,010** total element instances).
- **Evidence:** [polish_04_f-01.png](crops/polish_04_f-01.png), [polish_27_f-27.png](crops/polish_27_f-27.png)

### BUG-19 — Critical Axe accessibility violations (`select-name`, `label`, `button-name`) on core operational forms
- **Flow / Step:** `F-09`, `F-15`, `F-18`, `F-21`, `F-22`, `F-23`, `F-24`
- **Role / Viewport:** Waiter, Cashier, Owner @ `390x844` & `1440x900`
- **Severity:** `layout`
- **Steps to Reproduce:** Run `axe-core` WCAG 2.1 AA audit on `/pos`, `/billing`, `/billing/closeout`, `/venue/rooms`, `/inventory/receive`, `/inventory/wastage`, `/inventory/recipes`, `/activity`.
- **Expected:** Zero critical accessibility violations; all `<select>`, `<input>`, and icon buttons have accessible names.
- **Actual:** **35** captures flagged critical `select-name`, **21** critical `label`, **18** critical `button-name`, plus **151** serious `color-contrast` and **11** serious `scrollable-region-focusable`.
- **Evidence:** [walk_stats.json](raw/walk_stats.json), [rule-violations.md](rule-violations.md)

### BUG-20 — Missing Tamil localization on Royal Dum Pukht customer menu and Staff navigation chrome
- **Flow / Step:** `F-01` (`02-browse-ta`), `F-25` (`04-translations`)
- **Role / Viewport:** `GUEST`, `OWNER` @ `390x844` & `1440x900`
- **Severity:** `wording`
- **Steps to Reproduce:** Switch `/q/<V1_token>` to `தமிழ்`; open `/menu/translations`.
- **Expected:** Menu items, UI controls, and staff chrome render Tamil strings cleanly when Tamil is selected.
- **Actual:** Royal Dum Pukht seeded items remain in English in `தமிழ்` view, and Staff sidebar/header remains untranslated English on `/menu/translations`. Raw dot-keys (`order.qr_rejected`, `qr.rotate`) also appear in Activity Log.
- **Evidence:** [polish_05_f-01.png](crops/polish_05_f-01.png), [polish_28_f-25.png](crops/polish_28_f-25.png)

### BUG-21 — Persistent spinner/skeleton detected past 10 seconds on `/serve` & `/dashboard` mobile transitions
- **Flow / Step:** `F-13` (`01-ready-and-requests` mobile), `F-23` (`00-reload-auth-persistence` / `01-dashboard` mobile)
- **Role / Viewport:** `WAITER`, `OWNER` @ `390x844`
- **Severity:** `layout`
- **Steps to Reproduce:** Navigate via SPA transition to `/serve` and `/dashboard` on mobile (`390x844`).
- **Expected:** Initial loading indicators resolve well under 10 seconds.
- **Actual:** Page-level `.animate-spin` / `.animate-pulse` check reported still visible at 10s on 5 captures (`walk_stats.json`).
- **Evidence:** [polish_26_f-13.png](crops/polish_26_f-13.png), [walk_stats.json](raw/walk_stats.json)

### BUG-22 — Counter POS & Foodie Plaza Billing awaiting-payment settle check blocked on desktop (`F-16`)
- **Flow / Step:** `F-16` (`02-settled` desktop)
- **Role / Viewport:** `CASHIER` (`cashier@foodieplaza.in`) @ `1440x900`
- **Severity:** `wrong data`
- **Steps to Reproduce:** Place counter QR Pay-First order on Foodie Plaza (`F-04` desktop), open `/billing` as `cashier@foodieplaza.in`.
- **Expected:** Order appears under `Awaiting Payment — Counter / QR` with an enabled `Mark Paid` button.
- **Actual:** `Mark Paid` button was absent/not enabled when desktop Cashier inspected `/billing` (`F-16` desktop `02-settled` = `BLOCKED`).
- **Evidence:** [F-16 desktop billing](shots/F-16/desktop__01-awaiting-list.png), [walk_raw.json](raw/walk_raw.json)
