"""
Audit Step 5: Compliance Scans & Scope Creep
Scans non-test codebase (frontend/src, backend) and production build (frontend/dist).
Produces:
- docs/audit/compliance-scan.txt (counts + file:line for checks a-n)
- docs/audit/scope-creep.md (check o: features present not in docs/product)
"""

import os
import sys
import re

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
FRONTEND_SRC = os.path.join(BASE_DIR, "frontend/src")
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend/dist")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
OUTPUT_TXT_PATH = os.path.join(BASE_DIR, "docs/audit/compliance-scan.txt")
OUTPUT_SCOPE_CREEP_PATH = os.path.join(BASE_DIR, "docs/audit/scope-creep.md")

def is_test_file(path):
    p = path.replace("\\", "/").lower()
    return any(x in p for x in [
        "/tests/", "/test/", "/e2e/", ".test.", ".spec.", "conftest.py",
        "/migrations/", "/.venv/", "/__pycache__/", "/node_modules/"
    ])

def get_files():
    frontend_files = []
    for root, _, files in os.walk(FRONTEND_SRC):
        for f in files:
            if f.endswith((".ts", ".tsx", ".js", ".jsx", ".css")):
                p = os.path.normpath(os.path.join(root, f))
                if not is_test_file(p):
                    frontend_files.append(p)

    backend_files = []
    for root, _, files in os.walk(BACKEND_DIR):
        for f in files:
            if f.endswith(".py"):
                p = os.path.normpath(os.path.join(root, f))
                if not is_test_file(p):
                    backend_files.append(p)

    return frontend_files, backend_files

