# ServeMyFood: 5-Minute Product Journey & Demo Script

This script walks through the end-to-end operational lifecycle of ServeMyFood across distinct operational roles: **Waiter**, **Kitchen Chef**, **Cashier**, and **Restaurant Owner**, as well as the quick-service **Counter & Token** path.

All demonstration tenants are initialized via:
```powershell
uv run python manage.py seed_demo
```
All staff user accounts share the standard development password: `Password123!`.

---

## 1. Demo Credentials & Operational Personas

### Venue 1: The Grand Kaveri Cafe (Full Dine-In Restaurant)
| Operational Role | Login Email | Initial Landing Screen | Capabilities |
|---|---|---|---|
| **Floor Waiter** | `waiter@kavericafe.com` | Floor POS (`/orders/floor`) | Tables, Order Entry, Course Pacing, Ready-to-Serve Alerts |
| **Kitchen Chef** | `kitchen@kavericafe.com` | Kitchen KDS (`/orders/kds`) | Live Cooking Tickets, Station Routing, Bump Bar |
| **Cashier** | `cashier@kavericafe.com` | Billing (`/billing`) | Table Checkout, Settle Invoices, 80mm Receipts, Shift Closeout |
| **Branch Manager**| `manager@kavericafe.com` | Daily Operations (`/dashboard`)| Floor Oversight, Staff Shifts, Menu Availability, Cancel Voids |
| **Cafe Owner** | `owner@kavericafe.com` | Owner Dashboard (`/dashboard`) | Real-time Sales Revenue, Daily Metrics, Top Dishes, Full Setup |

### Venue 2: Madras Chai Point (Quick-Service Counter & Tokens)
| Operational Role | Login Email | Initial Landing Screen | Capabilities |
|---|---|---|---|
| **Counter Cashier**| `cashier@madraschai.com` | Counter POS (`/orders/floor`) | 2-tap Counter Token Orders, Instant Bill Settlement |
| **Tea Master / Kitchen**| `kitchen@madraschai.com` | Kitchen Queue (`/orders/kds`) | Sequential Token Calling Display (`#001`, `#002`) |

---

## 2. 5-Minute Step-by-Step Live Demonstration Walkthrough

### Part 1: Table-side Ordering (Waiter Persona) - 1 Minute
1. Navigate to `http://localhost:5173/login`.
2. Sign in as `waiter@kavericafe.com` (`Password123!`).
3. App lands directly on **Floor POS** (`/orders/floor`).
4. Notice **Area & Section Filter** ("AC Dining Hall" vs "Open Terrace").
5. Tap Table **T1** (or any available table).
6. Tap dishes to add to cart:
   - **Ghee Roast Masala Dosa** (₹135.00)
   - **South Indian Filter Coffee** (₹45.00)
7. Tap **"Fire Order to Kitchen"**. Order instantly receives sequential number `ORD-0001` and transitions to kitchen.

### Part 2: Kitchen Display System & Bump Bar (Kitchen Persona) - 1 Minute
1. Open a new incognito window or log out.
2. Sign in as `kitchen@kavericafe.com` (`Password123!`).
3. Lands directly on **Kitchen KDS** (`/orders/kds`).
4. Observe the new ticket for Table **T1** flashing with live elapsed preparation timer.
5. Tap the **"Start Preparing"** bump button -> ticket changes state to `PREPARING` with amber visual border.
6. When dishes are ready, tap **"Mark Ready"** -> ticket updates to `READY` status.

### Part 3: Service & Delivery (Waiter Persona) - 30 Seconds
1. Return to the Waiter session (`waiter@kavericafe.com`).
2. Order status shows `READY`. Waiter brings dishes to table and taps **"Mark Served"**.
3. Table T1 remains in `OCCUPIED` status with active table session code `SES-T1-DEMO`.

### Part 4: Cashier Checkout & Receipt Printing (Cashier Persona) - 1 Minute
1. Sign in as `cashier@kavericafe.com` (`Password123!`).
2. Lands directly on **Billing & Settlement** (`/billing`).
3. Left pane shows **Active Dining Sessions** with Table T1 selected.
4. Right pane displays the **Authoritative Server Bill Breakdown**:
   - Subtotal calculated server-side from database line items (pure integer paise math).
   - Zero hardcoded tax rates or CGST/SGST lines (receipts say *"DEMO RECEIPT - NOT A TAX INVOICE"*).
5. Select **Cash** tender, input ₹200 tendered amount -> system computes change due (₹20.00).
6. Tap **"Settle & Print Receipt"**.
7. Thermal receipt modal appears formatted in 80mm width with venue branding, itemized lines, and demo footer.
8. Table T1 session is automatically closed, and physical Table T1 is freed back to `AVAILABLE`.

### Part 5: Executive Sales Dashboard (Owner Persona) - 1 Minute
1. Sign in as `owner@kavericafe.com` (`Password123!`).
2. Lands on the comprehensive **Owner Dashboard** (`/dashboard`).
3. View real-time **Today's Operations** cards populated live from `/api/v1/reports/today/`:
   - **Total Sales Revenue** (₹2,870.00+) formatted with Indian numbering system.
   - **Orders Completed** & **Average Order Value**.
   - **Sales by Payment Method** breakdown (Cash, UPI, Card).
   - **Top 5 Bestselling Items** velocity list (Filter Coffee, Masala Dosa, etc.).
4. Inspect the left sidebar: Owner sees the full suite of operational modules: Daily Work, Menu, Reports, Setup, Team, and Settings.

### Part 6: Quick-Service Tea Shop (No Tables, Pure Tokens) - 30 Seconds
1. Sign in as `cashier@madraschai.com` (`Password123!`).
2. Word *"Table"* is replaced with **Counter & Tokens**.
3. Place order for *Kullad Masala Chai* + *Hot Samosa*.
4. Order generates sequential **Token #001** and immediate counter invoice.
5. Kitchen KDS tracks token numbers ready for collection.

---

## 3. Key Compliance & Architecture Highlights for Evaluators

1. **Strictly Zero Floats on Currency**:
   - All backend calculations are performed in integer paise.
   - Frontend displays format via `formatRupees(paise)` with Indian digit grouping (e.g., `₹1,25,000.00`).
2. **Tax Purge Adherence**:
   - Zero tax rules, CGST, or SGST lines anywhere in customer/billing screens until confirmed by certified accountant.
   - Receipts prominently display `"DEMO RECEIPT - NOT A TAX INVOICE"`.
3. **Role-Based Tenant Isolation**:
   - Cross-tenant queries return 404/403.
   - Platform super-administrators view aggregated platform metrics only; never individual restaurant data.
