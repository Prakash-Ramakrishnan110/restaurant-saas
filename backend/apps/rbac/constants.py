class Role:
    PLATFORM_ADMIN = "PLATFORM_ADMIN"
    OWNER = "OWNER"
    BRANCH_MANAGER = "BRANCH_MANAGER"
    CASHIER = "CASHIER"
    WAITER = "WAITER"
    KITCHEN = "KITCHEN"
    INVENTORY_MANAGER = "INVENTORY_MANAGER"

    CHOICES = [
        (OWNER, "Owner"),
        (BRANCH_MANAGER, "Branch Manager"),
        (CASHIER, "Cashier"),
        (WAITER, "Waiter"),
        (KITCHEN, "Kitchen Staff"),
        (INVENTORY_MANAGER, "Inventory Manager"),
    ]

    ALL = {
        PLATFORM_ADMIN,
        OWNER,
        BRANCH_MANAGER,
        CASHIER,
        WAITER,
        KITCHEN,
        INVENTORY_MANAGER,
    }

    # Rank hierarchy for permission delegation (higher number = higher privilege)
    HIERARCHY = {
        PLATFORM_ADMIN: 1000,
        OWNER: 100,
        BRANCH_MANAGER: 50,
        INVENTORY_MANAGER: 20,
        CASHIER: 20,
        WAITER: 20,
        KITCHEN: 20,
    }


class Permission:
    # Business & Tenant
    BUSINESS_VIEW = "business.view"
    BUSINESS_MANAGE = "business.manage"

    # Tenant & Branches
    TENANT_MANAGE = "tenant.manage"
    BRANCH_MANAGE = "branch.manage"
    BRANCH_VIEW = "branch.view"

    # Staff
    STAFF_MANAGE = "staff.manage"
    STAFF_VIEW = "staff.view"

    # Venue, Floor, Area, Tables & QR
    AREA_VIEW = "area.view"
    AREA_MANAGE = "area.manage"
    FLOOR_MANAGE = "floor.manage"
    TABLE_VIEW = "table.view"
    TABLE_MANAGE = "table.manage"
    TABLE_STATUS_UPDATE = "table.status_update"
    TABLE_MERGE = "table.merge"
    TABLE_ASSIGN = "table.assign"
    TABLE_SESSION_OPEN = "table_session.open"
    TABLE_SESSION_CLOSE = "table_session.close"
    QR_VIEW = "qr.view"
    QR_MANAGE = "qr.manage"

    # Core Operations
    MENU_MANAGE = "menu.manage"
    ORDER_CREATE = "order.create"
    ORDER_CANCEL = "order.cancel"
    INVOICE_REFUND = "invoice.refund"
    REPORT_VIEW = "report.view"
    PRINTER_REPRINT = "printer.reprint"

    # Platform Admin
    PLATFORM_ADMIN = "platform.admin"
