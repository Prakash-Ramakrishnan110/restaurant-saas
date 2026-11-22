"""Compare frontend routes, enums, permission codes, and API paths against openapi.json and deviations.md."""
import json
import os
import re

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OPENAPI_PATH = os.path.join(BASE_DIR, "docs/openapi.json")
OUT_PATH = os.path.join(BASE_DIR, "docs/audit/walk/raw/contracts_diff_raw.json")

with open(OPENAPI_PATH, encoding="utf-8") as f:
    spec = json.load(f)

openapi_paths = set(spec.get("paths", {}).keys())

# Collect all API calls in frontend/src
fe_api_calls = set()
fe_perms = set()
for root, _, files in os.walk(os.path.join(BASE_DIR, "frontend/src")):
    for fname in files:
        if not fname.endswith((".ts", ".tsx")) or "/tests/" in root.replace("\\", "/") or "\\tests\\" in root:
            continue
        fp = os.path.join(root, fname)
        with open(fp, encoding="utf-8", errors="ignore") as f:
            txt = f.read()
        for m in re.finditer(r'(?:apiClient|publicHttp)\.(?:get|post|patch|put|delete)(?:<[^>]+>)?\(\s*[`\'"]([^`\'"]+)[`\'"]', txt):
            p = m.group(1).split("?")[0]
            p_norm = "/api/v1" + re.sub(r"\$\{[^}]+\}", "{id}", p) if p.startswith("/") else p
            p_norm = p_norm.replace("{id}", "{id}")
            fe_api_calls.add((p_norm, fname))
        for m in re.finditer(r'(?:can|requiredPermission)\s*(?:=|\()\s*["\']([a-z0-9_.]+)["\']', txt):
            fe_perms.add((m.group(1), fname))

# Normalize OpenAPI parameterized segments to {id} for comparison
openapi_norm = set(re.sub(r"\{[^}]+\}", "{id}", p) for p in openapi_paths)

missing_in_openapi = []
for p, fname in sorted(fe_api_calls):
    if not p.startswith("/api/v1"):
        continue
    p_check = p if p.endswith("/") or p.endswith("{id}") else p + "/"
    if p not in openapi_norm and p_check not in openapi_norm:
        missing_in_openapi.append({"path": p, "file": fname})

# Extract backend permission constants
rbac_perms = set()
with open(os.path.join(BASE_DIR, "backend/apps/rbac/constants.py"), encoding="utf-8") as f:
    for m in re.finditer(r'=\s*"([a-z0-9_.]+)"', f.read()):
        rbac_perms.add(m.group(1))

# Extract sidebar routes vs StaffApp/App routes
with open(os.path.join(BASE_DIR, "frontend/src/app/navigation.ts"), encoding="utf-8") as f:
    nav_txt = f.read()
nav_routes = set(re.findall(r'path:\s*["\'](/[^"\']*)["\']', nav_txt))

with open(os.path.join(BASE_DIR, "docs/product/sidebar-map.md"), encoding="utf-8") as f:
    smap_txt = f.read()
smap_routes = set(re.findall(r'\|\s*(/[a-z0-9_/:.-]+)\s*\|', smap_txt))

out = {
    "fe_paths_not_in_openapi": missing_in_openapi,
    "fe_permissions_used": sorted(list(set(p for p, _ in fe_perms))),
    "fe_permissions_not_in_rbac_constants": sorted([p for p, _ in fe_perms if p not in rbac_perms]),
    "rbac_permissions_unused_in_fe": sorted([p for p in rbac_perms if p not in {x for x, _ in fe_perms}]),
    "sidebar_map_routes_missing_in_navigation_ts": sorted(list(smap_routes - nav_routes)),
    "navigation_ts_routes_missing_in_sidebar_map": sorted(list(nav_routes - smap_routes)),
}

with open(OUT_PATH, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2)

print("FE paths not in OpenAPI:", len(missing_in_openapi))
for x in missing_in_openapi:
    print("  MISSING API:", x)
print("FE perms not in RBAC:", out["fe_permissions_not_in_rbac_constants"])
print("Sidebar-map missing in nav.ts:", out["sidebar_map_routes_missing_in_navigation_ts"])
print("Nav.ts missing in sidebar-map:", out["navigation_ts_routes_missing_in_sidebar_map"])
