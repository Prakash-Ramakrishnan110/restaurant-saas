from __future__ import annotations

from decimal import Decimal
from typing import Any

from rest_framework import serializers

from apps.inventory.models import (
    GoodsReceipt,
    GoodsReceiptLine,
    InventoryItem,
    InventorySettings,
    OrderLineStockDeduction,
    PurchaseOrder,
    PurchaseOrderLine,
    Recipe,
    RecipeLine,
    StockCount,
    StockCountLine,
    StockLevel,
    StockLocation,
    StockMovement,
    Supplier,
    UnitConversion,
)
from apps.inventory.services import compute_recipe_cost_paise, round_paise

COST_FIELDS = {
    "weighted_avg_cost_paise",
    "unit_cost_paise",
    "value_paise",
    "stock_value_paise",
    "total_paid_paise",
    "line_total_paise",
    "total_cost_paise",
    "cost_per_portion_paise",
    "margin_percent",
    "variance_value_paise",
    "last_unit_cost_paise",
    "adjustment_approval_threshold_paise",
}


class CostAwareModelSerializer(serializers.ModelSerializer):
    """Omits all cost/value/margin fields completely when caller lacks inventory.costs."""

    def to_representation(self, instance: Any) -> dict[str, Any]:
        data: dict[str, Any] = super().to_representation(instance)
        if not self.context.get("include_costs", False):
            for field_name in list(data.keys()):
                if field_name in COST_FIELDS:
                    data.pop(field_name, None)
        return data


