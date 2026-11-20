from decimal import Decimal
from typing import Any, ClassVar

from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from apps.core.managers import TenantManager, TenantQuerySet
from apps.core.models import BranchOwnedModel, TenantOwnedModel
from apps.inventory.constants import (
    BaseUnit,
    DeductionStatus,
    InventoryCategory,
    InventoryItemType,
    InventoryMode,
    PackagingMode,
    PurchaseOrderStatus,
    StockCountStatus,
    StockCountType,
    StockLocationType,
    StockMovementType,
    StockTransferStatus,
)


class Supplier(TenantOwnedModel):
    """Vendor supplying ingredients, finished goods, or packaging."""

    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=150, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "name"],
                name="unique_tenant_supplier_name",
            )
        ]

    def __str__(self) -> str:
        return self.name


class InventoryItem(TenantOwnedModel):
    """Tracked inventory item stored in a canonical base unit (g, ml, piece)."""

    name = models.CharField(max_length=200)
    name_ta = models.CharField(max_length=200, blank=True, default="")
    item_type = models.CharField(
        max_length=20,
        choices=InventoryItemType.choices,
        default=InventoryItemType.INGREDIENT,
    )
    base_unit = models.CharField(
        max_length=10,
        choices=BaseUnit.choices,
        default=BaseUnit.GRAM,
    )
    category = models.CharField(
        max_length=30,
        choices=InventoryCategory.choices,
        default=InventoryCategory.OTHER,
    )
    barcode = models.CharField(max_length=80, blank=True, default="")
    is_active = models.BooleanField(default=True)
    track_expiry = models.BooleanField(default=False)
    shelf_life_days = models.PositiveIntegerField(null=True, blank=True)
    reorder_level = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0.000"),
    )
    par_level = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0.000"),
    )
    default_supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="default_items",
    )
    packaging_mode = models.CharField(
        max_length=20,
        choices=PackagingMode.choices,
        default=PackagingMode.NONE,
    )
    packaging_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("1.000"),
    )

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "name"],
                name="unique_tenant_inventory_item_name",
            ),
            models.CheckConstraint(
                condition=Q(reorder_level__gte=Decimal("0")),
                name="inventory_item_reorder_non_negative",
            ),
            models.CheckConstraint(
                condition=Q(par_level__gte=Decimal("0")),
                name="inventory_item_par_non_negative",
            ),
            models.CheckConstraint(
                condition=Q(par_level=Decimal("0")) | Q(reorder_level__lte=F("par_level")),
                name="inventory_item_reorder_lte_par",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.base_unit})"


class UnitConversion(TenantOwnedModel):
    """Display / purchase unit conversion to an item's base unit."""

    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name="unit_conversions",
    )
    unit_name = models.CharField(max_length=40)
    factor_to_base = models.DecimalField(max_digits=14, decimal_places=6)

    class Meta:
        ordering = ["unit_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["item", "unit_name"],
                name="unique_item_unit_conversion",
            ),
            models.CheckConstraint(
                condition=Q(factor_to_base__gt=Decimal("0")),
                name="unit_conversion_factor_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"1 {self.unit_name} = {self.factor_to_base} {self.item.base_unit}"


class StockLocation(BranchOwnedModel):
    """Physical stock storage location within a branch."""

    name = models.CharField(max_length=120)
    location_type = models.CharField(
        max_length=20,
        choices=StockLocationType.choices,
        default=StockLocationType.STORE,
    )
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_default", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "name"],
                name="unique_branch_stock_location_name",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.location_type})"


class StockLevel(BranchOwnedModel):
    """Cached stock total per (branch, location, item), rebuildable from StockMovement."""

    location = models.ForeignKey(
        StockLocation,
        on_delete=models.PROTECT,
        related_name="stock_levels",
    )
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="stock_levels",
    )
    quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0.000"),
    )
    weighted_avg_cost_paise = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["item__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "location", "item"],
                name="unique_branch_location_item_level",
            )
        ]

    def __str__(self) -> str:
        return f"{self.item.name} @ {self.location.name}: {self.quantity}"


