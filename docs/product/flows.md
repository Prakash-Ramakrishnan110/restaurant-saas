# ServeMyFood Complete End-to-End Flows Map

Authoritative walkthrough checklist covering every customer QR flow, floor/kitchen/cashier service flow, hotel flow, counter/takeaway flow, management back-office flow, and platform super-admin flow against the real seeded stack (`seed` + `seed_demo`).

---

## Flow Index

| ID | Group | Flow Name | Primary Role(s) | Seeded Venue / Context | Start Route |
|---|---|---|---|---|---|
| F-01 | Customer QR | Browse-Only Menu | Guest | Royal Dum Pukht (`FINE_DINING`, `BROWSE_ONLY`) | `/q/<V1_token>` |
| F-02 | Customer QR | Order with Staff Approval | Guest | Spice Garden (`CASUAL_DINING`, `ORDER_WITH_APPROVAL`) | `/q/<T21_token>` |
| F-03 | Customer QR | Order Direct | Guest | Bean & Bloom (`CAFE`, `ORDER_DIRECT`) | `/q/<T10_token>` |
| F-04 | Customer QR | Pay-First Counter QR | Guest → Cashier | Foodie Plaza (`FOOD_COURT`, `PAY_FIRST`) | `/q/<Counter6_token>` |
| F-05 | Customer QR | Invalid & Rotated QR Token | Guest + Owner | Spice Garden | `/q/invalid-token-999` & `/qr` |
| F-06 | Customer QR | Reorder Flow & History Consent | Guest | Bean & Bloom | `/q/<T11_token>` |
| F-07 | Customer QR | Table Service Requests (`CALL_WAITER`, `WATER`, `REQUEST_BILL`, `CUTLERY`) | Guest → Waiter | Spice Garden | `/q/<T22_token>` & `/serve` |
| F-08 | Customer QR | Live Order Tracker, Printable Bill & Verified Feedback | Guest → Owner | Bean & Bloom | `/q/<T10_token>/o/<trackingToken>` & `/customers/feedback` |
| F-09 | Waiter | Seat Table, Fire Order, Add Round | Waiter | Spice Garden (`waiter@spicegarden.com`) | `/pos` |
| F-10 | Waiter | Request Payment Handoff, Last Bill & Free Table | Waiter | Spice Garden (`waiter@spicegarden.com`) | `/pos` |
| F-11 | Live Orders | Approve & Reject Incoming QR Orders | Guest + Waiter/Manager | Spice Garden (`waiter@spicegarden.com`) | `/orders` |
| F-12 | Kitchen | Kitchen Display Start Cooking, Mark Ready & Sold-Out Switch | Kitchen | Spice Garden (`kitchen@spicegarden.com`) | `/kds` & `/menu/availability` |
| F-13 | Floor Service | Ready to Serve Queue & Resolve Guest Table Requests | Waiter | Spice Garden (`waiter@spicegarden.com`) | `/serve` |
| F-14 | Cashier Billing | Table Settlement — Cash Tender & Change Due | Cashier / Owner | Kaveri Cafe (`cashier@kavericafe.com`) / Spice Garden (`owner@spicegarden.com`) | `/billing` |
| F-15 | Cashier Billing | Table Settlement — UPI QR & Card | Cashier / Owner | Kaveri Cafe / Spice Garden | `/billing` |
| F-16 | Cashier Billing | Settle Awaiting-Payment Counter/QR Orders | Cashier | Foodie Plaza (`cashier@foodieplaza.in`) | `/billing` |
| F-17 | Cashier Billing | Hotel Room Folio Charge (`ROOM_FOLIO`) | Owner / Manager | Grand Meridian (`owner@grandmeridian.com`) | `/billing` & `/billing/room-charges` |
| F-18 | Cashier Billing | Bills History Reprint/Refund & Shift Closeout | Cashier | Chai Corner (`cashier@chaicorner.in`) / Kaveri Cafe (`cashier@kavericafe.com`) | `/billing/bills` & `/billing/closeout` |
| F-19 | Specialty Ops | Takeaway / Parcel Packing & Pickup Verification | Owner / Cashier | Foodie Plaza / Spice Garden | `/takeaway` |
| F-20 | Hotel Ops | Room Service Dispatch Board | Owner / Manager | Grand Meridian (`owner@grandmeridian.com`) | `/room-service` |
| F-21 | Hotel Ops | Hotel Rooms Management | Owner / Manager | Grand Meridian (`owner@grandmeridian.com`) | `/venue/rooms` |
| F-22 | Counter Ops | Counter Token Venue End-to-End | Cashier + Kitchen | Chai Corner (`cashier@chaicorner.in`, `kitchen@chaicorner.in`) | `/pos` → `/kds` → `/billing` |
| F-23 | Management | Owner & Manager Dashboard, Reports, Customers, Feedback & Activity | Owner & Manager | Spice Garden (`owner@spicegarden.com`, `manager@spicegarden.com`) | `/dashboard`, `/reports/*`, `/customers`, `/activity` |
| F-24 | Inventory | Stock Overview, Receive, Wastage, Counts, Recipes, Purchases, Reports & Settings | Owner | Spice Garden (`owner@spicegarden.com`) | `/inventory`..`/inventory/settings` |
| F-25 | Menu | Menu Editor, Option Groups, Availability & Translations | Owner | Spice Garden (`owner@spicegarden.com`) | `/menu`, `/menu/options`, `/menu/availability`, `/menu/translations` |
| F-26 | Venue Setup | Onboarding, Branches, Venue Layout, Areas, Tables, Counters, Floor Plan & QR Print Sheet | Owner | Spice Garden & Chai Corner | `/onboarding`..`/qr` |
| F-27 | Team & Settings | Staff, Roles Guide, Branding, Venue Settings, Sound, Devices, Account, Plan & Help | Owner | Spice Garden (`owner@spicegarden.com`) | `/staff`..`/help` |
| F-28 | Platform Admin | Super Admin Dashboard, Tenants Directory, New Customer Wizard, Tenant Detail, Plans, Health, Activity, Support, Leads & Announcements | Platform Admin | Platform (`admin@fusionengine.in`) | `/admin`..`/admin/announcements` |

