# ServeMyFood Frontend & Stack State Audit
**Audit Date**: November 9, 2026 | **Environment**: Real Docker PostgreSQL/Redis/Uvicorn Backend + Vite Frontend

## 1. Role Operational Verdicts
| Role | Can do daily job today? | Key Reason & Evidence |
|---|---|---|
| **Owner** | **PARTLY** | Core POS, Menu, Inventory & Sales Reports work, but Branding logo preview is broken (`BUG-002`) and approvals are pending (`H-01`). |
| **Manager** | **PARTLY** | Daily oversight, staff & inventory management work; Waiter assignment & shift scheduling remain partial (`H-08`). |
| **Cashier** | **PARTLY** | Billing, bills history, and shift closeout function; landing on `/dashboard` upon login disrupts workstation workflow (`BUG-003`). |
| **Waiter** | **PARTLY** | Order taking & ready queue work; landing on `/dashboard` (`BUG-003`) and guest seating errors (`BUG-001`) impede floor service. |
| **Kitchen** | **YES** | Kitchen KDS station, live bump bar, timer alerts, and dish availability toggling operate flawlessly. |
| **Platform Admin** | **YES** | Multi-tenant customer wizard, directory, subscription plans, health, activity, and support desk are fully functional. |

## 2. Route Inventory Breakdown
**Total Registered Routes**: 71
- **WORKING**: 20 (real API, verified)
- **PARTIAL**: 12 (functional with minor layout/error handling gaps)
- **STUB**: 3 (placeholder screens)
- **MOCK**: 0 (uses static/mock fixture data)
- **DEAD**: 0 (page file exists but not routed in App.tsx)
- **HIDDEN**: 36 (routed but not in sidebar)

## 3. Quality Gates Status
**Overall Quality Gates Verdict**: **FAIL**

| Gate | Tool / Check | Status | Exit Code | Result Summary | Evidence |
|---|---|---|---|---|---|
| Backend Pytest with Coverage | $(@{Id=1; Name=Backend Pytest with Coverage; Command=pytest --cov=apps; RawFile=backend-pytest.txt; ExitCode=1; Duration=363.06s; Summary=}.Command) | FAIL | 1 |  | docs/audit/raw/backend-pytest.txt |
| Backend Ruff Linter | $(@{Id=2; Name=Backend Ruff Linter; Command=ruff check .; RawFile=backend-ruff.txt; ExitCode=0; Duration=0.63s; Summary=}.Command) | PASS | 0 | 0 errors, all checks passed | docs/audit/raw/backend-ruff.txt |
| Backend Mypy Typecheck | $(@{Id=3; Name=Backend Mypy Typecheck; Command=mypy .; RawFile=backend-mypy.txt; ExitCode=1; Duration=84.44s; Summary=}.Command) | FAIL | 1 | 2 mypy errors | docs/audit/raw/backend-mypy.txt |
| Backend Makemigrations Check | $(@{Id=4; Name=Backend Makemigrations Check; Command=python manage.py makemigrations --check --dry-run; RawFile=backend-makemigrations.txt; ExitCode=1; Duration=8.86s; Summary=}.Command) | FAIL | 1 | Migrations detected or error | docs/audit/raw/backend-makemigrations.txt |
| Backend Pip Audit | $(@{Id=5; Name=Backend Pip Audit; Command=pip-audit; RawFile=backend-pip-audit.txt; ExitCode=0; Duration=36.35s; Summary=}.Command) | PASS | 0 | 0 vulnerabilities found | docs/audit/raw/backend-pip-audit.txt |
| Frontend ESLint | $(@{Id=6; Name=Frontend ESLint; Command=npm run lint; RawFile=frontend-lint.txt; ExitCode=0; Duration=85.06s; Summary=}.Command) | PASS | 0 | 0 errors, 0 warnings | docs/audit/raw/frontend-lint.txt |
| Frontend Typecheck (tsc) | $(@{Id=7; Name=Frontend Typecheck (tsc); Command=npx tsc --noEmit; RawFile=frontend-typecheck.txt; ExitCode=0; Duration=22.42s; Summary=}.Command) | PASS | 0 | 0 TypeScript errors | docs/audit/raw/frontend-typecheck.txt |
| Frontend Vitest with Coverage | $(@{Id=8; Name=Frontend Vitest with Coverage; Command=npx vitest run --coverage; RawFile=frontend-vitest.txt; ExitCode=1; Duration=116.1s; Summary=}.Command) | FAIL | 1 | Tests 5 | docs/audit/raw/frontend-vitest.txt |
| Frontend Production Build | $(@{Id=9; Name=Frontend Production Build; Command=npm run build; RawFile=frontend-build.txt; ExitCode=0; Duration=127.18s; Summary=}.Command) | PASS | 0 | Build succeeded in 47.54s | docs/audit/raw/frontend-build.txt |
| Frontend API Types Drift | $(@{Id=10; Name=Frontend API Types Drift; Command=openapi-typescript diff; RawFile=frontend-api-types.txt; ExitCode=0; Duration=7.86s; Summary=}.Command) | PASS | 0 | In sync (0 drift against openapi.json) | docs/audit/raw/frontend-api-types.txt |
| Frontend NPM Audit (High/Critical) | $(@{Id=11; Name=Frontend NPM Audit (High/Critical); Command=npm audit --audit-level=high; RawFile=frontend-npm-audit.txt; ExitCode=1; Duration=68.89s; Summary=}.Command) | FAIL | 1 | 16 vulnerabilities | docs/audit/raw/frontend-npm-audit.txt |
| Playwright E2E Test List | $(@{Id=12; Name=Playwright E2E Test List; Command=npx playwright test --list; RawFile=playwright-list.txt; ExitCode=0; Duration=6.37s; Summary=}.Command) | PASS | 0 | 144 E2E tests listed | docs/audit/raw/playwright-list.txt |
| Playwright E2E Test Run | $(@{Id=13; Name=Playwright E2E Test Run; Command=npx playwright test; RawFile=playwright-run.txt; ExitCode=1; Duration=1482.25s; Summary=}.Command) | FAIL | 1 | 122 passed | docs/audit/raw/playwright-run.txt |