class StockBatch(BranchOwnedModel):
    """Optional batch/expiry tracking for perishable stock."""

    location = models.ForeignKey(
        StockLocation,
        on_delete=models.PROTECT,
        related_name="batches",
    )
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="batches",
    )
    batch_number = models.CharField(max_length=100, blank=True, default="")
    expiry_date = models.DateField(null=True, blank=True, db_index=True)
    quantity_remaining = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0.000"),
    )
    unit_cost_paise = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["expiry_date", "created_at"]

    def __str__(self) -> str:
        return f"{self.item.name} batch {self.batch_number or self.id}"


class StockMovementQuerySet(TenantQuerySet):
    """Enforces append-only immutability at the QuerySet level."""

    def update(self, **kwargs: Any) -> int:
        raise PermissionError("StockMovement records are append-only and cannot be updated.")

    def delete(self) -> tuple[int, dict[str, int]]:
        raise PermissionError("StockMovement records are append-only and cannot be deleted.")


class StockMovementManager(TenantManager):
    def get_queryset(self) -> TenantQuerySet:
        qs = StockMovementQuerySet(self.model, using=self._db)
        from apps.core.context import get_current_tenant

        tenant = get_current_tenant()
        if tenant is None:
            return qs.none()
        return qs.filter(tenant=tenant)


class StockMovement(BranchOwnedModel):
    """Strictly append-only stock movement record (never updated or deleted)."""

    location = models.ForeignKey(
        StockLocation,
        on_delete=models.PROTECT,
        related_name="movements",
    )
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="movements",
    )
    batch = models.ForeignKey(
        StockBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="movements",
    )
    movement_type = models.CharField(
        max_length=30,
        choices=StockMovementType.choices,
        db_index=True,
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    unit_cost_paise = models.BigIntegerField(default=0)
    value_paise = models.BigIntegerField(default=0)
    reference_type = models.CharField(max_length=50, blank=True, default="")
    reference_id = models.CharField(max_length=100, blank=True, default="", db_index=True)
    reason_code = models.CharField(max_length=50, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )
    sequence_number = models.PositiveBigIntegerField()

    objects: ClassVar[Any] = StockMovementManager()
    unscoped: ClassVar[Any] = StockMovementQuerySet.as_manager()

    class Meta:
        ordering = ["-sequence_number", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["branch", "sequence_number"],
                name="unique_branch_movement_sequence",
            )
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise PermissionError("StockMovement records are append-only and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise PermissionError("StockMovement records are append-only and cannot be deleted.")

    def __str__(self) -> str:
        return f"#{self.sequence_number} {self.movement_type} {self.item.name} ({self.quantity})"


class SupplierItem(TenantOwnedModel):
    """Supplier-specific catalog entry for an inventory item."""

    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.CASCADE,
        related_name="supplier_items",
    )
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        related_name="supplier_items",
    )
    supplier_sku = models.CharField(max_length=80, blank=True, default="")
    purchase_unit = models.CharField(max_length=40, blank=True, default="")
    last_unit_cost_paise = models.BigIntegerField(default=0)
    lead_time_days = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["supplier", "item"],
                name="unique_supplier_inventory_item",
            )
        ]


class PurchaseOrder(TenantOwnedModel):
    """Supplier purchase order header."""

    branch = models.ForeignKey(
        "tenants.Branch",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="purchase_orders",
    )
    order_number = models.CharField(max_length=50, db_index=True)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_orders",
    )
    status = models.CharField(
        max_length=20,
        choices=PurchaseOrderStatus.choices,
        default=PurchaseOrderStatus.DRAFT,
    )
    total_cost_paise = models.BigIntegerField(default=0)
    notes = models.TextField(blank=True, default="")
    received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "order_number"],
                name="unique_tenant_po_number",
            )
        ]


