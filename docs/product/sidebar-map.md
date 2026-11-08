# ServeMyFood Sidebar Map

Single source of truth for navigation. `frontend/src/app/navigation.ts` must match this file, and a test fails when they differ.
Never show an item that has no working page. Hidden items are listed here with their phase.

**Roles:** O owner, M manager, C cashier, W waiter, K kitchen, I inventory manager, A platform admin (Fusion Engine only).
**Phases:** NOW built, P1 first pilot, P2 second pilot, P3 inventory, LATER planned, ADVICE needs an accountant or lawyer first.
**Venue rules:** T = only venues with tables, N = only counter venues (tea shop, bakery, food court), H = only hotels.

## Top of the sidebar (always)
- **+ New order** (O M C W). Counter venues say "New counter order".
- **Find a page** (Ctrl+K). Shows only pages the role may open.
- **Pinned** items (up to 5, chosen by the user).

## Restaurant app

### Daily work
| Item | Route | Roles | Rule | Phase |
|---|---|---|---|---|
| Dashboard | /dashboard | O M | | NOW (setup), P1 (sales) |
| Tables & Orders (counter venues: Counter Orders) | /pos | O M C W | | P1 |
| Live Orders | /orders | O M C W | badge: open orders | P1 |
| Ready to Serve (counter venues: Ready for Pickup) | /serve | O M C W | badge: ready | P1 |
| Kitchen | /kds | K O M | badge: new orders | P1 |
| Takeaway | /takeaway | O M C W | filter in Live Orders first | P1, own page P2 |
| Room Service | /room-service | O M W | H | P2 |
| Billing | /billing | O M C | badge: unpaid | P1 |
| Bills | /billing/bills | O M C | | P1 |
| Room Charges | /billing/room-charges | O M C | H | P2 |
| Shift Close | /billing/closeout | O M C | | P1 |
| Today's Availability | /menu/availability | O M C K | | NOW |
| Reservations | /reservations | O M (W view) | T | LATER |
| Events & Banquets | /events | O M | H | LATER |

### Menu
| Item | Route | Roles | Phase |
|---|---|---|---|
| Menu | /menu | O M edit; C W K view | NOW |
| Add-ons & Options | /menu/options | O M | P1 |
| Menu Import (Excel, CSV) | /menu/import | O M | P2 |
| Day-part & Outlet Prices | /menu/prices | O M | P2 |
| Offers & Coupons | /offers | O M | LATER |

### Reports (O M)
| Item | Route | Phase |
|---|---|---|
| Sales (day, week, month) | /reports/sales | P1 |
| Items & Categories | /reports/items | P1 |
| Payments by method | /reports/payments | P1 |
| Orders & Delays | /reports/orders | P2 |
| Exceptions (voids, discounts, free items, reprints) | /reports/exceptions | P2 |
| Staff & Waiters (fair, per working hour) | /reports/staff | P2 |
| Outlet Comparison | /reports/outlets | P2 |
| Taxes | /reports/taxes | ADVICE |
| Feedback | /reports/feedback | LATER |

### Inventory (I O M)
Stock, Recipes, Purchases, Suppliers, Wastage & Expiry, Low-stock Alerts. All P3.

### Customers (O M)
| Item | Phase |
|---|---|
| Guests (with consent) | P2 |
| Feedback & Ratings | LATER |
| Loyalty & Rewards | LATER |
| Corporate Accounts | ADVICE, LATER |

### Restaurant setup (O full; M view or own branch)
| Item | Route | Rule | Phase |
|---|---|---|---|
| Setup Guide | /onboarding | until complete, then under Help | NOW |
| Branches (hotels: Outlets) | /branches | | NOW |
| Areas & Sections (hotels: Floors & Outlets) | /venue/areas | | NOW |
| Tables | /venue/tables | T | NOW |
| Counters & Tokens | /venue/counters | N | NOW |
| Floor Plan | /venue/floor | T | NOW (read-only) |
| QR Codes | /qr | | NOW |
| Rooms | /venue/rooms | H | P2 |
| Customer Ordering | /settings/customer-ordering | | P2 |
| Documents & Reminders | /documents | | LATER |

