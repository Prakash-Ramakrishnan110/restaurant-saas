from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.models import TenantOwnedModel
from apps.inventory.constants import (
    IngredientCategory,
    PurchaseOrderStatus,
    StockTransactionType,
    UnitOfMeasure,
    WastageReason,
)


class Supplier(TenantOwnedModel):
    """Vendor / Supplier providing raw goods and ingredients."""

    name = models.CharField(max_length=200)
    contact_person = models.CharField(max_length=150, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    address = models.TextField(blank=True, default="")
    gstin = models.CharField(max_length=50, blank=True, default="")
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


class Ingredient(TenantOwnedModel):
    """Raw material, stock item or packaging element tracked for inventory."""

    name = models.CharField(max_length=200)
    name_ta = models.CharField(max_length=200, blank=True, default="")
    sku = models.CharField(max_length=50, blank=True, default="")
    category = models.CharField(
        max_length=30,
        choices=IngredientCategory.choices,
        default=IngredientCategory.OTHER,
    )
    unit = models.CharField(
        max_length=20,
        choices=UnitOfMeasure.choices,
        default=UnitOfMeasure.KG,
    )
    cost_paise = models.BigIntegerField(
        default=0,
        help_text="Standard or weighted average cost per unit in integer paise",
    )
    current_stock = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal("0.000"),
    )
    min_threshold = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=Decimal("0.000"),
        help_text="Threshold below which low-stock replenishment alert is triggered",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "name"],
                name="unique_tenant_ingredient_name",
            )
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.current_stock} {self.unit})"

    @property
    def is_low_stock(self) -> bool:
        return self.current_stock <= self.min_threshold

    @property
    def stock_value_paise(self) -> int:
        return int(self.current_stock * Decimal(self.cost_paise))


class Recipe(TenantOwnedModel):
    """Bill of Materials / Formulation linking a MenuItem to its constituent ingredients."""

    menu_item = models.ForeignKey(
        "menu.MenuItem",
        on_delete=models.CASCADE,
        related_name="recipes",
    )
    yield_servings = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        default=Decimal("1.00"),
        help_text="Number of servings produced by this recipe batch (default 1.0)",
    )
    preparation_instructions = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["menu_item__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "menu_item"],
                name="unique_tenant_menu_item_recipe",
            )
        ]

    def __str__(self) -> str:
        return f"Recipe: {self.menu_item.name}"

    @property
    def total_cost_paise(self) -> int:
        return sum(item.calculated_cost_paise for item in self.items.all())


class RecipeItem(TenantOwnedModel):
    """Ingredient component required for a recipe."""

    recipe = models.ForeignKey(
        Recipe,
        on_delete=models.CASCADE,
        related_name="items",
    )
    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.PROTECT,
        related_name="recipe_items",
    )
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        help_text="Quantity of ingredient in ingredient's base unit required per recipe batch",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["recipe", "ingredient"],
                name="unique_recipe_ingredient",
            )
        ]

    def __str__(self) -> str:
        return f"{self.quantity} {self.ingredient.unit} of {self.ingredient.name}"

    @property
    def calculated_cost_paise(self) -> int:
        return int(self.quantity * Decimal(self.ingredient.cost_paise))


class PurchaseOrder(TenantOwnedModel):
    """Inward stock acquisition / PO from vendor."""

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
    invoice_number = models.CharField(max_length=100, blank=True, default="")
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

    def __str__(self) -> str:
        return f"PO #{self.order_number} ({self.status})"


class PurchaseOrderItem(TenantOwnedModel):
    """Line item in a Purchase Order."""

    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.PROTECT,
        related_name="purchase_items",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price_paise = models.BigIntegerField(default=0)
    subtotal_paise = models.BigIntegerField(default=0)
    batch_number = models.CharField(max_length=100, blank=True, default="")
    expiry_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.quantity} {self.ingredient.unit} {self.ingredient.name} @ {self.unit_price_paise}p"


class WastageLog(TenantOwnedModel):
    """Record of damaged, expired, burnt or spilled inventory stock."""

    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.CASCADE,
        related_name="wastage_logs",
    )
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    reason = models.CharField(
        max_length=30,
        choices=WastageReason.choices,
        default=WastageReason.SPOILED,
    )
    cost_loss_paise = models.BigIntegerField(
        default=0,
        help_text="Total calculated monetary loss in integer paise",
    )
    notes = models.TextField(blank=True, default="")
    logged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logged_wastages",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Wastage: {self.quantity} {self.ingredient.unit} of {self.ingredient.name} ({self.reason})"


class StockTransaction(TenantOwnedModel):
    """Audit ledger entry for every physical stock modification."""

    ingredient = models.ForeignKey(
        Ingredient,
        on_delete=models.CASCADE,
        related_name="stock_transactions",
    )
    transaction_type = models.CharField(
        max_length=30,
        choices=StockTransactionType.choices,
    )
    quantity_change = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        help_text="Positive for inward receipts, negative for outward usage/waste",
    )
    balance_after = models.DecimalField(max_digits=12, decimal_places=3)
    reference_id = models.CharField(max_length=100, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.transaction_type} {self.ingredient.name}: {self.quantity_change} -> {self.balance_after}"