---

## Detailed Steps & Expected Results

### F-01: Customer QR — Browse Only
- **Role:** Anonymous Guest (`PUBLIC`)
- **Start Route:** `/q/<V1_token>` (Royal Dum Pukht)
- **Steps:**
  1. Open QR menu URL `/q/<V1_token>`.
  2. Switch UI language to Tamil (`தமிழ்`) and back to English.
  3. Search or filter items by diet (`VEG` / `NON_VEG`).
  4. Verify cart / add-to-cart controls are disabled or hidden (`BROWSE_ONLY`).
- **Expected Result:** Branded browse-only banner appears; no order placement controls allow submitting an order; zero console/HTTP 5xx errors.

### F-02: Customer QR — Order with Approval
- **Role:** Anonymous Guest (`PUBLIC`)
- **Start Route:** `/q/<T21_token>` (Spice Garden, `CUSTOMER_CAN_OPEN`, `ORDER_WITH_APPROVAL`)
- **Steps:**
  1. Open `/q/<T21_token>` and inspect menu cards and approval notice.
  2. Tap `+ Add` on a dish, add to cart, open cart sheet, optionally add note/name, tap **Place Order**.
  3. Observe redirect to `/q/<T21_token>/o/<trackingToken>`.
- **Expected Result:** Order is created with `PENDING_APPROVAL` status; customer sees "Waiting for staff approval" card on the order tracker.

### F-03: Customer QR — Order Direct
- **Role:** Anonymous Guest (`PUBLIC`)
- **Start Route:** `/q/<T10_token>` (Bean & Bloom, `CUSTOMER_CAN_OPEN`, `ORDER_DIRECT`)
- **Steps:**
  1. Open `/q/<T10_token>`.
  2. Select a dish, open cart, submit order.
  3. Verify order tracker shows `PLACED` ("Placed") on the 4-step progress tracker without waiting for staff approval.
- **Expected Result:** Order bypasses `PENDING_APPROVAL`, enters `PLACED` immediately, and opens `/q/<T10_token>/o/<trackingToken>`.

