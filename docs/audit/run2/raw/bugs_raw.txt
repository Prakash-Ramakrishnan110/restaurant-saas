# ServeMyFood Defect & Bug Register

Authoritative register of bugs, crashes, regressions, and design discrepancies identified during the audit.

| Bug ID | Target Page / Component | Affected Role | Severity | Summary of Defect | Evidence File / Source |
|---|---|---|---|---|---|
| **BUG-001** | `/pos (FloorPOSPage.tsx)` | Waiter / Cashier / Owner | **CRASH** | Displays red error toast banner: 'Could not seat guests at this table.' API call fails. | `media_1794151898928_89aa2cf7.jpg (User uploaded screenshot), frontend/e2e/orders-operations-flows.spec.ts:543` |
| **BUG-002** | `/settings/branding (BrandingSettingsPage.tsx)` | Owner | **LAYOUT** | Broken image icon with alt text 'Restauran Logo' / 'Logo' rendered; logo fails to load in preview. | `media_1794153222280_3648ad4a.jpg (User uploaded screenshot), frontend/src/pages/settings/BrandingSettingsPage.tsx:210` |
| **BUG-003** | `/login -> Post-login redirection` | Waiter / Cashier | **WRONG DATA** | Redirected to /dashboard. Waiter and Cashier do NOT have /dashboard in their sidebar and see an empty or partial view. | `frontend/src/pages/auth/LoginPage.tsx:214, frontend/src/app/navigation.ts:93-127` |
| **BUG-004** | `Global AppShell Mobile Bottom Navigation` | Platform Admin / Kitchen | **SECURITY** | Unconditionally renders restaurant operational tabs: 'Home', 'Tables/Counters', 'KDS', 'Billing' for Platform Admin and Kitchen. | `frontend/src/components/layout/AppShell.tsx:668-724` |
| **BUG-005** | `/api/v1/announcements/ (Backend ViewSet)` | All roles | **WRONG DATA** | HTTP 404 Not Found logged in Playwright crawl: 'BAD RESPONSE: 404 http://localhost:5173/api/v1/announcements/'. | `docs/audit/raw/playwright-run.txt (Test 17, 28 log output)` |
| **BUG-006** | `backend/apps/tenants/views.py:1020` | Platform Admin / Backend | **CRASH** | Ruff error F821: Undefined name 'models' at lines 1020 and 1021 ('models.Q(target_business_type="ALL")'). | `docs/audit/raw/backend-ruff.txt, docs/audit/raw/backend-mypy.txt` |
| **BUG-007** | `backend/apps/venues/views.py:476` | Staff / Backend | **CRASH** | Mypy type error: Missing positional argument 'request' in call to 'open' of TableSessionViewSet. | `docs/audit/raw/backend-mypy.txt:29-31` |
| **BUG-008** | `/api/v1/table-sessions/ (Backend Write Surface)` | Waiter / API | **SECURITY** | Test assertion failure: endpoint returned unexpected status code allowing direct un-audited creation. | `docs/audit/raw/backend-pytest.txt (FAILED test_removed_write_routes_return_405_or_404)` |
| **BUG-009** | `frontend/src/tests/a11y.test.tsx (Automated A11y Suite)` | Developer / CI | **CRASH** | Axe runtime crash: 'Axe is already running. Use await axe.run() to wait for previous run to finish'. | `docs/audit/raw/frontend-vitest.txt:495-501` |
| **BUG-010** | `frontend/src/pages/inventory/SuppliersPurchasesPage.tsx:121` | Owner / Manager | **WRONG DATA** | Floating point calculation used: (cost_paise / 100).toFixed(2), risking precision errors on large purchase orders. | `docs/audit/compliance-scan.txt:21-24, frontend/src/pages/inventory/SuppliersPurchasesPage.tsx:121` |
| **BUG-011** | `/venue/tables (Add Table Dialog Preset)` | Owner / Manager | **LAYOUT** | Vitest test timed out after 5000ms waiting for preset chair preview elements to resolve. | `docs/audit/raw/frontend-vitest.txt:107-110 (FAILED test_venue-chair-seating)` |
| **BUG-012** | `/billing (BillingPage.tsx) - orders.map crash regression guard` | Cashier | **CRASH** | Uncaught TypeError: orders.map is not a function occurred prior to pagination unwrapping fix. | `frontend/src/pages/billing/BillingPage.tsx:112, docs/audit/raw/api_usage_raw.txt` |
| **BUG-013** | `Production Build Bundle (frontend/dist)` | All roles | **SECURITY** | Found 1 reference to '/dev/' route in dist bundle asset index-BjFAKdjB.js. | `docs/audit/compliance-scan.txt:72-74` |
| **BUG-014** | `Global UI Components (Hardcoded English Strings)` | Tamil Speaking Staff / Owner | **WORDING** | 800 hardcoded string literals found in TSX markup bypassing the i18next t() translation dictionary. | `docs/audit/i18n-gaps.txt:18-68` |
| **BUG-015** | `/admin/tenants (TenantsDirectoryPage.tsx:90)` | Platform Admin | **WRONG DATA** | Calls undocumented endpoint /api/v1/tenants/{id}/toggle_status/ causing discrepancy with OpenAPI spec. | `docs/audit/raw/api_usage_raw.txt (Unmatched UI calls)` |

