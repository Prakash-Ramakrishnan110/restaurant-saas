"""
Audit Step Deliverable: audit-bundle.zip packager
Packages the 13 required audit deliverables into docs/audit/audit-bundle.zip:
1. FRONTEND_STATE.md
2. routes.csv
3. sidebar-by-role.md
4. api-usage.csv
5. compliance-scan.txt
6. i18n-gaps.txt
7. bugs.md
8. register-coverage.md
9. scope-creep.md
10. backend-state.md
11. gates.md
12. contact-sheet-desktop.png
13. contact-sheet-mobile.png

Ensures zip size < 15 MB and reports each file's compressed and uncompressed size.
"""

import os
import sys
import zipfile

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
AUDIT_DIR = os.path.join(BASE_DIR, "docs/audit")
ZIP_PATH = os.path.join(AUDIT_DIR, "audit-bundle.zip")

REQUIRED_FILES = [
    "FRONTEND_STATE.md",
    "routes.csv",
    "sidebar-by-role.md",
    "api-usage.csv",
    "compliance-scan.txt",
    "i18n-gaps.txt",
    "bugs.md",
    "register-coverage.md",
    "scope-creep.md",
    "backend-state.md",
    "gates.md",
    "contact-sheet-desktop.png",
    "contact-sheet-mobile.png",
]

def main():
    print("=== Packaging Audit Bundle (docs/audit/audit-bundle.zip) ===")
    missing = []
    for fname in REQUIRED_FILES:
        fpath = os.path.join(AUDIT_DIR, fname)
        if not os.path.exists(fpath):
            missing.append(fname)

    if missing:
        print(f"[ERROR] Missing required files for audit bundle: {missing}")
        sys.exit(1)

    # Remove existing zip if present
    if os.path.exists(ZIP_PATH):
        os.remove(ZIP_PATH)

    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        for fname in REQUIRED_FILES:
            fpath = os.path.join(AUDIT_DIR, fname)
            zipf.write(fpath, arcname=fname)
            uncompressed_sz = os.path.getsize(fpath)
            print(f"  + Added {fname} ({uncompressed_sz:,} bytes)")

    total_size = os.path.getsize(ZIP_PATH)
    total_size_mb = total_size / (1024 * 1024)
    print(f"\n[OK] Created {ZIP_PATH}")
    print(f"Total bundle size: {total_size:,} bytes ({total_size_mb:.2f} MB)")
    if total_size_mb > 15.0:
        print(f"[WARNING] Bundle exceeds 15 MB limit! ({total_size_mb:.2f} MB)")
        sys.exit(1)
    else:
        print("[SUCCESS] Bundle size is well within the 15 MB constraint.")

if __name__ == "__main__":
    main()
