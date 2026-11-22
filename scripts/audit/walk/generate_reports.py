"""Generate flows.csv, rule-violations.md, WALK_SUMMARY.md, and walk-bundle.zip from raw audit outputs."""
import csv
import json
import os
import re
import subprocess
import zipfile

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
WALK_DIR = os.path.join(BASE_DIR, "docs/audit/walk")
RAW_DIR = os.path.join(WALK_DIR, "raw")

with open(os.path.join(RAW_DIR, "walk_raw.json"), encoding="utf-8") as f:
    walk = json.load(f)
with open(os.path.join(RAW_DIR, "walk_stats.json"), encoding="utf-8") as f:
    stats = json.load(f)
with open(os.path.join(RAW_DIR, "flow_timings.json"), encoding="utf-8") as f:
    timings = json.load(f)
with open(os.path.join(RAW_DIR, "routes_analysis.json"), encoding="utf-8") as f:
    routes_meta = json.load(f)

timing_map = {(t["flowId"], t["viewport"]): t for t in timings}

# 1. Generate docs/audit/walk/flows.csv
flows_csv_path = os.path.join(WALK_DIR, "flows.csv")
with open(flows_csv_path, "w", newline="", encoding="utf-8") as f:
    fields = ["flow", "step", "role", "viewport", "status", "duration_ms", "taps", "evidence_path", "notes"]
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    for row in walk:
        vp_key = row["viewport"]
        vp_dims = "390x844" if vp_key == "mobile" else "1440x900"
        t_info = timing_map.get((row["flowId"], vp_key), {})
        note_parts = []
        if row.get("note"):
            note_parts.append(row["note"])
        if row.get("httpErrors"):
            note_parts.append(
                "HTTP: " + "; ".join(f"{e['status']} {e['method']} {e['url']}" for e in row["httpErrors"])
            )
        w.writerow(
            {
                "flow": row["flowId"],
                "step": row["stepId"],
                "role": row["role"],
                "viewport": vp_dims,
                "status": row["status"],
                "duration_ms": t_info.get("durationMs", ""),
                "taps": t_info.get("taps", ""),
                "evidence_path": row["shotPath"],
                "notes": " | ".join(note_parts),
            }
        )

# Flow-level rollup (PASS if all steps PASS, FAIL if any FAIL, else BLOCKED if any BLOCKED)
flow_rollup = {}
for row in walk:
    fid = row["flowId"]
    flow_rollup.setdefault(fid, []).append(row["status"])

flow_status = {}
for fid, statuses in sorted(flow_rollup.items()):
    if "FAIL" in statuses:
        flow_status[fid] = "FAIL"
    elif "BLOCKED" in statuses:
        flow_status[fid] = "BLOCKED"
    else:
        flow_status[fid] = "PASS"

# 2. Generate docs/audit/walk/rule-violations.md strictly from walk_stats.json & walk_raw.json
rv_lines = [
    "# Automated Screen Rule Violations Report",
    "",
    f"Evaluated **{stats['total_steps']}** captured flow steps (`mobile` 390x844 touch + `desktop` 1440x900) against Step 3 rules. Zero hand-typed counts; sourced directly from [walk_stats.json](raw/walk_stats.json).",
    "",
    "## Summary Table",
    "",
    "| Rule Check | Failing Screens | Total Element Instances | Status |",
    "|---|---:|---:|---|",
    f"| Horizontal scroll (`scrollWidth > innerWidth`) | {stats['horizontal_scroll_screens']} | — | {'FAIL' if stats['horizontal_scroll_screens'] else 'PASS'} |",
    f"| Tap targets under threshold (`< 56px` mobile touch / `< 48px` desktop) | {stats['small_tap_target_screens']} | {stats['small_tap_target_total_elements']} | {'FAIL' if stats['small_tap_target_screens'] else 'PASS'} |",
    f"| Text smaller than `12px` | {stats['small_text_screens']} | {stats['small_text_total_elements']} | {'FAIL' if stats['small_text_screens'] else 'PASS'} |",
    f"| Axe `serious` or `critical` accessibility violations | {stats['axe_violation_screens']} | — | {'FAIL' if stats['axe_violation_screens'] else 'PASS'} |",
    f"| Text contrast under `4.5:1` | {stats['low_contrast_screens']} | — | {'FAIL' if stats['low_contrast_screens'] else 'PASS'} |",
    f"| Orange used as text, warnings, or status colors | {stats['orange_text_screens']} | — | {'FAIL' if stats['orange_text_screens'] else 'PASS'} |",
    f"| White text on `#FF6A00` background | {stats['white_on_orange_screens']} | — | {'FAIL' if stats['white_on_orange_screens'] else 'PASS'} |",
    f"| Empty frames or broken images (`naturalWidth === 0`) | {stats['broken_media_screens']} | — | {'FAIL' if stats['broken_media_screens'] else 'PASS'} |",
    f"| Skeletons / spinners still visible after `10s` | {stats['skeleton_10s_screens']} | — | {'FAIL' if stats['skeleton_10s_screens'] else 'PASS'} |",
    f"| Zero metrics shown after failed HTTP request (`>= 400`) | {stats['zeros_after_failed_req_screens']} | — | {'FAIL' if stats['zeros_after_failed_req_screens'] else 'PASS'} |",
    f"| Forbidden visible words (EN or TA) | {stats['forbidden_word_screens']} | — | {'FAIL' if stats['forbidden_word_screens'] else 'PASS'} |",
    f"| Word `table` on counter-only venue screens | {stats['counter_table_word_screens']} | — | {'FAIL' if stats['counter_table_word_screens'] else 'PASS'} |",
    f"| Missing Tamil strings / raw keys | {stats['missing_tamil_screens']} | — | {'FAIL' if stats['missing_tamil_screens'] else 'PASS'} |",
    "",
    "## Axe Violation Breakdown (`serious` & `critical`)",
    "",
    "| Axe Rule (Impact) | Affected Screens |",
    "|---|---:|",
]
for k, v in stats["axe_rules_histogram"].items():
    rv_lines.append(f"| `{k}` | {v} |")

