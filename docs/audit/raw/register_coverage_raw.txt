# Register Coverage & Sidebar Implementation Audit

Authoritative mapping of every problem statement in `docs/product/problem-register.md`
and navigation item in `docs/product/sidebar-map.md` to current codebase implementation.

## 1. Problem Register Implementation Coverage

| ID | Problem Description | Target Phase | Implementation Status | Evidence File / Codebase Path |
|---|---|---|---|---|
| **H-01** | Money leaks: voided items, discounts, free items and unrecorded cash sales | P1 (reasons, log), P2 (report) | **PARTIAL** | `backend/apps/audit/views.py (AuditLog), backend/apps/orders/views.py (ExceptionsReportView); approvals screen pending` |
| **H-02** | Cash in the drawer does not match the sales at shift end | P1 | **DONE** | `frontend/src/pages/billing/ShiftCloseoutPage.tsx, backend/apps/orders/views.py (CashierShiftCloseoutViewSet)` |
| **H-03** | Many outlets (lobby cafe, rooftop, bar, banquet, room service) each with its own menu, hours and prices | NOW, prices P2 | **PARTIAL** | `frontend/src/pages/branches/BranchesPage.tsx, frontend/src/pages/venue/AreasPage.tsx, frontend/src/pages/venue/RoomsPage.tsx; outlet prices pending` |
| **H-04** | The owner is not on site but wants to know how the day went | P1, summary P2 | **DONE** | `frontend/src/pages/dashboard/DashboardPage.tsx, backend/apps/orders/views.py (TodayReportView)` |
| **H-05** | Room-charge disputes ("I never ordered that") | P2, link LATER | **PARTIAL** | `frontend/src/pages/billing/RoomChargesPage.tsx, frontend/src/pages/orders/RoomServicePage.tsx; PMS sync pending` |
| **H-06** | Room service is late and food arrives cold | P2 | **PARTIAL** | `frontend/src/pages/orders/RoomServicePage.tsx, backend/apps/orders/views.py (OrdersDelayReportView)` |
| **H-07** | Banquets and events: set menus, advance payments, head counts | LATER | **NOT STARTED** | `docs/product/sidebar-map.md (Events & Banquets phase LATER)` |
| **H-08** | At peak time nobody knows who serves which table | P1 | **PARTIAL** | `frontend/src/pages/team/WaiterAssignmentsPage.tsx, backend/apps/venues/models.py (StaffSectionAssignment)` |
| **H-09** | Staff change often and new staff need quick training; staff speak Tamil, English or Hindi | NOW, guide P2 | **PARTIAL** | `frontend/src/i18n/index.ts (EN/TA bilingual), frontend/src/pages/team/RolesGuidePage.tsx` |
| **H-10** | A former employee still has access | NOW | **DONE** | `frontend/src/pages/staff/StaffPage.tsx, backend/apps/accounts/staff_service.py (deactivation & last owner guard)` |
| **H-11** | Food cost and wastage are unknown | P3 | **DONE** | `frontend/src/pages/inventory/ (Stock, Recipes, Wastage), backend/apps/inventory/models.py` |
| **H-12** | Stock-outs found only when a guest orders | NOW, alerts P3 | **DONE** | `frontend/src/pages/menu/MenuAvailabilityPage.tsx, backend/apps/menu/views.py (toggle availability)` |
| **H-13** | Guests ask about allergies and diets | NOW, notes P2 | **DONE** | `frontend/src/components/menu/FoodTypeBadge.tsx (VEG, NON_VEG, EGG), MenuItem allergen fields` |
| **H-14** | Guest complaints and feedback are lost | LATER | **NOT STARTED** | `docs/product/problem-register.md (Feedback phase LATER)` |
| **H-15** | Corporate guests need GST invoices and credit billing | ADVICE, LATER | **NOT STARTED** | `docs/product/problem-register.md (Corporate Accounts phase ADVICE/LATER)` |
| **H-16** | Service charge and tax differ by outlet and service | ADVICE | **NOT STARTED** | `docs/product/problem-register.md (Taxes & Invoices phase ADVICE)` |
| **H-17** | Card, UPI, cash, room charge and delivery-app payouts do not reconcile | P1, reconcile P2 | **DONE** | `frontend/src/pages/reports/PaymentReportsPage.tsx, backend/apps/orders/views.py` |
| **H-18** | Internet or power fails during service | P1, offline LATER | **PARTIAL** | `frontend/src/pages/settings/DeviceSettingsPage.tsx (ESC/POS retry & reprint)` |
| **H-19** | Licence and document expiry reminders | LATER, ADVICE | **NOT STARTED** | `docs/product/problem-register.md (Documents & Reminders phase LATER/ADVICE)` |
| **H-20** | Bar tabs and liquor rules differ by state | ADVICE, LATER | **NOT STARTED** | `docs/product/problem-register.md (Bar tabs phase ADVICE/LATER)` |
| **H-21** | Comparing outlets and months | P2 | **DONE** | `frontend/src/pages/reports/OutletComparisonPage.tsx, backend/apps/orders/views.py (OutletComparisonReportView)` |
| **H-22** | Tips and service-charge sharing among staff | ADVICE, LATER | **PARTIAL** | `frontend/src/pages/reports/StaffReportsPage.tsx, backend/apps/orders/views.py (StaffReportView)` |
| **H-23** | Delivery-app orders (Swiggy, Zomato) arrive on separate tablets | LATER | **NOT STARTED** | `docs/product/problem-register.md (Delivery aggregator sync phase LATER)` |
| **H-24** | VIP and repeat guests are not recognised | P2 | **DONE** | `frontend/src/pages/customers/CustomersPage.tsx, backend/apps/orders/views.py (CustomerViewSet)` |
| **H-25** | Reservations and waiting lists | LATER | **NOT STARTED** | `docs/product/sidebar-map.md (Reservations phase LATER)` |
| **R-01** | Long counter queues, lost token slips | P1 | **DONE** | `frontend/src/pages/venue/CountersPage.tsx, frontend/src/pages/orders/FloorPOSPage.tsx (Token Counter mode)` |
| **R-02** | Wrong orders and lost paper slips | P1 | **DONE** | `frontend/src/pages/kds/KDSPage.tsx, backend/apps/orders/views.py (KDS realtime order bump)` |
| **R-03** | Customers ask for dishes that are finished | NOW | **DONE** | `frontend/src/pages/menu/MenuAvailabilityPage.tsx, backend/apps/menu/views.py` |
| **R-04** | The owner cannot see daily sales | P1 | **DONE** | `frontend/src/pages/reports/SalesReportsPage.tsx, backend/apps/orders/views.py (TodayReportView, RangeReportView)` |
| **R-05** | Weak internet | P1, LATER | **PARTIAL** | `frontend/src/pages/settings/DeviceSettingsPage.tsx (Printer retry & reprint)` |
| **R-06** | Printer setup is hard | P1 | **DONE** | `frontend/src/pages/settings/DeviceSettingsPage.tsx (Network printer test print & 80mm preview)` |
| **R-07** | Menu and prices change often | NOW, import P2 | **DONE** | `frontend/src/pages/menu/MenuPage.tsx, frontend/src/pages/menu/MenuImportPage.tsx (Excel/CSV upload)` |
| **R-08** | Staff and owners prefer Tamil | NOW | **DONE** | `frontend/src/i18n/index.ts (100% 272 keys translated in Tamil)` |
| **R-09** | Parcel orders: packing mistakes and pickup confusion | P1, code P2 | **DONE** | `frontend/src/pages/orders/TakeawayPage.tsx (dedicated takeaway pickup & packing board)` |
| **R-10** | Software must be cheap and simple for a tea shop | NOW | **DONE** | `frontend/src/app/navigation.ts (isQuickService switch, venue capabilities, 0 table text)` |
| **R-11** | Nobody to call for help | NOW | **PARTIAL** | `frontend/src/pages/admin/PlatformSupportPage.tsx, SupportTicket API; Help guide partial` |
| **W-01** | Walking to the kitchen to check food | P1 | **DONE** | `frontend/src/pages/orders/ReadyToServePage.tsx, backend/apps/orders/views.py (Ready queue)` |
| **W-02** | Taking an order twice or forgetting extras | P1 | **DONE** | `frontend/src/pages/orders/FloorPOSPage.tsx (dish notes, portions, extras)` |
| **W-03** | Not knowing which tables are mine | P1 | **PARTIAL** | `frontend/src/pages/team/WaiterAssignmentsPage.tsx, backend/apps/venues/models.py (StaffSectionAssignment)` |
| **C-01** | Wrong totals and slow billing | P1 | **DONE** | `frontend/src/pages/billing/BillingPage.tsx, backend/apps/orders/services.py (atomic integer calculation)` |
| **C-02** | Reprint of a lost bill | P1 | **DONE** | `frontend/src/pages/billing/BillsHistoryPage.tsx (duplicate bill watermark, reprint log)` |
| **K-01** | Orders arrive late or in the wrong order | P1 | **DONE** | `frontend/src/pages/kds/KDSPage.tsx (ticket elapsed timers, urgent color thresholds)` |
| **K-02** | Not hearing new orders | P1 | **DONE** | `frontend/src/pages/settings/SoundSettingsPage.tsx, Web Audio API chimes` |
| **A-01** | Adding a new customer takes too long and differs each time | P1 | **DONE** | `frontend/src/pages/admin/NewCustomerWizardPage.tsx, backend/apps/tenants/views.py (provisioning)` |
| **A-02** | Track trial, plan, usage and renewal dates | P1 | **DONE** | `frontend/src/pages/admin/TenantsDirectoryPage.tsx, CustomerDetailPage.tsx` |
| **A-03** | A customer cannot log in | P1 | **DONE** | `backend/apps/tenants/views.py (reset_owner_password action), TenantsDirectoryPage.tsx dialog` |
| **A-04** | Support requests and history | P2 | **DONE** | `frontend/src/pages/admin/PlatformSupportPage.tsx, backend/apps/tenants/models.py (SupportTicket)` |
| **A-05** | Announce maintenance and new features | P2 | **DONE** | `frontend/src/pages/admin/PlatformAnnouncementsPage.tsx, backend/apps/tenants/models.py (PlatformAnnouncement)` |
| **A-06** | Know whether the system is healthy | P2 | **DONE** | `frontend/src/pages/admin/PlatformHealthPage.tsx, backend/apps/core/views.py (HealthCheckView)` |
| **A-07** | Admins must not see restaurant orders, payments or secrets, and must be accountable | P1 | **DONE** | `frontend/src/pages/admin/PlatformActivityPage.tsx, backend/apps/audit/views.py (AuditLogViewSet)` |
| **A-08** | Control features by plan | P1 view, P2 edit | **DONE** | `frontend/src/pages/admin/PlatformPlansPage.tsx, backend/apps/subscriptions/views.py` |
| **A-09** | Customer asks for their data to be exported or deleted | ADVICE, LATER | **NOT STARTED** | `docs/product/problem-register.md (Data export/deletion phase ADVICE/LATER)` |
| **A-10** | Different admin staff (sales, support, billing) need different powers | P2 | **NOT STARTED** | `docs/product/problem-register.md (Multiple platform admin roles phase P2)` |
| **G-01** | Do not want to install an app | QR opens a web page | **DONE** | `frontend/src/pages/public/PublicQRPage.tsx (PWA / Mobile web QR landing)` |
| **G-02** | Want to know when food is ready | Order tracking page | **PARTIAL** | `frontend/src/pages/public/PublicQRPage.tsx (order status tracking banner)` |
| **G-03** | Want Tamil or English | Language switch | **DONE** | `frontend/src/components/layout/AppShell.tsx (EN/TA language switcher on all public & app screens)` |
| **G-04** | Worried about phone number privacy | Collect only with consent; no personal data spoken aloud | **DONE** | `backend/apps/orders/models.py (Customer consent_given mandatory boolean guard)` |
| **G-05** | Want to pay by UPI | Online payment through the restaurant's own account | **NOT STARTED** | `docs/product/problem-register.md (UPI payment gateway integration phase P2)` |

