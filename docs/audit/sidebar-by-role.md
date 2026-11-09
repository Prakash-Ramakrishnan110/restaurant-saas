# Sidebar by Role & Venue Audit

Evaluation of actual visible sidebar items across roles and venue profiles,
compared against the single source of truth `docs/product/sidebar-map.md`.

## 1. Role Login Landing Pages & Phone Bottom Tab Bar

### Post-Login Home Route by Role
| Role | Configured Post-Login Destination | Sidebar Membership of Destination | Status |
|---|---|---|---|
| Owner | `/dashboard` | YES (in Daily work) | OK |
| Manager | `/dashboard` | YES (in Daily work) | OK |
| Cashier | `/dashboard` | NO (not in sidebar) | MISCONFIGURED: Waiter/Cashier redirected to `/dashboard` which is not their station |
| Waiter | `/dashboard` | NO (not in sidebar) | MISCONFIGURED: Waiter/Cashier redirected to `/dashboard` which is not their station |
| Kitchen | `/kds` | YES (in Kitchen Station) | OK |
| Platform Admin | `/admin` | YES (in Super Admin) | OK |

### Phone Bottom Tab Bar (AppShell.tsx)
| Tab Label | Destination | Condition / Role Filtering | Defect / Note |
|---|---|---|---|
| Home | /dashboard | Unconditional (`md:hidden`) | Rendered globally for all roles including Platform Admin and Kitchen |
| Tables / Counters | /pos | Unconditional (`md:hidden`) | Rendered globally for all roles including Platform Admin and Kitchen |
| KDS | /kds | Unconditional (`md:hidden`) | Rendered globally for all roles including Platform Admin and Kitchen |
| Billing | /billing | Unconditional (`md:hidden`) | Rendered globally for all roles including Platform Admin and Kitchen |
| More | Opens sidebar drawer | Unconditional (`md:hidden`) | Rendered globally for all roles including Platform Admin and Kitchen |

---

## 2. Actual Visible Sidebar Items by Role & Venue

### Venue: Spice Garden (Table Venue - type: `CASUAL_DINING`, profile: `CASUAL_DINING`, uses_tables: `True`)

#### Role: Owner (20 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Daily work | Dashboard | `/dashboard` | - |
| Daily work | Floor POS | `/pos` | - |
| Daily work | Live Orders | `/orders` | activeOrders |
| Daily work | Ready to Serve | `/serve` | readyOrders |
| Daily work | Kitchen KDS | `/kds` | - |
| Daily work | Cashier Billing | `/billing` | - |
| Daily work | Bills | `/billing/bills` | - |
| Daily work | Shift Close | `/billing/closeout` | - |
| Daily work | Menu | `/menu` | - |
| Daily work | Today's Availability | `/menu/availability` | - |
| Restaurant setup | Onboarding | `/onboarding` | - |
| Restaurant setup | Branches | `/branches` | - |
| Restaurant setup | Areas | `/venue/areas` | - |
| Restaurant setup | Tables | `/venue/tables` | - |
| Restaurant setup | Floor Plan | `/venue/floor` | - |
| Restaurant setup | QR Codes | `/qr` | - |
| Team | Staff | `/staff` | - |
| Settings | Branding | `/settings/branding` | - |
| Settings | Venue Settings | `/settings/venue` | - |
| Settings | Your Plan & Billing | `/settings/plan` | - |

#### Role: Manager (17 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Daily work | Dashboard | `/dashboard` | - |
| Daily work | Floor POS | `/pos` | - |
| Daily work | Live Orders | `/orders` | activeOrders |
| Daily work | Ready to Serve | `/serve` | readyOrders |
| Daily work | Kitchen KDS | `/kds` | - |
| Daily work | Cashier Billing | `/billing` | - |
| Daily work | Bills | `/billing/bills` | - |
| Daily work | Shift Close | `/billing/closeout` | - |
| Daily work | Menu | `/menu` | - |
| Daily work | Today's Availability | `/menu/availability` | - |
| Restaurant setup | Branches | `/branches` | - |
| Restaurant setup | Areas | `/venue/areas` | - |
| Restaurant setup | Tables | `/venue/tables` | - |
| Restaurant setup | Floor Plan | `/venue/floor` | - |
| Restaurant setup | QR Codes | `/qr` | - |
| Team | Staff | `/staff` | - |
| Settings | Venue Settings | `/settings/venue` | - |