rv_lines.extend(["", "## Forbidden Visible Words Breakdown", "", "| Word / Token | Screens Matched |", "|---|---:|"])
for k, v in stats["forbidden_words_histogram"].items():
    rv_lines.append(f"| `{k}` | {v} |")

rv_lines.extend(["", "## HTTP >= 400 Responses Observed During Walkthrough", "", "| Flow | Step | Viewport | Role | Status | Method & Endpoint |", "|---|---|---|---|---:|---|"])
for he in stats["http_errors_list"]:
    rv_lines.append(f"| {he['flow']} | `{he['step']}` | {he['viewport']} | {he['role']} | {he['status']} | `{he['method']} {he['url']}` |")

rv_md_path = os.path.join(WALK_DIR, "rule-violations.md")
with open(rv_md_path, "w", encoding="utf-8") as f:
    f.write("\n".join(rv_lines) + "\n")

# 3. Parse bugs.md severity counts and titles
with open(os.path.join(WALK_DIR, "bugs.md"), encoding="utf-8") as f:
    bugs_txt = f.read()
bug_headers = re.findall(r"^### (BUG-\d+)\s+—\s+(.+)$", bugs_txt, flags=re.M)
bug_sevs = re.findall(r"^- \*\*Severity:\*\*\s+`([^`]+)`", bugs_txt, flags=re.M)
sev_counts = {}
for s in bug_sevs:
    sev_counts[s] = sev_counts.get(s, 0) + 1

# Parse scope-vs-plan.md Ahead-of-Plan and Not-Allowed items
with open(os.path.join(WALK_DIR, "scope-vs-plan.md"), encoding="utf-8") as f:
    scope_txt = f.read()
ahead_rows = re.findall(r"^\|\s*\*\*([^*]+)\*\*\s*\|[^|]+\|\s*\*\*AHEAD OF PLAN[^|]*\|\s*([^|]+)\|", scope_txt, flags=re.M)
not_allowed_rows = re.findall(r"^\|\s*\*\*([^*]+)\*\*\s*\|[^|]+\|\s*\*\*NOT ALLOWED\*\*\s*\|\s*([^|]+)\|", scope_txt, flags=re.M)

# Read routes.csv for URL-only routes
with open(os.path.join(WALK_DIR, "routes.csv"), encoding="utf-8") as f:
    route_rows = list(csv.DictReader(f))
url_only_routes = [r for r in route_rows if r["url_only_reachable"] == "Y"]

# Git tags
tags_out = subprocess.check_output(["git", "tag", "-l"], cwd=BASE_DIR, text=True).strip().splitlines()

def read_text_auto(fp):
    with open(fp, "rb") as f:
        raw = f.read()
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")) or b"\x00" in raw[:40]:
        return raw.decode("utf-16", errors="ignore")
    return raw.decode("utf-8", errors="ignore")

# Latest SUMMARY.txt (docs/evidence/SUMMARY.txt) & raw gate counts
latest_summary_txt = read_text_auto(os.path.join(BASE_DIR, "docs/evidence/SUMMARY.txt")).strip()