class SupplierSerializer(CostAwareModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "contact_person",
            "phone",
            "email",
            "address",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class UnitConversionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitConversion
        fields = ["id", "item", "unit_name", "factor_to_base"]
        read_only_fields = ["id"]


class StockLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockLocation
        fields = ["id", "branch", "name", "location_type", "is_default", "is_active"]
        read_only_fields = ["id"]


class InventoryItemSerializer(CostAwareModelSerializer):
    unit_conversions = UnitConversionSerializer(many=True, read_only=True)
    current_quantity = serializers.SerializerMethodField()
    weighted_avg_cost_paise = serializers.SerializerMethodField()
    stock_value_paise = serializers.SerializerMethodField()
    is_low_stock = serializers.SerializerMethodField()
    is_negative_stock = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = [
            "id",
            "name",
            "name_ta",
            "item_type",
            "base_unit",
            "category",
            "barcode",
            "is_active",
            "track_expiry",
            "shelf_life_days",
            "reorder_level",
            "par_level",
            "default_supplier",
            "packaging_mode",
            "packaging_quantity",
            "unit_conversions",
            "current_quantity",
            "weighted_avg_cost_paise",
            "stock_value_paise",
            "is_low_stock",
            "is_negative_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def _qty(self, obj: InventoryItem) -> Decimal:
        annotated = getattr(obj, "annotated_quantity", None)
        if annotated is not None:
            return Decimal(annotated)
        return Decimal("0.000")

    def _wac(self, obj: InventoryItem) -> int:
        annotated = getattr(obj, "annotated_wac", None)
        return int(annotated) if annotated is not None else 0

    def get_current_quantity(self, obj: InventoryItem) -> str:
        return str(self._qty(obj).quantize(Decimal("0.001")))

    def get_weighted_avg_cost_paise(self, obj: InventoryItem) -> int:
        return self._wac(obj)

    def get_stock_value_paise(self, obj: InventoryItem) -> int:
        return round_paise(self._qty(obj) * Decimal(self._wac(obj)))

    def get_is_low_stock(self, obj: InventoryItem) -> bool:
        qty = self._qty(obj)
        return qty < Decimal("0") or (obj.reorder_level > Decimal("0") and qty <= obj.reorder_level)

    def get_is_negative_stock(self, obj: InventoryItem) -> bool:
        return self._qty(obj) < Decimal("0")

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        reorder = attrs.get("reorder_level", getattr(self.instance, "reorder_level", Decimal("0")))
        par = attrs.get("par_level", getattr(self.instance, "par_level", Decimal("0")))
        if par > Decimal("0") and reorder > par:
            raise serializers.ValidationError(
                {"reorder_level": "Reorder level cannot be above par level."}
            )
        return attrs


class StockLevelSerializer(CostAwareModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_name_ta = serializers.CharField(source="item.name_ta", read_only=True)
    base_unit = serializers.CharField(source="item.base_unit", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)
    stock_value_paise = serializers.SerializerMethodField()

    class Meta:
        model = StockLevel
        fields = [
            "id",
            "branch",
            "location",
            "location_name",
            "item",
            "item_name",
            "item_name_ta",
            "base_unit",
            "quantity",
            "weighted_avg_cost_paise",
            "stock_value_paise",
            "updated_at",
        ]

    def get_stock_value_paise(self, obj: StockLevel) -> int:
        return round_paise(obj.quantity * Decimal(obj.weighted_avg_cost_paise))


class StockMovementSerializer(CostAwareModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    base_unit = serializers.CharField(source="item.base_unit", read_only=True)
    location_name = serializers.CharField(source="location.name", read_only=True)
    actor_name = serializers.CharField(source="actor.full_name", read_only=True, default="")

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "sequence_number",
            "branch",
            "location",
            "location_name",
            "item",
            "item_name",
            "base_unit",
            "movement_type",
            "quantity",
            "unit_cost_paise",
            "value_paise",
            "reference_type",
            "reference_id",
            "reason_code",
            "notes",
            "actor_name",
            "created_at",
        ]


class GoodsReceiptLineSerializer(CostAwareModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = GoodsReceiptLine
        fields = [
            "id",
            "item",
            "item_name",
            "quantity",
            "unit_name",
            "base_quantity",
            "unit_cost_paise",
            "line_total_paise",
            "batch_number",
            "expiry_date",
        ]


class GoodsReceiptSerializer(CostAwareModelSerializer):
    lines = GoodsReceiptLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default="")

    class Meta:
        model = GoodsReceipt
        fields = [
            "id",
            "branch",
            "location",
            "supplier",
            "supplier_name",
            "supplier_invoice_number",
            "total_paid_paise",
            "notes",
            "received_at",
            "lines",
        ]


class RecipeLineSerializer(CostAwareModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_name_ta = serializers.CharField(source="item.name_ta", read_only=True)
    base_unit = serializers.CharField(source="item.base_unit", read_only=True)

    class Meta:
        model = RecipeLine
        fields = [
            "id",
            "item",
            "item_name",
            "item_name_ta",
            "base_unit",
            "quantity_per_portion",
            "waste_percent",
        ]


class RecipeSerializer(CostAwareModelSerializer):
    lines = RecipeLineSerializer(many=True, read_only=True)
    menu_item_name = serializers.CharField(source="menu_item.name", read_only=True, default="")
    variant_name = serializers.CharField(source="variant.name", read_only=True, default="")
    output_item_name = serializers.CharField(source="output_item.name", read_only=True, default="")
    cost_per_portion_paise = serializers.SerializerMethodField()
    margin_percent = serializers.SerializerMethodField()

    class Meta:
        model = Recipe
        fields = [
            "id",
            "menu_item",
            "menu_item_name",
            "variant",
            "variant_name",
            "output_item",
            "output_item_name",
            "yield_portions",
            "version",
            "preparation_instructions",
            "is_active",
            "lines",
            "cost_per_portion_paise",
            "margin_percent",
            "updated_at",
        ]

    def get_cost_per_portion_paise(self, obj: Recipe) -> int:
        if not self.context.get("include_costs", False):
            return 0
        branch = self.context.get("branch")
        return compute_recipe_cost_paise(obj, branch=branch)

    def get_margin_percent(self, obj: Recipe) -> str | None:
        if not self.context.get("include_costs", False):
            return None
        if not obj.menu_item:
            return None
        sell_paise = obj.variant.price_paise if obj.variant else obj.menu_item.base_price_paise
        if not sell_paise or sell_paise <= 0:
            return None
        cost = self.get_cost_per_portion_paise(obj)
        margin = ((Decimal(sell_paise - cost) * Decimal("100")) / Decimal(sell_paise)).quantize(
            Decimal("0.1")
        )
        return str(margin)


class StockCountLineSerializer(CostAwareModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    base_unit = serializers.CharField(source="item.base_unit", read_only=True)

    class Meta:
        model = StockCountLine
        fields = [
            "id",
            "item",
            "item_name",
            "base_unit",
            "expected_quantity",
            "counted_quantity",
            "variance_quantity",
            "variance_value_paise",
            "reason",
        ]

    def to_representation(self, instance: StockCountLine) -> dict[str, Any]:
        data = super().to_representation(instance)
        # Hide expected_quantity during blind draft counts
        if instance.stock_count.is_blind and instance.stock_count.status == "DRAFT":
            data["expected_quantity"] = None
        return data


class StockCountSerializer(CostAwareModelSerializer):
    lines = StockCountLineSerializer(many=True, read_only=True)

    class Meta:
        model = StockCount
        fields = [
            "id",
            "branch",
            "location",
            "count_type",
            "category_filter",
            "is_blind",
            "status",
            "notes",
            "submitted_at",
            "approved_at",
            "created_at",
            "lines",
        ]


class PurchaseOrderLineSerializer(CostAwareModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = PurchaseOrderLine
        fields = [
            "id",
            "item",
            "item_name",
            "quantity_ordered",
            "quantity_received",
            "unit_name",
            "unit_cost_paise",
            "line_total_paise",
        ]


class PurchaseOrderSerializer(CostAwareModelSerializer):
    lines = PurchaseOrderLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default="")

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "branch",
            "order_number",
            "supplier",
            "supplier_name",
            "status",
            "total_cost_paise",
            "notes",
            "received_at",
            "created_at",
            "lines",
        ]


class InventorySettingsSerializer(CostAwareModelSerializer):
    class Meta:
        model = InventorySettings
        fields = [
            "id",
            "branch",
            "mode",
            "auto_sold_out",
            "adjustment_approval_threshold_paise",
            "target_margin_percent",
            "price_jump_alert_percent",
            "expiry_alert_days",
        ]
        read_only_fields = ["id", "branch"]


class OrderLineStockDeductionSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    item_name = serializers.CharField(source="order_line.item_name", read_only=True)

    class Meta:
        model = OrderLineStockDeduction
        fields = [
            "id",
            "branch",
            "order",
            "order_number",
            "order_line",
            "item_name",
            "status",
            "recipe_snapshot",
            "error_message",
            "attempts",
            "deducted_at",
            "created_at",
        ]
