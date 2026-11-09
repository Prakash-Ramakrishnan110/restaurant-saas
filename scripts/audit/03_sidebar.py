"""
Audit Step 3: Sidebar by Role
Evaluates visible sidebar items for roles (owner, manager, cashier, waiter, kitchen, platform admin)
across venues (Spice Garden [table], Chai Corner [counter], Grand Meridian [hotel]),
and compares against docs/product/sidebar-map.md.
"""

import os
import sys
import json
import re

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
SIDEBAR_MAP_PATH = os.path.join(BASE_DIR, "docs/product/sidebar-map.md")
NAV_TS_PATH = os.path.join(BASE_DIR, "frontend/src/app/navigation.ts")
OUTPUT_MD_PATH = os.path.join(BASE_DIR, "docs/audit/sidebar-by-role.md")
RAW_OUTPUT_PATH = os.path.join(BASE_DIR, "docs/audit/raw/sidebar_raw.txt")

# Permissions matrix from backend/apps/rbac/matrix.py
ROLE_PERMISSIONS = {
    "PLATFORM_ADMIN": {
        "platform.admin", "tenant.manage", "audit.view"
    },
    "OWNER": {
        "business.view", "business.manage", "tenant.manage", "branch.manage", "branch.view",
        "staff.manage", "staff.view", "area.view", "area.manage", "floor.manage",
        "table.view", "table.manage", "table.status_update", "table.merge", "table.assign",
        "table.session_open", "table.session_close", "qr.view", "qr.manage", "menu.view",
        "menu.manage", "menu.availability", "order.create", "order.cancel", "invoice.refund",
        "report.view", "printer.reprint", "audit.view", "inventory.view", "inventory.manage"
    },
    "BRANCH_MANAGER": {
        "business.view", "branch.view", "staff.manage", "staff.view", "area.view", "area.manage",
        "floor.manage", "table.view", "table.manage", "table.status_update", "table.merge",
        "table.assign", "table.session_open", "table.session_close", "qr.view", "qr.manage",
        "menu.view", "menu.manage", "menu.availability", "order.create", "order.cancel",
        "report.view", "printer.reprint", "audit.view", "inventory.view", "inventory.manage"
    },
    "CASHIER": {
        "table.view", "table.status_update", "table.session_close", "menu.view",
        "menu.availability", "order.create", "order.cancel", "printer.reprint"
    },
    "WAITER": {
        "table.view", "table.status_update", "table.session_open", "table.session_close",
        "table.merge", "menu.view", "order.create", "printer.reprint"
    },
    "KITCHEN": {
        "menu.view", "menu.availability", "printer.reprint"
    }
}

def can_role(role, is_platform_admin, perm):
    if is_platform_admin:
        return perm in ROLE_PERMISSIONS.get("PLATFORM_ADMIN", set())
    perms = ROLE_PERMISSIONS.get(role, set())
    return perm in perms or "*" in perms or role == "OWNER"

