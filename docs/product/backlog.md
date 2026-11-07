# ServeMyFood: Product Backlog & Release Roadmap

## 1. Release Milestone Map

```
v0.3.3 (Foundations Accepted)
   │
   ▼
Prompt 3B: Onboarding Wizard, Venue Branding & Printable QR Sheets (v0.4.0)
   │
   ▼
Pilot 1: Operational Core (Staff Dine-In, Takeaway, KDS, Cashier Billing, Owner Dashboard)
   │
   ▼
Pilot 2: Customer Self-Ordering QR Application & Direct Kitchen Dispatch
   │
   ▼
Phase 2: Payment Gateways (Razorpay/Stripe), Push Real-Time SSE, and Multi-Branch Inventory
```

---

## 2. Epics & User Stories

### Epic 1: Venue Onboarding & Brand Customization (Prompt 3B)
- **STORY-ONBD-01**: Multi-Step Onboarding Wizard
  - As a new venue owner, I want a 4-step wizard (Venue Profile -> Floor/Areas -> Menu Quickstart -> Printables) so I can configure my business in under 10 minutes.
- **STORY-ONBD-02**: Venue Branding Settings
  - As an owner, I want to upload my restaurant logo, select brand primary accent colors, and configure receipt headers/footers in English and Tamil.
- **STORY-ONBD-03**: Branded QR Print Sheet Generator
  - As an owner, I want to generate a multi-up printable PDF/SVG sheet of QR table stands with venue logo, table number, Wi-Fi details, and scanning instructions in English and Tamil.

### Epic 2: Staff-Entered Dine-In & Table Operations (Pilot 1)
- **STORY-POS-00**: Interactive Drag-and-Drop Floor Plan Editor (Deferred from Prompt 3C)
  - As a venue owner or manager, I want an interactive 2D drag-and-drop floor plan designer to freely position tables, rotate shapes, align furniture, and configure architectural boundaries (pillars, doors, walls).
  - *Status*: Deferred to post-v0.5.0 milestone. Current Screen B5 delivers a clean read-only grid layout with live table status and side-sheet status updates.
- **STORY-POS-01**: Touch-Optimized Waiter Terminal
  - As a floor waiter using an Android tablet, I want large touch targets (>= 56px) and high-contrast item cards to rapidly take orders at table-side.
- **STORY-POS-02**: Modifiers & Special Kitchen Instructions
  - As a waiter, I want to attach item variations (e.g., spice level, extra cheese, no onion) directly to order line items before firing.
- **STORY-POS-03**: Course Firing Management
  - As a waiter or captain, I want to hold main courses and fire starters immediately to coordinate kitchen pacing.

### Epic 3: Kitchen Display System (KDS) & Fulfilment (Pilot 1)
- **STORY-KDS-01**: Station-Specific Ticket Routing
  - As a chef at the grill station, I want to see only grill items on my display, while the beverage station sees drinks.
- **STORY-KDS-02**: Visual Prep Timer & SLA Escalation
  - As a kitchen manager, I want tickets to transition visually (Green -> Amber -> Red flashing) as order wait times exceed 15 and 25 minutes.
- **STORY-KDS-03**: Touch Bump Bar
  - As kitchen staff with gloved hands, I want large touch bump buttons to mark individual items or entire tickets as "PREPARING" or "READY".

### Epic 4: Counter Takeaway & Sequential Tokens (Pilot 1)
- **STORY-TAK-01**: Rapid Counter Order Entry
  - As a cashier at a quick-service tea counter, I want a 2-tap order flow that generates a sequential counter token (`#001`, `#002`) in under 5 seconds.
- **STORY-TAK-02**: Takeaway Customer Calling Screen
  - As a takeaway customer, I want a public display showing "Now Preparing" and "Ready for Pickup" token numbers.

### Epic 5: Cashier Billing & Payment Settlement (Pilot 1)
- **STORY-BIL-01**: Bill Splitting & Table Checkout
  - As a cashier, I want to split bills by item or evenly by seat count and apply pre-approved manager discounts.
  - *Status*: Multi-tender and equal split pay deferred in v0.8.0. Cashier billing operates in full payment settlement mode only.

---

## 3. Scope Trim & Deferred Features (Frozen for v0.8.0 Release)

The following items are trimmed from active user interfaces and deferred to Phase 2:
1. **Course Firing Management & Hold-Mains Pacing**:
   - Hidden from POS unless venue explicitly opts in via `capabilities.supports_courses`.
   - Simplifies ordering flow for quick-service and casual restaurants.
2. **Customer Call Bell & Waiter Calling Requests**:
   - Customer-initiated service calls (Water, Napkins, Call Waiter) are hidden from floor POS until the customer web self-ordering pilot launches.
3. **Multi-Tender Bill Splitting**:
   - Cashier checkout supports single full payment tender (Cash, UPI QR, Card, Room Folio). Equal item/head splitting is deferred.
4. **Automated Tax Calculations (CGST/SGST/VAT)**:
   - Zero hardcoded tax rates or automatic computations. All bills show net totals calculated as the exact sum of server-priced line items.
   - `BusinessSettings.tax_mode` remains dormant; tax rules will be enabled once confirmed by chartered accountant. Receipts state: `"DEMO RECEIPT - NOT A TAX INVOICE"`.

- **STORY-BIL-02**: Thermal Receipt Printing (ESC/POS)
  - As a cashier, I want one-click receipt generation formatted for 58mm and 80mm thermal receipt printers with GST breakdowns.
- **STORY-BIL-03**: Cash Drawer & Shift Float Reconciliation
  - As a cashier ending a shift, I want to log physical cash counted against expected sales to produce a shift close-out variance report.

### Epic 6: Owner Sales Dashboard & Financial Auditing (Pilot 1)
- **STORY-REP-01**: Real-Time Daily Sales Analytics
  - As a restaurant owner, I want a real-time dashboard displaying gross revenue, average order value (AOV), top-selling items, and payment method breakdown (Cash vs UPI).
- **STORY-REP-02**: Z-Report Generation
  - As an owner or accountant, I want an end-of-day Z-Report summarizing net sales, SGST/CGST tax liabilities, and voided item audit trails.

---

## 3. Future & Deferred Venue Types

### Food Truck / Pop-Up Venue Support (Deferred from Onboarding Wizard)
- **STORY-TRUCK-01**: Mobile / Pop-Up Operations Preset
  - As a food truck or pop-up vendor owner, I want a single pickup window counter workflow with battery-optimized mobile POS, GPS/location-based customer ordering, and dynamic temporary menu items. Deferred from initial onboarding wizard in favor of the core 7 hospitality presets (Tea shop, Bakery, Cafe, Restaurant, Fine dining, Hotel, Food court).

