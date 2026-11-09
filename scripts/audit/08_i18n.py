"""
Audit Step 8: I18N Audit
Extracts translation keys in en and ta from frontend/src/i18n/index.ts,
computes key counts, missing Tamil keys, and scans for hardcoded strings in frontend/src.
Produces:
- docs/audit/i18n-gaps.txt
- docs/audit/raw/i18n_raw.txt
"""

import os
import sys
import re
import json
import subprocess

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
I18N_TS_PATH = os.path.join(BASE_DIR, "frontend/src/i18n/index.ts")
FRONTEND_SRC = os.path.join(BASE_DIR, "frontend/src")
OUTPUT_TXT_PATH = os.path.join(BASE_DIR, "docs/audit/i18n-gaps.txt")
RAW_OUTPUT_PATH = os.path.join(BASE_DIR, "docs/audit/raw/i18n_raw.txt")

def flatten_dict(d, parent_key="", sep="."):
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, str(v)))
    return dict(items)

def extract_resources_via_node():
    node_script = """
const fs = require('fs');
const content = fs.readFileSync('frontend/src/i18n/index.ts', 'utf8');
const match = content.match(/export const defaultResources\\s*=\\s*(\\{[\\s\\S]*?\\n\\};)/);
if (!match) {
    console.error('Could not find defaultResources');
    process.exit(1);
}
const rawObj = eval('(' + match[1].slice(0, -1) + ')');
console.log(JSON.stringify({
    en: rawObj.en.translation,
    ta: rawObj.ta.translation
}));
"""
    res = subprocess.run(["node", "-e", node_script], cwd=BASE_DIR, capture_output=True, text=True, check=True)
    data = json.loads(res.stdout)
    return data["en"], data["ta"]

def scan_hardcoded_jsx_strings():
    hardcoded = []
    # Regex to detect text between JSX tags >Some Text<
    # Exclude tags, curly braces, spaces, pure punctuation/numbers
    jsx_text_regex = re.compile(r">([^<>{}\n]+)<")
    # Also string literal props like placeholder="...", label="..." where not {t(...)}
    prop_text_regex = re.compile(r'\b(placeholder|aria-label|label|title)="([^"{}\n]+)"')

    for root, _, files in os.walk(FRONTEND_SRC):
        for f in files:
            if not f.endswith((".tsx",)):
                continue
            # Exclude tests
            if ".test." in f or ".spec." in f or "tests" in root:
                continue

            filepath = os.path.normpath(os.path.join(root, f))
            rel = os.path.relpath(filepath, BASE_DIR).replace("\\", "/")

            with open(filepath, "r", encoding="utf-8", errors="ignore") as file_obj:
                lines = file_obj.readlines()

            for idx, line in enumerate(lines, 1):
                s = line.strip()
                if s.startswith("//") or s.startswith("/*") or s.startswith("*"):
                    continue

                # Check JSX text
                for m in jsx_text_regex.finditer(line):
                    txt = m.group(1).strip()
                    # Filter out purely whitespace, digits, single symbols, or common technical text
                    if len(txt) > 3 and not re.match(r"^[\d\s\.,:\-/\|₹%#\*\(\)]+$", txt) and not "import " in txt:
                        hardcoded.append({
                            "file": rel,
                            "line": idx,
                            "text": txt,
                            "kind": "jsx_text"
                        })

                # Check prop text
                for m in prop_text_regex.finditer(line):
                    prop_name = m.group(1)
                    prop_val = m.group(2).strip()
                    if len(prop_val) > 3 and not re.match(r"^[\d\s\.,:\-/\|₹%#\*\(\)]+$", prop_val):
                        hardcoded.append({
                            "file": rel,
                            "line": idx,
                            "text": f'{prop_name}="{prop_val}"',
                            "kind": "prop_text"
                        })

    return hardcoded

def main():
    en_dict, ta_dict = extract_resources_via_node()
    en_flat = flatten_dict(en_dict)
    ta_flat = flatten_dict(ta_dict)

    en_keys = set(en_flat.keys())
    ta_keys = set(ta_flat.keys())

    missing_in_ta = sorted(list(en_keys - ta_keys))
    extra_in_ta = sorted(list(ta_keys - en_keys))

    # Empty translations in ta
    empty_in_ta = [k for k in sorted(list(en_keys & ta_keys)) if not ta_flat[k].strip()]

    hardcoded = scan_hardcoded_jsx_strings()

    lines = []
    def p(l=""):
        lines.append(l)
        print(l)

    p("=== SERVEMYFOOD I18N AUDIT REPORT ===")
    p(f"English (en) translation keys count: {len(en_keys)}")
    p(f"Tamil (ta) translation keys count:   {len(ta_keys)}")
    p(f"Missing Tamil keys:                   {len(missing_in_ta)}")
    p(f"Empty Tamil translations:             {len(empty_in_ta)}")
    p(f"Extra Tamil keys (not in en):         {len(extra_in_ta)}")
    p(f"Hardcoded UI strings detected:        {len(hardcoded)}")
    p("")

    p(f"--- 1. MISSING TAMIL KEYS ({len(missing_in_ta)}) ---")
    if missing_in_ta:
        for k in missing_in_ta:
            p(f"  [MISSING_TA] {k} (en: '{en_flat[k]}')")
    else:
        p("  None. All English keys have matching Tamil keys.")
    p("")

    p(f"--- 2. EMPTY TAMIL TRANSLATIONS ({len(empty_in_ta)}) ---")
    if empty_in_ta:
        for k in empty_in_ta:
            p(f"  [EMPTY_TA] {k}")
    else:
        p("  None.")
    p("")

    p(f"--- 3. HARDCODED UI STRINGS IN COMPONENTS (Sample 50 of {len(hardcoded)}) ---")
    for hc in hardcoded[:50]:
        p(f"  {hc['file']}:{hc['line']} -> {hc['text']}")
    if len(hardcoded) > 50:
        p(f"  ... and {len(hardcoded) - 50} more hardcoded occurrences in components.")
    p("")

    os.makedirs(os.path.dirname(OUTPUT_TXT_PATH), exist_ok=True)
    with open(OUTPUT_TXT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    # Also write full list to raw
    raw_lines = list(lines)
    raw_lines.append("\n--- ALL HARDCODED STRINGS ---")
    for hc in hardcoded:
        raw_lines.append(f"{hc['file']}:{hc['line']} [{hc['kind']}] -> {hc['text']}")

    os.makedirs(os.path.dirname(RAW_OUTPUT_PATH), exist_ok=True)
    with open(RAW_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(raw_lines))

    print(f"[OK] Step 8 complete. Output written to {OUTPUT_TXT_PATH} and {RAW_OUTPUT_PATH}")

if __name__ == "__main__":
    main()
