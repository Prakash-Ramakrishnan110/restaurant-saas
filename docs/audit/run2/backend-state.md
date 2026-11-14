# Backend State Audit

Detailed inventory of backend apps, models, permissions, transitions, endpoints, and data rules.

## 1. Django Apps & Models

| App Label | Model Count | Model Names |
|---|---|---|
| `apps.accounts` | 2 | User, Membership |
| `apps.audit` | 1 | AuditLog |
| `apps.core` | 4 | UUIDModel, TimeStampedModel, TenantOwnedModel, BranchOwnedModel |
| `apps.inventory` | 8 | Supplier, Ingredient, Recipe, RecipeItem, PurchaseOrder, PurchaseOrderItem, WastageLog, StockTransaction |
| `apps.menu` | 7 | MenuCategory, MenuItem, ItemVariant, OptionGroup, Option, ItemOptionGroup, BranchItemAvailability |
| `apps.orders` | 7 | Order, OrderItem, OrderEvent, BillInvoice, CashierShiftCloseout, ServiceRequest, Customer |
| `apps.subscriptions` | 2 | Plan, Subscription |
| `apps.tenants` | 5 | Tenant, Branch, BusinessSettings, SupportTicket, PlatformAnnouncement |
| `apps.venues` | 9 | BranchCapabilities, ServiceArea, Section, TableGroup, DiningTable, StaffSectionAssignment, TableSession, QRCode, TokenCounter |

**Total Models Across All Apps**: 45

## 2. Database Migrations per App

| App Label | Migration Files Count |
|---|---|
| `apps.accounts` | 2 |
| `apps.audit` | 1 |
| `apps.inventory` | 1 |
| `apps.menu` | 1 |
| `apps.orders` | 4 |
| `apps.subscriptions` | 2 |
| `apps.tenants` | 6 |
| `apps.venues` | 8 |

**Total Migrations**: 25

## 3. RBAC Permission Matrix & Codes

### Defined Permission Codes (38 total)
| Constant | Permission Code String |
|---|---|
| `PLATFORM_ADMIN` | `PLATFORM_ADMIN` |
| `OWNER` | `OWNER` |
| `BRANCH_MANAGER` | `BRANCH_MANAGER` |
| `CASHIER` | `CASHIER` |
| `WAITER` | `WAITER` |
| `KITCHEN` | `KITCHEN` |
| `INVENTORY_MANAGER` | `INVENTORY_MANAGER` |
| `BUSINESS_VIEW` | `business.view` |
| `BUSINESS_MANAGE` | `business.manage` |
| `TENANT_MANAGE` | `tenant.manage` |
| `BRANCH_MANAGE` | `branch.manage` |
| `BRANCH_VIEW` | `branch.view` |
| `STAFF_MANAGE` | `staff.manage` |
| `STAFF_VIEW` | `staff.view` |
| `AREA_VIEW` | `area.view` |
| `AREA_MANAGE` | `area.manage` |
| `FLOOR_MANAGE` | `floor.manage` |
| `TABLE_VIEW` | `table.view` |
| `TABLE_MANAGE` | `table.manage` |
| `TABLE_STATUS_UPDATE` | `table.status_update` |
| `TABLE_MERGE` | `table.merge` |
| `TABLE_ASSIGN` | `table.assign` |
| `TABLE_SESSION_OPEN` | `table_session.open` |
| `TABLE_SESSION_CLOSE` | `table_session.close` |
| `QR_VIEW` | `qr.view` |
| `QR_MANAGE` | `qr.manage` |
| `MENU_VIEW` | `menu.view` |
| `MENU_MANAGE` | `menu.manage` |
| `MENU_AVAILABILITY` | `menu.availability` |
| `ORDER_CREATE` | `order.create` |
| `ORDER_CANCEL` | `order.cancel` |
| `INVOICE_REFUND` | `invoice.refund` |
| `REPORT_VIEW` | `report.view` |
| `PRINTER_REPRINT` | `printer.reprint` |
| `AUDIT_VIEW` | `audit.view` |
| `INVENTORY_VIEW` | `inventory.view` |
| `INVENTORY_MANAGE` | `inventory.manage` |
| `PLATFORM_ADMIN` | `platform.admin` |

### Role Permission Matrix
| Role | Granted Permission Codes Count | Key Permission Codes |
|---|---|---|
| **Platform Admin** | 3 | `platform.admin`, `tenant.manage`, `audit.view` |
| **Owner** | 30 | Full access to business, branches, tables, menu, orders, staff, inventory, billing, reports |
| **Branch Manager** | 25 | Operational access to branch staff, tables, menu, orders, inventory, billing, reports (excludes `business.manage`, `tenant.manage`, `branch.manage`) |
| **Cashier** | 8 | `table.view`, `table.status_update`, `table.session_close`, `menu.view`, `menu.availability`, `order.create`, `order.cancel`, `printer.reprint` |
| **Waiter** | 8 | `table.view`, `table.status_update`, `table.session_open`, `table.session_close`, `table.merge`, `menu.view`, `order.create`, `printer.reprint` |
| **Kitchen** | 3 | `menu.view`, `menu.availability`, `printer.reprint` |
| **Inventory Manager** | 5 | `menu.view`, `menu.manage`, `menu.availability`, `inventory.view`, `inventory.manage` |

## 4. Order Types, Sources, Statuses & Transitions