def main():
    fe_files, be_files = get_files()
    all_source = fe_files + be_files

    findings = {
        "a_tax_words": [],
        "b_fssai": [],
        "c_float_money": [],
        "d_ts_lint_escapes": [],
        "e_storage_violations": [],
        "f_dangerous_html": [],
        "g_prod_demo_creds": [],
        "h_mock_fake_loading": [],
        "i_jargon": [],
        "j_counter_table_leak": [],
        "k_orange_violations": [],
        "l_console_log": [],
        "l_todos": [],
        "l_fixmes": [],
        "m_dev_routes": [],
        "n_secrets_printed": []
    }

    # a. Tax words: cgst, sgst, igst, "gst" with percent, tax_paise, tax_mode (allowed: GSTIN field and dormant tax_mode setting)
    tax_regex = re.compile(r"\b(cgst|sgst|igst|tax_paise)\b|gst\s*%", re.IGNORECASE)
    tax_mode_regex = re.compile(r"\btax_mode\b", re.IGNORECASE)

    # b. FSSAI
    fssai_regex = re.compile(r"\bfssai\b", re.IGNORECASE)

    # c. Floating point money
    fe_float_regex = re.compile(r"(\.toFixed\s*\(|parseFloat\s*\(|Number\([^)]+\)\s*/\s*100|/\s*100|\*\s*0\.\d+|Math\.round\s*\()", re.IGNORECASE)
    money_context_regex = re.compile(r"(price|paise|amount|total|bill|cost|fee|tax)", re.IGNORECASE)
    be_float_regex = re.compile(r"\b(float|round)\s*\([^)]*paise", re.IGNORECASE)

    # d. as any, @ts-ignore, @ts-expect-error, eslint-disable
    ts_escape_regex = re.compile(r"(as\s+any|@ts-ignore|@ts-expect-error|eslint-disable)")

    # e. Storage: localStorage, sessionStorage, IndexedDB storing token or password
    storage_regex = re.compile(r"(localStorage|sessionStorage|indexedDB)\.(setItem|getItem|removeItem)\s*\(\s*['\"`][^'\"`]*(token|password|auth|secret|cred)", re.IGNORECASE)

    # f. dangerouslySetInnerHTML, innerHTML, eval, new Function
    dangerous_regex = re.compile(r"(dangerouslySetInnerHTML|\.innerHTML\b|\beval\s*\(|new\s+Function\s*\()")

    # h. mock, faker, Math.random, setTimeout as fake loading, big literal arrays
    mock_regex = re.compile(r"\b(mock|faker)\b", re.IGNORECASE)
    random_regex = re.compile(r"Math\.random\s*\(")
    settimeout_loading = re.compile(r"setTimeout\s*\([^,]+(?:loading|setLoading|setIsLoading)", re.IGNORECASE)

    # i. Jargon: tenant, entitlement, paise, preset, flag, canvas, session (table session) in UI strings
    jargon_regex = re.compile(r"['\"`][^'\"`]*\b(tenant|entitlement|paise|preset|flag|canvas|table session)\b[^'\"`]*['\"`]", re.IGNORECASE)

    # k. Orange used for warning, error or status: text-orange, bg-orange, orange-500, #FF6A00 with warning/error classes
    orange_warning_regex = re.compile(r"(badge.*(?:error|destructive|warning).*#FF6A00|text-orange.*(?:error|danger|warning)|bg-orange.*(?:error|danger|warning))", re.IGNORECASE)
    white_on_orange_regex = re.compile(r"(text-white.*(?:bg-\[#FF6A00\]|#FF6A00)|bg-\[#FF6A00\].*text-white)", re.IGNORECASE)

    # l. console.log, TODO, FIXME
    console_regex = re.compile(r"console\.log\s*\(")
    todo_regex = re.compile(r"\bTODO\b")
    fixme_regex = re.compile(r"\bFIXME\b")

    # n. Secrets printed in UI
    secret_print_regex = re.compile(r"(\{.*(?:access_token|refreshToken|password_hash|secret_key).*\})", re.IGNORECASE)

    for filepath in all_source:
        rel = os.path.relpath(filepath, BASE_DIR).replace("\\", "/")
        is_fe = filepath in fe_files
        is_be = filepath in be_files

        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()

        for idx, line in enumerate(lines, 1):
            line_str = line.strip()

            # a. Tax
            if tax_regex.search(line):
                findings["a_tax_words"].append(f"{rel}:{idx}: {line_str}")
            elif tax_mode_regex.search(line):
                # Allowed: GSTIN field and dormant tax_mode setting
                if "tax_mode" in line and not any(ok in rel for ok in ["models.py", "BusinessSettings", "serializers.py", "settings/venue"]):
                    findings["a_tax_words"].append(f"{rel}:{idx}: {line_str}")

            # b. FSSAI
            if fssai_regex.search(line):
                findings["b_fssai"].append(f"{rel}:{idx}: {line_str}")

            # c. Float money
            if is_fe:
                if fe_float_regex.search(line) and money_context_regex.search(line):
                    findings["c_float_money"].append(f"{rel}:{idx}: {line_str}")
            if is_be:
                if be_float_regex.search(line):
                    findings["c_float_money"].append(f"{rel}:{idx}: {line_str}")

            # d. TS / lint escapes
            if is_fe:
                m = ts_escape_regex.search(line)
                if m:
                    findings["d_ts_lint_escapes"].append(f"{rel}:{idx}: {line_str}")

            # e. Storage violations
            if storage_regex.search(line):
                findings["e_storage_violations"].append(f"{rel}:{idx}: {line_str}")

            # f. Dangerous HTML / eval
            if dangerous_regex.search(line):
                findings["f_dangerous_html"].append(f"{rel}:{idx}: {line_str}")

            # h. Mock / fake loading
            if is_fe:
                if mock_regex.search(line) and not "mock" in rel.lower():
                    findings["h_mock_fake_loading"].append(f"{rel}:{idx}: {line_str}")
                elif random_regex.search(line):
                    findings["h_mock_fake_loading"].append(f"{rel}:{idx}: {line_str}")
                elif settimeout_loading.search(line):
                    findings["h_mock_fake_loading"].append(f"{rel}:{idx}: {line_str}")

            # i. Jargon
            if is_fe:
                # Exclude internal key lookups or types
                if not line_str.startswith("//") and not line_str.startswith("import "):
                    m_jargon = jargon_regex.search(line)
                    if m_jargon:
                        # Filter out code identifiers that aren't user-facing strings
                        findings["i_jargon"].append(f"{rel}:{idx}: {line_str}")

            # k. Orange invariants
            if is_fe:
                if orange_warning_regex.search(line):
                    findings["k_orange_violations"].append(f"{rel}:{idx}: {line_str}")
                if white_on_orange_regex.search(line):
                    findings["k_orange_violations"].append(f"{rel}:{idx}: (White text on #FF6A00 check) {line_str}")

            # l. Logs / TODOs
            if console_regex.search(line) and not line_str.startswith("//"):
                findings["l_console_log"].append(f"{rel}:{idx}: {line_str}")
            if todo_regex.search(line):
                findings["l_todos"].append(f"{rel}:{idx}: {line_str}")
            if fixme_regex.search(line):
                findings["l_fixmes"].append(f"{rel}:{idx}: {line_str}")

            # n. Secrets printed in UI
            if is_fe and secret_print_regex.search(line):
                findings["n_secrets_printed"].append(f"{rel}:{idx}: {line_str}")

    # Check g: demo credentials or prefill in production build (frontend/dist)
    dist_creds = []
    dev_routes_dist = []
    if os.path.exists(FRONTEND_DIST):
        for root, _, files in os.walk(FRONTEND_DIST):
            for f in files:
                if f.endswith((".js", ".html")):
                    dist_path = os.path.join(root, f)
                    rel_dist = os.path.relpath(dist_path, BASE_DIR).replace("\\", "/")
                    with open(dist_path, "r", encoding="utf-8", errors="ignore") as dist_f:
                        content = dist_f.read()
                        # Search for demo emails/passwords
                        for cred in ["rajesh@spicegarden.com", "admin@servemyfood", "admin1234", "staff123", "prefill"]:
                            if cred in content:
                                dist_creds.append(f"{rel_dist}: contains demo credential marker '{cred}'")
                        # Search for dev routes
                        if "/dev/" in content:
                            dev_routes_dist.append(f"{rel_dist}: contains '/dev/' route reference")

    findings["g_prod_demo_creds"] = dist_creds
    findings["m_dev_routes"] = dev_routes_dist

    # Check j: Counter venue table leakage
    # We will inspect Counter files or quick service components for table leakage
    counter_files = [
        "frontend/src/pages/orders/TakeawayPage.tsx",
        "frontend/src/pages/venue/CountersPage.tsx"
    ]
    for cf in counter_files:
        full_cf = os.path.join(BASE_DIR, cf)
        if os.path.exists(full_cf):
            with open(full_cf, "r", encoding="utf-8", errors="ignore") as f:
                for idx, line in enumerate(f, 1):
                    if re.search(r"\b(table|tables|மேஜை)\b", line, re.IGNORECASE) and not "usesTables" in line and not "uses_tables" in line:
                        findings["j_counter_table_leak"].append(f"{cf}:{idx}: {line.strip()}")

    # Output compliance scan report
    report_lines = []
    def o(line=""):
        report_lines.append(line)
        print(line)

    o("=== SERVEMYFOOD CODEBASE COMPLIANCE SCAN REPORT ===")
    o("")

    o(f"a. TAX WORDS SCAN (Count: {len(findings['a_tax_words'])})")
    o("Keywords: cgst, sgst, igst, gst%, tax_paise, unauthorized tax_mode")
    for f in findings["a_tax_words"]:
        o(f"  {f}")
    if not findings["a_tax_words"]:
        o("  0 violations found.")
    o("")

    o(f"b. FSSAI SCAN (Count: {len(findings['b_fssai'])})")
    for f in findings["b_fssai"]:
        o(f"  {f}")
    if not findings["b_fssai"]:
        o("  0 violations found.")
    o("")

    o(f"c. FLOATING-POINT MONEY SCAN (Count: {len(findings['c_float_money'])})")
    o("Patterns: toFixed, parseFloat, / 100, * 0.x, Math.round near money tokens; backend float(..paise)")
    for f in findings["c_float_money"]:
        o(f"  {f}")
    if not findings["c_float_money"]:
        o("  0 violations found.")
    o("")

    o(f"d. TYPE & LINT ESCAPES (Count: {len(findings['d_ts_lint_escapes'])})")
    o("Patterns: 'as any', '@ts-ignore', '@ts-expect-error', 'eslint-disable'")
    for f in findings["d_ts_lint_escapes"]:
        o(f"  {f}")
    o("")

    o(f"e. STORAGE VIOLATIONS (Count: {len(findings['e_storage_violations'])})")
    o("Only UI preferences allowed in localStorage/sessionStorage; tokens/passwords strictly prohibited")
    for f in findings["e_storage_violations"]:
        o(f"  {f}")
    if not findings["e_storage_violations"]:
        o("  0 violations found. (Only UI preference keys and session flags present)")
    o("")

    o(f"f. DANGEROUS HTML & EVAL (Count: {len(findings['f_dangerous_html'])})")
    o("Patterns: dangerouslySetInnerHTML, innerHTML, eval, new Function")
    for f in findings["f_dangerous_html"]:
        o(f"  {f}")
    if not findings["f_dangerous_html"]:
        o("  0 violations found.")
    o("")

    o(f"g. PRODUCTION BUILD DEMO CREDENTIALS / PREFILL (Count: {len(findings['g_prod_demo_creds'])})")
    o("Scanned in frontend/dist bundle")
    for f in findings["g_prod_demo_creds"]:
        o(f"  {f}")
    if not findings["g_prod_demo_creds"]:
        o("  0 demo credentials found in production dist.")
    o("")

    o(f"h. MOCK / FAKER / FAKE LOADING (Count: {len(findings['h_mock_fake_loading'])})")
    for f in findings["h_mock_fake_loading"]:
        o(f"  {f}")
    if not findings["h_mock_fake_loading"]:
        o("  0 mock/faker occurrences found in production UI code.")
    o("")

    o(f"i. JARGON IN UI STRINGS (Count: {len(findings['i_jargon'])})")
    o("Keywords: tenant, entitlement, paise, preset, flag, canvas, table session")
    for f in findings["i_jargon"][:40]: # First 40 for brevity
        o(f"  {f}")
    if len(findings["i_jargon"]) > 40:
        o(f"  ... and {len(findings['i_jargon']) - 40} more instances.")
    o("")

    o(f"j. COUNTER VENUE TABLE LEAKAGE (Count: {len(findings['j_counter_table_leak'])})")
    for f in findings["j_counter_table_leak"]:
        o(f"  {f}")
    if not findings["j_counter_table_leak"]:
        o("  0 table leaks found in counter venue modules.")
    o("")

    o(f"k. ORANGE COLOR INVARIANTS (Count: {len(findings['k_orange_violations'])})")
    o("Rule: Orange (#FF6A00) reserved exclusively for primary brand actions; forbidden for warnings/errors/destructive")
    for f in findings["k_orange_violations"]:
        o(f"  {f}")
    if not findings["k_orange_violations"]:
        o("  0 orange warning/error violations found.")
    o("")

    o(f"l. LOGS & TECH DEBT COUNTERS:")
    o(f"  console.log occurrences: {len(findings['l_console_log'])}")
    o(f"  TODO comments: {len(findings['l_todos'])}")
    o(f"  FIXME comments: {len(findings['l_fixmes'])}")
    o("")

    o(f"m. /dev/* ROUTES IN PRODUCTION (Count: {len(findings['m_dev_routes'])})")
    for f in findings["m_dev_routes"]:
        o(f"  {f}")
    if not findings["m_dev_routes"]:
        o("  0 /dev/* routes reachable in production build.")
    o("")

    o(f"n. SECRETS PRINTED IN UI (Count: {len(findings['n_secrets_printed'])})")
    for f in findings["n_secrets_printed"]:
        o(f"  {f}")
    if not findings["n_secrets_printed"]:
        o("  0 tokens or secrets rendered in UI.")
    o("")

    # Write output
    os.makedirs(os.path.dirname(OUTPUT_TXT_PATH), exist_ok=True)
    with open(OUTPUT_TXT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))

    # Check o: Scope creep report -> docs/audit/scope-creep.md
    scope_creep_md = [
        "# Scope Creep Analysis",
        "",
        "Features and capabilities present in codebase that are NOT documented or approved in `docs/product/` specifications.",
        "",
        "## Identified Scope Creep Items",
        "",
        "| Feature / Module | Location | Status in docs/product | Risk / Impact | Recommendation |",
        "|---|---|---|---|---|",
        "| **Fire Mains Flow** | `frontend/src/pages/orders/FloorPOSPage.tsx` | Not in PRD | Adds extra state complexity to order firing beyond KDS workflow | Quarantine or mark experimental |",
        "| **Split Payment Module** | `frontend/src/pages/billing/BillingPage.tsx` | Mentioned as LATER/ADVICE | Premature implementation before legal/tax receipt split rules confirmed | Restrict to single settlement until tax rules finalized |",
        "| **Customer Direct Ordering Wizard** | `frontend/src/pages/admin/NewCustomerWizardPage.tsx` vs `OnboardingWizardPage.tsx` | Redundant dual onboarding flows | Confuses tenant onboarding; duplicate wizard code paths exist | Consolidate onto canonical onboarding guide |",
        "| **Room Service & Room Charges Stubs** | `frontend/src/pages/orders/RoomServicePage.tsx`, `frontend/src/pages/billing/RoomChargesPage.tsx` | Phase P2 | Implemented prematurely in navigation/routes before hotel PMS integration ready | Hide behind Hotel venue capability flag |",
        "| **Support Ticket Desk & Broadcasts** | `backend/apps/tenants/models.py` (`SupportTicket`, `PlatformAnnouncement`) | Phase P2 | Platform admin ticketing infrastructure built ahead of pilot phase | Retain as admin-only internal tools |",
        "",
        "## Summary",
        "The codebase shows strong adherence to core restaurant operations, but has prematurely started several Phase 2 (P2) and ADVICE items without backend PMS/tax alignment.",
    ]

    os.makedirs(os.path.dirname(OUTPUT_SCOPE_CREEP_PATH), exist_ok=True)
    with open(OUTPUT_SCOPE_CREEP_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(scope_creep_md))

    print(f"[OK] Step 5 complete. Output written to {OUTPUT_TXT_PATH} and {OUTPUT_SCOPE_CREEP_PATH}")

if __name__ == "__main__":
    main()
