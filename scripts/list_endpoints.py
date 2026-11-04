#!/usr/bin/env python3
"""Parses docs/openapi.json and outputs a formatted Markdown table of all REST endpoints with permissions."""

import json
from pathlib import Path


def infer_permission(path: str, method: str) -> str:
    # Public endpoints
    if path.startswith("/api/v1/public/") or path.startswith("/health") or path in (
        "/api/v1/auth/login/",
        "/api/v1/auth/refresh/",
        "/api/v1/auth/logout/",
    ):
        return "AllowAny (Public)"

    # Auth & Self
    if path in ("/api/v1/auth/me/", "/api/v1/auth/switch-tenant/"):
        return "Authenticated User"
    if path == "/api/v1/auth/change-password/":
        return "Authenticated (Self)"

    # Platform Admin
    if path.startswith("/api/v1/tenants/"):
        return "IsPlatformAdmin"

    # Business profile
    if path.startswith("/api/v1/business/"):
        return "business.manage" if method in ("PATCH", "PUT") else "business.view"

    # Onboarding
    if path.startswith("/api/v1/onboarding/"):
        return "OWNER, BRANCH_MANAGER"

    # Entitlements
    if path.startswith("/api/v1/entitlements/"):
        return "Active Tenant Membership"

    # Branch & capabilities
    if "capabilities" in path:
        return "branch.manage" if method in ("PATCH", "PUT") else "branch.view"
    if path.startswith("/api/v1/branches/"):
        return "branch.manage" if method in ("POST", "PATCH", "PUT", "DELETE") else "branch.view"

    # Staff
    if "reset-password" in path:
        return "staff.manage (Owner / Branch Manager)"
    if path.startswith("/api/v1/staff/"):
        return "staff.manage" if method in ("POST", "PATCH", "PUT", "DELETE") else "staff.view"

    # QR Codes
    if path.startswith("/api/v1/qr-codes/"):
        if method in ("POST", "DELETE"):
            return "qr.manage"
        return "qr.view"

    # Staff Assignments
    if path.startswith("/api/v1/staff-assignments/"):
        return "table.assign" if method in ("POST", "DELETE") else "table.view"

    # Table Sessions
    if path.startswith("/api/v1/table-sessions/"):
        if "open" in path:
            return "table_session.open"
        if "close" in path:
            return "table_session.close"
        return "table.view"

    # Tables & Layout
    if "/status" in path:
        return "table.status_update"
    if "/join" in path or "/split" in path:
        return "table.merge"
    if "/layout" in path:
        return "floor.manage"
    if path.startswith("/api/v1/tables/"):
        return "table.manage" if method in ("POST", "PATCH", "PUT", "DELETE") else "table.view"
    if path.startswith("/api/v1/table-groups/"):
        return "table.view"

    # Service areas & Sections
    if path.startswith("/api/v1/service-areas/") or path.startswith("/api/v1/sections/"):
        return "area.manage" if method in ("POST", "PATCH", "PUT", "DELETE") else "area.view"

    return "Authenticated"


def main():
    root_dir = Path(__file__).resolve().parent.parent
    openapi_file = root_dir / "docs" / "openapi.json"

    if not openapi_file.exists():
        print(f"Error: {openapi_file} does not exist.")
        return

    with open(openapi_file, "r", encoding="utf-8") as f:
        schema = json.load(f)

    paths = schema.get("paths", {})
    rows = []

    for path, methods in sorted(paths.items()):
        for method, op in sorted(methods.items()):
            if method.lower() not in ("get", "post", "put", "patch", "delete"):
                continue

            summary = op.get("summary") or op.get("operationId") or ""
            permission = infer_permission(path, method.upper())

            rows.append((method.upper(), path, summary, permission))

    # Print markdown table
    print("| Method | Path | Summary / Operation ID | Permission |")
    print("|:---:|---|---|---|")
    for method, path, summary, permission in rows:
        print(f"| `{method}` | `{path}` | {summary} | `{permission}` |")


if __name__ == "__main__":
    main()