class PurchaseOrderLine(TenantOwnedModel):
    """Line item inside a PurchaseOrder."""

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="purchase_order_lines",
    )
    quantity_ordered = models.DecimalField(max_digits=14, decimal_places=3)
    quantity_received = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0.000"),
    )
    unit_name = models.CharField(max_length=40, blank=True, default="")
    unit_cost_paise = models.BigIntegerField(default=0)
    line_total_paise = models.BigIntegerField(default=0)

    class Meta:
        ordering = ["id"]


class GoodsReceipt(BranchOwnedModel):
    """Inward stock receipt (no tax fields)."""

    location = models.ForeignKey(
        StockLocation,
        on_delete=models.PROTECT,
        related_name="goods_receipts",
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goods_receipts",
    )
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goods_receipts",
    )
    supplier_invoice_number = models.CharField(
        max_length=120, blank=True, default="", db_index=True
    )
    total_paid_paise = models.BigIntegerField(default=0)
    notes = models.TextField(blank=True, default="")
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="goods_receipts",
    )
    received_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-received_at", "-created_at"]


class GoodsReceiptLine(TenantOwnedModel):
    """Line item inside a GoodsReceipt."""

    receipt = models.ForeignKey(
        GoodsReceipt,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="goods_receipt_lines",
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=3)
    unit_name = models.CharField(max_length=40, blank=True, default="")
    base_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    unit_cost_paise = models.BigIntegerField(default=0)
    line_total_paise = models.BigIntegerField(default=0)
    batch_number = models.CharField(max_length=100, blank=True, default="")
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["id"]


class Recipe(TenantOwnedModel):
    """Recipe linking a MenuItem (and optional variant) or a PREPARED output item to ingredients."""

    menu_item = models.ForeignKey(
        "menu.MenuItem",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="recipes",
    )
    variant = models.ForeignKey(
        "menu.ItemVariant",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="recipes",
    )
    output_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="output_recipes",
    )
    yield_portions = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal("1.000"),
    )
    version = models.PositiveIntegerField(default=1)
    preparation_instructions = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "menu_item", "variant"],
                condition=Q(menu_item__isnull=False, variant__isnull=False),
                name="unique_tenant_menu_item_variant_recipe",
            ),
            models.UniqueConstraint(
                fields=["tenant", "menu_item"],
                condition=Q(menu_item__isnull=False, variant__isnull=True),
                name="unique_tenant_menu_item_base_recipe",
            ),
            models.UniqueConstraint(
                fields=["tenant", "output_item"],
                condition=Q(output_item__isnull=False),
                name="unique_tenant_prepared_output_recipe",
            ),
            models.CheckConstraint(
                condition=Q(yield_portions__gt=Decimal("0")),
                name="recipe_yield_portions_positive",
            ),
        ]

    def __str__(self) -> str:
        if self.menu_item:
            v_suffix = f" ({self.variant.name})" if self.variant else ""
            return f"Recipe: {self.menu_item.name}{v_suffix}"
        if self.output_item:
            return f"Prepared Recipe: {self.output_item.name}"
        return f"Recipe {self.id}"


class RecipeLine(TenantOwnedModel):
    """Ingredient line inside a Recipe (quantity per portion + waste percent)."""

    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="recipe_lines",
    )
    quantity_per_portion = models.DecimalField(max_digits=14, decimal_places=3)
    waste_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["recipe", "item"],
                name="unique_recipe_line_item",
            ),
            models.CheckConstraint(
                condition=Q(quantity_per_portion__gt=Decimal("0")),
                name="recipe_line_qty_positive",
            ),
            models.CheckConstraint(
                condition=Q(waste_percent__gte=Decimal("0")) & Q(waste_percent__lt=Decimal("100")),
                name="recipe_line_waste_pct_range",
            ),
        ]


class ProductionRun(BranchOwnedModel):
    """Production run turning ingredients into a PREPARED item."""

    location = models.ForeignKey(
        StockLocation,
        on_delete=models.PROTECT,
        related_name="production_runs",
    )
    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.PROTECT,
        related_name="production_runs",
    )
    output_item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="production_runs",
    )
    batch_multiplier = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=Decimal("1.000"),
    )
    output_quantity = models.DecimalField(max_digits=14, decimal_places=3)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="production_runs",
    )
    notes = models.TextField(blank=True, default="")
    completed_at = models.DateTimeField(default=timezone.now)