## 4. Top 15 Defects & Regressions
1. `BUG-001` [CRASH]: Guest seating fails on free tables on `/pos` with 'Could not seat guests at this table'.
2. `BUG-002` [LAYOUT]: Restaurant logo broken in Branding preview and live customer QR standee preview card.
3. `BUG-003` [WRONG DATA]: Waiter & Cashier redirected to `/dashboard` upon login rather than POS/Billing stations.
4. `BUG-004` [SECURITY]: Mobile bottom bar renders restaurant operational tabs unconditionally for Platform Admin and Kitchen.
5. `BUG-005` [WRONG DATA]: HTTP 404 logged on `/api/v1/announcements/` endpoint in production AppShell.
6. `BUG-006` [CRASH]: Ruff F821 undefined `models` in `apps/tenants/views.py:1020`.
7. `BUG-007` [CRASH]: Mypy missing argument `request` in `apps/venues/views.py:476` TableSessionViewSet.
8. `BUG-008` [SECURITY]: POST `/api/v1/table-sessions/` endpoint allows direct session creation bypass.
9. `BUG-009` [CRASH]: Concurrent axe runner execution collision in `a11y.test.tsx`.
10. `BUG-010` [WRONG DATA]: Floating-point `.toFixed(2)` currency conversion in `SuppliersPurchasesPage.tsx`.
11. `BUG-011` [LAYOUT]: Table presets dialog timed out in vitest waiting for 4/6-seater preview elements.
12. `BUG-012` [CRASH]: Previous `orders.map is not a function` unhandled exception when API returned paginated DRF payload.
13. `BUG-013` [SECURITY]: Production build bundle dist contains reference to `/dev/` route.
14. `BUG-014` [WORDING]: 800 hardcoded English string literals in TSX markup bypassing i18n translation dictionary.
15. `BUG-015` [WRONG DATA]: Tenants directory calls undocumented endpoint `/api/v1/tenants/{id}/toggle_status/`.

## 5. Top 15 Functional Gaps vs Product Specifications
1. `H-07` [LATER]: Banquets and events module not started.
2. `H-14` [LATER]: Guest feedback and review management not started.
3. `H-15` [ADVICE/LATER]: Corporate accounts and GST B2B billing postponed pending tax counsel.
4. `H-16` [ADVICE]: Dynamic service charge and outlet tax configuration postponed pending tax counsel.
5. `H-19` [ADVICE/LATER]: License and statutory expiry reminders not started.
6. `H-20` [ADVICE/LATER]: Bar tabs and excise compliance postponed pending state legal guidance.
7. `H-23` [LATER]: Swiggy / Zomato third-party order aggregations not integrated.
8. `H-25` [LATER]: Table reservations and advance waiting list not started.
9. `A-09` [ADVICE/LATER]: GDPR / DPDP customer data export and deletion workflows not started.
10. `A-10` [P2]: Sub-admin granular permission tiers (Sales, Support, Billing admins) not started.
11. `G-05` [P2]: Direct customer online UPI payment gateway integration not started.
12. `H-05` [P2]: Room charges PMS hotel integration pending.
13. `H-08` [P1]: Waiter assignments by floor section pending full automated balancing.
14. `H-22` [ADVICE]: Shift-based tip sharing and gratuity distribution postponed.
15. `R-05` [LATER]: Offline-first local SQLite cache and sync mode not started.

## 6. Codebase Compliance & Repository State
- **Tax Words**: 21 (all isolated to dormant `tax_mode` settings and GSTIN fields; 0 tax calculation leaks)
- **FSSAI**: 0 violations
- **Floating-Point Money**: 15 occurrences found (e.g. SuppliersPurchases, COGS margins)
- **TS/ESLint Escapes**: 9 `@ts-ignore` / `eslint-disable` occurrences
- **Storage Violations**: 0 (no passwords or access tokens stored in localStorage)
- **Dangerous HTML**: 0 `dangerouslySetInnerHTML` occurrences
- **Debt Counters**: `console.log` = 0, `TODO` = 0, `FIXME` = 0
- **Unpushed Commits**: 17 commits ahead of `origin/main` on branch `main`
- **Scope Creep**: 5 features identified (Fire mains flow, Split payment, Dual onboarding wizards, Room charge stubs, Premature support desk)