"""
Audit Step 7: Bugs Register
Assembles docs/audit/bugs.md with structured bug records:
id, page, role, steps, expected, actual, evidence file, severity (crash, wrong data, security, wording, layout).
"""

import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OUTPUT_MD_PATH = os.path.join(BASE_DIR, "docs/audit/bugs.md")
RAW_OUTPUT_PATH = os.path.join(BASE_DIR, "docs/audit/raw/bugs_raw.txt")

BUGS = [
    {
        "id": "BUG-001",
        "page": "/pos (FloorPOSPage.tsx)",
        "role": "Waiter / Cashier / Owner",
        "steps": "1. Navigate to Floor POS (/pos). 2. Select any free table (e.g., T9). 3. Click 'Seat Guests'.",
        "expected": "Table session opens successfully and table changes to occupied status with active order cart.",
        "actual": "Displays red error toast banner: 'Could not seat guests at this table.' API call fails.",
        "evidence_file": "media_1794151898928_89aa2cf7.jpg (User uploaded screenshot), frontend/e2e/orders-operations-flows.spec.ts:543",
        "severity": "crash"
    },
    {
        "id": "BUG-002",
        "page": "/settings/branding (BrandingSettingsPage.tsx)",
        "role": "Owner",
        "steps": "1. Log in as Rajesh Kumar (Owner). 2. Navigate to Settings > Branding. 3. Observe Restaurant Logo preview card and Live Customer QR Card preview.",
        "expected": "Uploaded PNG/WebP restaurant logo renders cleanly in the preview card and QR standee header.",
        "actual": "Broken image icon with alt text 'Restauran Logo' / 'Logo' rendered; logo fails to load in preview.",
        "evidence_file": "media_1794153222280_3648ad4a.jpg (User uploaded screenshot), frontend/src/pages/settings/BrandingSettingsPage.tsx:210",
        "severity": "layout"
    },
    {
        "id": "BUG-003",
        "page": "/login -> Post-login redirection",
        "role": "Waiter / Cashier",
        "steps": "1. Navigate to /login. 2. Log in with Waiter credentials (ramesh.waiter@spicegarden.com).",
        "expected": "Waiter redirected to Floor POS (/pos) or Floor Service station; Cashier redirected to Cashier Billing (/billing).",
        "actual": "Redirected to /dashboard. Waiter and Cashier do NOT have /dashboard in their sidebar and see an empty or partial view.",
        "evidence_file": "frontend/src/pages/auth/LoginPage.tsx:214, frontend/src/app/navigation.ts:93-127",
        "severity": "wrong data"
    },
    {
        "id": "BUG-004",
        "page": "Global AppShell Mobile Bottom Navigation",
        "role": "Platform Admin / Kitchen",
        "steps": "1. Log in as Platform Admin or Kitchen staff on mobile viewport (< 768px). 2. Observe fixed bottom tab bar.",
        "expected": "Mobile bottom navigation shows role-relevant destinations (or is hidden for platform console).",
        "actual": "Unconditionally renders restaurant operational tabs: 'Home', 'Tables/Counters', 'KDS', 'Billing' for Platform Admin and Kitchen.",
        "evidence_file": "frontend/src/components/layout/AppShell.tsx:668-724",
        "severity": "security"
    },
    {
        "id": "BUG-005",
        "page": "/api/v1/announcements/ (Backend ViewSet)",
        "role": "All roles",
        "steps": "1. Frontend AppShell attempts to query active platform announcements banner on load.",
        "expected": "HTTP 200 OK with list of published announcements or empty array.",
        "actual": "HTTP 404 Not Found logged in Playwright crawl: 'BAD RESPONSE: 404 http://localhost:5173/api/v1/announcements/'.",
        "evidence_file": "docs/audit/raw/playwright-run.txt (Test 17, 28 log output)",
        "severity": "wrong data"
    },
    {
        "id": "BUG-006",
        "page": "backend/apps/tenants/views.py:1020",
        "role": "Platform Admin / Backend",
        "steps": "1. Execute ruff linter or mypy typecheck on backend.",
        "expected": "Clean pass with 0 syntax or undefined variable errors.",
        "actual": "Ruff error F821: Undefined name 'models' at lines 1020 and 1021 ('models.Q(target_business_type=\"ALL\")').",
        "evidence_file": "docs/audit/raw/backend-ruff.txt, docs/audit/raw/backend-mypy.txt",
        "severity": "crash"
    },
    {
        "id": "BUG-007",
        "page": "backend/apps/venues/views.py:476",
        "role": "Staff / Backend",
        "steps": "1. Execute mypy typechecker on backend apps.",
        "expected": "TableSessionViewSet method calls adhere to typed signatures.",
        "actual": "Mypy type error: Missing positional argument 'request' in call to 'open' of TableSessionViewSet.",
        "evidence_file": "docs/audit/raw/backend-mypy.txt:29-31",
        "severity": "crash"
    },
    {
        "id": "BUG-008",
        "page": "/api/v1/table-sessions/ (Backend Write Surface)",
        "role": "Waiter / API",
        "steps": "1. Run backend pytest suite on venues app (test_write_surface.py).",
        "expected": "Removed direct POST on /api/v1/table-sessions/ returns HTTP 405 Method Not Allowed or 404 Not Found.",
        "actual": "Test assertion failure: endpoint returned unexpected status code allowing direct un-audited creation.",
        "evidence_file": "docs/audit/raw/backend-pytest.txt (FAILED test_removed_write_routes_return_405_or_404)",
        "severity": "security"
    },
    {
        "id": "BUG-009",
        "page": "frontend/src/tests/a11y.test.tsx (Automated A11y Suite)",
        "role": "Developer / CI",
        "steps": "1. Execute vitest suite concurrently across all test files.",
        "expected": "Axe accessibility runner evaluates pages sequentially without collision.",
        "actual": "Axe runtime crash: 'Axe is already running. Use await axe.run() to wait for previous run to finish'.",
        "evidence_file": "docs/audit/raw/frontend-vitest.txt:495-501",
        "severity": "crash"
    },
    {
        "id": "BUG-010",
        "page": "frontend/src/pages/inventory/SuppliersPurchasesPage.tsx:121",
        "role": "Owner / Manager",
        "steps": "1. Navigate to Inventory > Purchases. 2. Observe unit price conversion calculation.",
        "expected": "Currency amounts formatted using integer rupees and paise without floating-point conversion.",
        "actual": "Floating point calculation used: (cost_paise / 100).toFixed(2), risking precision errors on large purchase orders.",
        "evidence_file": "docs/audit/compliance-scan.txt:21-24, frontend/src/pages/inventory/SuppliersPurchasesPage.tsx:121",
        "severity": "wrong data"
    },
    {
        "id": "BUG-011",
        "page": "/venue/tables (Add Table Dialog Preset)",
        "role": "Owner / Manager",
        "steps": "1. Open Add Table modal. 2. Switch between 4-Seater and 6-Seater presets.",
        "expected": "Preview renders instantly within 200ms.",
        "actual": "Vitest test timed out after 5000ms waiting for preset chair preview elements to resolve.",
        "evidence_file": "docs/audit/raw/frontend-vitest.txt:107-110 (FAILED test_venue-chair-seating)",
        "severity": "layout"
    },
    {
        "id": "BUG-012",
        "page": "/billing (BillingPage.tsx) - orders.map crash regression guard",
        "role": "Cashier",
        "steps": "1. Cashier opens Billing screen when API returns paginated DRF response { count, results } instead of raw array.",
        "expected": "Defensive normalization: array check before calling .map() on order list.",
        "actual": "Uncaught TypeError: orders.map is not a function occurred prior to pagination unwrapping fix.",
        "evidence_file": "frontend/src/pages/billing/BillingPage.tsx:112, docs/audit/raw/api_usage_raw.txt",
        "severity": "crash"
    },
    {
        "id": "BUG-013",
        "page": "Production Build Bundle (frontend/dist)",
        "role": "All roles",
        "steps": "1. Compile frontend production bundle via npm run build. 2. Search dist assets for dev paths.",
        "expected": "Zero references to /dev/* routes or mock fixtures in production bundle.",
        "actual": "Found 1 reference to '/dev/' route in dist bundle asset index-BjFAKdjB.js.",
        "evidence_file": "docs/audit/compliance-scan.txt:72-74",
        "severity": "security"
    },
    {
        "id": "BUG-014",
        "page": "Global UI Components (Hardcoded English Strings)",
        "role": "Tamil Speaking Staff / Owner",
        "steps": "1. Toggle language to Tamil (தமிழ்). 2. Navigate through POS and Settings screens.",
        "expected": "All labels, dialog titles, placeholders, and action buttons render in authentic Tamil.",
        "actual": "800 hardcoded string literals found in TSX markup bypassing the i18next t() translation dictionary.",
        "evidence_file": "docs/audit/i18n-gaps.txt:18-68",
        "severity": "wording"
    },
    {
        "id": "BUG-015",
        "page": "/admin/tenants (TenantsDirectoryPage.tsx:90)",
        "role": "Platform Admin",
        "steps": "1. Platform admin toggles tenant active status in Tenants Directory.",
        "expected": "Calls documented OpenAPI endpoint.",
        "actual": "Calls undocumented endpoint /api/v1/tenants/{id}/toggle_status/ causing discrepancy with OpenAPI spec.",
        "evidence_file": "docs/audit/raw/api_usage_raw.txt (Unmatched UI calls)",
        "severity": "wrong data"
    }
]