### F-04: Customer QR — Pay First (Counter QR → Cashier Settlement)
- **Role:** Guest (`PUBLIC`) + Cashier (`cashier@foodieplaza.in`)
- **Start Route:** `/q/<Counter6_token>` (Foodie Plaza, `PAY_FIRST`, `FOOD_COURT`)
- **Steps:**
  1. Guest opens Counter QR menu, verifies counter badge (never shows "table"), adds combo item, submits order.
  2. Guest observes tracker showing `AWAITING_PAYMENT` ("Pay at counter") and Token `#`.
  3. In separate Cashier context, cashier opens `/billing`, finds order under **Awaiting Payment — Counter / QR**, selects Cash/UPI/Card, clicks confirm payment.
  4. Guest refreshes/polls tracker.
- **Expected Result:** Order transitions from `AWAITING_PAYMENT` to `PLACED`/paid, and customer tracker advances from payment prompt to live preparation progress.

### F-05: Customer QR — Rotated or Invalid Token
- **Role:** Guest (`PUBLIC`) + Owner (`owner@spicegarden.com`)
- **Start Route:** `/q/invalid-nonexistent-token-999` and `/qr`
- **Steps:**
  1. Guest opens `/q/invalid-nonexistent-token-999`.
  2. Owner opens `/qr`, picks a sacrificial table (`T30`) and triggers **Rotate QR**, capturing the old vs new token.
  3. Guest attempts to open the old rotated token URL, then opens the new token URL.
- **Expected Result:** Invalid and rotated old tokens render a clean localized "QR invalid / expired" state without uncaught exceptions or leaked menu data; new rotated token loads cleanly.

### F-06: Customer QR — Reorder & History Consent
- **Role:** Guest (`PUBLIC`)
- **Start Route:** `/q/<T11_token>` (Bean & Bloom)
- **Steps:**
  1. Open QR menu and verify `localStorage` order history is empty/opt-in off by default with an explicit **Enable** prompt.
  2. Click **Enable** ("Remember my orders on this phone"), place an order, and return via "Back to menu" on tracker.
  3. Expand **My orders (1)** and click **Reorder** (`reorderPreview`).
  4. Verify cart opens pre-populated with previous order items (checking availability/price notice) and submit reorder if available.
- **Expected Result:** Consent is explicitly gated before saving order numbers/tracking tokens locally; Reorder checks `reorder-preview` API and restores items cleanly.

### F-07: Customer QR — Service Requests & Staff Acknowledge/Resolve
- **Role:** Guest (`PUBLIC`) + Waiter (`waiter@spicegarden.com`)
- **Start Route:** `/q/<T22_token>` & `/serve`
- **Steps:**
  1. Guest opens `/q/<T22_token>` (ensure session opened) and taps **Call waiter**, **Water**, **Request bill**, or **Cutlery**.
  2. Verify HTTP status and UI feedback banner on guest screen.
  3. Waiter opens `/serve` and resolves any `PENDING` guest table requests.
- **Expected Result:** Valid service requests (`CALL_WAITER`, `WATER`, `CUTLERY`, and bill request) return HTTP 201 and appear in Waiter `/serve` Guest Table Requests panel where they can be resolved. Any enum mismatch returning 4xx is recorded as FAIL.

### F-08: Customer QR — Order Tracker, Printable Bill & Feedback
- **Role:** Guest (`PUBLIC`) + Owner (`owner@beanbloom.in`)
- **Start Route:** `/q/<T10_token>/o/<trackingToken>` & `/customers/feedback`
- **Steps:**
  1. Guest opens tracker from F-03, checks itemized bill block, triggers print/save PDF preview check (without blocking dialog) and verifies receipt HTML download button.
  2. Select Food rating, Service rating, optional suggestion topic (`TASTE`/`PORTION`/`SPEED`/`SERVICE`/`OTHER`), enter comment, submit feedback.
  3. Owner opens `/customers/feedback` to verify submitted feedback appears and can be moderated/exported.
- **Expected Result:** Order tracker bill displays store name/items/total; feedback submits HTTP 201 (or records FAIL if suggestion enum mismatches OpenAPI schema!).