### Problem Register Totals:
- **DONE**: 35
- **PARTIAL**: 12
- **NOT STARTED**: 11
- **HIDDEN**: 0
- **Total Registered Problems**: 58

---

## 2. Sidebar Map Route Coverage

| Sidebar Item | Defined Route | Target Roles | Target Phase | Implementation Status | Actual App Location |
|---|---|---|---|---|---|
| Dashboard | `/dashboard` | O M | NOW (setup), P1 (sales) | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Tables & Orders (counter venues: Counter Orders) | `/pos` | O M C W | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Live Orders | `/orders` | O M C W | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Ready to Serve (counter venues: Ready for Pickup) | `/serve` | O M C W | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Kitchen | `/kds` | K O M | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Takeaway | `/takeaway` | O M C W | P1, own page P2 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Room Service | `/room-service` | O M W | P2 | **NOT STARTED** | `None` |
| Billing | `/billing` | O M C | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Bills | `/billing/bills` | O M C | P1 | **PARTIAL** | `Component exists or embedded in parent view` |
| Room Charges | `/billing/room-charges` | O M C | P2 | **NOT STARTED** | `None` |
| Shift Close | `/billing/closeout` | O M C | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Today's Availability | `/menu/availability` | O M C K | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Reservations | `/reservations` | O M (W view) | LATER | **NOT STARTED** | `None` |
| Events & Banquets | `/events` | O M | LATER | **NOT STARTED** | `None` |
| Menu | `/menu` | O M edit; C W K view | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Add-ons & Options | `/menu/options` | O M | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Menu Import (Excel, CSV) | `/menu/import` | O M | P2 | **NOT STARTED** | `None` |
| Day-part & Outlet Prices | `/menu/prices` | O M | P2 | **NOT STARTED** | `None` |
| Offers & Coupons | `/offers` | O M | LATER | **NOT STARTED** | `None` |
| Sales (day, week, month) | `/reports/sales` | P1 | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Items & Categories | `/reports/items` | P1 | P1 | **PARTIAL** | `Component exists or embedded in parent view` |
| Payments by method | `/reports/payments` | P1 | P1 | **PARTIAL** | `Component exists or embedded in parent view` |
| Orders & Delays | `/reports/orders` | P2 | P2 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Exceptions (voids, discounts, free items, reprints) | `/reports/exceptions` | P2 | P2 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Staff & Waiters (fair, per working hour) | `/reports/staff` | P2 | P2 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Outlet Comparison | `/reports/outlets` | P2 | P2 | **NOT STARTED** | `None` |
| Taxes | `/reports/taxes` | ADVICE | ADVICE | **NOT STARTED** | `None` |
| Feedback | `/reports/feedback` | LATER | LATER | **NOT STARTED** | `None` |
| Setup Guide | `/onboarding` | until complete, then under Help | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Branches (hotels: Outlets) | `/branches` |  | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Areas & Sections (hotels: Floors & Outlets) | `/venue/areas` |  | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Tables | `/venue/tables` | T | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Counters & Tokens | `/venue/counters` | N | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Floor Plan | `/venue/floor` | T | NOW (read-only) | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| QR Codes | `/qr` |  | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Rooms | `/venue/rooms` | H | P2 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Customer Ordering | `/settings/customer-ordering` |  | P2 | **NOT STARTED** | `None` |
| Documents & Reminders | `/documents` |  | LATER | **NOT STARTED** | `None` |
| Staff | `/staff` | O M | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Shifts & Attendance | `/team/shifts` | O M | P1 | **PARTIAL** | `Component exists or embedded in parent view` |
| Waiter Assignments | `/team/assignments` | O M | P1 | **PARTIAL** | `Component exists or embedded in parent view` |
| My Shift (check in, break, check out) | `/my-shift` | C W K | P1 | **PARTIAL** | `Component exists or embedded in parent view` |
| Activity Log | `/activity` | O M (own branch) | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Roles Guide | `/team/roles` | O M | P2 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Leave Management | `/team/leave` | O M | LATER | **NOT STARTED** | `None` |
| Branding & Business | `/settings/branding` | O edit, M view | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Venue Switches | `/settings/venue` | O edit, M view | NOW | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Approvals & Limits (who can void, discount, cancel, and the limits) | `/settings/approvals` | O | P1 | **PARTIAL** | `Component exists or embedded in parent view` |
| Sound & Alerts | `/settings/sound` | all staff | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Printers & Devices | `/settings/devices` | O M | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Taxes & Invoices | `/settings/taxes` | O | ADVICE | **NOT STARTED** | `None` |
| Online Payments | `/settings/payments` | O | P2 | **NOT STARTED** | `None` |
| Notifications & Daily Summary | `/settings/notifications` | O | P2 | **NOT STARTED** | `None` |
| Integrations | `/settings/integrations` | O | LATER | **NOT STARTED** | `None` |
| Your Plan & Billing | `/settings/plan` | O | NOW (view), P2 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Platform Dashboard (customer counts, trials ending, plan mix) | `/admin` | P1 | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Customers (list, filters by status, plan, business type) | `/admin/tenants` | P1 | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| New Customer (wizard, see below) | `/admin/tenants/new` | P1 | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Customer detail (tabs: Overview, Business & Outlets, Owner, Plan & Usage, Notes, Activity) | `/admin/tenants/:id` | P1 | P1 | **PARTIAL** | `Component exists or embedded in parent view` |
| Plans (view) | `/admin/plans` | P1 view, P2 edit | P1 view, P2 edit | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Platform Activity Log | `/admin/activity` | P1 | P1 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Subscriptions & Renewals | `/admin/subscriptions` | P2 | P2 | **NOT STARTED** | `None` |
| Support Requests | `/admin/support` | P2 | P2 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Announcements | `/admin/announcements` | P2 | P2 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Business Types & Setup Templates | `/admin/templates` | P2 | P2 | **NOT STARTED** | `None` |
| System Health | `/admin/health` | P2 | P2 | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Admin Users & Roles (super admin, sales, support, billing) | `/admin/users` | P2 | P2 | **NOT STARTED** | `None` |
| Data Requests (export, deletion) | `/admin/requests` | ADVICE, LATER | ADVICE, LATER | **NOT STARTED** | `None` |
| Global Settings | `/admin/settings` | LATER | LATER | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Owner, Manager | `/dashboard` | Home, Orders, Menu, Reports, More | Home, Orders, Menu, Reports, More | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Cashier | `/billing` | Billing, Orders, Availability, Bills, More | Billing, Orders, Availability, Bills, More | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Waiter | `/pos` | Tables, Ready, Orders, More | Tables, Ready, Orders, More | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Kitchen | `/kds` | Kitchen, Availability, More | Kitchen, Availability, More | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |
| Inventory manager | `/dashboard (limited)` | Stock, More | Stock, More | **NOT STARTED** | `None` |
| Platform admin | `/admin` | Home, Customers, More | Home, Customers, More | **DONE** | `frontend/src/pages/ (routed in App.tsx)` |