from decimal import Decimal

from rest_framework import serializers

from apps.inventory.models import (
    Ingredient,
    PurchaseOrder,
    PurchaseOrderItem,
    Recipe,
    RecipeItem,
    StockTransaction,
    Supplier,
    WastageLog,
)


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "contact_person",
            "phone",
            "email",
            "address",
            "gstin",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class IngredientSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)
    stock_value_paise = serializers.IntegerField(read_only=True)

    class Meta:
        model = Ingredient
        fields = [
            "id",
            "name",
            "name_ta",
            "sku",
            "category",
            "unit",
            "cost_paise",
            "current_stock",
            "min_threshold",
            "is_active",
            "is_low_stock",
            "stock_value_paise",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_low_stock", "stock_value_paise", "created_at", "updated_at"]


class RecipeItemSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    ingredient_unit = serializers.CharField(source="ingredient.unit", read_only=True)
    ingredient_cost_paise = serializers.IntegerField(source="ingredient.cost_paise", read_only=True)
    calculated_cost_paise = serializers.IntegerField(read_only=True)

    class Meta:
        model = RecipeItem
        fields = [
            "id",
            "ingredient",
            "ingredient_name",
            "ingredient_unit",
            "ingredient_cost_paise",
            "quantity",
            "calculated_cost_paise",
        ]
        read_only_fields = [
            "id",
            "ingredient_name",
            "ingredient_unit",
            "ingredient_cost_paise",
            "calculated_cost_paise",
        ]


class RecipeSerializer(serializers.ModelSerializer):
    items = RecipeItemSerializer(many=True, required=False)
    menu_item_name = serializers.CharField(source="menu_item.name", read_only=True)
    menu_item_price_paise = serializers.IntegerField(
        source="menu_item.base_price_paise", read_only=True
    )
    total_cost_paise = serializers.IntegerField(read_only=True)

    class Meta:
        model = Recipe
        fields = [
            "id",
            "menu_item",
            "menu_item_name",
            "menu_item_price_paise",
            "yield_servings",
            "preparation_instructions",
            "total_cost_paise",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "menu_item_name",
            "menu_item_price_paise",
            "total_cost_paise",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items", None)
        request = self.context.get("request")
        if items_data is None and request and hasattr(request, "data"):
            items_data = request.data.get("items", [])
        items_data = items_data or []
        recipe = Recipe.objects.create(**validated_data)
        for item_data in items_data:
            ing = item_data.get("ingredient")
            ing_id = getattr(ing, "id", ing)
            RecipeItem.objects.create(
                tenant=recipe.tenant,
                recipe=recipe,
                ingredient_id=ing_id,
                quantity=Decimal(str(item_data["quantity"])),
            )
        return recipe

    def update(self, instance, validated_data):
        items_data = validated_data.pop("items", None)
        request = self.context.get("request")
        if items_data is None and request and hasattr(request, "data") and "items" in request.data:
            items_data = request.data.get("items", [])
        instance.yield_servings = validated_data.get("yield_servings", instance.yield_servings)
        instance.preparation_instructions = validated_data.get(
            "preparation_instructions", instance.preparation_instructions
        )
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                ing = item_data.get("ingredient")
                ing_id = getattr(ing, "id", ing)
                RecipeItem.objects.create(
                    tenant=instance.tenant,
                    recipe=instance,
                    ingredient_id=ing_id,
                    quantity=Decimal(str(item_data["quantity"])),
                )
        return instance


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    ingredient_unit = serializers.CharField(source="ingredient.unit", read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = [
            "id",
            "ingredient",
            "ingredient_name",
            "ingredient_unit",
            "quantity",
            "unit_price_paise",
            "subtotal_paise",
            "batch_number",
            "expiry_date",
        ]
        read_only_fields = ["id", "ingredient_name", "ingredient_unit"]


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, required=False)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    order_number = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "order_number",
            "supplier",
            "supplier_name",
            "status",
            "invoice_number",
            "total_cost_paise",
            "notes",
            "received_at",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "supplier_name",
            "status",
            "received_at",
            "created_at",
            "updated_at",
        ]

    def create(self, validated_data):
        items_data = validated_data.pop("items", None)
        request = self.context.get("request")
        if not validated_data.get("order_number"):
            from django.utils import timezone

            year = timezone.now().year
            tenant = validated_data.get("tenant") or (
                getattr(request, "tenant", None) if request else None
            )
            count = PurchaseOrder.objects.filter(tenant=tenant).count() + 1
            validated_data["order_number"] = f"PO-{year}-{count:04d}"
        if items_data is None and request and hasattr(request, "data"):
            items_data = request.data.get("items", [])
        items_data = items_data or []
        total = 0
        po = PurchaseOrder.objects.create(**validated_data)
        for item_data in items_data:
            qty = Decimal(str(item_data["quantity"]))
            unit_price = int(item_data.get("unit_price_paise", 0))
            subtotal = int(qty * unit_price)
            total += subtotal
            ing = item_data.get("ingredient")
            ing_id = getattr(ing, "id", ing)
            PurchaseOrderItem.objects.create(
                tenant=po.tenant,
                purchase_order=po,
                ingredient_id=ing_id,
                quantity=qty,
                unit_price_paise=unit_price,
                subtotal_paise=subtotal,
                batch_number=item_data.get("batch_number", ""),
                expiry_date=item_data.get("expiry_date", None),
            )
        po.total_cost_paise = total
        po.save(update_fields=["total_cost_paise"])
        return po


class WastageLogSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    ingredient_unit = serializers.CharField(source="ingredient.unit", read_only=True)
    logged_by_name = serializers.CharField(source="logged_by.get_full_name", read_only=True)

    class Meta:
        model = WastageLog
        fields = [
            "id",
            "ingredient",
            "ingredient_name",
            "ingredient_unit",
            "quantity",
            "reason",
            "cost_loss_paise",
            "notes",
            "logged_by",
            "logged_by_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "ingredient_name",
            "ingredient_unit",
            "cost_loss_paise",
            "logged_by",
            "logged_by_name",
            "created_at",
        ]


class StockTransactionSerializer(serializers.ModelSerializer):
    ingredient_name = serializers.CharField(source="ingredient.name", read_only=True)
    ingredient_unit = serializers.CharField(source="ingredient.unit", read_only=True)

    class Meta:
        model = StockTransaction
        fields = [
            "id",
            "ingredient",
            "ingredient_name",
            "ingredient_unit",
            "transaction_type",
            "quantity_change",
            "balance_after",
            "reference_id",
            "notes",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "ingredient_name",
            "ingredient_unit",
            "balance_after",
            "created_at",
        ]


class StockAdjustmentSerializer(serializers.Serializer):
    ingredient_id = serializers.UUIDField()
    new_stock = serializers.DecimalField(max_digits=12, decimal_places=3)
    notes = serializers.CharField(required=False, default="Manual Stock Reconciliation")