#### Role: Cashier (6 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Billing & Register | Cashier Billing | `/billing` | - |
| Billing & Register | Bills | `/billing/bills` | - |
| Billing & Register | Shift Close | `/billing/closeout` | - |
| Billing & Register | Live Orders | `/orders` | activeOrders |
| Billing & Register | Today's Availability | `/menu/availability` | - |
| Billing & Register | Menu | `/menu` | - |

#### Role: Waiter (4 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Floor Service | Tables and Orders | `/pos` | - |
| Floor Service | Live Orders | `/orders` | activeOrders |
| Floor Service | Ready to Serve | `/serve` | readyOrders |
| Floor Service | Menu | `/menu` | - |

#### Role: Kitchen (3 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Kitchen Station | Kitchen KDS | `/kds` | activeOrders |
| Kitchen Station | Today's Availability | `/menu/availability` | - |
| Kitchen Station | Menu | `/menu` | - |

#### Role: Platform Admin (8 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Super Admin | Platform Dashboard | `/admin` | - |
| Super Admin | Tenants Directory | `/admin/tenants` | - |
| Super Admin | New Customer | `/admin/tenants/new` | - |
| Super Admin | Subscription Plans | `/admin/plans` | - |
| Super Admin | System Health | `/admin/health` | - |
| Super Admin | Audit & Activity | `/admin/activity` | - |
| Super Admin | Support Desk | `/admin/support` | - |
| Super Admin | Announcements | `/admin/announcements` | - |

### Venue: Chai Corner (Counter Venue - type: `TEA_SHOP`, profile: `QUICK_SERVICE`, uses_tables: `False`)

#### Role: Owner (19 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Daily work | Dashboard | `/dashboard` | - |
| Daily work | Counter Orders | `/pos` | - |
| Daily work | Live Orders | `/orders` | activeOrders |
| Daily work | Ready for Pickup | `/serve` | readyOrders |
| Daily work | Kitchen KDS | `/kds` | - |
| Daily work | Cashier Billing | `/billing` | - |
| Daily work | Bills | `/billing/bills` | - |
| Daily work | Shift Close | `/billing/closeout` | - |
| Daily work | Menu | `/menu` | - |
| Daily work | Today's Availability | `/menu/availability` | - |
| Restaurant setup | Onboarding | `/onboarding` | - |
| Restaurant setup | Branches | `/branches` | - |
| Restaurant setup | Areas | `/venue/areas` | - |
| Restaurant setup | Counters and Tokens | `/venue/counters` | - |
| Restaurant setup | QR Codes | `/qr` | - |
| Team | Staff | `/staff` | - |
| Settings | Branding | `/settings/branding` | - |
| Settings | Venue Settings | `/settings/venue` | - |
| Settings | Your Plan & Billing | `/settings/plan` | - |

#### Role: Manager (16 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Daily work | Dashboard | `/dashboard` | - |
| Daily work | Counter Orders | `/pos` | - |
| Daily work | Live Orders | `/orders` | activeOrders |
| Daily work | Ready for Pickup | `/serve` | readyOrders |
| Daily work | Kitchen KDS | `/kds` | - |
| Daily work | Cashier Billing | `/billing` | - |
| Daily work | Bills | `/billing/bills` | - |
| Daily work | Shift Close | `/billing/closeout` | - |
| Daily work | Menu | `/menu` | - |
| Daily work | Today's Availability | `/menu/availability` | - |
| Restaurant setup | Branches | `/branches` | - |
| Restaurant setup | Areas | `/venue/areas` | - |
| Restaurant setup | Counters and Tokens | `/venue/counters` | - |
| Restaurant setup | QR Codes | `/qr` | - |
| Team | Staff | `/staff` | - |
| Settings | Venue Settings | `/settings/venue` | - |