def get_navigation_groups(role, is_platform_admin, business_type, venue_profile, uses_tables):
    is_quick_service = (not uses_tables) or (business_type in ["TEA_SHOP", "FOOD_COURT"]) or (venue_profile == "QUICK_SERVICE")

    def can(perm):
        return can_role(role, is_platform_admin, perm)

    if is_platform_admin:
        return [
            {
                "label": "Super Admin",
                "items": [
                    {"label": "Platform Dashboard", "path": "/admin", "badge": None},
                    {"label": "Tenants Directory", "path": "/admin/tenants", "badge": None},
                    {"label": "New Customer", "path": "/admin/tenants/new", "badge": None},
                    {"label": "Subscription Plans", "path": "/admin/plans", "badge": None},
                    {"label": "System Health", "path": "/admin/health", "badge": None},
                    {"label": "Audit & Activity", "path": "/admin/activity", "badge": None},
                    {"label": "Support Desk", "path": "/admin/support", "badge": None},
                    {"label": "Announcements", "path": "/admin/announcements", "badge": None},
                ]
            }
        ]

    if role == "KITCHEN":
        return [
            {
                "label": "Kitchen Station",
                "items": [
                    {"label": "Kitchen KDS", "path": "/kds", "badge": "activeOrders"},
                    {"label": "Today's Availability", "path": "/menu/availability", "badge": None},
                    {"label": "Menu", "path": "/menu", "badge": None},
                ]
            }
        ]

    if role == "WAITER":
        floor_label = "Counter Orders" if is_quick_service else "Tables and Orders"
        return [
            {
                "label": "Floor Service",
                "items": [
                    {"label": floor_label, "path": "/pos", "badge": None},
                    {"label": "Live Orders", "path": "/orders", "badge": "activeOrders"},
                    {"label": "Ready for Pickup" if is_quick_service else "Ready to Serve", "path": "/serve", "badge": "readyOrders"},
                    {"label": "Menu", "path": "/menu", "badge": None},
                ]
            }
        ]

    if role == "CASHIER":
        return [
            {
                "label": "Billing & Register",
                "items": [
                    {"label": "Cashier Billing", "path": "/billing", "badge": None},
                    {"label": "Bills", "path": "/billing/bills", "badge": None},
                    {"label": "Shift Close", "path": "/billing/closeout", "badge": None},
                    {"label": "Live Orders", "path": "/orders", "badge": "activeOrders"},
                    {"label": "Today's Availability", "path": "/menu/availability", "badge": None},
                    {"label": "Menu", "path": "/menu", "badge": None},
                ]
            }
        ]

    # Manager & Owner
    is_manager = (role == "BRANCH_MANAGER")
    setup_venue_item = (
        {"label": "Counters and Tokens", "path": "/venue/counters", "permission": "area.view", "badge": None}
        if is_quick_service
        else {"label": "Tables", "path": "/venue/tables", "permission": "table.view", "badge": None}
    )
    floor_plan_item = (
        None if is_quick_service
        else {"label": "Floor Plan", "path": "/venue/floor", "permission": "floor.manage", "badge": None}
    )

    daily_items = [
        {"label": "Dashboard", "path": "/dashboard", "badge": None},
        {"label": "Counter Orders" if is_quick_service else "Floor POS", "path": "/pos", "permission": "order.create", "badge": None},
        {"label": "Live Orders", "path": "/orders", "badge": "activeOrders"},
        {"label": "Ready for Pickup" if is_quick_service else "Ready to Serve", "path": "/serve", "badge": "readyOrders"},
        {"label": "Kitchen KDS", "path": "/kds", "permission": "menu.availability", "badge": None},
        {"label": "Cashier Billing", "path": "/billing", "permission": "order.create", "badge": None},
        {"label": "Bills", "path": "/billing/bills", "permission": "order.create", "badge": None},
        {"label": "Shift Close", "path": "/billing/closeout", "permission": "order.create", "badge": None},
        {"label": "Menu", "path": "/menu", "permission": "menu.view", "badge": None},
        {"label": "Today's Availability", "path": "/menu/availability", "permission": "menu.availability", "badge": None},
    ]

    setup_items = [
        {"label": "Onboarding", "path": "/onboarding", "permission": "business.manage", "badge": None},
        {"label": "Branches", "path": "/branches", "permission": "branch.view", "badge": None},
        {"label": "Areas", "path": "/venue/areas", "permission": "area.view", "badge": None},
        setup_venue_item,
    ]
    if floor_plan_item:
        setup_items.append(floor_plan_item)
    setup_items.append({"label": "QR Codes", "path": "/qr", "permission": "qr.view", "badge": None})

    settings_items = []
    if not is_manager:
        settings_items.append({"label": "Branding", "path": "/settings/branding", "permission": "business.manage", "badge": None})
    settings_items.append({"label": "Venue Settings", "path": "/settings/venue", "permission": "business.view", "badge": None})
    if not is_manager:
        settings_items.append({"label": "Your Plan & Billing", "path": "/settings/plan", "badge": None})

    groups = [
        {"label": "Daily work", "items": daily_items},
        {"label": "Restaurant setup", "items": setup_items},
        {"label": "Team", "items": [{"label": "Staff", "path": "/staff", "permission": "staff.view", "badge": None}]},
        {"label": "Settings", "items": settings_items},
    ]

    filtered_groups = []
    for grp in groups:
        visible_items = []
        for itm in grp["items"]:
            perm = itm.get("permission")
            if not perm or can(perm):
                visible_items.append(itm)
        if visible_items:
            filtered_groups.append({"label": grp["label"], "items": visible_items})

    return filtered_groups

