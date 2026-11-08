from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.inventory.constants import (
    PurchaseOrderStatus,
    StockTransactionType,
    WastageReason,
)
from apps.inventory.models import (
    Ingredient,
    PurchaseOrder,
    Recipe,
    StockTransaction,
    WastageLog,
)
from apps.orders.models import BillInvoice, Order
from apps.tenants.models import Tenant


@transaction.atomic
def record_stock_transaction(
    *,
    ingredient: Ingredient,
    transaction_type: str,
    quantity_change: Decimal,
    reference_id: str = "",
    notes: str = "",
) -> StockTransaction:
    """Updates physical ingredient stock level atomically and creates an audit transaction."""
    ingredient.current_stock = F("current_stock") + quantity_change
    ingredient.save(update_fields=["current_stock", "updated_at"])
    ingredient.refresh_from_db(fields=["current_stock"])

    tx = StockTransaction.objects.create(
        tenant=ingredient.tenant,
        ingredient=ingredient,
        transaction_type=transaction_type,
        quantity_change=quantity_change,
        balance_after=ingredient.current_stock,
        reference_id=reference_id,
        notes=notes,
    )
    return tx


@transaction.atomic
def record_wastage(
    *,
    ingredient: Ingredient,
    quantity: Decimal,
    reason: str = WastageReason.SPOILED,
    notes: str = "",
    logged_by: Any = None,
) -> WastageLog:
    """Deducts wasted/spoiled stock and logs financial loss in pure integer paise."""
    if quantity <= 0:
        raise ValidationError({"quantity": "Wastage quantity must be strictly greater than zero."})

    cost_loss_paise = int(quantity * Decimal(ingredient.cost_paise))

    # Log physical depletion transaction
    record_stock_transaction(
        ingredient=ingredient,
        transaction_type=StockTransactionType.WASTAGE,
        quantity_change=-quantity,
        reference_id=f"WASTAGE-{timezone.now().strftime('%Y%m%d%H%M%S')}",
        notes=f"Waste write-off: {reason}. {notes}".strip(),
    )

    wastage_log = WastageLog.objects.create(
        tenant=ingredient.tenant,
        ingredient=ingredient,
        quantity=quantity,
        reason=reason,
        cost_loss_paise=cost_loss_paise,
        notes=notes,
        logged_by=logged_by if (logged_by and logged_by.is_authenticated) else None,
    )
    return wastage_log


@transaction.atomic
def receive_purchase_order(purchase_order: PurchaseOrder) -> PurchaseOrder:
    """Receives a draft purchase order, increases ingredient stock, and recalculates weighted average unit cost."""
    if purchase_order.status != PurchaseOrderStatus.DRAFT:
        raise ValidationError(
            {
                "status": f"Only DRAFT purchase orders can be received (current: {purchase_order.status})."
            }
        )

    for item in purchase_order.items.select_related("ingredient"):
        ing = item.ingredient
        current_stock = ing.current_stock
        po_qty = item.quantity

        # Calculate weighted average unit cost if stock is positive
        if (current_stock + po_qty) > 0:
            total_val = (current_stock * Decimal(ing.cost_paise)) + (
                po_qty * Decimal(item.unit_price_paise)
            )
            ing.cost_paise = int(total_val / (current_stock + po_qty))
            ing.save(update_fields=["cost_paise"])

        # Inward stock addition
        record_stock_transaction(
            ingredient=ing,
            transaction_type=StockTransactionType.INWARD_PURCHASE,
            quantity_change=po_qty,
            reference_id=f"PO-{purchase_order.order_number}",
            notes=f"Batch: {item.batch_number or 'N/A'}",
        )

    purchase_order.status = PurchaseOrderStatus.RECEIVED
    purchase_order.received_at = timezone.now()
    purchase_order.save(update_fields=["status", "received_at", "updated_at"])
    return purchase_order


@transaction.atomic
def deplete_stock_for_order(order: Order) -> int:
    """Depletes raw ingredients based on recipe definitions for items in the order ticket.

    Returns the number of ingredient items depleted.
    """
    depleted_count = 0
    # Fetch all recipes for menu items in this order
    menu_item_ids = [item.menu_item_id for item in order.items.all()]
    recipes = {
        r.menu_item_id: r
        for r in Recipe.objects.filter(
            tenant=order.tenant, menu_item_id__in=menu_item_ids
        ).prefetch_related("items__ingredient")
    }

    for order_item in order.items.all():
        recipe = recipes.get(order_item.menu_item_id)
        if not recipe or recipe.yield_servings <= 0:
            continue

        portion_factor = Decimal(str(order_item.quantity)) / recipe.yield_servings
        for recipe_item in recipe.items.all():
            deduct_qty = recipe_item.quantity * portion_factor
            record_stock_transaction(
                ingredient=recipe_item.ingredient,
                transaction_type=StockTransactionType.OUTWARD_SALE,
                quantity_change=-deduct_qty,
                reference_id=str(order.id),
                notes=f"Order #{order.order_number} ({order_item.item_name} x{order_item.quantity})",
            )
            depleted_count += 1

    return depleted_count


