"""
Audit Step 2: Route Inventory
Parses frontend/src/App.tsx router and all pages in frontend/src/pages/.
Correlates with navigation.ts, openapi calls, tests, and UX crawl metrics.
Produces:
- docs/audit/routes.csv (19 exact required columns)
- docs/audit/raw/routes_raw.txt
"""

import os
import sys
import re
import csv
import json

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
APP_TSX_PATH = os.path.join(BASE_DIR, "frontend/src/App.tsx")
NAV_TS_PATH = os.path.join(BASE_DIR, "frontend/src/app/navigation.ts")
PAGES_DIR = os.path.join(BASE_DIR, "frontend/src/pages")
TESTS_DIR = os.path.join(BASE_DIR, "frontend/src/tests")
E2E_DIR = os.path.join(BASE_DIR, "frontend/e2e")
CRAWL_JSON_PATH = os.path.join(BASE_DIR, "docs/audit/raw/crawl_raw.json")
OUTPUT_CSV_PATH = os.path.join(BASE_DIR, "docs/audit/routes.csv")
RAW_OUTPUT_PATH = os.path.join(BASE_DIR, "docs/audit/raw/routes_raw.txt")

def parse_app_routes():
    with open(APP_TSX_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Extract component imports
    # e.g.: import { FloorPOSPage } from "./pages/orders/FloorPOSPage";
    # or import { LoginPage } from "./pages/auth/LoginPage";
    import_map = {}
    for m in re.finditer(r'import\s+\{([^}]+)\}\s+from\s+["\']([^"\']+)["\']', content):
        names = [n.strip() for n in m.group(1).split(",")]
        imp_path = m.group(2)
        for name in names:
            import_map[name] = imp_path

    # Parse Route definitions
    routes = []
    # Match each <Route path="..." element={...} />
    route_matches = re.finditer(r'<Route\s+path=["\']([^"\']+)["\']\s+element=\{([\s\S]*?)\}\s*/>', content)
    
    for rm in route_matches:
        path_str = rm.group(1)
        element_str = rm.group(2)

        guard_roles = "PUBLIC"
        if "requirePlatformAdmin" in element_str:
            guard_roles = "PLATFORM_ADMIN"
        elif "<ProtectedRoute" in element_str:
            guard_roles = "AUTHENTICATED"

        # Find components in element_str excluding wrapper / control components
        comps = re.findall(r'<([A-Z][A-Za-z0-9_]+)', element_str)
        inner_comps = [c for c in comps if c not in ["ProtectedRoute", "Navigate"]]
        comp_name = inner_comps[0] if inner_comps else "UNKNOWN"

        routes.append({
            "route": path_str,
            "component": comp_name,
            "guard_roles": guard_roles,
            "import_path": import_map.get(comp_name, "")
        })

    return routes

def get_sidebar_routes():
    with open(NAV_TS_PATH, "r", encoding="utf-8") as f:
        nav_content = f.read()
    # Find all path: "/..."
    paths = set(re.findall(r'path:\s*["\'](/[^"\']*)["\']', nav_content))
    return paths

def main():
    routes = parse_app_routes()
    sidebar_paths = get_sidebar_routes()

    # Also list all page files in frontend/src/pages
    all_page_files = []
    for root, _, files in os.walk(PAGES_DIR):
        for f in files:
            if f.endswith(".tsx"):
                full_path = os.path.normpath(os.path.join(root, f))
                rel_path = os.path.relpath(full_path, BASE_DIR).replace("\\", "/")
                all_page_files.append((rel_path, f.replace(".tsx", "")))

    # Load crawl results if present
    crawl_data = {}
    if os.path.exists(CRAWL_JSON_PATH):
        try:
            with open(CRAWL_JSON_PATH, "r", encoding="utf-8") as cf:
                c_list = json.load(cf)
                for item in c_list:
                    p = item.get("requestedPath")
                    if p not in crawl_data:
                        crawl_data[p] = item
        except Exception:
            pass

    # Find test files
    unit_test_files = [f for f in os.listdir(TESTS_DIR) if f.endswith((".ts", ".tsx"))] if os.path.exists(TESTS_DIR) else []
    e2e_test_files = [f for f in os.listdir(E2E_DIR) if f.endswith(".ts")] if os.path.exists(E2E_DIR) else []

    routed_comp_names = set()
    rows = []

    for r in routes:
        comp_name = r["component"]
        routed_comp_names.add(comp_name)

        # Find matching component file
        comp_file = "UNKNOWN"
        for pfile, base in all_page_files:
            if base == comp_name or base == comp_name.replace("Page", ""):
                comp_file = pfile
                break

        # Calculate LOC and inspect component file
        loc = 0
        endpoints_called = []
        data_source = "NONE"
        has_loading = "N"
        has_empty = "N"
        has_error = "N"
        en_ta_comp = "partial"

        if comp_file != "UNKNOWN" and os.path.exists(os.path.join(BASE_DIR, comp_file)):
            with open(os.path.join(BASE_DIR, comp_file), "r", encoding="utf-8", errors="ignore") as pf:
                p_lines = pf.readlines()
            loc = len(p_lines)
            p_text = "".join(p_lines)

            # API calls
            for ep_m in re.finditer(r'apiClient\.(get|post|patch|delete|put)(?:<[^>]+>)?\s*\(\s*([`\'"][^`\'"]+[`\'"])', p_text):
                endpoints_called.append(f"{ep_m.group(1).upper()} {ep_m.group(2).strip('`\'\"').split('?')[0]}")
            # Dedup endpoints
            endpoints_called = sorted(list(set(endpoints_called)))

            # Data source
            if endpoints_called:
                data_source = "API"
            elif "useState" in p_text and ("mock" in p_text.lower() or "dummy" in p_text.lower() or "SAMPLE_" in p_text):
                data_source = "MOCK"
            elif "useState" in p_text or "useReducer" in p_text:
                data_source = "LOCAL"
            else:
                data_source = "NONE"

            # States
            if re.search(r"\b(isLoading|loading|Skeleton|animate-pulse)\b", p_text):
                has_loading = "Y"
            if re.search(r"\b(empty|No items|No data|EmptyState|no-results)\b", p_text, re.IGNORECASE):
                has_empty = "Y"
            if re.search(r"\b(error|isError|errorMsg|setError|Alert)\b", p_text, re.IGNORECASE):
                has_error = "Y"

            # i18n
            has_t = "useTranslation" in p_text or "\bt(" in p_text
            has_ta_bilingual = "தமிழ்" in p_text or re.search(r"[\u0B80-\u0BFF]", p_text)
            if has_t and has_ta_bilingual:
                en_ta_comp = "Y"
            elif has_t or has_ta_bilingual:
                en_ta_comp = "partial"
            else:
                en_ta_comp = "N"

        # Sidebar membership
        in_sb = "Y" if r["route"] in sidebar_paths else "N"

        # Matching tests
        comp_slug = comp_name.replace("Page", "").lower()
        matched_unit = [tf for tf in unit_test_files if comp_slug in tf.lower()]
        matched_e2e = [ef for ef in e2e_test_files if comp_slug in ef.lower()]

        # UX crawl metrics
        crawl = crawl_data.get(r["route"], {})
        http_errors = crawl.get("httpErrorsSeen", "NONE")
        console_errors = crawl.get("consoleErrorsSeen", "NONE")
        axe_ser = crawl.get("axeSerious", 0)
        h_scroll = crawl.get("horizontalScroll", "N")

        # Status determination: exactly one of WORKING, PARTIAL, STUB, MOCK, DEAD, HIDDEN
        status = "WORKING"
        if data_source == "MOCK":
            status = "MOCK"
        elif loc < 50 or "Coming Soon" in (p_text if 'p_text' in locals() else ""):
            status = "STUB"
        elif in_sb == "N" and r["route"] not in ["/login", "/change-password", "/suspended", "/403", "/q/:token", "/dev/brand", "/dev/design-system", "/"]:
            status = "HIDDEN"
        elif has_loading == "N" or has_error == "N" or http_errors != "NONE" or console_errors != "NONE":
            status = "PARTIAL"
        else:
            status = "WORKING"

        notes = []
        if r["route"] in ["/orders/floor", "/pos"]:
            notes.append("Floor POS / Table selection interface")
        elif r["route"] in ["/kds", "/orders/kds"]:
            notes.append("Kitchen Display Bump Station")
        elif r["route"].startswith("/admin"):
            notes.append("Platform super admin module")
        if http_errors != "NONE":
            notes.append(f"HTTP errs: {http_errors}")
        if console_errors != "NONE":
            notes.append("Console errors observed")

        rows.append({
            "route": r["route"],
            "component_file": comp_file,
            "lines_of_code": loc,
            "guard_roles": r["guard_roles"],
            "in_sidebar": in_sb,
            "api_endpoints_called": "; ".join(endpoints_called) if endpoints_called else "NONE",
            "data_source": data_source,
            "has_loading": has_loading,
            "has_empty": has_empty,
            "has_error": has_error,
            "en_ta_complete": en_ta_comp,
            "unit_tests": "; ".join(matched_unit) if matched_unit else "NONE",
            "e2e_tests": "; ".join(matched_e2e) if matched_e2e else "NONE",
            "http_errors_seen": http_errors,
            "console_errors_seen": console_errors,
            "axe_serious": axe_ser,
            "horizontal_scroll": h_scroll,
            "status": status,
            "notes": "; ".join(notes) if notes else "Standard production route"
        })

    # Check for DEAD pages: files in pages/ that are NOT routed
    for pfile, base in all_page_files:
        if base not in routed_comp_names and not base.startswith("index") and not "Test" in base:
            with open(os.path.join(BASE_DIR, pfile), "r", encoding="utf-8", errors="ignore") as f:
                d_loc = len(f.readlines())
            rows.append({
                "route": "UNROUTED",
                "component_file": pfile,
                "lines_of_code": d_loc,
                "guard_roles": "NONE",
                "in_sidebar": "N",
                "api_endpoints_called": "NONE",
                "data_source": "NONE",
                "has_loading": "N",
                "has_empty": "N",
                "has_error": "N",
                "en_ta_complete": "N",
                "unit_tests": "NONE",
                "e2e_tests": "NONE",
                "http_errors_seen": "NONE",
                "console_errors_seen": "NONE",
                "axe_serious": 0,
                "horizontal_scroll": "N",
                "status": "DEAD",
                "notes": "Page file exists on disk but is not registered in App.tsx router"
            })

    # Sort rows by route
    rows.sort(key=lambda x: (0 if x["route"] != "UNROUTED" else 1, x["route"]))

    # Write CSV
    headers = [
        "route", "component_file", "lines_of_code", "guard_roles", "in_sidebar",
        "api_endpoints_called", "data_source", "has_loading", "has_empty",
        "has_error", "en_ta_complete", "unit_tests", "e2e_tests",
        "http_errors_seen", "console_errors_seen", "axe_serious",
        "horizontal_scroll", "status", "notes"
    ]

    os.makedirs(os.path.dirname(OUTPUT_CSV_PATH), exist_ok=True)
    with open(OUTPUT_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)

    # Write raw output
    raw_lines = [
        "=== ROUTE INVENTORY AUDIT RAW REPORT ===",
        f"Total routes parsed: {len(rows)}",
        f"WORKING: {len([r for r in rows if r['status'] == 'WORKING'])}",
        f"PARTIAL: {len([r for r in rows if r['status'] == 'PARTIAL'])}",
        f"STUB:    {len([r for r in rows if r['status'] == 'STUB'])}",
        f"MOCK:    {len([r for r in rows if r['status'] == 'MOCK'])}",
        f"DEAD:    {len([r for r in rows if r['status'] == 'DEAD'])}",
        f"HIDDEN:  {len([r for r in rows if r['status'] == 'HIDDEN'])}",
        "",
        "--- INVENTORY BREAKDOWN ---"
    ]
    for r in rows:
        raw_lines.append(f"{r['route']} | {r['component_file']} | LOC:{r['lines_of_code']} | Guard:{r['guard_roles']} | Status:{r['status']}")

    os.makedirs(os.path.dirname(RAW_OUTPUT_PATH), exist_ok=True)
    with open(RAW_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(raw_lines))

    print(f"[OK] Step 2 complete. CSV written to {OUTPUT_CSV_PATH}, raw to {RAW_OUTPUT_PATH}")

if __name__ == "__main__":
    main()
