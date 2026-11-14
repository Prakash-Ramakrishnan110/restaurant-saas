# ServeMyFood Audit Delta: Run 1 vs Run 2

**Generated**: November 12, 2026  
**Environment**: Real Docker PostgreSQL (5435), Redis (6379), Uvicorn/Django Backend (8000), Vite Frontend (5173).  
**Baseline (Run 1)**: `docs/audit/run1/`  
**Current State (Run 2)**: `docs/audit/run2/`  

---

## 1. Executive Summary

| Category | Run 1 Metric | Run 2 Metric | Net Delta |
|---|---|---|---|
| **Backend Pytest** | 533 passed, 3 failed (91.68%) | 534 passed, 2 failed (91.04%) | +1 passed, -1 failed (`apps/tenants/tests/test_business_profile.py` resolved) |
| **Backend Ruff Linter** | 2 errors (F821 `models`) | 0 errors (all checks passed) | **FIXED** (`BUG-006` resolved) |
| **Backend Mypy** | 4 errors across 2 files | 2 errors in 1 file | -2 errors (only `apps/venues/views.py:476` remains) |
| **Backend Makemigrations** | 0 pending | Pending migrations for `business_type`, `table_type`, `section_type` | **NEW GAP** (Model choice modifications without migration) |
| **Pip Audit** | 0 vulnerabilities | 0 vulnerabilities | Invariant maintained |
| **Frontend ESLint** | 0 errors, 0 warnings | 0 errors, 0 warnings | Invariant maintained |
| **Frontend Typecheck (tsc)** | 0 errors | 0 errors | Invariant maintained |
| **Frontend Vitest** | Fails (axe concurrency, timeouts) | Fails (axe concurrency, `text-amber-500` in DashboardPage, e2e spec matching) | 2 open issues |
| **Frontend Production Build** | Success (47s) | Success (47.54s) | Invariant maintained |
| **Frontend API Types Drift** | 0 drift | 0 drift | Invariant maintained |
| **Frontend NPM Audit** | 0 high/crit reported | 16 vulnerabilities (2 critical `tinypool`, 14 moderate `react-router`) | Accurately parsed (raw audit reflects npm report) |
| **Playwright E2E Run** | 130 passed, 14 failed | 122 passed, 22 failed | Regressions in mobile sidebar nav, table seating, menu add buttons |

---

## 2. Bugs Fixed (Run 1 -> Run 2)

### `BUG-006`: Ruff F821 Undefined Name `models` in `apps/tenants/views.py:1020`
- **Status**: **FIXED**
- **Evidence Path**: `docs/audit/run2/raw/backend-ruff.txt` ("All checks passed!").
- **Resolution**: `from django.db import models` properly imported; Q expressions resolved cleanly.

### `BUG-012`: `orders.map is not a function` Unhandled TypeError on `/billing`
- **Status**: **FIXED**
- **Evidence Path**: `docs/audit/run2/raw/crawl_raw.txt`, `frontend/src/pages/billing/BillingPage.tsx:112`.
- **Resolution**: Pagination unwrapping logic `res.data?.results || res.data || []` guards against paginated DRF payloads.

---

## 3. Bugs Still Open

### `BUG-001`: Guest Seating Fails on `/pos` (FloorPOSPage.tsx)
- **Status**: **OPEN**
- **Role**: Waiter, Cashier, Owner
- **Evidence Path**: `media_1794151898928_89aa2cf7.jpg`, `docs/audit/run2/raw/playwright-run.txt` (`Option 2: Live Floor POS Table Selection, Search, Cart & Order Dispatch` failed).
- **Root Cause**: Backend `TableSessionViewSet.create` calls `self.open(request)`, triggering mypy call error and breaking the expected write surface contract.

### `BUG-002`: Restaurant Logo Preview Broken in Branding Settings (`/settings/branding`)
- **Status**: **OPEN**
- **Role**: Owner
- **Evidence Path**: `media_1794153222280_3648ad4a.jpg`, `frontend/src/pages/settings/BrandingSettingsPage.tsx:210`.
- **Root Cause**: Logo URL resolution fails when logo is uploaded via API or stored as relative path without backend base URL prefix or file reader state fallback.

### `BUG-003`: Post-Login Redirection Lands Waiter & Cashier on `/dashboard`
- **Status**: **OPEN**
- **Role**: Waiter, Cashier
- **Evidence Path**: `frontend/src/pages/auth/LoginPage.tsx:214`, `frontend/src/app/navigation.ts:93-127`.
- **Root Cause**: `LoginPage.tsx` unconditionally redirects non-admin, non-kitchen users to `/dashboard`. Cashiers must land on `/billing`, Waiters on `/pos`.

### `BUG-004`: AppShell Mobile Bottom Navigation Unconditionally Renders Restaurant Tabs
- **Status**: **OPEN**
- **Role**: Platform Admin, Kitchen
- **Evidence Path**: `frontend/src/components/layout/AppShell.tsx:668-724`, `docs/audit/run2/raw/playwright-run.txt` (`Option 1: Dynamic Role-based Sidebar Navigation` failed).
- **Root Cause**: Mobile bottom bar does not filter by role or respect `docs/product/sidebar-map.md`.

### `BUG-005`: HTTP 404 on `/api/v1/announcements/`
- **Status**: **OPEN**
- **Role**: All Roles
- **Evidence Path**: `docs/audit/run2/raw/playwright-run.txt` (logged during E2E test runs).
- **Root Cause**: Frontend queries `/api/v1/announcements/` which is missing or unauthenticated.

### `BUG-007`: Mypy Type Error in `apps/venues/views.py:476`
- **Status**: **OPEN**
- **Role**: Developer / CI
- **Evidence Path**: `docs/audit/run2/raw/backend-mypy.txt:1-4`.
- **Root Cause**: `TableSessionViewSet.create` calls `self.open(request)`, failing typecheck because `open` is decorated with `@action`.