#### Role: Cashier (6 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Billing & Register | Cashier Billing | `/billing` | - |
| Billing & Register | Bills | `/billing/bills` | - |
| Billing & Register | Shift Close | `/billing/closeout` | - |
| Billing & Register | Live Orders | `/orders` | activeOrders |
| Billing & Register | Today's Availability | `/menu/availability` | - |
| Billing & Register | Menu | `/menu` | - |

#### Role: Waiter (4 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Floor Service | Counter Orders | `/pos` | - |
| Floor Service | Live Orders | `/orders` | activeOrders |
| Floor Service | Ready for Pickup | `/serve` | readyOrders |
| Floor Service | Menu | `/menu` | - |

#### Role: Kitchen (3 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Kitchen Station | Kitchen KDS | `/kds` | activeOrders |
| Kitchen Station | Today's Availability | `/menu/availability` | - |
| Kitchen Station | Menu | `/menu` | - |

### Venue: Grand Meridian (Hotel - type: `HOTEL`, profile: `HOTEL_RESTAURANT`, uses_tables: `True`)

#### Role: Owner (20 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Daily work | Dashboard | `/dashboard` | - |
| Daily work | Floor POS | `/pos` | - |
| Daily work | Live Orders | `/orders` | activeOrders |
| Daily work | Ready to Serve | `/serve` | readyOrders |
| Daily work | Kitchen KDS | `/kds` | - |
| Daily work | Cashier Billing | `/billing` | - |
| Daily work | Bills | `/billing/bills` | - |
| Daily work | Shift Close | `/billing/closeout` | - |
| Daily work | Menu | `/menu` | - |
| Daily work | Today's Availability | `/menu/availability` | - |
| Restaurant setup | Onboarding | `/onboarding` | - |
| Restaurant setup | Branches | `/branches` | - |
| Restaurant setup | Areas | `/venue/areas` | - |
| Restaurant setup | Tables | `/venue/tables` | - |
| Restaurant setup | Floor Plan | `/venue/floor` | - |
| Restaurant setup | QR Codes | `/qr` | - |
| Team | Staff | `/staff` | - |
| Settings | Branding | `/settings/branding` | - |
| Settings | Venue Settings | `/settings/venue` | - |
| Settings | Your Plan & Billing | `/settings/plan` | - |

#### Role: Manager (17 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Daily work | Dashboard | `/dashboard` | - |
| Daily work | Floor POS | `/pos` | - |
| Daily work | Live Orders | `/orders` | activeOrders |
| Daily work | Ready to Serve | `/serve` | readyOrders |
| Daily work | Kitchen KDS | `/kds` | - |
| Daily work | Cashier Billing | `/billing` | - |
| Daily work | Bills | `/billing/bills` | - |
| Daily work | Shift Close | `/billing/closeout` | - |
| Daily work | Menu | `/menu` | - |
| Daily work | Today's Availability | `/menu/availability` | - |
| Restaurant setup | Branches | `/branches` | - |
| Restaurant setup | Areas | `/venue/areas` | - |
| Restaurant setup | Tables | `/venue/tables` | - |
| Restaurant setup | Floor Plan | `/venue/floor` | - |
| Restaurant setup | QR Codes | `/qr` | - |
| Team | Staff | `/staff` | - |
| Settings | Venue Settings | `/settings/venue` | - |

#### Role: Cashier (6 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Billing & Register | Cashier Billing | `/billing` | - |
| Billing & Register | Bills | `/billing/bills` | - |
| Billing & Register | Shift Close | `/billing/closeout` | - |
| Billing & Register | Live Orders | `/orders` | activeOrders |
| Billing & Register | Today's Availability | `/menu/availability` | - |
| Billing & Register | Menu | `/menu` | - |