- **Order Types**: `DINE_IN`, `TAKEAWAY`, `ROOM_SERVICE`, `DELIVERY`
- **Order Sources**: `WAITER_APP`, `CASHIER_POS`, `CUSTOMER_QR`, `DIRECT_COUNTER`
- **Order Statuses**: `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `SERVED`, `COMPLETED`, `CANCELLED`

### Allowed Status Transitions
| Current Status | Permitted Next Statuses | Actor / Trigger |
|---|---|---|
| `PENDING` | `CONFIRMED`, `CANCELLED` | Kitchen or Staff accept/cancel order |
| `CONFIRMED` | `PREPARING`, `CANCELLED` | Kitchen starts preparation |
| `PREPARING` | `READY`, `CANCELLED` | Kitchen marks food ready |
| `READY` | `SERVED`, `CANCELLED` | Waiter/Runner serves food or counter calls pickup |
| `SERVED` | `COMPLETED` | Bill settled and session closed |
| `CANCELLED` | *(Terminal)* | Requires audit cancellation reason |
| `COMPLETED` | *(Terminal)* | Finalized order with linked invoice |

## 5. Payment Methods & Invoicing Rule

- **Payment Methods**: `CASH`, `UPI`, `CARD`, `ROOM_CHARGE`, `OTHER`
- **Invoice Numbering Rule**: `{PREFIX}{BRANCH_CODE}-{YYYYMMDD}-{SEQUENCE:04d}` (e.g. `SG-MAIN-20261109-0001`). Generated via atomic sequence counter in database to prevent collisions or reuse across voided transactions.

## 6. Report & Platform Admin Endpoints

### Report Endpoints (`/api/v1/reports/`)
| Endpoint | View Class | Permission Required | Purpose |
|---|---|---|---|
| `/api/v1/reports/today/` | `TodayReportView` | `report.view` | Real-time daily gross sales, order counts, covers, active tables |
| `/api/v1/reports/range/` | `RangeReportView` | `report.view` | Historical sales and category aggregations over date ranges |
| `/api/v1/reports/exceptions/` | `ExceptionsReportView` | `report.view` | Voids, discounts, cancellations, and supervisor overrides |
| `/api/v1/reports/staff/` | `StaffReportView` | `report.view` | Orders, sales volume, and covers per waiter / cashier |
| `/api/v1/reports/outlets/` | `OutletComparisonReportView` | `report.view` | Multi-branch / multi-outlet sales and volume comparisons |
| `/api/v1/reports/orders-delay/` | `OrdersDelayReportView` | `report.view` | Kitchen ticket preparation and delivery delay metrics |

### Platform Admin Endpoints (`/api/v1/`)
| Endpoint | View / ViewSet | Permission | Purpose |
|---|---|---|---|
| `/api/v1/tenants/` | `TenantViewSet` | `tenant.manage` / Super Admin | Provision, list, update, and suspend tenant accounts |
| `/api/v1/tenants/{id}/reset_owner_password/` | `TenantViewSet` action | Super Admin | One-time password reset for tenant owner |
| `/api/v1/tenants/{id}/toggle_status/` | `TenantViewSet` action | Super Admin | Activate or suspend tenant access |
| `/api/v1/subscriptions/plans/` | `SubscriptionPlanViewSet` | Super Admin | List and manage platform subscription tiers and limits |
| `/api/v1/audit-logs/` | `AuditLogViewSet` | `audit.view` | System-wide immutable activity audit trail |
| `/api/v1/support-tickets/` | `SupportTicketViewSet` | Super Admin / Staff | Tenant support issues and escalation desk |
| `/api/v1/announcements/` | `PlatformAnnouncementViewSet` | Super Admin | System maintenance announcements and broadcast banners |

## 7. Seed & Demo Accounts (Names & Roles only)

| User Full Name | Email Address | Role | Associated Tenant & Venue Profile |
|---|---|---|---|
| System Administrator | `admin@servemyfood.com` | Platform Admin | Fusion Engine Platform Console |
| Rajesh Kumar | `rajesh@spicegarden.com` | Owner | Spice Garden (Casual Dining, Tables) |
| Ramesh Patel | `ramesh.waiter@spicegarden.com` | Waiter | Spice Garden (Casual Dining, Tables) |
| Suresh Chef | `suresh.kitchen@spicegarden.com` | Kitchen | Spice Garden (Casual Dining, Tables) |
| Priya Sharma | `priya.cashier@spicegarden.com` | Cashier | Spice Garden (Casual Dining, Tables) |
| Ananya Sen | `ananya.manager@spicegarden.com` | Branch Manager | Spice Garden (Casual Dining, Tables) |
| Murugan Tea Master | `murugan@chaicorner.com` | Owner | Chai Corner (Quick Service / Tea Shop, Counter) |
| Vikram Singhania | `vikram@grandmeridian.com` | Owner | Grand Meridian (Hotel, Outlets & Rooms) |
| Elena Rostova | `elena@artisanbakery.com` | Owner | Artisan Bakehouse (Bakery) |
| Aris Thorne | `aris@beanbloom.com` | Owner | Bean & Bloom (Café) |
| Maya Lin | `maya@foodieplaza.com` | Owner | Foodie Plaza (Food Truck Court) |
| Nawabzada Asif | `asif@royaldumpukht.com` | Owner | Royal Dum Pukht (Fine Dining) |
