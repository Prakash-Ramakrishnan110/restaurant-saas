from django.db import models


class PaymentTiming(models.TextChoices):
    PAY_FIRST = "PAY_FIRST", "Pay First"
    PAY_LATER = "PAY_LATER", "Pay Later"
    EITHER = "EITHER", "Either"


class QROrderingMode(models.TextChoices):
    DISABLED = "DISABLED", "Disabled"
    BROWSE_ONLY = "BROWSE_ONLY", "Browse Only"
    ORDER_WITH_APPROVAL = "ORDER_WITH_APPROVAL", "Order With Approval"
    ORDER_DIRECT = "ORDER_DIRECT", "Order Direct"


class QRSessionPolicy(models.TextChoices):
    CUSTOMER_CAN_OPEN = "CUSTOMER_CAN_OPEN", "Customer Can Open"
    STAFF_ONLY = "STAFF_ONLY", "Staff Only"


class OrderWorkflow(models.TextChoices):
    COUNTER_TOKEN = "COUNTER_TOKEN", "Counter Token"
    TABLE_SERVICE = "TABLE_SERVICE", "Table Service"
    BAR_TAB = "BAR_TAB", "Bar Tab"
    ROOM_SERVICE = "ROOM_SERVICE", "Room Service"


class AreaType(models.TextChoices):
    DINING = "DINING", "Dining Area"
    BAR = "BAR", "Bar / Lounge"
    COUNTER = "COUNTER", "Order Counter"
    OUTDOOR = "OUTDOOR", "Outdoor / Patio"
    ROOM_SERVICE = "ROOM_SERVICE", "Hotel Room Service"
    BANQUET = "BANQUET", "Banquet / Event Hall"
    FOOD_COURT_COUNTER = "FOOD_COURT_COUNTER", "Food Court Stall Counter"
    TAKEAWAY = "TAKEAWAY", "Takeaway Pickup Point"


class TableType(models.TextChoices):
    TABLE = "TABLE", "Dining Table"
    BOOTH = "BOOTH", "Booth Seating"
    BAR_SEAT = "BAR_SEAT", "Bar Stool"
    ROOM = "ROOM", "Hotel Room"
    COUNTER = "COUNTER", "Counter Seat / Token Station"
    BANQUET_TABLE = "BANQUET_TABLE", "Banquet Round"
    TAKEAWAY_POINT = "TAKEAWAY_POINT", "Takeaway Point"


class TableStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    OCCUPIED = "OCCUPIED", "Occupied"
    RESERVED = "RESERVED", "Reserved"
    CLEANING = "CLEANING", "Cleaning / Busing"
    BLOCKED = "BLOCKED", "Blocked / Maintenance"


class TableShape(models.TextChoices):
    RECT = "RECT", "Rectangle"
    ROUND = "ROUND", "Round"
    SQUARE = "SQUARE", "Square"
    BOOTH = "BOOTH", "Booth"
    LONG = "LONG", "Long Table"


class SessionStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    CLOSED = "CLOSED", "Closed"


class OpenedVia(models.TextChoices):
    STAFF = "STAFF", "Staff Opened"
    QR = "QR", "Customer QR Scan"
    QR_CUSTOMER = "QR_CUSTOMER", "Customer QR Scan"


class QRTargetType(models.TextChoices):
    TABLE = "TABLE", "Dining Table"
    ROOM = "ROOM", "Hotel Room"
    COUNTER = "COUNTER", "Order Counter"
    BRANCH_MENU = "BRANCH_MENU", "General Branch Menu"


# Permitted state transitions for DiningTable.status
ALLOWED_TABLE_STATUS_TRANSITIONS: dict[str, set[str]] = {
    TableStatus.AVAILABLE: {TableStatus.OCCUPIED, TableStatus.RESERVED, TableStatus.BLOCKED},
    TableStatus.OCCUPIED: {TableStatus.CLEANING, TableStatus.AVAILABLE},
    TableStatus.RESERVED: {TableStatus.OCCUPIED, TableStatus.AVAILABLE, TableStatus.BLOCKED},
    TableStatus.CLEANING: {TableStatus.AVAILABLE, TableStatus.BLOCKED},
    TableStatus.BLOCKED: {TableStatus.AVAILABLE, TableStatus.CLEANING},
}