#### Role: Waiter (4 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Floor Service | Tables and Orders | `/pos` | - |
| Floor Service | Live Orders | `/orders` | activeOrders |
| Floor Service | Ready to Serve | `/serve` | readyOrders |
| Floor Service | Menu | `/menu` | - |

#### Role: Kitchen (3 visible items)
| Group | Label | Route | Badge |
|---|---|---|---|
| Kitchen Station | Kitchen KDS | `/kds` | activeOrders |
| Kitchen Station | Today's Availability | `/menu/availability` | - |
| Kitchen Station | Menu | `/menu` | - |

---

## 3. Discrepancies vs `docs/product/sidebar-map.md`

Summary of differences found between code implementation and `sidebar-map.md`:

| Role | Missing/Extra Route | Expected Label | Phase | Rule | Details |
|---|---|---|---|---|---|
| Cashier | `/my-shift` | My Shift (check in, break, check out) | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Cashier | `/pos` | Tables & Orders (counter venues: Counter Orders) | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Cashier | `/serve` | Ready to Serve (counter venues: Ready for Pickup) | P1 | badge: ready | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Cashier | `/takeaway` | Takeaway | P1, own page P2 | filter in Live Orders first | Specified in sidebar-map for phase P1, own page P2 but omitted in `navigation.ts` |
| Kitchen | `/my-shift` | My Shift (check in, break, check out) | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Manager | `/activity` | Activity Log | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Manager | `/menu/options` | Add-ons & Options | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Manager | `/reports/items` | Items & Categories | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Manager | `/reports/payments` | Payments by method | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Manager | `/reports/sales` | Sales (day, week, month) | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Manager | `/settings/branding` | Branding & Business | NOW | All | Specified in sidebar-map for phase NOW but omitted in `navigation.ts` |
| Manager | `/settings/devices` | Printers & Devices | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Manager | `/takeaway` | Takeaway | P1, own page P2 | filter in Live Orders first | Specified in sidebar-map for phase P1, own page P2 but omitted in `navigation.ts` |
| Manager | `/team/assignments` | Waiter Assignments | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Manager | `/team/shifts` | Shifts & Attendance | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Owner | `/activity` | Activity Log | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Owner | `/menu/options` | Add-ons & Options | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Owner | `/reports/items` | Items & Categories | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Owner | `/reports/payments` | Payments by method | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Owner | `/reports/sales` | Sales (day, week, month) | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Owner | `/settings/approvals` | Approvals & Limits (who can void, discount, cancel, and the limits) | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Owner | `/settings/devices` | Printers & Devices | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Owner | `/takeaway` | Takeaway | P1, own page P2 | filter in Live Orders first | Specified in sidebar-map for phase P1, own page P2 but omitted in `navigation.ts` |
| Owner | `/team/assignments` | Waiter Assignments | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Owner | `/team/shifts` | Shifts & Attendance | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Waiter | `/my-shift` | My Shift (check in, break, check out) | P1 | All | Specified in sidebar-map for phase P1 but omitted in `navigation.ts` |
| Waiter | `/takeaway` | Takeaway | P1, own page P2 | filter in Live Orders first | Specified in sidebar-map for phase P1, own page P2 but omitted in `navigation.ts` |

### Critical Behavioral Observations
1. **Waiters and Cashiers Home Page**: Redirected to `/dashboard` upon login, but `/dashboard` is neither in their sidebar nor is it an active operational view for them.
2. **Mobile Bottom Navigation**: Hardcoded unconditionally with 4 tabs (Home, Tables/Counters, KDS, Billing). Waiters see Billing/KDS even if they are not cashier/kitchen; Platform Admins see restaurant tables and billing tabs.
3. **Hotel Specific Routes**: Routes like `/room-service` and `/billing/room-charges` (Phase P2 for Hotel) are not yet present in `navigation.ts`.
4. **Counter Venue Quick-Service Switch**: Counter venues (`uses_tables=False`) correctly swap 'Tables' -> 'Counters and Tokens' (`/venue/counters`) and omit 'Floor Plan' (`/venue/floor`).