def main():
    lines = []
    lines.append("# ServeMyFood Defect & Bug Register")
    lines.append("")
    lines.append("Authoritative register of bugs, crashes, regressions, and design discrepancies identified during the audit.")
    lines.append("")
    lines.append("| Bug ID | Target Page / Component | Affected Role | Severity | Summary of Defect | Evidence File / Source |")
    lines.append("|---|---|---|---|---|---|")

    for b in BUGS:
        lines.append(f"| **{b['id']}** | `{b['page']}` | {b['role']} | **{b['severity'].upper()}** | {b['actual']} | `{b['evidence_file']}` |")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## Detailed Defect Records")
    lines.append("")

    for b in BUGS:
        lines.append(f"### {b['id']}: {b['page']} ({b['severity'].upper()})")
        lines.append(f"- **Role**: {b['role']}")
        lines.append(f"- **Reproduction Steps**: {b['steps']}")
        lines.append(f"- **Expected Behavior**: {b['expected']}")
        lines.append(f"- **Actual Behavior**: {b['actual']}")
        lines.append(f"- **Evidence Path**: `{b['evidence_file']}`")
        lines.append(f"- **Severity Tier**: `{b['severity']}`")
        lines.append("")

    os.makedirs(os.path.dirname(OUTPUT_MD_PATH), exist_ok=True)
    with open(OUTPUT_MD_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    os.makedirs(os.path.dirname(RAW_OUTPUT_PATH), exist_ok=True)
    with open(RAW_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"[OK] Step 7 complete. Output written to {OUTPUT_MD_PATH}")

if __name__ == "__main__":
    main()