### F-09: Waiter — Seat Table, Fire Order, Add Round
- **Role:** Waiter (`waiter@spicegarden.com`)
- **Start Route:** `/pos`
- **Steps:**
  1. Waiter logs in (`waiter@spicegarden.com`), lands on `/pos`.
  2. Selects an `AVAILABLE` table (e.g., `T2`), enters guest count, seats/opens table.
  3. Adds menu items to cart, fires first order (`PLACED`).
  4. Selects same occupied table `T2`, adds another dish round, fires second order (`PLACED`).
- **Expected Result:** Table transitions `AVAILABLE` → `OCCUPIED`, two rounds attach cleanly to the active table session, zero 4xx/5xx errors.

### F-10: Waiter — Request Payment Handoff, Last Bill & Free Table
- **Role:** Waiter (`waiter@spicegarden.com`)
- **Start Route:** `/pos`
- **Steps:**
  1. On occupied table `T2`, waiter views current/last bill controls and clicks **Request Payment**.
  2. After Cashier settles the bill (or on an empty seated table `T3`), waiter verifies **Free Table** closes/clears the table back to Free/Available.
- **Expected Result:** Request Payment triggers billing handoff toast/notification without exposing cash settlement controls to Waiter; Free Table closes/cleans table state cleanly.

### F-11: Live Orders — Approve & Reject QR Orders
- **Role:** Guest (`PUBLIC`) + Waiter (`waiter@spicegarden.com`)
- **Start Route:** `/q/<T23_token>` & `/orders`
- **Steps:**
  1. Guest context submits two QR orders on Spice Garden (`ORDER_WITH_APPROVAL`) so both sit in `PENDING_APPROVAL`.
  2. Waiter opens `/orders`, sees Needs Approval badge count, filters `PENDING_APPROVAL`.
  3. Waiter clicks **Approve** on Order 1 (`PENDING_APPROVAL` → `PLACED`) and **Reject** with reason on Order 2 (`PENDING_APPROVAL` → `CANCELLED`).
  4. Verify both Guest trackers reflect approved cooking status and rejection reason respectively.
- **Expected Result:** Approved order enters Kitchen `PLACED`; rejected order displays cancellation/reason to guest.

### F-12: Kitchen — Start Cooking, Mark Ready & Sold-Out Switch
- **Role:** Kitchen (`kitchen@spicegarden.com`)
- **Start Route:** `/kds` & `/menu/availability`
- **Steps:**
  1. Kitchen logs in (`kitchen@spicegarden.com`), lands on `/kds`.
  2. Locates `PLACED` ticket from F-09/F-11, clicks **Start Cooking** (`PLACED` → `PREPARING`).
  3. Clicks **Mark Ready** (`PREPARING` → `READY`).
  4. Navigates to `/menu/availability`, toggles one dish sold out and back on (ensuring state restored cleanly).
- **Expected Result:** KDS board transitions `PLACED` → `PREPARING` → `READY` seamlessly; availability switch updates live menu state.

### F-13: Ready to Serve & Resolve Guest Requests
- **Role:** Waiter (`waiter@spicegarden.com`)
- **Start Route:** `/serve`
- **Steps:**
  1. Waiter opens `/serve` (`Ready to Serve`).
  2. Sees `READY` order from F-12 and any pending guest requests from F-07.
  3. Resolves guest table request and clicks **Mark Served to Guest** (`READY` → `SERVED`).
- **Expected Result:** Order moves off Ready queue (`SERVED`) and request is marked resolved.

### F-14: Cashier Billing — Cash Settlement
- **Role:** Cashier / Owner (`owner@spicegarden.com` on Spice Garden, and `cashier@kavericafe.com` on Kaveri Cafe)
- **Start Route:** `/billing`
- **Steps:**
  1. Log in as Cashier/Owner on `/billing`.
  2. Select unpaid table session (e.g., `T2` from F-09/F-13).
  3. Select **Cash**, enter tendered amount above total, check calculated **Change Due to Guest**, click **Settle & Print Receipt**.
  4. Verify thermal 80mm receipt modal opens and table session closes.
- **Expected Result:** Invoice is generated server-side with `CASH` tender and integer paise totals; receipt displays `DEMO RECEIPT - NOT A TAX INVOICE`.