### `BUG-008`: POST `/api/v1/table-sessions/` Allows Direct Un-Audited Creation
- **Status**: **OPEN**
- **Role**: Waiter / API
- **Evidence Path**: `docs/audit/run2/raw/backend-pytest.txt:204-205` (`FAILED test_write_surface.py::test_removed_write_routes_return_405_or_404[post-/api/v1/table-sessions/]`, `FAILED test_sessions_can_only_be_created_through_open`).
- **Root Cause**: Defining `def create` on `TableSessionViewSet` overrides DRF default method restriction and allows direct POST instead of requiring `/api/v1/table-sessions/open/`.

### `BUG-009`: Concurrent Axe Runner Collisions in `a11y.test.tsx`
- **Status**: **OPEN**
- **Role**: Developer / CI
- **Evidence Path**: `docs/audit/run2/raw/frontend-vitest.txt:1195-1210`.
- **Root Cause**: Vitest runs test cases concurrently in `a11y.test.tsx`, violating `axe-core` requirement that only one instance of `axe.run()` can execute at a time.

### `BUG-010`: Floating Point Currency Math `.toFixed(2)` in `SuppliersPurchasesPage.tsx`
- **Status**: **OPEN**
- **Role**: Owner, Manager
- **Evidence Path**: `docs/audit/compliance-scan.txt:21-24`, `frontend/src/pages/inventory/SuppliersPurchasesPage.tsx:121`.
- **Root Cause**: Legacy code divides by 100 using floating-point math instead of integer paise formatting.

### `BUG-011`: Table Chair Preview Timeout in Vitest
- **Status**: **OPEN**
- **Role**: Owner, Manager
- **Evidence Path**: `docs/audit/run2/raw/frontend-vitest.txt:107-110`.
- **Root Cause**: DOM query for preset chair elements times out under heavy Vitest runner CPU load.

### `BUG-013`: Reference to `/dev/` Route in Production Bundle
- **Status**: **OPEN**
- **Role**: All Roles
- **Evidence Path**: `docs/audit/compliance-scan.txt:72-74`.
- **Root Cause**: Dev design system or dev routes are imported unconditionally in `App.tsx` or router tree.

### `BUG-014`: Hardcoded English Strings Bypassing i18n
- **Status**: **OPEN**
- **Role**: Tamil Speaking Staff / Owner
- **Evidence Path**: `docs/audit/i18n-gaps.txt`.
- **Root Cause**: Plain string literals present across newly added management and admin screens.

### `BUG-015`: Undocumented Endpoint `/api/v1/tenants/{id}/toggle_status/`
- **Status**: **OPEN**
- **Role**: Platform Admin
- **Evidence Path**: `docs/audit/raw/api_usage_raw.txt`.
- **Root Cause**: `TenantsDirectoryPage.tsx:90` calls custom action not reflected in OpenAPI schema.

---

## 4. New Bugs & Gaps Identified in Run 2

### `BUG-016`: [CRASH] Pending Django Migrations Detected in Gate 4
- **Status**: **NEW**
- **Severity**: Critical / Quality Gate Failure
- **Evidence Path**: `docs/audit/run2/raw/backend-makemigrations.txt`.
- **Description**: Model field alterations on `tenant.business_type`, `diningtable.table_type`, and `section.section_type` have not been committed as Django migrations, causing Gate 4 (`python manage.py makemigrations --check --dry-run`) to fail with exit code 1.

### `BUG-017`: [LAYOUT / DESIGN SYSTEM] Forbidden `#D97706` / `text-amber-500` Used in `DashboardPage.tsx`
- **Status**: **NEW**
- **Severity**: Compliance Failure / Vitest Failure
- **Evidence Path**: `docs/audit/run2/raw/frontend-vitest.txt:1215-1229` (`src/tests/contrast.test.tsx`).
- **Description**: `DashboardPage.tsx` introduced `text-amber-500`, violating the design token rule that amber must never be used as a text color in `frontend/src`.

### `BUG-018`: [SECURITY / ROUTING] Setup Wizard Stubbed at `/onboarding`
- **Status**: **NEW**
- **Severity**: High / Broken Core Flow
- **Evidence Path**: `frontend/src/pages/onboarding/OnboardingPage.tsx:1-8`, `frontend/src/App.tsx`.
- **Description**: Route `/onboarding` mounts an 8-line stub file `OnboardingPage.tsx` while the complete `OnboardingWizardPage.tsx` is left unrouted.

### `BUG-019`: [COMPLIANCE] NPM Audit High/Critical Vulnerabilities Detected
- **Status**: **NEW**
- **Severity**: Security Gate Failure
- **Evidence Path**: `docs/audit/run2/raw/frontend-npm-audit.txt`.
- **Description**: 2 critical vulnerabilities (`tinypool`) and 14 moderate vulnerabilities (`react-router`) are flagged by `npm audit --audit-level=high`.

---

## 5. Summary Table

| Category | Count | IDs / References |
|---|---|---|
| **Bugs Fixed** | 2 | `BUG-006`, `BUG-012` |
| **Bugs Open** | 12 | `BUG-001`, `BUG-002`, `BUG-003`, `BUG-004`, `BUG-005`, `BUG-007`, `BUG-008`, `BUG-009`, `BUG-010`, `BUG-011`, `BUG-013`, `BUG-014`, `BUG-015` |
| **New Bugs / Regressions** | 4 | `BUG-016` (Pending Migrations), `BUG-017` (Amber text violation), `BUG-018` (Onboarding Stub), `BUG-019` (NPM Audit) |

