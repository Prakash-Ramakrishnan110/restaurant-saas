# ServeMyFood Problem Register

Every real problem we know about, who has it, and where ServeMyFood answers it.
Rule: a new idea is added here first, gets an ID, and is built only when its phase starts.

**Phases:** NOW = built, P1 = first pilot, P2 = second pilot, P3 = inventory, LATER = planned, ADVICE = needs an accountant or lawyer before we build or promise anything.
**Status:** done, partial, not started.

---

## 1. Hotel owner or general manager (H)

| ID | Problem in plain words | Why it hurts | ServeMyFood answer | Sidebar item | Phase | Status |
|---|---|---|---|---|---|---|
| H-01 | Money leaks: voided items, discounts, free items and unrecorded cash sales | Profit disappears and nobody can prove who did it | Reason required for every void, discount and free item; manager approval above a limit; every change in the activity log; an Exceptions report | Settings > Approvals & Limits; Reports > Exceptions; Team > Activity Log | P1 (reasons, log), P2 (report) | partial (audit built) |
| H-02 | Cash in the drawer does not match the sales at shift end | Arguments and silent losses | Shift close with counted cash against expected cash and the difference shown | Daily work > Shift Close | P1 | not started |
| H-03 | Many outlets (lobby cafe, rooftop, bar, banquet, room service) each with its own menu, hours and prices | One system must fit all, and staff get confused | Outlets with their own areas, menu availability, hours; later own prices and day-part menus | Setup > Branches, Areas & Sections ("Floors & Outlets"); Menu > Day-part & Outlet Prices | NOW, prices P2 | partial |
| H-04 | The owner is not on site but wants to know how the day went | Decisions made blind | Phone-friendly dashboard; later a daily summary message | Daily work > Dashboard; Settings > Notifications & Daily Summary | P1, summary P2 | not started |
| H-05 | Room-charge disputes ("I never ordered that") | Lost money and unhappy guests | Charge to room needs room number, guest name and a manager or signature check, and a daily list for the front desk. Linking to the hotel's own system comes later. | Daily work > Room Charges | P2, link LATER | not started |
| H-06 | Room service is late and food arrives cold | Complaints and refunds | Room-service orders with a timer and a late alert | Daily work > Room Service | P2 | not started |
| H-07 | Banquets and events: set menus, advance payments, head counts | Big money, handled on paper | A separate Events module | Daily work > Events & Banquets | LATER | not started |
| H-08 | At peak time nobody knows who serves which table | Unattended tables, slow service | Waiter assignment by floor, section or table; unassigned-table alert; manager can move tables with a reason | Team > Waiter Assignments | P1 | not started |
| H-09 | Staff change often and new staff need quick training; staff speak Tamil, English or Hindi | Mistakes in the first weeks | One simple screen per role, Tamil and English, Help page, Roles Guide | Help; Team > Roles Guide | NOW, guide P2 | partial |
| H-10 | A former employee still has access | Fraud and data risk | Switch an account off instantly; every action is logged; the last owner cannot be removed | Team > Staff; Team > Activity Log | NOW | done |
| H-11 | Food cost and wastage are unknown | Margins shrink unseen | Recipes, stock, wastage log, theoretical against actual use | Inventory | P3 | not started |
| H-12 | Stock-outs found only when a guest orders | Embarrassment, cancelled orders | Sold-out switches now; low-stock alerts later | Daily work > Today's Availability; Inventory > Low-stock Alerts | NOW, alerts P3 | partial |
| H-13 | Guests ask about allergies and diets | Safety and trust | Veg, non-veg, egg marks now; optional allergen notes written by the restaurant (the restaurant is responsible for accuracy) | Menu | NOW, notes P2 | partial |
| H-14 | Guest complaints and feedback are lost | Repeat problems, bad reviews | Guest notes on orders now; feedback and ratings later | Customers > Feedback | LATER | not started |
| H-15 | Corporate guests need GST invoices and credit billing | Delayed payments, rework | Corporate accounts and invoice formats after your accountant confirms the rules | Customers > Corporate Accounts | ADVICE, LATER | not started |
| H-16 | Service charge and tax differ by outlet and service | Wrong bills and notices | Settings screen for tax and service charge, built only after the accountant decides | Settings > Taxes & Invoices | ADVICE | not started |
| H-17 | Card, UPI, cash, room charge and delivery-app payouts do not reconcile | Hours of manual checking | Payments report by method; reconciliation later | Reports > Payments | P1, reconcile P2 | not started |
| H-18 | Internet or power fails during service | Service stops | Printer retry and reprint now; a work-offline mode later; paper bill backup in the Help page | Settings > Printers & Devices | P1, offline LATER | not started |
| H-19 | Licence and document expiry reminders | Fines and shutdowns | Generic reminders the owner enters; no legal claims from us | Setup > Documents & Reminders | LATER, ADVICE | not started |
| H-20 | Bar tabs and liquor rules differ by state | Legal risk | Tab billing only; rules need local legal advice | Daily work > Billing | ADVICE, LATER | not started |
| H-21 | Comparing outlets and months | Cannot see which outlet is weak | Outlet comparison report | Reports > Outlet Comparison | P2 | not started |
| H-22 | Tips and service-charge sharing among staff | Staff disputes | Report of service charge and tips by shift | Reports > Staff | ADVICE, LATER | not started |
| H-23 | Delivery-app orders (Swiggy, Zomato) arrive on separate tablets | Missed and duplicate orders | Integrations through each partner's official programme | Settings > Integrations | LATER | not started |
| H-24 | VIP and repeat guests are not recognised | Lost loyalty | Guest list with consent, notes and preferences | Customers > Guests | P2 | not started |
| H-25 | Reservations and waiting lists | Empty tables and angry queues | Reservations and a waitlist | Daily work > Reservations | LATER | not started |