def get_low_stock_alerts(tenant: Tenant) -> list[dict[str, Any]]:
    """Retrieves all ingredients where current stock is at or below the minimum alert threshold."""
    low_ingredients = Ingredient.objects.filter(
        tenant=tenant,
        is_active=True,
        current_stock__lte=F("min_threshold"),
    ).order_by("category", "name")

    alerts = []
    for ing in low_ingredients:
        current = float(ing.current_stock)
        threshold = float(ing.min_threshold)
        deficit = max(0.0, threshold - current)
        recommended_reorder = deficit + (threshold * 0.5)  # 50% buffer over threshold

        alerts.append(
            {
                "ingredient_id": str(ing.id),
                "ingredient_name": ing.name,
                "ingredient_name_ta": ing.name_ta,
                "category": ing.category,
                "unit": ing.unit,
                "current_stock": current,
                "min_threshold": threshold,
                "deficit": deficit,
                "recommended_reorder_qty": round(recommended_reorder, 3),
                "cost_paise": ing.cost_paise,
                "estimated_reorder_cost_paise": int(recommended_reorder * ing.cost_paise),
            }
        )
    return alerts


def get_inventory_variance_report(
    tenant: Tenant,
    start_date: Any = None,
    end_date: Any = None,
) -> dict[str, Any]:
    """Generates food cost variance report comparing theoretical recipe consumption vs actual usage & wastage."""
    tx_qs = StockTransaction.objects.filter(tenant=tenant)
    wastage_qs = WastageLog.objects.filter(tenant=tenant)
    invoice_qs = BillInvoice.objects.filter(tenant=tenant, is_settled=True)

    if start_date:
        tx_qs = tx_qs.filter(created_at__gte=start_date)
        wastage_qs = wastage_qs.filter(created_at__gte=start_date)
        invoice_qs = invoice_qs.filter(created_at__gte=start_date)
    if end_date:
        tx_qs = tx_qs.filter(created_at__lte=end_date)
        wastage_qs = wastage_qs.filter(created_at__lte=end_date)
        invoice_qs = invoice_qs.filter(created_at__lte=end_date)

    # 1. Total Food Sales Revenue (paise)
    total_sales_paise = invoice_qs.aggregate(total=Sum("total_paise"))["total"] or 0

    # 2. Total Wastage Loss (paise)
    total_wastage_loss_paise = wastage_qs.aggregate(total=Sum("cost_loss_paise"))["total"] or 0

    # 3. Theoretical Cost of Goods Sold (COGS) from recipe outward sales
    theoretical_sales_txs = tx_qs.filter(
        transaction_type=StockTransactionType.OUTWARD_SALE
    ).select_related("ingredient")

    theoretical_cogs_paise = sum(
        int(abs(tx.quantity_change) * Decimal(tx.ingredient.cost_paise))
        for tx in theoretical_sales_txs
    )

    # 4. Total Inward Purchases during period
    inward_txs = tx_qs.filter(transaction_type=StockTransactionType.INWARD_PURCHASE).select_related(
        "ingredient"
    )
    total_purchases_paise = sum(
        int(tx.quantity_change * Decimal(tx.ingredient.cost_paise)) for tx in inward_txs
    )

    # Food cost % = (Theoretical COGS + Wastage) / Total Sales * 100
    effective_cogs_paise = theoretical_cogs_paise + total_wastage_loss_paise
    food_cost_percentage = (
        round((effective_cogs_paise / total_sales_paise) * 100, 2) if total_sales_paise > 0 else 0.0
    )

    # 5. Ingredient usage summary
    ingredients = Ingredient.objects.filter(tenant=tenant, is_active=True)
    items_breakdown = []
    for ing in ingredients:
        ing_txs = tx_qs.filter(ingredient=ing)
        depleted_qty = abs(
            sum(
                tx.quantity_change
                for tx in ing_txs.filter(transaction_type=StockTransactionType.OUTWARD_SALE)
            )
        )
        wasted_qty = abs(
            sum(
                tx.quantity_change
                for tx in ing_txs.filter(transaction_type=StockTransactionType.WASTAGE)
            )
        )
        inward_qty = sum(
            tx.quantity_change
            for tx in ing_txs.filter(transaction_type=StockTransactionType.INWARD_PURCHASE)
        )

        items_breakdown.append(
            {
                "ingredient_id": str(ing.id),
                "name": ing.name,
                "category": ing.category,
                "unit": ing.unit,
                "cost_paise": ing.cost_paise,
                "current_stock": float(ing.current_stock),
                "inward_purchased_qty": float(inward_qty),
                "theoretical_used_qty": float(depleted_qty),
                "wasted_qty": float(wasted_qty),
                "theoretical_cost_paise": int(depleted_qty * Decimal(ing.cost_paise)),
                "wastage_cost_paise": int(wasted_qty * Decimal(ing.cost_paise)),
                "stock_value_paise": ing.stock_value_paise,
                "is_low_stock": ing.is_low_stock,
            }
        )

    return {
        "total_food_sales_paise": total_sales_paise,
        "theoretical_cogs_paise": theoretical_cogs_paise,
        "total_wastage_loss_paise": total_wastage_loss_paise,
        "total_purchases_paise": total_purchases_paise,
        "effective_cogs_paise": effective_cogs_paise,
        "food_cost_percentage": food_cost_percentage,
        "ingredients_breakdown": items_breakdown,
    }
