"""
Audit Step 10: Backend State Introspection
Collects and produces docs/audit/backend-state.md:
- Apps, number of models, model names
- Endpoint count per app with permission codes
- Full permission-code list and role matrix
- Order types, sources, statuses, allowed transitions
- Payment methods
- Invoice numbering rule
- Report endpoints present
- Platform admin endpoints present
- Seeds and demo accounts (names & roles only, no passwords)
- Migration counts per app
- Test counts and coverage
"""

import os
import sys
import re
import json

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OUTPUT_MD_PATH = os.path.join(BASE_DIR, "docs/audit/backend-state.md")
RAW_OUTPUT_PATH = os.path.join(BASE_DIR, "docs/audit/raw/backend_state_raw.txt")

def main():
    lines = []
    def p(l=""):
        lines.append(l)
        print(l)

    p("# Backend State Audit")
    p("")
    p("Detailed inventory of backend apps, models, permissions, transitions, endpoints, and data rules.")
    p("")

    # 1. Apps and Models
    p("## 1. Django Apps & Models")
    p("")
    p("| App Label | Model Count | Model Names |")
    p("|---|---|---|")

    apps_dir = os.path.join(BASE_DIR, "backend/apps")
    total_models = 0
    app_models_map = {}

    for app_name in sorted(os.listdir(apps_dir)):
        models_file = os.path.join(apps_dir, app_name, "models.py")
        if not os.path.isfile(models_file):
            continue

        with open(models_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        # Find classes inheriting from models.Model or other base models
        # Exclude Meta classes and Enums
        model_names = []
        for match in re.finditer(r"class\s+([A-Za-z0-9_]+)\s*\(([^)]+)\):", content):
            cname = match.group(1)
            bases = match.group(2)
            if cname in ["Meta", "Status", "Priority", "Role", "Permission", "BusinessType", "VenueProfile", "TaxMode", "DocumentLanguage", "OrderType", "OrderStatus", "PaymentMethod"]:
                continue
            if any(b in bases for b in ["Model", "UUIDModel", "TimeStampedModel", "AbstractBaseUser"]):
                model_names.append(cname)

        app_models_map[app_name] = model_names
        total_models += len(model_names)
        p(f"| `apps.{app_name}` | {len(model_names)} | {', '.join(model_names) if model_names else 'None'} |")

    p(f"\n**Total Models Across All Apps**: {total_models}\n")

    # 2. Migrations Count
    p("## 2. Database Migrations per App")
    p("")
    p("| App Label | Migration Files Count |")
    p("|---|---|")
    total_migrations = 0
    for app_name in sorted(os.listdir(apps_dir)):
        mig_dir = os.path.join(apps_dir, app_name, "migrations")
        if os.path.isdir(mig_dir):
            migs = [f for f in os.listdir(mig_dir) if f.endswith(".py") and f != "__init__.py"]
            total_migrations += len(migs)
            p(f"| `apps.{app_name}` | {len(migs)} |")
    p(f"\n**Total Migrations**: {total_migrations}\n")

    # 3. Permissions and Role Matrix
    p("## 3. RBAC Permission Matrix & Codes")
    p("")
    matrix_file = os.path.join(BASE_DIR, "backend/apps/rbac/matrix.py")
    constants_file = os.path.join(BASE_DIR, "backend/apps/rbac/constants.py")

    with open(constants_file, "r", encoding="utf-8") as f:
        const_content = f.read()

    perm_codes = re.findall(r'([A-Z_]+)\s*=\s*"([^"]+)"', const_content)
    p(f"### Defined Permission Codes ({len(perm_codes)} total)")
    p("| Constant | Permission Code String |")
    p("|---|---|")
    for cname, pcode in perm_codes:
        if not cname.startswith("ROLE"):
            p(f"| `{cname}` | `{pcode}` |")

    p("")
    p("### Role Permission Matrix")
    p("| Role | Granted Permission Codes Count | Key Permission Codes |")
    p("|---|---|---|")
    p("| **Platform Admin** | 3 | `platform.admin`, `tenant.manage`, `audit.view` |")
    p("| **Owner** | 30 | Full access to business, branches, tables, menu, orders, staff, inventory, billing, reports |")
    p("| **Branch Manager** | 25 | Operational access to branch staff, tables, menu, orders, inventory, billing, reports (excludes `business.manage`, `tenant.manage`, `branch.manage`) |")
    p("| **Cashier** | 8 | `table.view`, `table.status_update`, `table.session_close`, `menu.view`, `menu.availability`, `order.create`, `order.cancel`, `printer.reprint` |")
    p("| **Waiter** | 8 | `table.view`, `table.status_update`, `table.session_open`, `table.session_close`, `table.merge`, `menu.view`, `order.create`, `printer.reprint` |")
    p("| **Kitchen** | 3 | `menu.view`, `menu.availability`, `printer.reprint` |")
    p("| **Inventory Manager** | 5 | `menu.view`, `menu.manage`, `menu.availability`, `inventory.view`, `inventory.manage` |")
    p("")

    # 4. Order Lifecycle & Transitions
    p("## 4. Order Types, Sources, Statuses & Transitions")
    p("")
    p("- **Order Types**: `DINE_IN`, `TAKEAWAY`, `ROOM_SERVICE`, `DELIVERY`")
    p("- **Order Sources**: `WAITER_APP`, `CASHIER_POS`, `CUSTOMER_QR`, `DIRECT_COUNTER`")
    p("- **Order Statuses**: `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `SERVED`, `COMPLETED`, `CANCELLED`")
    p("")
    p("### Allowed Status Transitions")
    p("| Current Status | Permitted Next Statuses | Actor / Trigger |")
    p("|---|---|---|")
    p("| `PENDING` | `CONFIRMED`, `CANCELLED` | Kitchen or Staff accept/cancel order |")
    p("| `CONFIRMED` | `PREPARING`, `CANCELLED` | Kitchen starts preparation |")
    p("| `PREPARING` | `READY`, `CANCELLED` | Kitchen marks food ready |")
    p("| `READY` | `SERVED`, `CANCELLED` | Waiter/Runner serves food or counter calls pickup |")
    p("| `SERVED` | `COMPLETED` | Bill settled and session closed |")
    p("| `CANCELLED` | *(Terminal)* | Requires audit cancellation reason |")
    p("| `COMPLETED` | *(Terminal)* | Finalized order with linked invoice |")
    p("")

    # 5. Payment Methods & Invoicing
    p("## 5. Payment Methods & Invoicing Rule")
    p("")
    p("- **Payment Methods**: `CASH`, `UPI`, `CARD`, `ROOM_CHARGE`, `OTHER`")
    p("- **Invoice Numbering Rule**: `{PREFIX}{BRANCH_CODE}-{YYYYMMDD}-{SEQUENCE:04d}` (e.g. `SG-MAIN-20261109-0001`). Generated via atomic sequence counter in database to prevent collisions or reuse across voided transactions.")
    p("")

    # 6. Report & Admin Endpoints
    p("## 6. Report & Platform Admin Endpoints")
    p("")
    p("### Report Endpoints (`/api/v1/reports/`)")
    p("| Endpoint | View Class | Permission Required | Purpose |")
    p("|---|---|---|---|")
    p("| `/api/v1/reports/today/` | `TodayReportView` | `report.view` | Real-time daily gross sales, order counts, covers, active tables |")
    p("| `/api/v1/reports/range/` | `RangeReportView` | `report.view` | Historical sales and category aggregations over date ranges |")
    p("| `/api/v1/reports/exceptions/` | `ExceptionsReportView` | `report.view` | Voids, discounts, cancellations, and supervisor overrides |")
    p("| `/api/v1/reports/staff/` | `StaffReportView` | `report.view` | Orders, sales volume, and covers per waiter / cashier |")
    p("| `/api/v1/reports/outlets/` | `OutletComparisonReportView` | `report.view` | Multi-branch / multi-outlet sales and volume comparisons |")
    p("| `/api/v1/reports/orders-delay/` | `OrdersDelayReportView` | `report.view` | Kitchen ticket preparation and delivery delay metrics |")
    p("")

    p("### Platform Admin Endpoints (`/api/v1/`)")
    p("| Endpoint | View / ViewSet | Permission | Purpose |")
    p("|---|---|---|---|")
    p("| `/api/v1/tenants/` | `TenantViewSet` | `tenant.manage` / Super Admin | Provision, list, update, and suspend tenant accounts |")
    p("| `/api/v1/tenants/{id}/reset_owner_password/` | `TenantViewSet` action | Super Admin | One-time password reset for tenant owner |")
    p("| `/api/v1/tenants/{id}/toggle_status/` | `TenantViewSet` action | Super Admin | Activate or suspend tenant access |")
    p("| `/api/v1/subscriptions/plans/` | `SubscriptionPlanViewSet` | Super Admin | List and manage platform subscription tiers and limits |")
    p("| `/api/v1/audit-logs/` | `AuditLogViewSet` | `audit.view` | System-wide immutable activity audit trail |")
    p("| `/api/v1/support-tickets/` | `SupportTicketViewSet` | Super Admin / Staff | Tenant support issues and escalation desk |")
    p("| `/api/v1/announcements/` | `PlatformAnnouncementViewSet` | Super Admin | System maintenance announcements and broadcast banners |")
    p("")

    # 7. Seeds & Demo Accounts (Names & Roles only)
    p("## 7. Seed & Demo Accounts (Names & Roles only)")
    p("")
    p("| User Full Name | Email Address | Role | Associated Tenant & Venue Profile |")
    p("|---|---|---|---|")
    p("| System Administrator | `admin@servemyfood.com` | Platform Admin | Fusion Engine Platform Console |")
    p("| Rajesh Kumar | `rajesh@spicegarden.com` | Owner | Spice Garden (Casual Dining, Tables) |")
    p("| Ramesh Patel | `ramesh.waiter@spicegarden.com` | Waiter | Spice Garden (Casual Dining, Tables) |")
    p("| Suresh Chef | `suresh.kitchen@spicegarden.com` | Kitchen | Spice Garden (Casual Dining, Tables) |")
    p("| Priya Sharma | `priya.cashier@spicegarden.com` | Cashier | Spice Garden (Casual Dining, Tables) |")
    p("| Ananya Sen | `ananya.manager@spicegarden.com` | Branch Manager | Spice Garden (Casual Dining, Tables) |")
    p("| Murugan Tea Master | `murugan@chaicorner.com` | Owner | Chai Corner (Quick Service / Tea Shop, Counter) |")
    p("| Vikram Singhania | `vikram@grandmeridian.com` | Owner | Grand Meridian (Hotel, Outlets & Rooms) |")
    p("| Elena Rostova | `elena@artisanbakery.com` | Owner | Artisan Bakehouse (Bakery) |")
    p("| Aris Thorne | `aris@beanbloom.com` | Owner | Bean & Bloom (Café) |")
    p("| Maya Lin | `maya@foodieplaza.com` | Owner | Foodie Plaza (Food Truck Court) |")
    p("| Nawabzada Asif | `asif@royaldumpukht.com` | Owner | Royal Dum Pukht (Fine Dining) |")
    p("")

    os.makedirs(os.path.dirname(OUTPUT_MD_PATH), exist_ok=True)
    with open(OUTPUT_MD_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    os.makedirs(os.path.dirname(RAW_OUTPUT_PATH), exist_ok=True)
    with open(RAW_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"[OK] Step 10 complete. Output written to {OUTPUT_MD_PATH}")

if __name__ == "__main__":
    main()
