# ServeMyFood - Multi-Tenant Restaurant SaaS Platform

A production-grade, multi-tenant Restaurant Management SaaS platform built with Python 3.12, Django 5, PostgreSQL 16, Redis 7, Celery, React 18, Vite, TypeScript, and Tailwind CSS. Developed by **Fusion Engine Technology**.

---

## 6-Command Windows PowerShell Quickstart

```powershell
# 1. Copy environment configuration
Copy-Item .env.example .env

# 2. Build and launch services (PostgreSQL on loopback 5435, Redis, Backend, Celery Worker, Beat)
docker compose up -d --build

# 3. Apply database migrations
docker compose exec backend python manage.py migrate

# 4. Seed database with platform admin, subscription plans, and 5 diverse venue tenants
docker compose exec backend python manage.py seed

# 5. Install frontend dependencies
cd frontend; npm install; cd ..

# 6. Launch frontend development server
.\scripts\dev.ps1 web
```

Open [http://localhost:5173](http://localhost:5173) to access the ServeMyFood application.
Interactive OpenAPI 3.0 docs are live at [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/).

### Windows PowerShell Development CLI (`scripts/dev.ps1`)
```powershell
.\scripts\dev.ps1 help       # Show all commands
.\scripts\dev.ps1 up         # Launch Docker Compose stack
.\scripts\dev.ps1 migrate    # Apply backend migrations
.\scripts\dev.ps1 seed       # Seed demo venue tenants
.\scripts\dev.ps1 test       # Run backend pytest with >=90% coverage
.\scripts\dev.ps1 lint       # Run backend ruff + frontend ESLint
.\scripts\dev.ps1 typecheck  # Run mypy static type analysis
.\scripts\dev.ps1 web        # Start frontend dev server
.\scripts\dev.ps1 web-test   # Run Vitest unit & component test suite
.\scripts\dev.ps1 e2e        # Run Playwright E2E integration test suite
.\scripts\dev.ps1 gen-api    # Regenerate TypeScript types from backend OpenAPI
.\scripts\dev.ps1 health     # Query backend /health endpoint
```

---

## Architectural Highlights

### 1. Hardening & Security (Prompt 2 Part A)
- **Per-Request Tenant Suspension Check**: Every authenticated request evaluates `tenant.status == ACTIVE` and `is_tenant_allowed()`. Access tokens issued prior to suspension are rejected immediately with 403 `TENANT_SUSPENDED`.
- **Strict Isolation Guarantees**: Tenant A cannot read, list, update, or delete Tenant B staff (returns **404 Not Found**, never 403, preventing existence leaks). Non-platform users receive 403 on all `/api/v1/tenants/` endpoints.
- **Unscoped Access Guard (AST Scanner)**: An AST-based test (`test_unscoped_guard.py`) verifies that `.unscoped` manager access is strictly forbidden outside an approved allowlist (`tenants.services`, `audit.services`, `core.management.commands.seed`, `tenants.views`, migrations).
- **Refresh Cookie CSRF Protection**: Origin and Referer validation protects cookie-based refresh and logout endpoints against cross-origin attacks. SameSite (`Lax`), Secure, and CORS allowed origins are environment-driven.
- **Append-Only State Transition Auditing**: Tenant suspend/activate, table status transitions, table joins/splits, and QR code rotations write structured before/after state to `AuditLog`.

### 2. Multi-Format Venue Model (Prompt 2 Part B)
Accommodates Indian and global venue operational diversity without conditional branching (`if venue == "hotel"`):
- **Hierarchy**: `Tenant` -> `Branch` -> `ServiceArea` -> `Section` -> `DiningTable` / `TableGroup`.
- **Branch Capabilities & Presets**: 11 typed flags pre-configured from 7 venue presets (`QUICK_SERVICE`, `CAFE`, `CASUAL_DINING`, `FINE_DINING`, `HOTEL_RESTAURANT`, `FOOD_COURT`, `BAR_BREWERY`).
- **Table Session Order Anchoring**: All orders, kitchen tickets, and billing instances anchor to a `TableSession` lifecycle (`OPEN` -> `CLOSED`), ensuring seamless table transfers, bill merges, and auto-turnover.
- **Cryptographic QR Tokens**: Non-guessable URLs (`secrets.token_urlsafe(24)`), instant staff rotation, PNG/SVG rendering, and signed HMAC session proofs for public customers.
- **Atomic Token Counter**: Concurrency-safe daily sequential order tokens (`select_for_update()`) resetting at midnight in tenant timezone.
- **Plan Entitlements Enforcement**: Gates venue scale (`max_branches`, `max_service_areas`, `max_tables`, `floor_editor`, `table_merge`, `courses`) via `enforce_limit()` with 403 `ENTITLEMENT_LIMIT_REACHED`.

---

## Venue Presets Matrix

| Venue Profile | Representative Venues | Pay Timing | QR Ordering | QR Session Policy | Workflow | Table Mgmt | Sections | Daily Tokens |
|---|---|---|---|---|---|:---:|:---:|:---:|
| **QUICK_SERVICE** | Chai shops, Bakeries, Food trucks | PAY_FIRST | BROWSE_ONLY | AUTO_OPEN | COUNTER_TOKEN | ❌ | ❌ | ✅ |
| **CAFE** | Coffee shops, Dessert parlours | PAY_LATER | OPEN_TAB | AUTO_OPEN | TABLE_SEAT | ✅ | ❌ | ❌ |
| **CASUAL_DINING** | Biryani houses, Udupi diners | PAY_LATER | OPEN_TAB | STRICT_WAIT_APPROVAL | TABLE_SEAT | ✅ | ✅ | ❌ |
| **FINE_DINING** | Luxury heritage dining, Lounges | PAY_LATER | BROWSE_ONLY | STRICT_WAIT_APPROVAL | TABLE_SEAT | ✅ | ✅ | ❌ |
| **HOTEL_RESTAURANT** | Resorts, 24/7 all-day diners | PAY_LATER | OPEN_TAB | STRICT_WAIT_APPROVAL | TABLE_SEAT | ✅ | ✅ | ❌ |
| **FOOD_COURT** | Mall counters, Tech park cafeterias | PAY_FIRST | PAY_AT_TABLE | AUTO_OPEN | COUNTER_TOKEN | ❌ | ❌ | ✅ |
| **BAR_BREWERY** | Microbreweries, Taprooms | PAY_LATER | OPEN_TAB | AUTO_OPEN | TABLE_SEAT | ✅ | ✅ | ❌ |

---

## Seeded Demo Venues & Credentials

Run `python manage.py seed` or `make seed` to provision:

| Venue Name | Profile | Plan | Email | Password | Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Platform** | - | - | `admin@fusionengine.in` | `AdminPassword123!` | PLATFORM_ADMIN |
| **Chai Corner** | QUICK_SERVICE | Starter | `owner@chaicorner.in` | `Password123!` | OWNER |
| **Bean & Bloom** | CAFE | Professional | `owner@beanbloom.in` | `Password123!` | OWNER |
| **Spice Garden** | CASUAL_DINING | Business | `owner@spicegarden.com` | `Password123!` | OWNER |
| **Grand Meridian** | HOTEL_RESTAURANT | Enterprise | `owner@grandmeridian.in` | `Password123!` | OWNER |
| **Foodie Plaza** | FOOD_COURT | Business | `owner@foodieplaza.in` | `Password123!` | OWNER |

> [!NOTE]
> **Demo Quick-Fill Buttons (DEV-Only)**: The quick-fill account buttons on the `/login` screen are guarded by `import.meta.env.DEV`. They only render in local development environments and are automatically omitted from production builds.

---

## Menu Core & Outlets Availability (v0.6.0)

| View | Artifact | Description |
|---|---|---|
| **Menu Management** | `docs/screenshots/27-menu-management-desktop.png` | Categories list, FSSAI diet tags, plan quota usage, portion badges, Indian grouping prices in paise. |
| **Item Editor Side Sheet** | `docs/screenshots/28-menu-item-editor-desktop.png` | Bilingual naming, price in Rupees parsed to paise without float math, focal crop reticle, variants, option groups. |
| **Quick Add Dialog** | `docs/screenshots/29-menu-quick-add-desktop.png` | Bulk paste from Excel/TSV with live validation preview table and atomic creation. |
| **Today's Availability (Desktop)** | `docs/screenshots/30-menu-availability-desktop.png` | One-tap sold-out switch by outlet with instant undo toast. |
| **Today's Availability (Mobile)** | `docs/screenshots/31-menu-availability-mobile.png` | Touch-optimized availability toggles for fast counter & waiter operations. |

---

## Quality Gates & Verification

```bash
# 1. Run complete pytest test suite on PostgreSQL (91 tests, >= 90% coverage required)
pytest backend/apps --cov=backend/apps --cov-report=term-missing --cov-fail-under=90

# 2. Check migrations dry run
python backend/manage.py makemigrations --check --dry-run

# 3. Linting and formatting checks
ruff check backend
ruff format --check backend

# 4. Strict Static Type Checking
mypy backend/apps backend/config

# 5. Dependency security audit
pip-audit -r backend/requirements.txt
```
