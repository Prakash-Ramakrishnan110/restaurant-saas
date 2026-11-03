from typing import Any

from django.db import models
from django.utils import timezone

from apps.core.models import BranchOwnedModel, TenantOwnedModel
from apps.venues.constants import (
    AreaType,
    OpenedVia,
    OrderWorkflow,
    PaymentTiming,
    QROrderingMode,
    QRSessionPolicy,
    QRTargetType,
    SessionStatus,
    TableShape,
    TableStatus,
    TableType,
)


class BranchCapabilities(TenantOwnedModel):
    """Explicitly typed operational and behavioral capabilities of a branch."""

    branch = models.OneToOneField(
        "tenants.Branch",
        on_delete=models.PROTECT,
        related_name="capabilities",
    )
    uses_tables = models.BooleanField(default=True)
    uses_token_numbers = models.BooleanField(default=False)
    uses_kds = models.BooleanField(default=True)
    uses_courses = models.BooleanField(default=False)
    allows_takeaway = models.BooleanField(default=True)
    allows_room_service = models.BooleanField(default=False)
    allows_qr_ordering = models.BooleanField(default=True)

    payment_timing = models.CharField(
        max_length=20,
        choices=PaymentTiming.choices,
        default=PaymentTiming.PAY_LATER,
    )
    qr_ordering_mode = models.CharField(
        max_length=30,
        choices=QROrderingMode.choices,
        default=QROrderingMode.ORDER_WITH_APPROVAL,
    )
    qr_session_policy = models.CharField(
        max_length=30,
        choices=QRSessionPolicy.choices,
        default=QRSessionPolicy.CUSTOMER_CAN_OPEN,
    )
    order_workflow = models.CharField(
        max_length=20,
        choices=OrderWorkflow.choices,
        default=OrderWorkflow.TABLE_SERVICE,
    )

    class Meta:
        verbose_name_plural = "Branch capabilities"

    def __str__(self) -> str:
        return f"Capabilities: {self.branch.name}"


class ServiceArea(BranchOwnedModel):
    """Distinct physical or operational area (e.g. Dining, Rooftop Bar, Room Service)."""

    name = models.CharField(max_length=100)
    area_type = models.CharField(
        max_length=30,
        choices=AreaType.choices,
        default=AreaType.DINING,
    )
    service_charge_bps = models.IntegerField(
        default=0,
        help_text="Service charge in basis points (e.g. 500 = 5.0%)",
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    operating_hours = models.JSONField(
        null=True,
        blank=True,
        help_text="Null indicates inheritance from branch operating hours",
    )

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "branch", "name"],
                name="unique_tenant_branch_area_name",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.branch.name})"


class Section(BranchOwnedModel):
    """Subdivision of a Service Area (e.g. AC Section, Family, Patio)."""

    service_area = models.ForeignKey(
        ServiceArea,
        on_delete=models.CASCADE,
        related_name="sections",
    )
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=20, default="#3B82F6")
    canvas_width = models.IntegerField(default=1200)
    canvas_height = models.IntegerField(default=800)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "service_area", "name"],
                name="unique_tenant_area_section_name",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} - {self.service_area.name}"


class TableGroup(BranchOwnedModel):
    """Temporary association of combinable tables for large group dining."""

    label = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["label"]

    def __str__(self) -> str:
        return f"Group: {self.label} ({self.branch.name})"


