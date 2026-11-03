import ast
from pathlib import Path


def test_unscoped_manager_guard():
    """Security Guard: Ensures `.unscoped` manager is never accessed or imported

    outside explicitly approved system files.
    """
    apps_dir = Path(__file__).resolve().parent.parent.parent

    # Allowed modules/files relative to apps/
    ALLOWED_SUBPATHS = {
        "tenants/services.py",
        "tenants/views.py",
        "tenants/models.py",
        "tenants/migrations",
        "rbac/permissions.py",
        "audit/models.py",
        "audit/services.py",
        "audit/migrations",
        "core/managers.py",
        "core/models.py",
        "core/management/commands/seed.py",
        "accounts/migrations",
        "subscriptions/migrations",
        "tests",  # Tests are allowed to use unscoped to setup test fixtures
    }

    violations = []

    for py_file in apps_dir.rglob("*.py"):
        rel_path = py_file.relative_to(apps_dir).as_posix()

        # Check if file is in allow-list
        is_allowed = any(allowed in rel_path for allowed in ALLOWED_SUBPATHS)

        try:
            tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
        except Exception:
            continue

        for node in ast.walk(tree):
            # Check for attribute access: obj.unscoped
            if isinstance(node, ast.Attribute) and node.attr == "unscoped":
                if not is_allowed:
                    violations.append(f"{rel_path}:{node.lineno} accesses .unscoped")

            # Check for direct import of UnscopedTenantManager
            elif isinstance(node, ast.ImportFrom):
                for alias in node.names:
                    if alias.name == "UnscopedTenantManager":
                        if not is_allowed:
                            violations.append(
                                f"{rel_path}:{node.lineno} imports UnscopedTenantManager"
                            )

    assert not violations, (
        "Security violation! .unscoped manager accessed outside approved modules:\n"
        + "\n".join(violations)
    )