---

## Detailed Defect Records

### BUG-001: /pos (FloorPOSPage.tsx) (CRASH)
- **Role**: Waiter / Cashier / Owner
- **Reproduction Steps**: 1. Navigate to Floor POS (/pos). 2. Select any free table (e.g., T9). 3. Click 'Seat Guests'.
- **Expected Behavior**: Table session opens successfully and table changes to occupied status with active order cart.
- **Actual Behavior**: Displays red error toast banner: 'Could not seat guests at this table.' API call fails.
- **Evidence Path**: `media_1794151898928_89aa2cf7.jpg (User uploaded screenshot), frontend/e2e/orders-operations-flows.spec.ts:543`
- **Severity Tier**: `crash`

### BUG-002: /settings/branding (BrandingSettingsPage.tsx) (LAYOUT)
- **Role**: Owner
- **Reproduction Steps**: 1. Log in as Rajesh Kumar (Owner). 2. Navigate to Settings > Branding. 3. Observe Restaurant Logo preview card and Live Customer QR Card preview.
- **Expected Behavior**: Uploaded PNG/WebP restaurant logo renders cleanly in the preview card and QR standee header.
- **Actual Behavior**: Broken image icon with alt text 'Restauran Logo' / 'Logo' rendered; logo fails to load in preview.
- **Evidence Path**: `media_1794153222280_3648ad4a.jpg (User uploaded screenshot), frontend/src/pages/settings/BrandingSettingsPage.tsx:210`
- **Severity Tier**: `layout`

### BUG-003: /login -> Post-login redirection (WRONG DATA)
- **Role**: Waiter / Cashier
- **Reproduction Steps**: 1. Navigate to /login. 2. Log in with Waiter credentials (ramesh.waiter@spicegarden.com).
- **Expected Behavior**: Waiter redirected to Floor POS (/pos) or Floor Service station; Cashier redirected to Cashier Billing (/billing).
- **Actual Behavior**: Redirected to /dashboard. Waiter and Cashier do NOT have /dashboard in their sidebar and see an empty or partial view.
- **Evidence Path**: `frontend/src/pages/auth/LoginPage.tsx:214, frontend/src/app/navigation.ts:93-127`
- **Severity Tier**: `wrong data`

### BUG-004: Global AppShell Mobile Bottom Navigation (SECURITY)
- **Role**: Platform Admin / Kitchen
- **Reproduction Steps**: 1. Log in as Platform Admin or Kitchen staff on mobile viewport (< 768px). 2. Observe fixed bottom tab bar.
- **Expected Behavior**: Mobile bottom navigation shows role-relevant destinations (or is hidden for platform console).
- **Actual Behavior**: Unconditionally renders restaurant operational tabs: 'Home', 'Tables/Counters', 'KDS', 'Billing' for Platform Admin and Kitchen.
- **Evidence Path**: `frontend/src/components/layout/AppShell.tsx:668-724`
- **Severity Tier**: `security`

### BUG-005: /api/v1/announcements/ (Backend ViewSet) (WRONG DATA)
- **Role**: All roles
- **Reproduction Steps**: 1. Frontend AppShell attempts to query active platform announcements banner on load.
- **Expected Behavior**: HTTP 200 OK with list of published announcements or empty array.
- **Actual Behavior**: HTTP 404 Not Found logged in Playwright crawl: 'BAD RESPONSE: 404 http://localhost:5173/api/v1/announcements/'.
- **Evidence Path**: `docs/audit/raw/playwright-run.txt (Test 17, 28 log output)`
- **Severity Tier**: `wrong data`

### BUG-006: backend/apps/tenants/views.py:1020 (CRASH)
- **Role**: Platform Admin / Backend
- **Reproduction Steps**: 1. Execute ruff linter or mypy typecheck on backend.
- **Expected Behavior**: Clean pass with 0 syntax or undefined variable errors.
- **Actual Behavior**: Ruff error F821: Undefined name 'models' at lines 1020 and 1021 ('models.Q(target_business_type="ALL")').
- **Evidence Path**: `docs/audit/raw/backend-ruff.txt, docs/audit/raw/backend-mypy.txt`
- **Severity Tier**: `crash`

### BUG-007: backend/apps/venues/views.py:476 (CRASH)
- **Role**: Staff / Backend
- **Reproduction Steps**: 1. Execute mypy typechecker on backend apps.
- **Expected Behavior**: TableSessionViewSet method calls adhere to typed signatures.
- **Actual Behavior**: Mypy type error: Missing positional argument 'request' in call to 'open' of TableSessionViewSet.
- **Evidence Path**: `docs/audit/raw/backend-mypy.txt:29-31`
- **Severity Tier**: `crash`