### F-15: Cashier Billing — UPI & Card Settlement
- **Role:** Owner (`owner@spicegarden.com`) / Waiter (`waiter@spicegarden.com` creates 2 small tables)
- **Start Route:** `/billing`
- **Steps:**
  1. Seat & fire short orders on two tables (`T4`, `T5`) so unpaid sessions exist.
  2. On `/billing`, settle `T4` via **UPI QR** (`UPI`) and `T5` via **Card** (`CARD`).
- **Expected Result:** Both settlements issue server invoices and appear in Bills History under `UPI` and `CARD`.

### F-16: Cashier Billing — Awaiting Payment (Pay-First Counter/QR)
- **Role:** Cashier (`cashier@foodieplaza.in`)
- **Start Route:** `/billing`
- **Steps:**
  1. Ensure `AWAITING_PAYMENT` QR order exists from F-04 on Foodie Plaza.
  2. Cashier opens `/billing`, locates order in **Awaiting Payment — Counter / QR**, picks payment method, settles payment.
- **Expected Result:** Order unlocks to `PLACED` / Kitchen flow and leaves Awaiting Payment panel.

### F-17: Cashier Billing — Hotel Room Charge (`ROOM_FOLIO`)
- **Role:** Owner (`owner@grandmeridian.com`)
- **Start Route:** `/pos` → `/billing` → `/billing/room-charges`
- **Steps:**
  1. Owner opens `/pos` on Grand Meridian (`HOTEL_RESTAURANT`), selects a room (e.g. `Room 101`), seats/opens session, fires room-service food order.
  2. Opens `/billing`, selects **Room Folio** (`ROOM_FOLIO`), enters/confirms roomfolio details if shown, settles invoice.
  3. Navigates to `/billing/room-charges` to verify the posted invoice appears on Front Desk Room Charges Folio.
- **Expected Result:** Room folio settlement succeeds and displays in `/billing/room-charges`.

### F-18: Bills History (Reprint/Refund) & Shift Closeout
- **Role:** Cashier (`cashier@chaicorner.in` / `cashier@kavericafe.com`) / Owner (`owner@spicegarden.com`)
- **Start Route:** `/billing/bills` & `/billing/closeout`
- **Steps:**
  1. Open `/billing/bills`, filter by today/method, open **Reprint** dialog, verify refund modal accessibility.
  2. Open `/billing/closeout`, inspect expected cash/UPI/card totals, record cash movement / counted cash / shift close if shift open.
- **Expected Result:** Invoice history renders live server records; Shift Close displays server-computed totals and variance cleanly.

### F-19: Takeaway / Parcel Queue & Pickup Verification
- **Role:** Owner (`owner@spicegarden.com`) / Cashier (`cashier@chaicorner.in`)
- **Start Route:** `/takeaway`
- **Steps:**
  1. Navigate by URL to `/takeaway` (not in sidebar — record reachability).
  2. Inspect takeaway/parcel orders, toggle item packing checks, test pickup verification dialog if orders exist.
- **Expected Result:** Screen loads live orders filtered to takeaway/counter without errors; packing & verification controls work cleanly.

### F-20: Hotel Room Service Dispatch
- **Role:** Owner (`owner@grandmeridian.com`)
- **Start Route:** `/room-service`
- **Steps:**
  1. Navigate to `/room-service`, verify hotel room orders appear with live elapsed timers and status transition controls.
- **Expected Result:** Room service queue loads real room orders and updates status without errors.