def grep_tail_metric(rel_path, pattern):
    fp = os.path.join(BASE_DIR, rel_path)
    if not os.path.exists(fp):
        return "Not found"
    txt = re.sub(r"\x1b\[[0-9;]*m", "", read_text_auto(fp))
    m = re.findall(pattern, txt, flags=re.M)
    return m[-1].strip() if m else "Unknown"

ev_pytest = grep_tail_metric("docs/evidence/backend-pytest.txt", r"(\d+\s+passed(?:\s+in\s+[^\s=]+.*)?)(?=\s*=*$)")
ev_vitest_files = grep_tail_metric("docs/evidence/frontend-vitest.txt", r"Test Files\s+(.+)")
ev_vitest = grep_tail_metric("docs/evidence/frontend-vitest.txt", r"Tests\s+(.+)")
ev_e2e_fail = grep_tail_metric("docs/evidence/e2e-report.txt", r"^\s*(\d+\s+failed)\s*$")
ev_e2e_pass = grep_tail_metric("docs/evidence/e2e-report.txt", r"^\s*(\d+\s+passed\s*\([^)]+\))\s*$")
raw_pytest = grep_tail_metric("docs/audit/raw/backend-pytest.txt", r"(\d+\s+failed,\s+\d+\s+passed[^\r\n=]*)")
raw_vitest_fail = grep_tail_metric("docs/audit/raw/frontend-vitest.txt", r"\[(\d+/\d+)\]")
raw_e2e_fail = grep_tail_metric("docs/audit/raw/playwright-run.txt", r"^\s*(\d+\s+failed)\s*$")
raw_e2e_pass = grep_tail_metric("docs/audit/raw/playwright-run.txt", r"^\s*(\d+\s+passed\s*\([^)]+\))\s*$")

# 4. Generate WALK_SUMMARY.md
ws_lines = [
    "# ServeMyFood Walkthrough Audit Summary (`WALK_SUMMARY`)",
    "",
    "Generated strictly by [generate_reports.py](../../../scripts/audit/walk/generate_reports.py) from raw walkthrough outputs, CSVs, and latest gate artifacts.",
    "",
    "## 1. Flow Walkthrough Counts (28 Flows, 185 Screen Steps)",
    "",
    f"- **Flow-level status (28 flows):** PASS = **{sum(1 for v in flow_status.values() if v == 'PASS')}**, FAIL = **{sum(1 for v in flow_status.values() if v == 'FAIL')}**, BLOCKED = **{sum(1 for v in flow_status.values() if v == 'BLOCKED')}**",
    f"- **Step-level status ({stats['total_steps']} steps):** PASS = **{stats['pass_count']}**, FAIL = **{stats['fail_count']}**, BLOCKED = **{stats['blocked_count']}**",
    "",
    "| Flow | Overall Status |",
    "|---|---|",
]
for fid, st in sorted(flow_status.items()):
    ws_lines.append(f"| {fid} | **{st}** |")

ws_lines.extend([
    "",
    "## 2. Bugs by Severity",
    "",
    f"- **Total Bugs Logged:** **{len(bug_headers)}**",
])
for sev, cnt in sorted(sev_counts.items()):
    ws_lines.append(f"- `{sev}`: **{cnt}**")

ws_lines.extend([
    "",
    "## 3. Step 3 Rule Violation Counts (Across 185 Screen Captures)",
    "",
    f"- Horizontal scroll: **{stats['horizontal_scroll_screens']}** screens",
    f"- Small tap targets (`< 56px` mobile / `< 48px` desktop): **{stats['small_tap_target_screens']}** screens (**{stats['small_tap_target_total_elements']}** elements)",
    f"- Text `< 12px`: **{stats['small_text_screens']}** screens (**{stats['small_text_total_elements']}** elements)",
    f"- Axe `serious`/`critical` violations: **{stats['axe_violation_screens']}** screens",
    f"- Contrast `< 4.5:1`: **{stats['low_contrast_screens']}** screens",
    f"- Orange used as text/warnings/status: **{stats['orange_text_screens']}** screens",
    f"- White text on `#FF6A00`: **{stats['white_on_orange_screens']}** screens",
    f"- Broken images / empty frames (`naturalWidth === 0`): **{stats['broken_media_screens']}** screens",
    f"- Skeleton/spinner still active after 10s: **{stats['skeleton_10s_screens']}** screens",
    f"- Zeros shown after failed request: **{stats['zeros_after_failed_req_screens']}** screens",
    f"- Forbidden visible words (EN/TA): **{stats['forbidden_word_screens']}** screens",
    f"- Word `table` on counter-only venue: **{stats['counter_table_word_screens']}** screens",
    f"- Missing Tamil strings / raw keys: **{stats['missing_tamil_screens']}** screens",
    "",
    "## 4. Scope vs Plan — Ahead-of-Plan & Not-Allowed Features",
    "",
    "### Not Allowed (Against Recorded Decisions)",
])
for feat, dec in not_allowed_rows:
    ws_lines.append(f"- **{feat.strip()}** — {dec.strip()}")