### BUG-008: /api/v1/table-sessions/ (Backend Write Surface) (SECURITY)
- **Role**: Waiter / API
- **Reproduction Steps**: 1. Run backend pytest suite on venues app (test_write_surface.py).
- **Expected Behavior**: Removed direct POST on /api/v1/table-sessions/ returns HTTP 405 Method Not Allowed or 404 Not Found.
- **Actual Behavior**: Test assertion failure: endpoint returned unexpected status code allowing direct un-audited creation.
- **Evidence Path**: `docs/audit/raw/backend-pytest.txt (FAILED test_removed_write_routes_return_405_or_404)`
- **Severity Tier**: `security`

### BUG-009: frontend/src/tests/a11y.test.tsx (Automated A11y Suite) (CRASH)
- **Role**: Developer / CI
- **Reproduction Steps**: 1. Execute vitest suite concurrently across all test files.
- **Expected Behavior**: Axe accessibility runner evaluates pages sequentially without collision.
- **Actual Behavior**: Axe runtime crash: 'Axe is already running. Use await axe.run() to wait for previous run to finish'.
- **Evidence Path**: `docs/audit/raw/frontend-vitest.txt:495-501`
- **Severity Tier**: `crash`

### BUG-010: frontend/src/pages/inventory/SuppliersPurchasesPage.tsx:121 (WRONG DATA)
- **Role**: Owner / Manager
- **Reproduction Steps**: 1. Navigate to Inventory > Purchases. 2. Observe unit price conversion calculation.
- **Expected Behavior**: Currency amounts formatted using integer rupees and paise without floating-point conversion.
- **Actual Behavior**: Floating point calculation used: (cost_paise / 100).toFixed(2), risking precision errors on large purchase orders.
- **Evidence Path**: `docs/audit/compliance-scan.txt:21-24, frontend/src/pages/inventory/SuppliersPurchasesPage.tsx:121`
- **Severity Tier**: `wrong data`

### BUG-011: /venue/tables (Add Table Dialog Preset) (LAYOUT)
- **Role**: Owner / Manager
- **Reproduction Steps**: 1. Open Add Table modal. 2. Switch between 4-Seater and 6-Seater presets.
- **Expected Behavior**: Preview renders instantly within 200ms.
- **Actual Behavior**: Vitest test timed out after 5000ms waiting for preset chair preview elements to resolve.
- **Evidence Path**: `docs/audit/raw/frontend-vitest.txt:107-110 (FAILED test_venue-chair-seating)`
- **Severity Tier**: `layout`

### BUG-012: /billing (BillingPage.tsx) - orders.map crash regression guard (CRASH)
- **Role**: Cashier
- **Reproduction Steps**: 1. Cashier opens Billing screen when API returns paginated DRF response { count, results } instead of raw array.
- **Expected Behavior**: Defensive normalization: array check before calling .map() on order list.
- **Actual Behavior**: Uncaught TypeError: orders.map is not a function occurred prior to pagination unwrapping fix.
- **Evidence Path**: `frontend/src/pages/billing/BillingPage.tsx:112, docs/audit/raw/api_usage_raw.txt`
- **Severity Tier**: `crash`

### BUG-013: Production Build Bundle (frontend/dist) (SECURITY)
- **Role**: All roles
- **Reproduction Steps**: 1. Compile frontend production bundle via npm run build. 2. Search dist assets for dev paths.
- **Expected Behavior**: Zero references to /dev/* routes or mock fixtures in production bundle.
- **Actual Behavior**: Found 1 reference to '/dev/' route in dist bundle asset index-BjFAKdjB.js.
- **Evidence Path**: `docs/audit/compliance-scan.txt:72-74`
- **Severity Tier**: `security`

### BUG-014: Global UI Components (Hardcoded English Strings) (WORDING)
- **Role**: Tamil Speaking Staff / Owner
- **Reproduction Steps**: 1. Toggle language to Tamil (தமிழ்). 2. Navigate through POS and Settings screens.
- **Expected Behavior**: All labels, dialog titles, placeholders, and action buttons render in authentic Tamil.
- **Actual Behavior**: 800 hardcoded string literals found in TSX markup bypassing the i18next t() translation dictionary.
- **Evidence Path**: `docs/audit/i18n-gaps.txt:18-68`
- **Severity Tier**: `wording`

### BUG-015: /admin/tenants (TenantsDirectoryPage.tsx:90) (WRONG DATA)
- **Role**: Platform Admin
- **Reproduction Steps**: 1. Platform admin toggles tenant active status in Tenants Directory.
- **Expected Behavior**: Calls documented OpenAPI endpoint.
- **Actual Behavior**: Calls undocumented endpoint /api/v1/tenants/{id}/toggle_status/ causing discrepancy with OpenAPI spec.
- **Evidence Path**: `docs/audit/raw/api_usage_raw.txt (Unmatched UI calls)`
- **Severity Tier**: `wrong data`