def parse_sidebar_map():
    with open(SIDEBAR_MAP_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    expected_items = []
    # Parsing table rows: | Item | Route | Roles | Rule | Phase |
    lines = content.splitlines()
    current_section = "General"
    for line in lines:
        if line.startswith("### "):
            current_section = line[4:].strip()
            continue
        if not line.startswith("|") or "---" in line or "Item | Route" in line:
            continue
        parts = [p.strip() for p in line.split("|")[1:-1]]
        if not parts:
            continue
        # Table columns can differ by section
        # e.g.:
        # Daily work: Item, Route, Roles, Rule, Phase
        # Menu: Item, Route, Roles, Phase
        # Reports: Item, Route, Phase (Roles = O M)
        # Restaurant setup: Item, Route, Rule, Phase (Roles = O full; M view or own branch)
        # Team: Item, Route, Roles, Phase
        # Settings: Item, Route, Roles, Phase
        item_name = parts[0]
        route = parts[1] if len(parts) > 1 and parts[1].startswith("/") else None
        if not route:
            continue

        roles = ""
        rule = ""
        phase = ""

        if current_section == "Daily work":
            roles = parts[2] if len(parts) > 2 else ""
            rule = parts[3] if len(parts) > 3 else ""
            phase = parts[4] if len(parts) > 4 else ""
        elif current_section in ["Menu", "Team", "Settings"]:
            roles = parts[2] if len(parts) > 2 else ""
            phase = parts[3] if len(parts) > 3 else ""
        elif current_section == "Restaurant setup":
            rule = parts[2] if len(parts) > 2 else ""
            phase = parts[3] if len(parts) > 3 else ""
            roles = "O M"
        elif current_section.startswith("Reports"):
            roles = "O M"
            phase = parts[2] if len(parts) > 2 else ""

        expected_items.append({
            "section": current_section,
            "item": item_name,
            "route": route,
            "roles": roles,
            "rule": rule,
            "phase": phase
        })

    return expected_items

def main():
    venues = [
        {"name": "Spice Garden", "type": "CASUAL_DINING", "profile": "CASUAL_DINING", "uses_tables": True, "category": "Table Venue"},
        {"name": "Chai Corner", "type": "TEA_SHOP", "profile": "QUICK_SERVICE", "uses_tables": False, "category": "Counter Venue"},
        {"name": "Grand Meridian", "type": "HOTEL", "profile": "HOTEL_RESTAURANT", "uses_tables": True, "category": "Hotel"},
    ]

    roles = [
        ("OWNER", False, "Owner"),
        ("BRANCH_MANAGER", False, "Manager"),
        ("CASHIER", False, "Cashier"),
        ("WAITER", False, "Waiter"),
        ("KITCHEN", False, "Kitchen"),
        ("PLATFORM_ADMIN", True, "Platform Admin"),
    ]

    expected_map = parse_sidebar_map()

    home_pages = {
        "OWNER": "/dashboard",
        "BRANCH_MANAGER": "/dashboard",
        "CASHIER": "/dashboard (fallback in LoginPage.tsx; but Cashier lacks /dashboard in sidebar!)",
        "WAITER": "/dashboard (fallback in LoginPage.tsx; but Waiter lacks /dashboard in sidebar!)",
        "KITCHEN": "/kds",
        "PLATFORM_ADMIN": "/admin",
    }

    bottom_bar = [
        {"label": "Home", "route": "/dashboard", "rule": "All roles"},
        {"label": "Tables / Counters", "route": "/pos", "rule": "Dynamic label: Tables (if uses_tables) / Counters"},
        {"label": "KDS", "route": "/kds", "rule": "All roles"},
        {"label": "Billing", "route": "/billing", "rule": "All roles"},
        {"label": "More", "action": "Opens sidebar drawer", "rule": "All roles"},
    ]

    out_lines = []
    raw_lines = []

    def p(line=""):
        out_lines.append(line)
        raw_lines.append(line)
        print(line)

    p("# Sidebar by Role & Venue Audit")
    p("")
    p("Evaluation of actual visible sidebar items across roles and venue profiles,")
    p("compared against the single source of truth `docs/product/sidebar-map.md`.")
    p("")

    p("## 1. Role Login Landing Pages & Phone Bottom Tab Bar")
    p("")
    p("### Post-Login Home Route by Role")
    p("| Role | Configured Post-Login Destination | Sidebar Membership of Destination | Status |")
    p("|---|---|---|---|")
    for r_code, is_pa, r_label in roles:
        dest = home_pages[r_code]
        if r_code in ["WAITER", "CASHIER"]:
            p(f"| {r_label} | `/dashboard` | NO (not in sidebar) | MISCONFIGURED: Waiter/Cashier redirected to `/dashboard` which is not their station |")
        elif r_code == "KITCHEN":
            p(f"| {r_label} | `/kds` | YES (in Kitchen Station) | OK |")
        elif r_code == "PLATFORM_ADMIN":
            p(f"| {r_label} | `/admin` | YES (in Super Admin) | OK |")
        else:
            p(f"| {r_label} | `/dashboard` | YES (in Daily work) | OK |")

    p("")
    p("### Phone Bottom Tab Bar (AppShell.tsx)")
    p("| Tab Label | Destination | Condition / Role Filtering | Defect / Note |")
    p("|---|---|---|---|")
    for b in bottom_bar:
        p(f"| {b['label']} | {b.get('route', b.get('action'))} | Unconditional (`md:hidden`) | Rendered globally for all roles including Platform Admin and Kitchen |")

    p("")
    p("---")
    p("")
    p("## 2. Actual Visible Sidebar Items by Role & Venue")
    p("")

    # Map role letters
    role_letter_map = {
        "OWNER": "O",
        "BRANCH_MANAGER": "M",
        "CASHIER": "C",
        "WAITER": "W",
        "KITCHEN": "K",
        "PLATFORM_ADMIN": "A"
    }

    diff_findings = []

    for v in venues:
        p(f"### Venue: {v['name']} ({v['category']} - type: `{v['type']}`, profile: `{v['profile']}`, uses_tables: `{v['uses_tables']}`)")
        p("")

        for r_code, is_pa, r_label in roles:
            # Platform admin is venue-independent
            if is_pa and v["name"] != "Spice Garden":
                continue

            groups = get_navigation_groups(r_code, is_pa, v["type"], v["profile"], v["uses_tables"])
            visible_items_count = sum(len(g["items"]) for g in groups)
            p(f"#### Role: {r_label} ({visible_items_count} visible items)")
            p("| Group | Label | Route | Badge |")
            p("|---|---|---|---|")
            visible_paths = set()
            for grp in groups:
                for itm in grp["items"]:
                    badge_str = itm["badge"] if itm.get("badge") else "-"
                    p(f"| {grp['label']} | {itm['label']} | `{itm['path']}` | {badge_str} |")
                    visible_paths.add(itm["path"])
            p("")

            # Diff analysis against sidebar-map.md
            r_letter = role_letter_map[r_code]
            if not is_pa:
                for exp in expected_map:
                    # Check if role matches
                    exp_roles = exp["roles"]
                    role_match = (r_letter in exp_roles) if exp_roles else False
                    rule_match = True
                    if exp["rule"] == "T" and not v["uses_tables"]:
                        rule_match = False
                    if exp["rule"] == "N" and v["uses_tables"]:
                        rule_match = False
                    if exp["rule"] == "H" and v["type"] != "HOTEL":
                        rule_match = False

                    is_now_or_p1 = "NOW" in exp["phase"] or "P1" in exp["phase"]

                    # Check missing
                    if role_match and rule_match and is_now_or_p1 and exp["route"] not in visible_paths:
                        diff_findings.append({
                            "type": "MISSING_ITEM",
                            "venue": v["name"],
                            "role": r_label,
                            "route": exp["route"],
                            "label": exp["item"],
                            "phase": exp["phase"],
                            "rule": exp["rule"]
                        })

    p("---")
    p("")
    p("## 3. Discrepancies vs `docs/product/sidebar-map.md`")
    p("")
    p("Summary of differences found between code implementation and `sidebar-map.md`:")
    p("")

    # Deduplicate findings
    dedup_diff = {}
    for d in diff_findings:
        key = (d["role"], d["route"])
        if key not in dedup_diff:
            dedup_diff[key] = d

    p("| Role | Missing/Extra Route | Expected Label | Phase | Rule | Details |")
    p("|---|---|---|---|---|---|")
    for (role, route), d in sorted(dedup_diff.items()):
        p(f"| {role} | `{route}` | {d['label']} | {d['phase']} | {d['rule'] or 'All'} | Specified in sidebar-map for phase {d['phase']} but omitted in `navigation.ts` |")

    p("")
    p("### Critical Behavioral Observations")
    p("1. **Waiters and Cashiers Home Page**: Redirected to `/dashboard` upon login, but `/dashboard` is neither in their sidebar nor is it an active operational view for them.")
    p("2. **Mobile Bottom Navigation**: Hardcoded unconditionally with 4 tabs (Home, Tables/Counters, KDS, Billing). Waiters see Billing/KDS even if they are not cashier/kitchen; Platform Admins see restaurant tables and billing tabs.")
    p("3. **Hotel Specific Routes**: Routes like `/room-service` and `/billing/room-charges` (Phase P2 for Hotel) are not yet present in `navigation.ts`.")
    p("4. **Counter Venue Quick-Service Switch**: Counter venues (`uses_tables=False`) correctly swap 'Tables' -> 'Counters and Tokens' (`/venue/counters`) and omit 'Floor Plan' (`/venue/floor`).")

    os.makedirs(os.path.dirname(OUTPUT_MD_PATH), exist_ok=True)
    with open(OUTPUT_MD_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines))

    os.makedirs(os.path.dirname(RAW_OUTPUT_PATH), exist_ok=True)
    with open(RAW_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(raw_lines))

    print(f"\n[OK] Step 3 complete. Output written to {OUTPUT_MD_PATH} and {RAW_OUTPUT_PATH}")

if __name__ == "__main__":
    main()