class StockCount(BranchOwnedModel):
    """Physical stock count header (DRAFT -> SUBMITTED -> APPROVED)."""

    location = models.ForeignKey(
        StockLocation,
        on_delete=models.PROTECT,
        related_name="stock_counts",
    )
    count_type = models.CharField(
        max_length=20,
        choices=StockCountType.choices,
        default=StockCountType.FULL,
    )
    category_filter = models.CharField(max_length=30, blank=True, default="")
    is_blind = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20,
        choices=StockCountStatus.choices,
        default=StockCountStatus.DRAFT,
    )
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_stock_counts",
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_stock_counts",
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class StockCountLine(TenantOwnedModel):
    """Line item inside a StockCount."""

    stock_count = models.ForeignKey(
        StockCount,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="stock_count_lines",
    )
    expected_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0.000"),
    )
    counted_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    variance_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=Decimal("0.000"),
    )
    variance_value_paise = models.BigIntegerField(default=0)
    reason = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["stock_count", "item"],
                name="unique_stock_count_line_item",
            )
        ]


class StockTransfer(TenantOwnedModel):
    """Transfer of stock between locations or branches."""

    from_branch = models.ForeignKey(
        "tenants.Branch",
        on_delete=models.PROTECT,
        related_name="outgoing_transfers",
    )
    from_location = models.ForeignKey(
        StockLocation,
        on_delete=models.PROTECT,
        related_name="outgoing_transfers",
    )
    to_branch = models.ForeignKey(
        "tenants.Branch",
        on_delete=models.PROTECT,
        related_name="incoming_transfers",
    )
    to_location = models.ForeignKey(
        StockLocation,
        on_delete=models.PROTECT,
        related_name="incoming_transfers",
    )
    status = models.CharField(
        max_length=20,
        choices=StockTransferStatus.choices,
        default=StockTransferStatus.DRAFT,
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="requested_transfers",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_transfers",
    )
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]


class StockTransferLine(TenantOwnedModel):
    """Line item inside a StockTransfer."""

    transfer = models.ForeignKey(
        StockTransfer,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    item = models.ForeignKey(
        InventoryItem,
        on_delete=models.PROTECT,
        related_name="transfer_lines",
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=3)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(quantity__gt=Decimal("0")),
                name="stock_transfer_line_qty_positive",
            )
        ]


class OrderLineStockDeduction(BranchOwnedModel):
    """Idempotent record of stock deduction for a single OrderItem (unique per order_line)."""

    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="stock_deductions",
    )
    order_line = models.OneToOneField(
        "orders.OrderItem",
        on_delete=models.CASCADE,
        related_name="stock_deduction",
    )
    status = models.CharField(
        max_length=25,
        choices=DeductionStatus.choices,
        default=DeductionStatus.PENDING,
        db_index=True,
    )
    recipe_snapshot = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True, default="")
    attempts = models.PositiveIntegerField(default=0)
    deducted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class InventorySettings(TenantOwnedModel):
    """Per-branch inventory mode and operational thresholds."""

    branch = models.OneToOneField(
        "tenants.Branch",
        on_delete=models.CASCADE,
        related_name="inventory_settings",
    )
    mode = models.CharField(
        max_length=20,
        choices=InventoryMode.choices,
        default=InventoryMode.STANDARD,
    )
    auto_sold_out = models.BooleanField(default=False)
    adjustment_approval_threshold_paise = models.BigIntegerField(default=50000)
    target_margin_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("65.00"),
    )
    price_jump_alert_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("15.00"),
    )
    expiry_alert_days = models.PositiveIntegerField(default=7)

    class Meta:
        verbose_name_plural = "Inventory settings"

    def __str__(self) -> str:
        return f"InventorySettings({self.branch.name}: {self.mode})"
