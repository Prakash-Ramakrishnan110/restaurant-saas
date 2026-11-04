"""Check coverage for required security and business logic modules.

Thresholds:
- >= 95% on:
  * apps/rbac/permissions.py
  * apps/core/managers.py
  * apps/core/middleware.py
  * apps/accounts/staff_service.py
  * apps/accounts/services.py
- >= 90% on:
  * apps/tenants/views.py
  * apps/venues/views.py
"""

import json
import subprocess
import sys


def main() -> None:
    # Generate coverage json
    res = subprocess.run(
        ["coverage", "json", "-o", "coverage.json"], capture_output=True, text=True
    )
    if res.returncode != 0:
        print(f"Error running coverage json: {res.stderr}")
        sys.exit(1)

    with open("coverage.json", encoding="utf-8") as f:
        data = json.load(f)

    files = data.get("files", {})

    gates_95 = [
        "apps/rbac/permissions.py",
        "apps/core/managers.py",
        "apps/core/middleware.py",
        "apps/accounts/staff_service.py",
        "apps/accounts/services.py",
    ]

    gates_90 = [
        "apps/tenants/views.py",
        "apps/venues/views.py",
    ]

    failed = False
    print("=== Module Coverage Verification ===")

    def get_file_coverage(pattern: str) -> float | None:
        norm = pattern.replace("\\", "/")
        for path, meta in files.items():
            path_norm = path.replace("\\", "/")
            if path_norm.endswith(norm):
                return float(meta["summary"]["percent_covered"])
        return None

    for target in gates_95:
        cov = get_file_coverage(target)
        if cov is None:
            print(f"FAIL: {target} not found in coverage data")
            failed = True
        elif cov < 95.0:
            print(f"FAIL: {target} coverage {cov:.1f}% < 95.0%")
            failed = True
        else:
            print(f"PASS: {target} coverage {cov:.1f}% >= 95.0%")

    for target in gates_90:
        cov = get_file_coverage(target)
        if cov is None:
            print(f"FAIL: {target} not found in coverage data")
            failed = True
        elif cov < 90.0:
            print(f"FAIL: {target} coverage {cov:.1f}% < 90.0%")
            failed = True
        else:
            print(f"PASS: {target} coverage {cov:.1f}% >= 90.0%")

    total_cov = float(data.get("totals", {}).get("percent_covered", 0.0))
    print(f"TOTAL COVERAGE: {total_cov:.2f}%")

    if failed:
        sys.exit(1)
    print("ALL COVERAGE GATES PASSED!")


if __name__ == "__main__":
    main()
