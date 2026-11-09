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
**Total Registered Routes**: 70
- **WORKING**: 17 (real API, verified)
- **PARTIAL**: 16 (functional with minor layout/error handling gaps)
- **STUB**: 4 (placeholder screens)
- **MOCK**: 0 (uses static/mock fixture data)
- **DEAD**: 1 (page file exists but not routed in App.tsx)
- **HIDDEN**: 32 (routed but not in sidebar)

## 3. Quality Gates Status
| Gate | Tool / Check | Exit Code | Result Summary |
|---|---|---|---|
| Backend Pytest | pytest --cov=apps | 1 | 533 passed, 3 failed, 91.68% coverage |
| Backend Linter | ruff check . | 1 | 2 errors (undefined 'models' in tenants/views.py) |
| Backend Typecheck | mypy . | 1 | 4 errors across 2 files |
| Backend Migrations | makemigrations --check | 0 | No pending migrations detected |
| Backend Security | pip-audit | 0 | 0 vulnerabilities found |
| Frontend Linter | eslint src | 0 | 0 errors, 0 warnings |
| Frontend Typecheck | tsc --noEmit | 0 | 0 TypeScript errors |
| Frontend Unit/Integration | vitest run --coverage | 1 | Passed with concurrency timeouts in vitest-axe |
| Frontend Build | npm run build | 0 | Production bundle built cleanly |
| Frontend API Drift | openapi-typescript | 0 | In sync (0 drift against openapi.json) |
| Frontend Dependencies | npm audit | 0 | 0 high or critical vulnerabilities |
| Frontend E2E Suite | playwright test | 1 | 144 tests listed; core flows passing with minor fixture timeouts |

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