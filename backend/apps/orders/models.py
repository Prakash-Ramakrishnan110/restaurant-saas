from django.db import models
from django.utils import timezone

from apps.core.models import BranchOwnedModel, TimeStampedModel, UUIDModel


class OrderWorkflow(models.TextChoices):
    TABLE_SERVICE = "TABLE_SERVICE", "Table Service"
    COUNTER_TOKEN = "COUNTER_TOKEN", "Counter Token"
    ROOM_SERVICE = "ROOM_SERVICE", "Room Service"
    BAR_TAB = "BAR_TAB", "Bar Tab"


class OrderStatus(models.TextChoices):
    PLACED = "PLACED", "Placed"
    PREPARING = "PREPARING", "Preparing"
    READY = "READY", "Ready to Serve"
    SERVED = "SERVED", "Served"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class CourseType(models.TextChoices):
    STARTER = "STARTER", "Starter"
    MAIN = "MAIN", "Main Course"
    DESSERT = "DESSERT", "Dessert"
    BEVERAGE = "BEVERAGE", "Beverage"


class PaymentMethod(models.TextChoices):
    CASH = "CASH", "Cash"
    UPI = "UPI", "UPI QR"
    CARD = "CARD", "Debit / Credit Card"
    ROOM_FOLIO = "ROOM_FOLIO", "Room Folio Charge"


class ServiceRequestType(models.TextChoices):
    WATER = "WATER", "Water"
    NAPKINS = "NAPKINS", "Extra Napkins"
    CALL_WAITER = "CALL_WAITER", "Call Waiter"
    BILL = "BILL", "Request Bill"


class ServiceRequestStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    ACKNOWLEDGED = "ACKNOWLEDGED", "Acknowledged"
    RESOLVED = "RESOLVED", "Resolved"


class Order(BranchOwnedModel):
    """Represents a kitchen order ticket placed for a dining table session or counter token."""

    table_session = models.ForeignKey(
        "venues.TableSession",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="orders",
    )
    order_number = models.CharField(
        max_length=64,
        blank=True,
        default="",
        db_index=True,
        help_text="Unique human-readable order identifier",
    )
    order_workflow = models.CharField(
        max_length=30,
        choices=OrderWorkflow.choices,
        default=OrderWorkflow.TABLE_SERVICE,
        db_index=True,
    )
    token_number = models.PositiveIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Sequential daily token number for counter service",
    )
    status = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.PLACED,
        db_index=True,
    )
    placed_by = models.ForeignKey(
        "accounts.Membership",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="placed_orders",
    )
    placed_at = models.DateTimeField(default=timezone.now, db_index=True)
    ready_at = models.DateTimeField(null=True, blank=True)
    served_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-placed_at"]
        indexes = [
            models.Index(fields=["tenant", "branch", "status"]),
            models.Index(fields=["table_session", "status"]),
        ]

    def __str__(self) -> str:
        anchor = (
            f"Table {self.table_session.table.label}"
            if self.table_session and self.table_session.table
            else f"Token #{self.token_number}"
        )
        return f"Order {str(self.id)[:8]} ({anchor}) - {self.status}"

    @property
    def total_paise(self) -> int:
        return sum(item.subtotal_paise for item in self.items.all())


class OrderItem(UUIDModel, TimeStampedModel):
    """Line item belonging to an order ticket with authoritative snapshot pricing."""

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )
    menu_item = models.ForeignKey(
        "menu.MenuItem",
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    item_name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    unit_price_paise = models.BigIntegerField(
        help_text="Snapshot unit price in paise at order time"
    )
    subtotal_paise = models.BigIntegerField(help_text="quantity * unit_price_paise in paise")
    course = models.CharField(
        max_length=20,
        choices=CourseType.choices,
        default=CourseType.MAIN,
    )
    is_fired = models.BooleanField(
        default=True,
        help_text="True if dispatched to kitchen; False if on HOLD for pacing",
    )
    station = models.CharField(
        max_length=50,
        default="MAIN_KITCHEN",
        help_text="Kitchen station routing tag (e.g. MAIN_KITCHEN, TANDOOR, BAR)",
    )
    notes = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=20,
        default="PENDING",
        choices=[
            ("PENDING", "Pending"),
            ("COOKING", "Cooking"),
            ("READY", "Ready"),
            ("SERVED", "Served"),
        ],
    )

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.quantity}x {self.item_name} ({self.subtotal_paise} paise)"