### Team
| Item | Route | Roles | Phase |
|---|---|---|---|
| Staff | /staff | O M | NOW |
| Shifts & Attendance | /team/shifts | O M | P1 |
| Waiter Assignments | /team/assignments | O M | P1 |
| My Shift (check in, break, check out) | /my-shift | C W K | P1 |
| Activity Log | /activity | O M (own branch) | P1 |
| Roles Guide | /team/roles | O M | P2 |
| Leave Management | /team/leave | O M | LATER |

### Settings
| Item | Route | Roles | Phase |
|---|---|---|---|
| Branding & Business | /settings/branding | O edit, M view | NOW |
| Venue Switches | /settings/venue | O edit, M view | NOW |
| Approvals & Limits (who can void, discount, cancel, and the limits) | /settings/approvals | O | P1 |
| Sound & Alerts | /settings/sound | all staff | P1 |
| Printers & Devices | /settings/devices | O M | P1 |
| Taxes & Invoices | /settings/taxes | O | ADVICE |
| Online Payments | /settings/payments | O | P2 |
| Notifications & Daily Summary | /settings/notifications | O | P2 |
| Integrations | /settings/integrations | O | LATER |
| Your Plan & Billing | /settings/plan | O | NOW (view), P2 |

### Footer (always visible)
Restaurant and branch switcher, My Account, Help, Sign out, version number.

## Platform admin console (A only)
Platform admins see this group alone. They never see a restaurant's orders, bills, customers or payment settings.

| Item | Route | Phase |
|---|---|---|
| Platform Dashboard (customer counts, trials ending, plan mix) | /admin | P1 |
| Customers (list, filters by status, plan, business type) | /admin/tenants | P1 |
| New Customer (wizard, see below) | /admin/tenants/new | P1 |
| Customer detail (tabs: Overview, Business & Outlets, Owner, Plan & Usage, Notes, Activity) | /admin/tenants/:id | P1 |
| Plans (view) | /admin/plans | P1 view, P2 edit |
| Platform Activity Log | /admin/activity | P1 |
| Subscriptions & Renewals | /admin/subscriptions | P2 |
| Support Requests | /admin/support | P2 |
| Announcements | /admin/announcements | P2 |
| Business Types & Setup Templates | /admin/templates | P2 |
| System Health | /admin/health | P2 |
| Admin Users & Roles (super admin, sales, support, billing) | /admin/users | P2 |
| Data Requests (export, deletion) | /admin/requests | ADVICE, LATER |
| Global Settings | /admin/settings | LATER |

### New Customer wizard
1. Business: name, business type (Tea shop, Bakery, Cafe, Restaurant, Fine dining, Hotel, Food court), city, language.
2. Owner: name, phone, email.
3. Plan and trial: Starter, Professional, Business or Enterprise; trial days (default 14).
4. Outlets: number of outlets (hotels: outlet names).
5. Review: shows what will be created (restaurant, first branch, setup for the business type, trial subscription, owner login).
6. Done: temporary password shown ONCE with a copy button and a ready-to-send welcome note. The owner must change it at first sign-in.

Business type decides the starting setup: tea shop, bakery and food court start with counters and tokens and no tables; cafe, restaurant and fine dining start with tables; hotel starts with Floors & Outlets and room features switched on.

### Customer detail actions (all need a reason and are logged)
Suspend, reactivate, extend trial, change plan, reset owner password, add an internal note.

## Role homes and phone bottom bars
| Role | Opens on | Phone bottom bar |
|---|---|---|
| Owner, Manager | /dashboard | Home, Orders, Menu, Reports, More |
| Cashier | /billing | Billing, Orders, Availability, Bills, More |
| Waiter | /pos | Tables, Ready, Orders, More |
| Kitchen | /kds | Kitchen, Availability, More |
| Inventory manager | /dashboard (limited) | Stock, More |
| Platform admin | /admin | Home, Customers, More |

## Changes by venue type
| Venue | Changes |
|---|---|
| Tea shop, bakery, food court | Counter Orders and Counters & Tokens replace Tables, Floor Plan and Reservations. The word "table" never appears. |
| Cafe | Tables, simple flow, kitchen screen optional. |
| Restaurant, fine dining | Full table service, sections, waiter assignment, courses only if switched on. |
| Hotel | Floors & Outlets, Rooms, Room Service, Room Charges, Events & Banquets, outlet comparison. |

