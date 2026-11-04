from apps.rbac.constants import Permission, Role

# Centralized role-to-permissions mapping matrix for security auditing
ROLE_PERMISSIONS: dict[str, set[str]] = {
    Role.PLATFORM_ADMIN: {
        Permission.PLATFORM_ADMIN,
        Permission.TENANT_MANAGE,
    },
    Role.OWNER: {
        Permission.BUSINESS_VIEW,
        Permission.BUSINESS_MANAGE,
        Permission.TENANT_MANAGE,
        Permission.BRANCH_MANAGE,
        Permission.BRANCH_VIEW,
        Permission.STAFF_MANAGE,
        Permission.STAFF_VIEW,
        Permission.AREA_VIEW,
        Permission.AREA_MANAGE,
        Permission.FLOOR_MANAGE,
        Permission.TABLE_VIEW,
        Permission.TABLE_MANAGE,
        Permission.TABLE_STATUS_UPDATE,
        Permission.TABLE_MERGE,
        Permission.TABLE_ASSIGN,
        Permission.TABLE_SESSION_OPEN,
        Permission.TABLE_SESSION_CLOSE,
        Permission.QR_VIEW,
        Permission.QR_MANAGE,
        Permission.MENU_MANAGE,
        Permission.ORDER_CREATE,
        Permission.ORDER_CANCEL,
        Permission.INVOICE_REFUND,
        Permission.REPORT_VIEW,
        Permission.PRINTER_REPRINT,
    },
    Role.BRANCH_MANAGER: {
        Permission.BUSINESS_VIEW,
        Permission.BRANCH_VIEW,
        Permission.STAFF_MANAGE,
        Permission.STAFF_VIEW,
        Permission.AREA_VIEW,
        Permission.AREA_MANAGE,
        Permission.FLOOR_MANAGE,
        Permission.TABLE_VIEW,
        Permission.TABLE_MANAGE,
        Permission.TABLE_STATUS_UPDATE,
        Permission.TABLE_MERGE,
        Permission.TABLE_ASSIGN,
        Permission.TABLE_SESSION_OPEN,
        Permission.TABLE_SESSION_CLOSE,
        Permission.QR_VIEW,
        Permission.QR_MANAGE,
        Permission.MENU_MANAGE,
        Permission.ORDER_CREATE,
        Permission.ORDER_CANCEL,
        Permission.REPORT_VIEW,
        Permission.PRINTER_REPRINT,
    },
    Role.CASHIER: {
        Permission.BRANCH_VIEW,
        Permission.TABLE_VIEW,
        Permission.TABLE_STATUS_UPDATE,
        Permission.TABLE_SESSION_OPEN,
        Permission.TABLE_SESSION_CLOSE,
        Permission.QR_VIEW,
        Permission.ORDER_CREATE,
        Permission.ORDER_CANCEL,
        Permission.PRINTER_REPRINT,
    },
    Role.WAITER: {
        Permission.AREA_VIEW,
        Permission.STAFF_VIEW,
        Permission.TABLE_VIEW,
        Permission.TABLE_STATUS_UPDATE,
        Permission.TABLE_SESSION_OPEN,
        Permission.TABLE_SESSION_CLOSE,
        Permission.QR_VIEW,
        Permission.ORDER_CREATE,
        Permission.PRINTER_REPRINT,
    },
    Role.KITCHEN: {
        Permission.TABLE_VIEW,
        Permission.PRINTER_REPRINT,
    },
    Role.INVENTORY_MANAGER: {
        Permission.MENU_MANAGE,
        Permission.BRANCH_VIEW,
    },
}


def get_permissions_for_role(role: str) -> set[str]:
    """Retrieve the set of permission codes assigned to a role."""
    return ROLE_PERMISSIONS.get(role, set())


def role_has_permission(role: str, permission: str) -> bool:
    """Check if a role includes a specific permission code."""
    return permission in get_permissions_for_role(role)