## 2. Restaurant, cafe and tea shop owner (R)

| ID | Problem | ServeMyFood answer | Sidebar item | Phase | Status |
|---|---|---|---|---|---|
| R-01 | Long counter queues, lost token slips | Counter orders with printed or shown token numbers | Daily work > Counter Orders | P1 | partial |
| R-02 | Wrong orders and lost paper slips | Orders go straight to a kitchen screen | Daily work > Kitchen | P1 | partial |
| R-03 | Customers ask for dishes that are finished | Sold-out switches per outlet | Today's Availability | NOW | done |
| R-04 | The owner cannot see daily sales | Sales dashboard from real invoices | Dashboard | P1 | not started |
| R-05 | Weak internet | Retry and reprint; offline mode later | Printers & Devices | P1, LATER | not started |
| R-06 | Printer setup is hard | Test print and a simple setup guide | Settings > Printers & Devices | P1 | not started |
| R-07 | Menu and prices change often | Menu editor with price-change log; spreadsheet import later | Menu | NOW, import P2 | done |
| R-08 | Staff and owners prefer Tamil | Tamil on every new screen | All | NOW | partial |
| R-09 | Parcel orders: packing mistakes and pickup confusion | Takeaway flow with pickup check; pickup code later | Daily work > Takeaway | P1, code P2 | partial |
| R-10 | Software must be cheap and simple for a tea shop | Counter mode with no tables and very few screens | Venue Switches | NOW | done |
| R-11 | Nobody to call for help | Help page and setup guide; support requests later | Help | NOW | partial |

## 3. Waiter or captain (W), cashier (C), kitchen (K)

| ID | Problem | Answer | Sidebar item | Phase | Status |
|---|---|---|---|---|---|
| W-01 | Walking to the kitchen to check food | "Ready" alert for the waiter | Ready to Serve | P1 | partial |
| W-02 | Taking an order twice or forgetting extras | Order screen with notes and extras | Tables & Orders | P1 | partial |
| W-03 | Not knowing which tables are mine | My tables, Waiter Assignments | Team > Waiter Assignments | P1 | not started |
| C-01 | Wrong totals and slow billing | Server-calculated totals, one bill per table | Billing | P1 | partial |
| C-02 | Reprint of a lost bill | Bills history with a "Duplicate" mark | Bills | P1 | partial |
| K-01 | Orders arrive late or in the wrong order | Kitchen board with waiting timers | Kitchen | P1 | partial |
| K-02 | Not hearing new orders | Chime and voice alert with a visual alert always shown | Sound & Alerts | P1 | not started |

## 4. Fusion Engine platform admin (A)

| ID | Problem | Answer | Sidebar item | Phase | Status |
|---|---|---|---|---|---|
| A-01 | Adding a new customer takes too long and differs each time | "New customer" wizard that builds the right setup for their business type | Platform > Customers > New | P1 | not started |
| A-02 | Track trial, plan, usage and renewal dates | Customer list and detail with usage against plan | Platform > Customers | P1 | partial |
| A-03 | A customer cannot log in | Reset the owner's password; temporary password shown once | Customer detail | P1 | done (backend) |
| A-04 | Support requests and history | Support requests with notes | Platform > Support | P2 | not started |
| A-05 | Announce maintenance and new features | Announcements | Platform > Announcements | P2 | not started |
| A-06 | Know whether the system is healthy | System health page | Platform > System Health | P2 | not started |
| A-07 | Admins must not see restaurant orders, payments or secrets, and must be accountable | Admin sees only account data; every admin action in a platform activity log; support access later only with consent and a time limit | Platform > Activity Log | P1 | partial |
| A-08 | Control features by plan | Plans and limits page | Platform > Plans | P1 view, P2 edit | partial |
| A-09 | Customer asks for their data to be exported or deleted | Export and deletion process | Platform > Requests | ADVICE, LATER | not started |
| A-10 | Different admin staff (sales, support, billing) need different powers | Platform roles | Platform > Admin Users | P2 | not started |

## 5. Guest (G)

| ID | Problem | Answer | Phase |
|---|---|---|---|
| G-01 | Do not want to install an app | QR opens a web page | P2 |
| G-02 | Want to know when food is ready | Order tracking page | P2 |
| G-03 | Want Tamil or English | Language switch | P2 |
| G-04 | Worried about phone number privacy | Collect only with consent; no personal data spoken aloud | P2 |
| G-05 | Want to pay by UPI | Online payment through the restaurant's own account | P2 |

## 6. What we do NOT promise yet
- Any tax rate, tax invoice format, service charge rule or liquor rule (ADVICE items).
- Connection to the hotel's front-office system or delivery apps.
- Working fully offline.
- Legal claims about food safety or allergens: the restaurant enters and owns that information.