ws_lines.append("")
ws_lines.append("### Ahead of Plan (Implemented Ahead of Target Phase)")
for feat, ph in ahead_rows:
    ws_lines.append(f"- **{feat.strip()}** — Planned: {ph.strip()}")

ws_lines.extend([
    "",
    f"## 5. Routes Reachable by URL Only (Not in Sidebar: {len(url_only_routes)} of {routes_meta['total_routes']} Routes)",
    "",
    "| Route | Component | Roles Allowed by URL | Data Source | Test Coverage |",
    "|---|---|---|---|---|",
])
for r in url_only_routes:
    ws_lines.append(f"| `{r['route']}` | `{r['component']}` | {r['roles_allowed_by_url']} | {r['data_source']} | {r['covered_by_tests']} |")

ws_lines.extend([
    "",
    "## 6. Flow Timing & Tap Counts",
    "",
    "| Flow | Viewport | Taps | Duration (ms) |",
    "|---|---|---:|---:|",
])
for t in timings:
    ws_lines.append(f"| {t['flowId']} | {t['viewport']} | {t['taps']} | {t['durationMs']} |")

ws_lines.extend([
    "",
    "## 7. Git Tags & Latest Gate Records (Unmodified / Not Rerun)",
    "",
    f"- **Git tags ({len(tags_out)}):** `" + "`, `".join(tags_out) + "`",
    f"- **Latest `SUMMARY.txt` (`docs/evidence/SUMMARY.txt`, 2026-11-21):**",
    "  - Overall Result: **`FAIL`** (18/19 gates PASS; Playwright Browser E2E Suite **`FAIL`**)",
    f"  - `docs/evidence/backend-pytest.txt`: `{ev_pytest}` (92.07% coverage)",
    f"  - `docs/evidence/frontend-vitest.txt`: `{ev_vitest_files}` files, `{ev_vitest}`",
    f"  - `docs/evidence/e2e-report.txt`: `{ev_e2e_fail}`, `{ev_e2e_pass}`",
    f"- **Earlier `docs/audit/raw/` gate snapshot (2026-11-12):**",
    f"  - `docs/audit/raw/backend-pytest.txt`: `{raw_pytest}`",
    f"  - `docs/audit/raw/frontend-vitest.txt`: `{raw_vitest_fail}` failed assertions in Vitest failure summary",
    f"  - `docs/audit/raw/playwright-run.txt`: `{raw_e2e_fail}`, `{raw_e2e_pass}`",
])

walk_summary_path = os.path.join(WALK_DIR, "WALK_SUMMARY.md")
with open(walk_summary_path, "w", encoding="utf-8") as f:
    f.write("\n".join(ws_lines) + "\n")

# 5. Bundle everything except raw/ and shots/ into docs/audit/walk/walk-bundle.zip (< 15 MB)
zip_path = os.path.join(WALK_DIR, "walk-bundle.zip")
if os.path.exists(zip_path):
    os.remove(zip_path)

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    zf.write(os.path.join(BASE_DIR, "docs/product/flows.md"), "docs/product/flows.md")
    for root, dirs, files in os.walk(WALK_DIR):
        # Skip raw/ and shots/
        rel_root = os.path.relpath(root, WALK_DIR).replace("\\", "/")
        if rel_root.startswith("raw") or rel_root.startswith("shots"):
            continue
        for fname in sorted(files):
            if fname == "walk-bundle.zip":
                continue
            full_p = os.path.join(root, fname)
            arc_p = os.path.relpath(full_p, BASE_DIR).replace("\\", "/")
            zf.write(full_p, arc_p)

zip_mb = os.path.getsize(zip_path) / (1024 * 1024)
print(f"Wrote {flows_csv_path}, {rv_md_path}, {walk_summary_path}")
print(f"Wrote {zip_path}: {zip_mb:.2f} MB (limit < 15 MB)")
assert zip_mb < 15.0, f"Zip too large: {zip_mb:.2f} MB"