### F-21: Hotel Rooms Management
- **Role:** Owner (`owner@grandmeridian.com`)
- **Start Route:** `/venue/rooms`
- **Steps:**
  1. Navigate to `/venue/rooms`, filter by floor/status (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`, etc.), inspect Add Room modal & status toggle.
- **Expected Result:** Rooms list loads `Room 101`..`Room 120`; any schema mismatch (`MAINTENANCE` vs backend `TableStatus`) on update is caught as FAIL.

### F-22: Counter Token Venue End-to-End
- **Role:** Cashier (`cashier@chaicorner.in`), Kitchen (`kitchen@chaicorner.in`)
- **Start Route:** `/pos` (Counter Orders) → `/kds` → `/billing`
- **Steps:**
  1. Cashier logs into Chai Corner (`uses_tables = false`), checks `/pos` renders **Counter Orders** and Token `#` (checks zero occurrence of word "table").
  2. Fires a counter token order, Kitchen bumps on `/kds`, Cashier settles/inspects on `/billing`.
- **Expected Result:** Entire counter-token flow works end to end without ever displaying "table" terminology.

### F-23: Owner & Manager Screens (`/dashboard`, `/reports/*`, `/customers`, `/customers/feedback`, `/activity`)
- **Role:** Owner (`owner@spicegarden.com`) & Manager (`manager@spicegarden.com`)
- **Start Route:** `/dashboard`
- **Steps:**
  1. Inspect `/dashboard` KPIs, charts, low-stock alerts.
  2. Visit `/reports/sales`, `/reports/items`, `/reports/payments`, `/reports/exceptions`, `/reports/staff`, `/reports/outlets`.
  3. Visit `/customers`, `/customers/feedback`, `/activity`.
  4. Repeat role comparison checks as `manager@spicegarden.com`.
- **Expected Result:** All management views render live backend data and respect Manager vs Owner scope.

### F-24: Inventory Screens
- **Role:** Owner (`owner@spicegarden.com`)
- **Start Route:** `/inventory`
- **Steps:**
  1. Visit `/inventory`, `/inventory/receive`, `/inventory/wastage`, `/inventory/counts`, `/inventory/recipes`, `/inventory/purchases`, `/inventory/reports`, `/inventory/settings`.
  2. Verify loading, empty/populated tables, modals/forms, and check if `WAITER` gets denied access.
- **Expected Result:** Inventory screens render live `/api/v1/inventory/*` data cleanly without 4xx/5xx or crashes.

### F-25: Menu, Options, Availability & Translations
- **Role:** Owner (`owner@spicegarden.com`)
- **Start Route:** `/menu`
- **Steps:**
  1. Visit `/menu` (categories, items, Quick Add button, item editor), `/menu/options`, `/menu/availability`, `/menu/translations`.
  2. Inspect Tamil translations tab and category/item editors.
- **Expected Result:** All menu management tools load cleanly; Tamil strings and contrast rules pass.

### F-26: Venue Setup & QR Print Sheet
- **Role:** Owner (`owner@spicegarden.com` & `owner@chaicorner.in`)
- **Start Route:** `/onboarding` → `/qr`
- **Steps:**
  1. Visit `/onboarding`, `/branches`, `/venue`, `/venue/areas`, `/venue/tables`, `/venue/floor`, `/qr`.
  2. On `/qr`, open Print Sheet / Preview tab for EN and Tamil cards.
  3. As `owner@chaicorner.in` (counter venue), visit `/venue/counters` and `/venue/tables` / `/venue` to verify counter-venue adaptation.
- **Expected Result:** Setup and QR standee generator work cleanly; counter venues show Counters & Tokens without "table" word leakage.

### F-27: Staff, Roles Guide & Settings
- **Role:** Owner (`owner@spicegarden.com`)
- **Start Route:** `/staff`
- **Steps:**
  1. Visit `/staff`, `/team/roles`, `/settings/branding`, `/settings/venue`, `/settings/sound`, `/settings/devices`, `/settings/account`, `/settings/plan`, `/help`.
  2. Check branding logo/color contrast guard, GSTIN/address fields (rule compliance scan!), venue capability switches, printer settings, and sound alerts.
- **Expected Result:** All settings/staff screens render properly; any rule-violating wording (`GST`, `tax`, `preset`, `paise`, `tenant`) or contrast violation is logged.

### F-28: Platform Super Admin Console
- **Role:** Platform Admin (`admin@fusionengine.in`)
- **Start Route:** `/admin`
- **Steps:**
  1. Log in as `admin@fusionengine.in`, verify redirect to `/admin`.
  2. Walk `/admin`, `/admin/tenants`, `/admin/tenants/new` (Wizard steps), `/admin/tenants/:id` (pick a seeded tenant ID), `/admin/plans`, `/admin/health`, `/admin/activity`, `/admin/support`, `/admin/leads`, `/admin/announcements`.
  3. Verify platform admin cannot access restaurant `/dashboard` or restaurant order data (redirected back to `/admin`).
- **Expected Result:** Super Admin manages tenants/plans/health/support/leads without ever viewing restaurant orders/bills.