class OrderEventType(models.TextChoices):
    CREATED = "CREATED", "Order Created"
    STATUS_CHANGED = "STATUS_CHANGED", "Status Changed"
    ITEM_FIRED = "ITEM_FIRED", "Item Fired"
    CANCELLED = "CANCELLED", "Order Cancelled"
    COMPLETED = "COMPLETED", "Order Completed"


class OrderEvent(BranchOwnedModel):
    """Immutable audit trail for order lifecycle transitions."""

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="events",
    )
    event_type = models.CharField(
        max_length=30,
        choices=OrderEventType.choices,
        default=OrderEventType.CREATED,
    )
    from_status = models.CharField(max_length=20, blank=True, default="")
    to_status = models.CharField(max_length=20, blank=True, default="")
    user = models.ForeignKey(
        "accounts.Membership",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="order_events",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"Event {self.event_type} on Order {str(self.order_id)[:8]}"


class BillInvoice(BranchOwnedModel):
    """Invoice generated upon session checkout."""

    table_session = models.ForeignKey(
        "venues.TableSession",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="invoices",
    )
    invoice_number = models.CharField(max_length=64, db_index=True)
    subtotal_paise = models.BigIntegerField(default=0)
    discount_paise = models.BigIntegerField(default=0)
    total_paise = models.BigIntegerField(default=0)
    snapshot_lines = models.JSONField(default=list, blank=True)
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.CASH,
    )
    amount_tendered_paise = models.BigIntegerField(default=0)
    change_due_paise = models.BigIntegerField(default=0)
    is_settled = models.BooleanField(default=False, db_index=True)
    settled_at = models.DateTimeField(null=True, blank=True)
    settled_by = models.ForeignKey(
        "accounts.Membership",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="settled_invoices",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "branch", "invoice_number"]),
            models.Index(fields=["is_settled", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"Invoice {self.invoice_number} ({self.total_paise} paise)"


class CashierShiftCloseout(BranchOwnedModel):
    """End-of-shift register reconciliation (Z-Report) with blind cash count."""

    cashier = models.ForeignKey(
        "accounts.Membership",
        on_delete=models.PROTECT,
        related_name="shift_closeouts",
    )
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)
    opening_cash_paise = models.BigIntegerField(default=0)
    expected_cash_paise = models.BigIntegerField(default=0)
    actual_cash_paise = models.BigIntegerField(default=0)
    cash_variance_paise = models.BigIntegerField(default=0, help_text="actual - expected")
    upi_total_paise = models.BigIntegerField(default=0)
    card_total_paise = models.BigIntegerField(default=0)
    total_settled_paise = models.BigIntegerField(default=0)
    total_invoices_count = models.IntegerField(default=0)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-opened_at"]

    def __str__(self) -> str:
        return (
            f"Shift Closeout {self.cashier.user.full_name} ({self.opened_at.strftime('%Y-%m-%d')})"
        )


class ServiceRequest(BranchOwnedModel):
    """Live call bell or service request from customer table QR."""

    table = models.ForeignKey(
        "venues.DiningTable",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="service_requests",
    )
    table_session = models.ForeignKey(
        "venues.TableSession",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="service_requests",
    )
    request_type = models.CharField(
        max_length=30,
        choices=ServiceRequestType.choices,
        default=ServiceRequestType.CALL_WAITER,
    )
    status = models.CharField(
        max_length=20,
        choices=ServiceRequestStatus.choices,
        default=ServiceRequestStatus.PENDING,
        db_index=True,
    )
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        "accounts.Membership",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="acknowledged_requests",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        table_label = self.table.label if self.table else "N/A"
        return f"Call Bell: {self.request_type} at Table {table_label} ({self.status})"
