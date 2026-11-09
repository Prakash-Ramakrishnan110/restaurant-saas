"""
Audit Step 4: API Usage
Parses docs/openapi.json (YAML format) and scans frontend/src for API calls.
Outputs:
- docs/audit/api-usage.csv (endpoint, method, calling_pages, unused_by_ui)
- docs/audit/raw/api_usage_raw.txt (full detailed report including direct fetch/axios and unmapped calls)
"""

import os
import sys
import re
import csv
import yaml

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
OPENAPI_PATH = os.path.join(BASE_DIR, "docs/openapi.json")
FRONTEND_SRC = os.path.join(BASE_DIR, "frontend/src")
OUTPUT_CSV_PATH = os.path.join(BASE_DIR, "docs/audit/api-usage.csv")
RAW_OUTPUT_PATH = os.path.join(BASE_DIR, "docs/audit/raw/api_usage_raw.txt")

def normalize_path_pattern(path):
    # Convert /api/v1/users/{id}/ to regex pattern
    # Also handle trailing slash flexibility
    p = path.rstrip("/")
    # Replace {param} or :param with ([^/]+)
    pattern = re.sub(r"\{[^}]+\}", r"[^/]+", p)
    pattern = re.sub(r":[a-zA-Z_]+", r"[^/]+", pattern)
    return r"^" + pattern + r"/?$"

