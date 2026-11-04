#!/usr/bin/env python3
"""Parses docs/openapi.json and outputs a formatted Markdown table of all REST endpoints with permissions."""

import json
from pathlib import Path


def infer_permission(path: str, method: str) -> str:
    # Public endpoints
    if path.startswith("/api/v1/public/") or path in (
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

    # Entitlements
    if path.startswith("/api/v1/entitlements/"):
        return "Active Tenant Membership"

    # Branch & capabilities
    if "capabilities" in path:
        return "branches.manage" if method in ("PATCH", "PUT") else "branches.view"
    if path.startswith("/api/v1/branches/"):
        return "branches.manage" if method in ("POST", "PATCH", "PUT", "DELETE") else "branches.view"

    # Staff
    if "reset-password" in path:
        return "staff.manage (Owner / Branch Manager)"
    if path.startswith("/api/v1/staff/"):
        return "staff.manage" if method in ("POST", "PATCH", "PUT", "DELETE") else "staff.view"

    # QR Codes
    if path.startswith("/api/v1/qr-codes/"):
        if method in ("POST", "DELETE"):
            return "qrcodes.manage"
        return "qrcodes.view"

    # Staff Assignments
    if path.startswith("/api/v1/staff-assignments/"):
        return "staff.manage" if method in ("POST", "DELETE") else "staff.view"

    # Table Sessions
    if path.startswith("/api/v1/table-sessions/"):
        if "open" in path or "close" in path or method == "POST":
            return "orders.manage or tables.manage"
        return "tables.view"

    # Tables & Layout
    if "/layout" in path or "/status" in path:
        return "tables.manage"
    if path.startswith("/api/v1/tables/") or path.startswith("/api/v1/table-groups/"):
        return "tables.manage" if method in ("POST", "PATCH", "PUT", "DELETE") else "tables.view"

    # Service areas & Sections
    if path.startswith("/api/v1/service-areas/") or path.startswith("/api/v1/sections/"):
        return "tables.manage" if method in ("POST", "PATCH", "PUT", "DELETE") else "tables.view"

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

    print("| Method | Path | Summary / Operation ID | Permission |")
    print("|:---:|---|---|---|")

    method_order = ["GET", "POST", "PUT", "PATCH", "DELETE"]

    rows = []
    for path, path_item in sorted(paths.items()):
        for method, op in path_item.items():
            method_upper = method.upper()
            if method_upper not in method_order:
                continue
            summary = op.get("summary") or op.get("operationId") or ""
            permission = infer_permission(path, method_upper)
            rows.append((path, method_upper, summary, permission))

    # Sort rows by path, then method
    for path, method, summary, perm in sorted(rows, key=lambda x: (x[0], method_order.index(x[1]))):
        print(f"| `{method}` | `{path}` | {summary} | `{perm}` |")


if __name__ == "__main__":
    main()
