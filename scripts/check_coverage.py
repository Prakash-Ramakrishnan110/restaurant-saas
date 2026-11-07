#!/usr/bin/env python3
"""Coverage gate verification script for ServeMyFood backend.

Checks exact coverage of critical modules against mandatory minimum thresholds:
- apps/rbac/permissions.py >= 95.0%
- apps/core/managers.py >= 95.0%
- apps/core/middleware.py >= 95.0%
- apps/accounts/staff_service.py >= 95.0%
- apps/accounts/services.py >= 95.0%
- apps/tenants/views.py >= 90.0%
- apps/venues/views.py >= 90.0%
- Total coverage >= 90.0%
"""

import os
import sys
import subprocess

THRESHOLDS = {
    "apps/rbac/permissions.py": 95.0,
    "apps/core/managers.py": 95.0,
    "apps/core/middleware.py": 95.0,
    "apps/accounts/staff_service.py": 95.0,
    "apps/accounts/services.py": 95.0,
    "apps/tenants/views.py": 90.0,
    "apps/venues/views.py": 90.0,
    "apps/menu/services.py": 90.0,
    "apps/menu/models.py": 90.0,
}
TOTAL_THRESHOLD = 90.0


def main():
    # Attempt to read pytest output or run pytest coverage
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
    evidence_file = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "docs", "evidence", "backend-pytest.txt")
    )

    lines = []
    if os.path.exists(evidence_file):
        for enc in ["utf-8", "utf-16", "utf-16-le", "cp1252"]:
            try:
                with open(evidence_file, "r", encoding=enc) as f:
                    content = f.read()
                    if "TOTAL" in content:
                        lines = content.splitlines()
                        break
            except Exception:
                continue

    if not lines:
        cmd = ["uv", "run", "pytest", "--cov=apps", "--cov-report=term-missing", "--cov-fail-under=90"]
        res = subprocess.run(cmd, cwd=backend_dir, capture_output=True, text=True)
        lines = res.stdout.splitlines()

    module_cov = {}
    total_cov = None

    for line in lines:
        norm = line.replace("\\", "/")
        parts = norm.split()
        if len(parts) >= 4 and parts[0] in THRESHOLDS:
            # Format: apps/foo/bar.py  stmts  miss  cover%
            cov_str = parts[3].rstrip("%")
            try:
                module_cov[parts[0]] = float(cov_str)
            except ValueError:
                pass
        elif norm.startswith("TOTAL ") and len(parts) >= 4:
            cov_str = parts[3].rstrip("%")
            try:
                total_cov = float(cov_str)
            except ValueError:
                pass

    print("=== Module Coverage Verification ===")
    failed = False

    for mod, required in THRESHOLDS.items():
        actual = module_cov.get(mod, 0.0)
        status = "PASS" if actual >= required else "FAIL"
        if status == "FAIL":
            failed = True
        print(f"{status}: {mod} coverage {actual:.1f}% >= {required:.1f}%")

    if total_cov is not None:
        total_status = "PASS" if total_cov >= TOTAL_THRESHOLD else "FAIL"
        if total_status == "FAIL":
            failed = True
        print(f"TOTAL COVERAGE: {total_cov:.2f}% (required >= {TOTAL_THRESHOLD:.1f}%)")
    else:
        print("FAIL: TOTAL COVERAGE could not be parsed.")
        failed = True

    if failed:
        print("COVERAGE GATES FAILED!")
        sys.exit(1)
    else:
        print("ALL COVERAGE GATES PASSED!")
        sys.exit(0)


if __name__ == "__main__":
    main()