def main():
    print(f"Reading OpenAPI specification from {OPENAPI_PATH}...")
    with open(OPENAPI_PATH, "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)

    openapi_paths = spec.get("paths", {})
    print(f"Found {len(openapi_paths)} paths in OpenAPI spec.")

    # Flatten openapi endpoints: list of (method, path, summary)
    endpoints = []
    for path, methods in openapi_paths.items():
        for method, details in methods.items():
            if method.lower() in ["get", "post", "put", "patch", "delete", "options", "head"]:
                endpoints.append({
                    "method": method.upper(),
                    "path": path,
                    "summary": details.get("summary", ""),
                    "regex": re.compile(normalize_path_pattern(path))
                })

    print(f"Total OpenAPI operations: {len(endpoints)}")

    # Scan frontend/src
    direct_fetch = []
    direct_axios = []
    ui_api_calls = [] # {file, line, method, endpoint_raw, normalized}

    client_file = os.path.normpath(os.path.join(FRONTEND_SRC, "api/client.ts"))

    for root, _, files in os.walk(FRONTEND_SRC):
        for file in files:
            if not file.endswith((".ts", ".tsx")):
                continue
            filepath = os.path.normpath(os.path.join(root, file))
            relpath = os.path.relpath(filepath, BASE_DIR).replace("\\", "/")

            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()

            for idx, line in enumerate(lines, 1):
                # Check direct fetch
                if re.search(r"\bfetch\s*\(", line):
                    # Exclude comment lines
                    if not line.strip().startswith("//") and not line.strip().startswith("/*"):
                        direct_fetch.append({"file": relpath, "line": idx, "code": line.strip()})

                # Check direct axios outside client.ts
                if filepath != client_file and re.search(r"\baxios(\.|\s*\()", line):
                    if not line.strip().startswith("//") and not line.strip().startswith("/*") and not "from \"axios\"" in line and not "from 'axios'" in line:
                        direct_axios.append({"file": relpath, "line": idx, "code": line.strip()})

                # Check apiClient calls: apiClient.get, apiClient.post, apiClient.patch, apiClient.delete, apiClient.put
                # or calls in api/
                match = re.search(r"apiClient\.(get|post|patch|delete|put)(?:<[^>]+>)?\s*\(\s*([`'\"][^`'\"]+[`'\"])", line)
                if match:
                    method = match.group(1).upper()
                    raw_endpoint = match.group(2).strip("`'\"")
                    # Clean endpoint: strip query params, template strings
                    clean_ep = raw_endpoint.split("?")[0]
                    # In frontend, apiClient baseURL is /api/v1. If endpoint starts with "/", prepend /api/v1
                    if clean_ep.startswith("/api/v1"):
                        normalized = clean_ep
                    elif clean_ep.startswith("/"):
                        normalized = "/api/v1" + clean_ep
                    else:
                        normalized = "/api/v1/" + clean_ep

                    # Handle template literals like `/tables/${tableId}/` -> `/tables/xxx/`
                    normalized = re.sub(r"\$\{[^}]+\}", "placeholder", normalized)

                    ui_api_calls.append({
                        "file": relpath,
                        "line": idx,
                        "method": method,
                        "raw": raw_endpoint,
                        "normalized": normalized
                    })

                # Also capture template literals in backticks across lines or multi-part
                match_bt = re.search(r"apiClient\.(get|post|patch|delete|put)(?:<[^>]+>)?\s*\(\s*`([^`]+)`", line)
                if match_bt and not match:
                    method = match_bt.group(1).upper()
                    raw_endpoint = match_bt.group(2)
                    clean_ep = raw_endpoint.split("?")[0]
                    clean_ep = re.sub(r"\$\{[^}]+\}", "placeholder", clean_ep)
                    if clean_ep.startswith("/api/v1"):
                        normalized = clean_ep
                    elif clean_ep.startswith("/"):
                        normalized = "/api/v1" + clean_ep
                    else:
                        normalized = "/api/v1/" + clean_ep

                    ui_api_calls.append({
                        "file": relpath,
                        "line": idx,
                        "method": method,
                        "raw": raw_endpoint,
                        "normalized": normalized
                    })

    print(f"Total UI API call sites extracted: {len(ui_api_calls)}")
    print(f"Direct fetch violations found: {len(direct_fetch)}")
    print(f"Direct axios violations found: {len(direct_axios)}")

    # Match UI calls against OpenAPI endpoints
    endpoint_pages_map = { (ep["method"], ep["path"]): set() for ep in endpoints }
    unmatched_ui_calls = []

    for call in ui_api_calls:
        matched = False
        norm = call["normalized"]
        method = call["method"]

        for ep in endpoints:
            if ep["method"] == method and ep["regex"].match(norm):
                endpoint_pages_map[(ep["method"], ep["path"])].add(call["file"])
                matched = True
                break

        if not matched:
            # Try without strict method matching or check if path exists with another method
            unmatched_ui_calls.append(call)

    # Prepare CSV rows
    csv_rows = []
    unused_count = 0
    used_count = 0

    for ep in endpoints:
        key = (ep["method"], ep["path"])
        pages = sorted(list(endpoint_pages_map[key]))
        is_unused = len(pages) == 0
        if is_unused:
            unused_count += 1
        else:
            used_count += 1

        csv_rows.append({
            "endpoint": ep["path"],
            "method": ep["method"],
            "calling_pages": "; ".join(pages) if pages else "NONE",
            "unused_by_ui": "Y" if is_unused else "N"
        })

    # Sort CSV rows by endpoint, method
    csv_rows.sort(key=lambda x: (x["endpoint"], x["method"]))

    # Write CSV
    os.makedirs(os.path.dirname(OUTPUT_CSV_PATH), exist_ok=True)
    with open(OUTPUT_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["endpoint", "method", "calling_pages", "unused_by_ui"])
        writer.writeheader()
        writer.writerows(csv_rows)

    # Write raw report
    raw_lines = []
    def rprint(l=""):
        raw_lines.append(l)
        print(l)

    rprint("=== API USAGE AUDIT REPORT ===")
    rprint(f"Total OpenAPI endpoints defined: {len(endpoints)}")
    rprint(f"Endpoints used by frontend UI: {used_count}")
    rprint(f"Endpoints unused by frontend UI: {unused_count} ({(unused_count / len(endpoints) * 100):.1f}%)")
    rprint("")

    rprint(f"=== DIRECT FETCH CALLS IN FRONTEND ({len(direct_fetch)}) ===")
    if direct_fetch:
        for df in direct_fetch:
            rprint(f"{df['file']}:{df['line']} -> {df['code']}")
    else:
        rprint("None (0 direct fetch calls found)")
    rprint("")

    rprint(f"=== DIRECT AXIOS CALLS OUTSIDE client.ts ({len(direct_axios)}) ===")
    if direct_axios:
        for da in direct_axios:
            rprint(f"{da['file']}:{da['line']} -> {da['code']}")
    else:
        rprint("None (0 direct axios calls found)")
    rprint("")

    rprint(f"=== UNMATCHED UI CALLS (No matching OpenAPI endpoint) ({len(unmatched_ui_calls)}) ===")
    if unmatched_ui_calls:
        # Deduplicate
        seen_unmatched = set()
        for um in unmatched_ui_calls:
            key = (um["method"], um["raw"], um["file"])
            if key not in seen_unmatched:
                seen_unmatched.add(key)
                rprint(f"{um['file']}:{um['line']} -> [{um['method']}] '{um['raw']}' (normalized: {um['normalized']})")
    else:
        rprint("None (All UI API calls mapped to OpenAPI)")
    rprint("")

    os.makedirs(os.path.dirname(RAW_OUTPUT_PATH), exist_ok=True)
    with open(RAW_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(raw_lines))

    print(f"[OK] Step 4 complete. CSV written to {OUTPUT_CSV_PATH}, raw report to {RAW_OUTPUT_PATH}")

if __name__ == "__main__":
    main()