class DiningTable(BranchOwnedModel):
    """Individual table, room, counter, or seat entity."""

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="tables",
    )
    label = models.CharField(max_length=50, help_text="e.g. T12, Room 301, Counter 2")
    label_prefix = models.CharField(max_length=50, default="", db_index=True)
    label_number = models.IntegerField(default=0, db_index=True)
    table_type = models.CharField(
        max_length=30,
        choices=TableType.choices,
        default=TableType.TABLE,
    )
    min_capacity = models.IntegerField(default=1)
    capacity = models.IntegerField(default=4)
    status = models.CharField(
        max_length=20,
        choices=TableStatus.choices,
        default=TableStatus.AVAILABLE,
        db_index=True,
    )
    is_combinable = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    # Visual Layout Editor Coordinates
    x = models.FloatField(default=0.0)
    y = models.FloatField(default=0.0)
    width = models.FloatField(default=80.0)
    height = models.FloatField(default=80.0)
    rotation = models.IntegerField(default=0)
    shape = models.CharField(
        max_length=20,
        choices=TableShape.choices,
        default=TableShape.SQUARE,
    )

    group = models.ForeignKey(
        TableGroup,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="tables",
    )

    class Meta:
        ordering = ["section__sort_order", "label_prefix", "label_number", "label"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "branch", "label"],
                condition=models.Q(is_active=True),
                name="unique_active_tenant_branch_table_label",
            )
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        import re

        if self.label:
            match = re.match(r"^([^\d]*)(\d+)?", self.label.strip())
            if match:
                self.label_prefix = match.group(1).strip()
                self.label_number = int(match.group(2)) if match.group(2) else 0
            else:
                self.label_prefix = self.label.strip()
                self.label_number = 0
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.label} ({self.section.name})"


class StaffSectionAssignment(BranchOwnedModel):
    """Assignment of a staff member (waiter) to a section."""

    membership = models.ForeignKey(
        "accounts.Membership",
        on_delete=models.CASCADE,
        related_name="section_assignments",
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="staff_assignments",
    )
    valid_from = models.DateTimeField(default=timezone.now)
    valid_to = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-valid_from"]

    def __str__(self) -> str:
        return f"{self.membership.user.email} -> {self.section.name}"


class TableSession(BranchOwnedModel):
    """Dining session anchor for orders, items, and billing."""

    table = models.ForeignKey(
        DiningTable,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sessions",
    )
    table_group = models.ForeignKey(
        TableGroup,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="sessions",
    )
    status = models.CharField(
        max_length=20,
        choices=SessionStatus.choices,
        default=SessionStatus.OPEN,
        db_index=True,
    )
    opened_via = models.CharField(
        max_length=20,
        choices=OpenedVia.choices,
        default=OpenedVia.STAFF,
    )
    opened_by = models.ForeignKey(
        "accounts.Membership",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="opened_sessions",
    )
    guest_count = models.IntegerField(default=1)
    session_code = models.CharField(max_length=16, db_index=True)
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)
    last_activity_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-opened_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["table"],
                condition=models.Q(status="OPEN", table__isnull=False),
                name="unique_open_session_per_table",
            )
        ]

    def __str__(self) -> str:
        target = (
            self.table.label
            if self.table
            else (self.table_group.label if self.table_group else "Unassigned")
        )
        return f"Session [{self.session_code}] {target} - {self.status}"


class QRCode(BranchOwnedModel):
    """Cryptographic non-guessable QR token mapping to a venue target."""

    target_type = models.CharField(
        max_length=30,
        choices=QRTargetType.choices,
        default=QRTargetType.TABLE,
    )
    table = models.ForeignKey(
        DiningTable,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="qr_codes",
    )
    public_token = models.CharField(max_length=64, unique=True, db_index=True)
    is_active = models.BooleanField(default=True)
    version = models.IntegerField(default=1)
    rotated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"QR [{self.public_token[:8]}...] ({self.target_type})"


class TokenCounter(BranchOwnedModel):
    """Atomic daily sequential order token number generator."""

    service_date = models.DateField(db_index=True)
    service_area = models.ForeignKey(
        ServiceArea,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="token_counters",
    )
    last_number = models.IntegerField(default=0)

    class Meta:
        ordering = ["-service_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "service_date", "service_area"],
                name="unique_branch_date_area_counter",
            )
        ]

    def __str__(self) -> str:
        return f"Token #{self.last_number} on {self.service_date} ({self.branch.name})"
