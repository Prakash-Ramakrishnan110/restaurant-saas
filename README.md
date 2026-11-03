# Fusion Engine Restaurant SaaS - Foundation & Venue Model Backend

A production-grade, multi-tenant Restaurant Management SaaS backend built with Python 3.12, Django 5, Django REST Framework, PostgreSQL 16, Redis 7, Celery, Channels, SimpleJWT, and drf-spectacular.

---

## Quickstart (Under 5 Commands)

```bash
# 1. Copy environment variables
cp .env.example .env

# 2. Build and launch services (Postgres, Redis, Backend, Celery Worker, Celery Beat)
docker compose up -d --build

# 3. Apply database migrations
docker compose exec backend python manage.py migrate

# 4. Seed database with platform admin, 4 plans, and 5 diverse demo venue tenants
docker compose exec backend python manage.py seed

# 5. Verify system health
curl http://localhost:8000/health
```

The OpenAPI documentation is immediately available at [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/).

### Windows PowerShell Equivalent (`scripts/dev.ps1`)
For Windows environments without `make`, use the unified PowerShell CLI:
```powershell
.\scripts\dev.ps1 help       # Show all commands
.\scripts\dev.ps1 up         # Launch Docker Compose stack
.\scripts\dev.ps1 migrate    # Apply migrations
.\scripts\dev.ps1 seed       # Seed demo venue tenants
.\scripts\dev.ps1 test       # Run pytest with >=90% coverage
.\scripts\dev.ps1 lint       # Run ruff check and format check
.\scripts\dev.ps1 typecheck  # Run mypy
.\scripts\dev.ps1 health     # Query /health endpoint
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
