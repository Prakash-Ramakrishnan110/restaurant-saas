from __future__ import annotations

import csv
import io
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import Max, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import log_audit_event
from apps.core.exceptions import BusinessRuleError
from apps.inventory.constants import (
    BUSINESS_TYPE_DEFAULT_MODE,
    BaseUnit,
    DeductionStatus,
    InventoryItemType,
    InventoryMode,
    PackagingMode,
    PurchaseOrderStatus,
    StockCountStatus,
    StockCountType,
    StockLocationType,
    StockMovementType,
    StockTransferStatus,
    WasteReason,
)
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
    StockBatch,
    StockCount,
    StockCountLine,
    StockLevel,
    StockLocation,
    StockMovement,
    StockTransfer,
    StockTransferLine,
    Supplier,
    SupplierItem,
    UnitConversion,
)
from apps.subscriptions.services import get_entitlement
from apps.tenants.models import Branch, Tenant

ZERO = Decimal("0.000")
HUNDRED = Decimal("100")
CSV_FORMULA_PREFIXES = ("=", "+", "-", "@")

BUILTIN_UNIT_FACTORS: dict[tuple[str, str], Decimal] = {
    ("g", "kg"): Decimal("1000"),
    ("g", "g"): Decimal("1"),
    ("ml", "l"): Decimal("1000"),
    ("ml", "ltr"): Decimal("1000"),
    ("ml", "liter"): Decimal("1000"),
    ("ml", "litre"): Decimal("1000"),
    ("ml", "ml"): Decimal("1"),
    ("piece", "piece"): Decimal("1"),
    ("piece", "pcs"): Decimal("1"),
    ("piece", "pc"): Decimal("1"),
    ("piece", "dozen"): Decimal("12"),
}


def round_paise(amount: Decimal) -> int:
    """Round a Decimal paise amount half-up to a whole integer."""
    return int(amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def sanitize_csv_cell(value: Any) -> str:
    """Neutralize spreadsheet formula injection characters (=, +, -, @)."""
    text = "" if value is None else str(value)
    if text and text[0] in CSV_FORMULA_PREFIXES:
        return "'" + text
    return text


def get_or_create_branch_settings(branch: Branch) -> InventorySettings:
    """Return branch InventorySettings, initializing default mode from business type."""
    settings_obj = InventorySettings.objects.filter(branch=branch).first()
    if settings_obj is not None:
        return settings_obj

    business_type = getattr(branch.tenant, "business_type", "RESTAURANT")
    default_mode = BUSINESS_TYPE_DEFAULT_MODE.get(business_type, InventoryMode.STANDARD)
    if default_mode == InventoryMode.ADVANCED and not bool(
        get_entitlement(branch.tenant, "inventory_advanced", False)
    ):
        default_mode = InventoryMode.STANDARD

    settings_obj, _ = InventorySettings.objects.get_or_create(
        branch=branch,
        defaults={
            "tenant": branch.tenant,
            "mode": default_mode,
        },
    )
    return settings_obj


def get_or_create_default_location(branch: Branch) -> StockLocation:
    """Return the default StockLocation for a branch, creating one if absent."""
    loc = StockLocation.objects.filter(branch=branch, is_default=True, is_active=True).first()
    if loc is not None:
        return loc
    loc = StockLocation.objects.filter(branch=branch, is_active=True).first()
    if loc is not None:
        loc.is_default = True
        loc.save(update_fields=["is_default", "updated_at"])
        return loc

    business_type = getattr(branch.tenant, "business_type", "RESTAURANT")
    loc_type = (
        StockLocationType.COUNTER
        if business_type in {"TEA_SHOP", "FOOD_COURT"}
        else StockLocationType.STORE
    )
    name = "Main Counter" if loc_type == StockLocationType.COUNTER else "Main Store"
    loc, _ = StockLocation.objects.get_or_create(
        branch=branch,
        name=name,
        defaults={
            "tenant": branch.tenant,
            "location_type": loc_type,
            "is_default": True,
            "is_active": True,
        },
    )
    return loc


def to_base_quantity(item: InventoryItem, quantity: Decimal, unit_name: str | None) -> Decimal:
    """Convert a quantity in unit_name into item.base_unit using Decimal arithmetic."""
    if not unit_name or unit_name.strip().lower() == item.base_unit.lower():
        return quantity.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

    norm = unit_name.strip().lower()
    conv = UnitConversion.objects.filter(item=item, unit_name__iexact=norm).first()
    if conv is not None:
        return (quantity * conv.factor_to_base).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

    factor = BUILTIN_UNIT_FACTORS.get((item.base_unit.lower(), norm))
    if factor is not None:
        return (quantity * factor).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)

    raise ValidationError(
        {
            "unit_name": f"Unknown unit '{unit_name}' for item '{item.name}' (base unit: {item.base_unit})."
        }
    )


def get_branch_item_wac(branch: Branch, item: InventoryItem) -> int:
    """Return weighted average cost per base unit in paise for (branch, item)."""
    lvl = (
        StockLevel.objects.filter(branch=branch, item=item)
        .order_by("-weighted_avg_cost_paise")
        .first()
    )
    return lvl.weighted_avg_cost_paise if lvl else 0


@transaction.atomic
def post_stock_movement(
    *,
    branch: Branch,
    item: InventoryItem,
    movement_type: str,
    quantity: Decimal,
    location: StockLocation | None = None,
    unit_cost_paise: int | None = None,
    reference_type: str = "",
    reference_id: str = "",
    reason_code: str = "",
    notes: str = "",
    actor: Any = None,
    batch: StockBatch | None = None,
) -> StockMovement:
    """Atomically append a StockMovement and update cached StockLevel + weighted average cost."""
    if quantity == ZERO:
        raise ValidationError({"quantity": "Movement quantity cannot be zero."})

    # Lock branch row to serialize per-branch sequence_number allocation
    Branch.objects.select_for_update().get(pk=branch.pk)

    target_location = location or get_or_create_default_location(branch)

    # Lock or create StockLevel
    level = (
        StockLevel.objects.select_for_update()
        .filter(branch=branch, location=target_location, item=item)
        .first()
    )
    if level is None:
        try:
            level = StockLevel.objects.create(
                tenant=branch.tenant,
                branch=branch,
                location=target_location,
                item=item,
                quantity=ZERO,
                weighted_avg_cost_paise=get_branch_item_wac(branch, item),
            )
        except IntegrityError:
            level = StockLevel.objects.select_for_update().get(
                branch=branch, location=target_location, item=item
            )

    current_branch_qty = (
        StockLevel.objects.filter(branch=branch, item=item).aggregate(total=Sum("quantity"))[
            "total"
        ]
        or ZERO
    )
    current_wac = level.weighted_avg_cost_paise

    effective_unit_cost = current_wac if unit_cost_paise is None else int(unit_cost_paise)
    value_paise = round_paise(quantity * Decimal(effective_unit_cost))

    # Recompute weighted average cost on PURCHASE, OPENING, or TRANSFER_IN with positive quantity
    if (
        movement_type
        in {StockMovementType.PURCHASE, StockMovementType.OPENING, StockMovementType.TRANSFER_IN}
        and quantity > ZERO
        and unit_cost_paise is not None
    ):
        if current_branch_qty > ZERO:
            total_value = (current_branch_qty * Decimal(current_wac)) + (
                quantity * Decimal(effective_unit_cost)
            )
            new_wac = round_paise(total_value / (current_branch_qty + quantity))
        else:
            new_wac = effective_unit_cost
        StockLevel.objects.filter(branch=branch, item=item).update(weighted_avg_cost_paise=new_wac)
        level.weighted_avg_cost_paise = new_wac

    level.quantity = (level.quantity + quantity).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    level.save(update_fields=["quantity", "weighted_avg_cost_paise", "updated_at"])

    max_seq = (
        StockMovement.objects.filter(branch=branch).aggregate(m=Max("sequence_number"))["m"] or 0
    )
    actor_user = (
        actor if (actor is not None and getattr(actor, "is_authenticated", False)) else None
    )

    movement = StockMovement.objects.create(
        tenant=branch.tenant,
        branch=branch,
        location=target_location,
        item=item,
        batch=batch,
        movement_type=movement_type,
        quantity=quantity.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP),
        unit_cost_paise=effective_unit_cost,
        value_paise=value_paise,
        reference_type=reference_type,
        reference_id=str(reference_id),
        reason_code=reason_code,
        notes=notes,
        actor=actor_user,
        sequence_number=max_seq + 1,
    )
    return movement


def rebuild_and_compare_stock_levels(
    *,
    tenant: Tenant | None = None,
    apply: bool = False,
) -> dict[str, Any]:
    """Recompute StockLevel totals from StockMovement and compare against cached StockLevel rows."""
    mv_qs = StockMovement.objects.all()
    lvl_qs = StockLevel.objects.all()
    if tenant is not None:
        mv_qs = mv_qs.filter(tenant=tenant)
        lvl_qs = lvl_qs.filter(tenant=tenant)

    expected_map: dict[tuple[Any, Any, Any], Decimal] = {}
    for row in mv_qs.values("branch_id", "location_id", "item_id").annotate(total=Sum("quantity")):
        key = (row["branch_id"], row["location_id"], row["item_id"])
        expected_map[key] = (row["total"] or ZERO).quantize(Decimal("0.001"))

    actual_map: dict[tuple[Any, Any, Any], StockLevel] = {}
    for lvl in lvl_qs:
        actual_map[(lvl.branch_id, lvl.location_id, lvl.item_id)] = lvl

    all_keys = set(expected_map.keys()) | set(actual_map.keys())
    mismatches: list[dict[str, Any]] = []

    for key in all_keys:
        exp_qty = expected_map.get(key, ZERO)
        lvl_obj = actual_map.get(key)
        act_qty = lvl_obj.quantity if lvl_obj else ZERO
        if exp_qty != act_qty:
            mismatches.append(
                {
                    "branch_id": str(key[0]),
                    "location_id": str(key[1]),
                    "item_id": str(key[2]),
                    "expected_quantity": str(exp_qty),
                    "actual_quantity": str(act_qty),
                }
            )
            if apply:
                if lvl_obj is not None:
                    lvl_obj.quantity = exp_qty
                    lvl_obj.save(update_fields=["quantity", "updated_at"])
                else:
                    branch = Branch.objects.get(pk=key[0])
                    StockLevel.objects.create(
                        tenant=branch.tenant,
                        branch_id=key[0],
                        location_id=key[1],
                        item_id=key[2],
                        quantity=exp_qty,
                    )

    return {
        "checked_keys": len(all_keys),
        "mismatch_count": len(mismatches),
        "mismatches": mismatches,
        "applied": apply,
    }


def validate_recipe_no_cycles(
    *,
    tenant: Tenant,
    output_item_id: Any,
    ingredient_item_ids: list[Any],
) -> None:
    """Prevent a prepared item recipe from including itself directly or transitively."""
    if not output_item_id:
        return
    output_str = str(output_item_id)
    direct_ids = {str(i) for i in ingredient_item_ids}
    if output_str in direct_ids:
        raise BusinessRuleError(
            "RECIPE_CYCLE",
            "A recipe cannot include its own output item as an ingredient.",
            status_code=400,
        )

    # Build adjacency map: prepared_item_id -> set of ingredient_item_ids
    adj: dict[str, set[str]] = {}
    for line in RecipeLine.objects.filter(tenant=tenant, recipe__output_item__isnull=False).values(
        "recipe__output_item_id", "item_id"
    ):
        src = str(line["recipe__output_item_id"])
        adj.setdefault(src, set()).add(str(line["item_id"]))

    adj[output_str] = direct_ids

    visited: set[str] = set()
    stack = list(direct_ids)
    while stack:
        curr = stack.pop()
        if curr == output_str:
            raise BusinessRuleError(
                "RECIPE_CYCLE",
                "Circular dependency detected between prepared item recipes.",
                status_code=400,
            )
        if curr in visited:
            continue
        visited.add(curr)
        stack.extend(adj.get(curr, set()))


@transaction.atomic
def create_goods_receipt(
    *,
    branch: Branch,
    lines_data: list[dict[str, Any]],
    location: StockLocation | None = None,
    supplier: Supplier | None = None,
    supplier_invoice_number: str = "",
    notes: str = "",
    confirm_duplicate: bool = False,
    actor: Any = None,
    request: Any = None,
) -> GoodsReceipt:
    """Receive stock into a branch, update WAC, and block duplicate supplier invoices unless confirmed."""
    if not lines_data:
        raise ValidationError({"lines": "At least one item line is required."})

    inv_num = supplier_invoice_number.strip()
    if supplier is not None and inv_num and not confirm_duplicate:
        dup_exists = GoodsReceipt.objects.filter(
            tenant=branch.tenant,
            supplier=supplier,
            supplier_invoice_number__iexact=inv_num,
        ).exists()
        if dup_exists:
            raise BusinessRuleError(
                "DUPLICATE_INVOICE",
                f"Invoice '{inv_num}' from supplier '{supplier.name}' was already received. Confirm to proceed.",
                status_code=409,
                details={"supplier_id": str(supplier.id), "supplier_invoice_number": inv_num},
            )

    target_location = location or get_or_create_default_location(branch)
    actor_user = (
        actor if (actor is not None and getattr(actor, "is_authenticated", False)) else None
    )

    receipt = GoodsReceipt.objects.create(
        tenant=branch.tenant,
        branch=branch,
        location=target_location,
        supplier=supplier,
        supplier_invoice_number=inv_num,
        total_paid_paise=0,
        notes=notes,
        received_by=actor_user,
    )

    total_paid = 0
    for idx, line in enumerate(lines_data):
        item: InventoryItem = line["item"]
        qty = Decimal(str(line["quantity"]))
        if qty <= ZERO:
            raise ValidationError({"lines": f"Row {idx + 1}: quantity must be positive."})
        unit_name = line.get("unit_name") or item.base_unit
        base_qty = to_base_quantity(item, qty, unit_name)
        if base_qty <= ZERO:
            raise ValidationError(
                {"lines": f"Row {idx + 1}: converted base quantity must be positive."}
            )

        # Cost can be passed as line_total_paise or unit_cost_paise (per purchase unit)
        if line.get("line_total_paise") is not None:
            line_total = int(line["line_total_paise"])
            base_unit_cost = round_paise(Decimal(line_total) / base_qty)
        else:
            purchase_unit_cost = int(line.get("unit_cost_paise", 0))
            line_total = round_paise(qty * Decimal(purchase_unit_cost))
            base_unit_cost = round_paise(Decimal(line_total) / base_qty)

        if line_total < 0 or base_unit_cost < 0:
            raise ValidationError({"lines": f"Row {idx + 1}: cost cannot be negative."})

        batch_num = str(line.get("batch_number") or "").strip()
        expiry_date = line.get("expiry_date")

        batch_obj: StockBatch | None = None
        if batch_num or expiry_date or item.track_expiry:
            batch_obj = StockBatch.objects.create(
                tenant=branch.tenant,
                branch=branch,
                location=target_location,
                item=item,
                batch_number=batch_num,
                expiry_date=expiry_date,
                quantity_remaining=base_qty,
                unit_cost_paise=base_unit_cost,
            )

        GoodsReceiptLine.objects.create(
            tenant=branch.tenant,
            receipt=receipt,
            item=item,
            quantity=qty,
            unit_name=unit_name,
            base_quantity=base_qty,
            unit_cost_paise=base_unit_cost,
            line_total_paise=line_total,
            batch_number=batch_num,
            expiry_date=expiry_date,
        )

        post_stock_movement(
            branch=branch,
            location=target_location,
            item=item,
            batch=batch_obj,
            movement_type=StockMovementType.PURCHASE,
            quantity=base_qty,
            unit_cost_paise=base_unit_cost,
            reference_type="GoodsReceipt",
            reference_id=str(receipt.id),
            reason_code="PURCHASE",
            notes=f"Invoice: {inv_num}" if inv_num else notes,
            actor=actor_user,
        )

        if supplier is not None:
            SupplierItem.objects.update_or_create(
                tenant=branch.tenant,
                supplier=supplier,
                item=item,
                defaults={
                    "purchase_unit": unit_name,
                    "last_unit_cost_paise": base_unit_cost,
                },
            )

        total_paid += line_total

    receipt.total_paid_paise = total_paid
    receipt.save(update_fields=["total_paid_paise", "updated_at"])

    log_audit_event(
        action="inventory.receipt.create",
        entity_type="GoodsReceipt",
        entity_id=str(receipt.id),
        actor=actor_user,
        tenant=branch.tenant,
        after_state={
            "branch_id": str(branch.id),
            "supplier_invoice_number": inv_num,
            "total_paid_paise": total_paid,
            "line_count": len(lines_data),
        },
        request=request,
    )
    return receipt


@transaction.atomic
def record_wastage(
    *,
    branch: Branch,
    item: InventoryItem,
    quantity: Decimal,
    unit_name: str | None = None,
    reason_code: str = WasteReason.SPOILED,
    notes: str = "",
    location: StockLocation | None = None,
    actor: Any = None,
    request: Any = None,
) -> StockMovement:
    """Log a wastage movement with signed negative quantity and audit trail."""
    if quantity <= ZERO:
        raise ValidationError({"quantity": "Wastage quantity must be greater than zero."})
    if reason_code not in WasteReason.values:
        raise ValidationError({"reason_code": f"Invalid wastage reason: {reason_code}."})

    base_qty = to_base_quantity(item, quantity, unit_name)
    mv = post_stock_movement(
        branch=branch,
        location=location,
        item=item,
        movement_type=StockMovementType.WASTE,
        quantity=-base_qty,
        reference_type="Wastage",
        reference_id="",
        reason_code=reason_code,
        notes=notes,
        actor=actor,
    )
    log_audit_event(
        action="inventory.waste.create",
        entity_type="StockMovement",
        entity_id=str(mv.id),
        actor=actor,
        tenant=branch.tenant,
        after_state={
            "item_id": str(item.id),
            "quantity": str(mv.quantity),
            "reason_code": reason_code,
            "value_paise": mv.value_paise,
        },
        request=request,
    )
    return mv


@transaction.atomic
def quick_update_stock(
    *,
    branch: Branch,
    item: InventoryItem,
    delta_quantity: Decimal,
    unit_name: str | None = None,
    reason_code: str = "",
    notes: str = "",
    location: StockLocation | None = None,
    is_opening: bool = False,
    unit_cost_paise: int | None = None,
    actor: Any = None,
    can_approve: bool = False,
    request: Any = None,
) -> StockMovement:
    """Quick +/- adjustment or opening balance with threshold approval enforcement."""
    if delta_quantity == ZERO:
        raise ValidationError({"quantity": "Adjustment quantity cannot be zero."})
    if not is_opening and not reason_code.strip():
        raise ValidationError({"reason_code": "A reason is required for stock adjustments."})

    sign = Decimal("1") if delta_quantity > ZERO else Decimal("-1")
    base_abs = to_base_quantity(item, abs(delta_quantity), unit_name)
    signed_base = sign * base_abs

    if not is_opening:
        settings_obj = get_or_create_branch_settings(branch)
        wac = get_branch_item_wac(branch, item)
        est_abs_value = abs(round_paise(signed_base * Decimal(wac)))
        if est_abs_value > settings_obj.adjustment_approval_threshold_paise and not can_approve:
            raise BusinessRuleError(
                "APPROVAL_REQUIRED",
                "This adjustment exceeds the branch approval limit and requires a manager.",
                status_code=403,
                details={
                    "threshold_paise": settings_obj.adjustment_approval_threshold_paise,
                    "adjustment_value_paise": est_abs_value,
                },
            )

    mv = post_stock_movement(
        branch=branch,
        location=location,
        item=item,
        movement_type=StockMovementType.OPENING if is_opening else StockMovementType.ADJUSTMENT,
        quantity=signed_base,
        unit_cost_paise=unit_cost_paise,
        reference_type="OpeningBalance" if is_opening else "QuickUpdate",
        reference_id="",
        reason_code=reason_code.strip() or ("OPENING" if is_opening else "ADJUSTMENT"),
        notes=notes,
        actor=actor,
    )
    log_audit_event(
        action="inventory.opening.create" if is_opening else "inventory.adjustment.create",
        entity_type="StockMovement",
        entity_id=str(mv.id),
        actor=actor,
        tenant=branch.tenant,
        after_state={
            "item_id": str(item.id),
            "quantity": str(mv.quantity),
            "reason_code": mv.reason_code,
        },
        request=request,
    )
    return mv


def preview_stock_paste(
    *,
    tenant: Tenant,
    raw_text: str,
) -> dict[str, Any]:
    """Parse pasted spreadsheet rows (name, quantity, unit, cost_rupees) with row-level errors."""
    rows: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    existing_items = {it.name.lower(): it for it in InventoryItem.objects.filter(tenant=tenant)}

    lines = [ln for ln in raw_text.splitlines() if ln.strip()]
    for idx, line in enumerate(lines, start=1):
        delimiter = "\t" if "\t" in line else ("," if "," in line else "|")
        parts = [p.strip() for p in line.split(delimiter)]
        if idx == 1 and parts and parts[0].lower() in {"name", "item", "item name", "ingredient"}:
            continue

        if len(parts) < 3:
            errors.append(
                {
                    "row": idx,
                    "message": "Expected at least 3 columns: name, quantity, unit[, cost_rupees].",
                }
            )
            continue

        raw_name = sanitize_csv_cell(parts[0]).lstrip("'").strip()
        if not raw_name:
            errors.append({"row": idx, "message": "Item name is required."})
            continue

        try:
            qty = Decimal(parts[1])
            if qty <= ZERO:
                raise ValueError("non-positive")
        except (InvalidOperation, ValueError):
            errors.append({"row": idx, "message": f"Invalid quantity '{parts[1]}'."})
            continue

        unit = parts[2].lower().strip()
        if unit in {"kg", "g", "gram", "grams"}:
            base_unit = BaseUnit.GRAM
            norm_unit = "kg" if unit == "kg" else "g"
        elif unit in {"l", "ltr", "liter", "litre", "ml"}:
            base_unit = BaseUnit.MILLILITER
            norm_unit = "l" if unit in {"l", "ltr", "liter", "litre"} else "ml"
        elif unit in {"piece", "pcs", "pc", "nos", "dozen"}:
            base_unit = BaseUnit.PIECE
            norm_unit = "dozen" if unit == "dozen" else "piece"
        else:
            errors.append(
                {
                    "row": idx,
                    "message": f"Unsupported unit '{parts[2]}'. Use g, kg, ml, l, piece, or dozen.",
                }
            )
            continue

        cost_paise = 0
        if len(parts) >= 4 and parts[3]:
            try:
                cost_rupees = Decimal(parts[3])
                if cost_rupees < ZERO:
                    raise ValueError("negative")
                cost_paise = round_paise(cost_rupees * HUNDRED)
            except (InvalidOperation, ValueError):
                errors.append({"row": idx, "message": f"Invalid cost '{parts[3]}'."})
                continue

        rows.append(
            {
                "row": idx,
                "name": sanitize_csv_cell(raw_name),
                "quantity": str(qty),
                "unit": norm_unit,
                "base_unit": base_unit,
                "unit_cost_paise": cost_paise,
                "exists": raw_name.lower() in existing_items,
            }
        )

    return {
        "valid_count": len(rows),
        "error_count": len(errors),
        "rows": rows,
        "errors": errors,
    }


@transaction.atomic
def apply_stock_paste(
    *,
    branch: Branch,
    raw_text: str,
    location: StockLocation | None = None,
    actor: Any = None,
    request: Any = None,
) -> dict[str, Any]:
    """Atomically create missing items and post OPENING stock movements from spreadsheet paste."""
    preview = preview_stock_paste(tenant=branch.tenant, raw_text=raw_text)
    if preview["error_count"] > 0:
        raise BusinessRuleError(
            "PASTE_VALIDATION_FAILED",
            "Fix row errors before importing.",
            status_code=400,
            details={"errors": preview["errors"]},
        )

    created_items = 0
    movements_posted = 0
    for row in preview["rows"]:
        clean_name = row["name"].lstrip("'").strip()
        item, created = InventoryItem.objects.get_or_create(
            tenant=branch.tenant,
            name=clean_name,
            defaults={
                "base_unit": row["base_unit"],
                "item_type": InventoryItemType.INGREDIENT,
            },
        )
        if created:
            created_items += 1
        qty = Decimal(row["quantity"])
        base_qty = to_base_quantity(item, qty, row["unit"])
        # Convert purchase-unit cost to base-unit cost
        factor = base_qty / qty if qty > ZERO else Decimal("1")
        base_unit_cost = (
            round_paise(Decimal(row["unit_cost_paise"]) / factor) if factor > ZERO else 0
        )

        post_stock_movement(
            branch=branch,
            location=location,
            item=item,
            movement_type=StockMovementType.OPENING,
            quantity=base_qty,
            unit_cost_paise=base_unit_cost,
            reference_type="SpreadsheetImport",
            reference_id="",
            reason_code="OPENING",
            notes="Imported via spreadsheet paste",
            actor=actor,
        )
        movements_posted += 1

    log_audit_event(
        action="inventory.paste.import",
        entity_type="Branch",
        entity_id=str(branch.id),
        actor=actor,
        tenant=branch.tenant,
        after_state={"created_items": created_items, "movements_posted": movements_posted},
        request=request,
    )
    return {"created_items": created_items, "movements_posted": movements_posted}


@transaction.atomic
def create_stock_count(
    *,
    branch: Branch,
    count_type: str = StockCountType.FULL,
    category_filter: str = "",
    is_blind: bool = False,
    location: StockLocation | None = None,
    notes: str = "",
    actor: Any = None,
) -> StockCount:
    """Create a DRAFT StockCount seeded with current expected StockLevel quantities."""
    target_loc = location or get_or_create_default_location(branch)
    actor_user = (
        actor if (actor is not None and getattr(actor, "is_authenticated", False)) else None
    )

    sc = StockCount.objects.create(
        tenant=branch.tenant,
        branch=branch,
        location=target_loc,
        count_type=count_type,
        category_filter=category_filter,
        is_blind=is_blind,
        status=StockCountStatus.DRAFT,
        notes=notes,
        created_by=actor_user,
    )

    items_qs = InventoryItem.objects.filter(tenant=branch.tenant, is_active=True)
    if count_type == StockCountType.CATEGORY and category_filter:
        items_qs = items_qs.filter(category=category_filter)

    level_map = {
        lvl.item_id: lvl.quantity
        for lvl in StockLevel.objects.filter(branch=branch, location=target_loc)
    }

    lines_to_create = [
        StockCountLine(
            tenant=branch.tenant,
            stock_count=sc,
            item=it,
            expected_quantity=level_map.get(it.id, ZERO),
        )
        for it in items_qs
    ]
    StockCountLine.objects.bulk_create(lines_to_create)
    return sc


@transaction.atomic
def submit_stock_count(
    *,
    stock_count: StockCount,
    counted_lines: list[dict[str, Any]],
    actor: Any = None,
    request: Any = None,
) -> StockCount:
    """Record physical counted quantities and move StockCount to SUBMITTED."""
    if stock_count.status != StockCountStatus.DRAFT:
        raise BusinessRuleError(
            "INVALID_COUNT_STATE",
            "Only draft counts can be submitted.",
            status_code=400,
        )

    line_map = {str(ln.item_id): ln for ln in stock_count.lines.select_related("item")}
    for entry in counted_lines:
        item_id = str(entry["item_id"])
        line = line_map.get(item_id)
        if line is None:
            continue
        counted = Decimal(str(entry["counted_quantity"]))
        if counted < ZERO:
            raise ValidationError({"counted_quantity": "Counted quantity cannot be negative."})
        wac = get_branch_item_wac(stock_count.branch, line.item)
        variance = (counted - line.expected_quantity).quantize(Decimal("0.001"))
        line.counted_quantity = counted.quantize(Decimal("0.001"))
        line.variance_quantity = variance
        line.variance_value_paise = round_paise(variance * Decimal(wac))
        line.reason = str(entry.get("reason") or "").strip()[:200]
        line.save(
            update_fields=[
                "counted_quantity",
                "variance_quantity",
                "variance_value_paise",
                "reason",
                "updated_at",
            ]
        )

    stock_count.status = StockCountStatus.SUBMITTED
    stock_count.submitted_at = timezone.now()
    stock_count.save(update_fields=["status", "submitted_at", "updated_at"])

    log_audit_event(
        action="inventory.count.submit",
        entity_type="StockCount",
        entity_id=str(stock_count.id),
        actor=actor,
        tenant=stock_count.tenant,
        after_state={"status": StockCountStatus.SUBMITTED},
        request=request,
    )
    return stock_count


@transaction.atomic
def approve_stock_count(
    *,
    stock_count: StockCount,
    actor: Any = None,
    request: Any = None,
) -> StockCount:
    """Approve a SUBMITTED StockCount and post COUNT_VARIANCE movements for all variances."""
    if stock_count.status != StockCountStatus.SUBMITTED:
        raise BusinessRuleError(
            "INVALID_COUNT_STATE",
            "Only submitted counts can be approved.",
            status_code=400,
        )

    actor_user = (
        actor if (actor is not None and getattr(actor, "is_authenticated", False)) else None
    )
    posted = 0
    for line in stock_count.lines.select_related("item"):
        if line.counted_quantity is None or line.variance_quantity == ZERO:
            continue
        post_stock_movement(
            branch=stock_count.branch,
            location=stock_count.location,
            item=line.item,
            movement_type=StockMovementType.COUNT_VARIANCE,
            quantity=line.variance_quantity,
            reference_type="StockCount",
            reference_id=str(stock_count.id),
            reason_code="COUNT_VARIANCE",
            notes=line.reason or f"Approved stock count {stock_count.id}",
            actor=actor_user,
        )
        posted += 1

    stock_count.status = StockCountStatus.APPROVED
    stock_count.approved_by = actor_user
    stock_count.approved_at = timezone.now()
    stock_count.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

    log_audit_event(
        action="inventory.count.approve",
        entity_type="StockCount",
        entity_id=str(stock_count.id),
        actor=actor_user,
        tenant=stock_count.tenant,
        after_state={"status": StockCountStatus.APPROVED, "variance_movements_posted": posted},
        request=request,
    )
    return stock_count


def _expand_recipe_ingredients(
    *,
    tenant: Tenant,
    recipe: Recipe,
    portions: Decimal,
    depth: int = 0,
) -> dict[Any, Decimal]:
    """Recursively expand recipe lines (including PREPARED sub-recipes and waste_percent)."""
    if depth > 5:
        raise BusinessRuleError("RECIPE_DEPTH_EXCEEDED", "Prepared recipe nesting too deep.")

    totals: dict[Any, Decimal] = {}
    yield_div = recipe.yield_portions if recipe.yield_portions > ZERO else Decimal("1")

    for line in recipe.lines.select_related("item"):
        waste_mult = Decimal("1") + (line.waste_percent / HUNDRED)
        req_qty = (portions * line.quantity_per_portion * waste_mult) / yield_div

        if line.item.item_type == InventoryItemType.PREPARED:
            sub_recipe = (
                Recipe.objects.filter(tenant=tenant, output_item=line.item, is_active=True)
                .prefetch_related("lines__item")
                .first()
            )
            if sub_recipe is not None:
                sub_totals = _expand_recipe_ingredients(
                    tenant=tenant, recipe=sub_recipe, portions=req_qty, depth=depth + 1
                )
                for sub_item_id, sub_qty in sub_totals.items():
                    totals[sub_item_id] = totals.get(sub_item_id, ZERO) + sub_qty
                continue

        totals[line.item_id] = totals.get(line.item_id, ZERO) + req_qty

    return totals


def compute_recipe_cost_paise(recipe: Recipe, branch: Branch | None = None) -> int:
    """Compute live cost per portion in paise for a recipe using branch WAC."""
    totals = _expand_recipe_ingredients(
        tenant=recipe.tenant, recipe=recipe, portions=Decimal("1.000")
    )
    if not totals:
        return 0
    total_dec = Decimal("0")
    for item_id, qty in totals.items():
        if branch is not None:
            lvl = (
                StockLevel.objects.filter(branch=branch, item_id=item_id)
                .order_by("-weighted_avg_cost_paise")
                .first()
            )
            wac = lvl.weighted_avg_cost_paise if lvl else 0
        else:
            lvl = (
                StockLevel.objects.filter(tenant=recipe.tenant, item_id=item_id)
                .order_by("-weighted_avg_cost_paise")
                .first()
            )
            wac = lvl.weighted_avg_cost_paise if lvl else 0
        total_dec += qty * Decimal(wac)
    return round_paise(total_dec)


def deduct_order_line(order_line_id: Any, *, actor: Any = None) -> OrderLineStockDeduction | None:
    """Idempotently deduct stock for one OrderItem; never blocks or fails the order."""
    from apps.menu.models import BranchItemAvailability
    from apps.orders.models import OrderItem

    order_line = (
        OrderItem.objects.select_related("order", "order__branch", "order__tenant", "menu_item")
        .filter(pk=order_line_id)
        .first()
    )
    if order_line is None or order_line.menu_item is None:
        return None

    branch = order_line.order.branch
    tenant = order_line.order.tenant

    # Lock or create idempotent deduction record
    with transaction.atomic():
        deduction, _ = OrderLineStockDeduction.objects.select_for_update().get_or_create(
            order_line=order_line,
            defaults={
                "tenant": tenant,
                "branch": branch,
                "order": order_line.order,
                "status": DeductionStatus.PENDING,
            },
        )
        if deduction.status == DeductionStatus.COMPLETED:
            return deduction

        deduction.attempts += 1
        try:
            # Prefer variant-specific recipe, then base menu item recipe
            recipe = None
            if order_line.variant_name:
                recipe = (
                    Recipe.objects.filter(
                        tenant=tenant,
                        menu_item_id=order_line.menu_item_id,
                        variant__name__iexact=order_line.variant_name,
                        is_active=True,
                    )
                    .prefetch_related("lines__item")
                    .first()
                )
            if recipe is None:
                recipe = (
                    Recipe.objects.filter(
                        tenant=tenant,
                        menu_item_id=order_line.menu_item_id,
                        variant__isnull=True,
                        is_active=True,
                    )
                    .prefetch_related("lines__item")
                    .first()
                )

            if recipe is None:
                deduction.status = DeductionStatus.COMPLETED
                deduction.recipe_snapshot = {"recipe_id": None, "lines": []}
                deduction.error_message = ""
                deduction.deducted_at = timezone.now()
                deduction.save(
                    update_fields=[
                        "status",
                        "recipe_snapshot",
                        "error_message",
                        "attempts",
                        "deducted_at",
                        "updated_at",
                    ]
                )
                return deduction

            expanded = _expand_recipe_ingredients(
                tenant=tenant,
                recipe=recipe,
                portions=Decimal(order_line.quantity),
            )
            snapshot_lines: list[dict[str, Any]] = []
            items_by_id = InventoryItem.objects.in_bulk(list(expanded.keys()))
            settings_obj = get_or_create_branch_settings(branch)

            for item_id, req_qty in expanded.items():
                if req_qty <= ZERO:
                    continue
                inv_item = items_by_id[item_id]
                post_stock_movement(
                    branch=branch,
                    item=inv_item,
                    movement_type=StockMovementType.SALE_USAGE,
                    quantity=-req_qty,
                    reference_type="OrderItem",
                    reference_id=str(order_line.id),
                    reason_code="SALE_USAGE",
                    notes=f"Order {order_line.order.order_number}: {order_line.quantity}x {order_line.item_name}",
                    actor=actor,
                )
                snapshot_lines.append(
                    {
                        "item_id": str(item_id),
                        "item_name": inv_item.name,
                        "quantity": str(req_qty.quantize(Decimal("0.001"))),
                        "base_unit": inv_item.base_unit,
                    }
                )

                # Optional auto sold-out (off by default, audited when triggered)
                if settings_obj.auto_sold_out:
                    total_left = (
                        StockLevel.objects.filter(branch=branch, item=inv_item).aggregate(
                            t=Sum("quantity")
                        )["t"]
                        or ZERO
                    )
                    if total_left <= ZERO:
                        avail, _ = BranchItemAvailability.objects.get_or_create(
                            tenant=tenant,
                            branch=branch,
                            menu_item_id=order_line.menu_item_id,
                            defaults={"is_available": False},
                        )
                        if avail.is_available:
                            avail.is_available = False
                            avail.save(update_fields=["is_available", "updated_at"])
                            log_audit_event(
                                action="inventory.auto_sold_out",
                                entity_type="MenuItem",
                                entity_id=str(order_line.menu_item_id),
                                actor=actor,
                                tenant=tenant,
                                before_state={"is_available": True},
                                after_state={
                                    "is_available": False,
                                    "trigger_item_id": str(inv_item.id),
                                    "branch_id": str(branch.id),
                                },
                            )

            deduction.status = DeductionStatus.COMPLETED
            deduction.recipe_snapshot = {
                "recipe_id": str(recipe.id),
                "recipe_version": recipe.version,
                "lines": snapshot_lines,
            }
            deduction.error_message = ""
            deduction.deducted_at = timezone.now()
            deduction.save(
                update_fields=[
                    "status",
                    "recipe_snapshot",
                    "error_message",
                    "attempts",
                    "deducted_at",
                    "updated_at",
                ]
            )
            return deduction
        except Exception as exc:
            deduction.status = DeductionStatus.FAILED
            deduction.error_message = str(exc)[:1000]
            deduction.save(update_fields=["status", "error_message", "attempts", "updated_at"])
            return deduction


@transaction.atomic
def cancel_order_line_deduction(
    order_line_id: Any,
    *,
    was_preparing: bool,
    actor: Any = None,
) -> None:
    """Handle cancellation: before PREPARING -> no deduction; after PREPARING -> WASTE movement."""
    if not was_preparing:
        return

    deduction = (
        OrderLineStockDeduction.objects.select_for_update()
        .select_related("branch", "order")
        .filter(order_line_id=order_line_id)
        .first()
    )
    if deduction is None or deduction.status != DeductionStatus.COMPLETED:
        return

    snapshot_lines = (deduction.recipe_snapshot or {}).get("lines", [])
    for entry in snapshot_lines:
        inv_item = InventoryItem.objects.filter(pk=entry["item_id"]).first()
        if inv_item is None:
            continue
        qty = Decimal(str(entry["quantity"]))
        if qty <= ZERO:
            continue
        post_stock_movement(
            branch=deduction.branch,
            item=inv_item,
            movement_type=StockMovementType.WASTE,
            quantity=-qty,
            reference_type="OrderItemCancel",
            reference_id=str(order_line_id),
            reason_code=WasteReason.CANCELLED_AFTER_COOKING,
            notes=f"Cancelled after cooking (Order {deduction.order.order_number})",
            actor=actor,
        )

    deduction.status = DeductionStatus.CANCELLED_WASTED
    deduction.save(update_fields=["status", "updated_at"])


@transaction.atomic
def deduct_takeaway_packaging(order_id: Any, *, actor: Any = None) -> int:
    """Deduct configured PACKAGING items for a takeaway order (idempotent per order)."""
    from apps.orders.models import Order

    order = (
        Order.objects.select_related("branch", "tenant")
        .prefetch_related("items")
        .filter(pk=order_id)
        .first()
    )
    if order is None:
        return 0
    if order.order_workflow != "COUNTER_TOKEN":
        return 0

    # Idempotency check
    already_posted = StockMovement.objects.filter(
        branch=order.branch,
        movement_type=StockMovementType.PACKAGING_USAGE,
        reference_type="OrderPackaging",
        reference_id=str(order.id),
    ).exists()
    if already_posted:
        return 0

    packaging_items = InventoryItem.objects.filter(
        tenant=order.tenant,
        item_type=InventoryItemType.PACKAGING,
        is_active=True,
    ).exclude(packaging_mode=PackagingMode.NONE)

    total_item_units = sum(int(it.quantity) for it in order.items.all())
    posted = 0
    for pkg in packaging_items:
        if pkg.packaging_mode == PackagingMode.PER_ORDER:
            qty = pkg.packaging_quantity
        elif pkg.packaging_mode == PackagingMode.PER_ITEM:
            qty = pkg.packaging_quantity * Decimal(total_item_units)
        else:
            continue
        if qty <= ZERO:
            continue
        post_stock_movement(
            branch=order.branch,
            item=pkg,
            movement_type=StockMovementType.PACKAGING_USAGE,
            quantity=-qty,
            reference_type="OrderPackaging",
            reference_id=str(order.id),
            reason_code="TAKEAWAY_PACKAGING",
            notes=f"Takeaway packaging for {order.order_number}",
            actor=actor,
        )
        posted += 1
    return posted


def compute_branch_alerts(branch: Branch, *, include_costs: bool = False) -> dict[str, Any]:
    """Compute low stock, negative stock, days left, expiring soon, and failed deductions on read."""
    settings_obj = get_or_create_branch_settings(branch)
    today = timezone.localdate()
    expiry_cutoff = today + timedelta(days=settings_obj.expiry_alert_days)
    fourteen_days_ago = timezone.now() - timedelta(days=14)

    items = list(InventoryItem.objects.filter(tenant=branch.tenant, is_active=True))
    level_totals: dict[Any, Decimal] = {}
    wac_map: dict[Any, int] = {}
    for row in (
        StockLevel.objects.filter(branch=branch)
        .values("item_id")
        .annotate(total_qty=Sum("quantity"), max_wac=Max("weighted_avg_cost_paise"))
    ):
        level_totals[row["item_id"]] = row["total_qty"] or ZERO
        wac_map[row["item_id"]] = row["max_wac"] or 0

    # Usage over last 14 days (days_left shown only when >= 7 distinct days of usage exist)
    usage_movements = StockMovement.objects.filter(
        branch=branch,
        movement_type__in=[
            StockMovementType.SALE_USAGE,
            StockMovementType.PRODUCTION_USAGE,
            StockMovementType.PACKAGING_USAGE,
        ],
        created_at__gte=fourteen_days_ago,
    ).values("item_id", "quantity", "created_at")

    usage_totals: dict[Any, Decimal] = {}
    usage_days: dict[Any, set[date]] = {}
    for mv in usage_movements:
        iid = mv["item_id"]
        usage_totals[iid] = usage_totals.get(iid, ZERO) + abs(mv["quantity"])
        usage_days.setdefault(iid, set()).add(mv["created_at"].date())

    low_stock: list[dict[str, Any]] = []
    negative_stock: list[dict[str, Any]] = []

    for it in items:
        qty = level_totals.get(it.id, ZERO)
        distinct_days = len(usage_days.get(it.id, set()))
        days_left: Decimal | None = None
        if distinct_days >= 7 and qty > ZERO:
            avg_daily = usage_totals[it.id] / Decimal("14")
            if avg_daily > ZERO:
                days_left = (qty / avg_daily).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)

        entry: dict[str, Any] = {
            "item_id": str(it.id),
            "name": it.name,
            "name_ta": it.name_ta,
            "base_unit": it.base_unit,
            "quantity": str(qty),
            "reorder_level": str(it.reorder_level),
            "par_level": str(it.par_level),
            "days_of_stock_left": str(days_left) if days_left is not None else None,
        }
        if include_costs:
            entry["weighted_avg_cost_paise"] = wac_map.get(it.id, 0)

        if qty < ZERO:
            negative_stock.append(entry)
            low_stock.append(entry)
        elif it.reorder_level > ZERO and qty <= it.reorder_level:
            low_stock.append(entry)

    expiring_soon = [
        {
            "batch_id": str(b.id),
            "item_id": str(b.item_id),
            "item_name": b.item.name,
            "batch_number": b.batch_number,
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            "quantity_remaining": str(b.quantity_remaining),
            "base_unit": b.item.base_unit,
        }
        for b in StockBatch.objects.filter(
            branch=branch,
            quantity_remaining__gt=ZERO,
            expiry_date__isnull=False,
            expiry_date__lte=expiry_cutoff,
        ).select_related("item")
    ]

    failed_deductions = [
        {
            "deduction_id": str(d.id),
            "order_id": str(d.order_id),
            "order_number": d.order.order_number,
            "order_line_id": str(d.order_line_id),
            "item_name": d.order_line.item_name,
            "attempts": d.attempts,
            "error_message": d.error_message,
            "created_at": d.created_at.isoformat(),
        }
        for d in OrderLineStockDeduction.objects.filter(
            branch=branch, status=DeductionStatus.FAILED
        ).select_related("order", "order_line")
    ]

    return {
        "low_stock": low_stock,
        "negative_stock": negative_stock,
        "expiring_soon": expiring_soon,
        "failed_deductions": failed_deductions,
        "summary": {
            "low_stock_count": len(low_stock),
            "negative_stock_count": len(negative_stock),
            "expiring_soon_count": len(expiring_soon),
            "failed_deductions_count": len(failed_deductions),
        },
    }


def render_csv_string(headers: list[str], rows: list[list[Any]]) -> str:
    """Render RFC 4180 CSV with formula-injection neutralization."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([sanitize_csv_cell(h) for h in headers])
    for row in rows:
        writer.writerow([sanitize_csv_cell(c) for c in row])
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Stage D: Inter-Branch Stock Transfers (D1) & Purchase Orders (D2)
# ---------------------------------------------------------------------------


@transaction.atomic
def create_stock_transfer(
    *,
    from_branch: Branch,
    to_branch: Branch,
    lines_data: list[dict[str, Any]],
    notes: str = "",
    actor: Any = None,
    request: Any = None,
) -> StockTransfer:
    """Creates a DRAFT inter-branch stock transfer with validated positive line quantities."""
    if from_branch.tenant_id != to_branch.tenant_id:
        raise BusinessRuleError(
            "CROSS_TENANT_FORBIDDEN",
            "Cannot transfer stock across different restaurant organizations.",
            status_code=403,
        )
    if from_branch.id == to_branch.id:
        raise BusinessRuleError(
            "SAME_BRANCH_TRANSFER",
            "Source and destination branches must be different for an inter-branch transfer.",
            status_code=400,
        )
    if not lines_data:
        raise ValidationError({"lines": "At least one transfer item line is required."})

    from_loc = get_or_create_default_location(from_branch)
    to_loc = get_or_create_default_location(to_branch)
    actor_user = (
        actor if (actor is not None and getattr(actor, "is_authenticated", False)) else None
    )

    transfer = StockTransfer.objects.create(
        tenant=from_branch.tenant,
        from_branch=from_branch,
        from_location=from_loc,
        to_branch=to_branch,
        to_location=to_loc,
        status=StockTransferStatus.DRAFT,
        requested_by=actor_user,
        notes=notes,
    )

    for idx, entry in enumerate(lines_data):
        item: InventoryItem = entry["item"]
        qty = Decimal(str(entry["quantity"]))
        if qty <= ZERO:
            raise ValidationError({"lines": f"Row {idx + 1}: quantity must be greater than zero."})
        unit_name = entry.get("unit_name") or item.base_unit
        base_qty = to_base_quantity(item, qty, unit_name)
        StockTransferLine.objects.create(
            tenant=from_branch.tenant,
            transfer=transfer,
            item=item,
            quantity=base_qty,
        )

    log_audit_event(
        action="inventory.transfer.create",
        entity_type="StockTransfer",
        entity_id=str(transfer.id),
        actor=actor_user,
        tenant=from_branch.tenant,
        after_state={
            "from_branch_id": str(from_branch.id),
            "to_branch_id": str(to_branch.id),
            "status": transfer.status,
            "line_count": len(lines_data),
        },
        request=request,
    )
    return transfer


@transaction.atomic
def dispatch_stock_transfer(
    *,
    transfer: StockTransfer,
    actor: Any = None,
    request: Any = None,
) -> StockTransfer:
    """Dispatches a DRAFT stock transfer, posting append-only TRANSFER_OUT movements on from_branch."""
    locked = (
        StockTransfer.objects.select_for_update()
        .select_related("from_branch", "from_location", "to_branch", "to_location", "tenant")
        .prefetch_related("lines__item")
        .get(pk=transfer.pk)
    )
    if locked.status != StockTransferStatus.DRAFT:
        raise BusinessRuleError(
            "INVALID_STATUS_TRANSITION",
            f"Cannot dispatch transfer in '{locked.status}' status.",
            status_code=400,
        )

    actor_user = (
        actor if (actor is not None and getattr(actor, "is_authenticated", False)) else None
    )

    for line in locked.lines.all():
        source_wac = get_branch_item_wac(locked.from_branch, line.item)
        post_stock_movement(
            branch=locked.from_branch,
            location=locked.from_location,
            item=line.item,
            movement_type=StockMovementType.TRANSFER_OUT,
            quantity=-line.quantity,
            unit_cost_paise=source_wac,
            reference_type="StockTransfer",
            reference_id=str(locked.id),
            reason_code="INTER_BRANCH_TRANSFER_OUT",
            notes=f"Transfer to {locked.to_branch.name}",
            actor=actor_user,
        )

    locked.status = StockTransferStatus.APPROVED
    locked.approved_by = actor_user
    locked.save(update_fields=["status", "approved_by", "updated_at"])

    log_audit_event(
        action="inventory.transfer.dispatch",
        entity_type="StockTransfer",
        entity_id=str(locked.id),
        actor=actor_user,
        tenant=locked.tenant,
        before_state={"status": StockTransferStatus.DRAFT},
        after_state={"status": locked.status},
        request=request,
    )
    return locked


@transaction.atomic
def receive_stock_transfer(
    *,
    transfer: StockTransfer,
    actor: Any = None,
    request: Any = None,
) -> StockTransfer:
    """Receives an APPROVED (in-transit) stock transfer, posting append-only TRANSFER_IN movements on to_branch."""
    locked = (
        StockTransfer.objects.select_for_update()
        .select_related("from_branch", "from_location", "to_branch", "to_location", "tenant")
        .prefetch_related("lines__item")
        .get(pk=transfer.pk)
    )
    if locked.status != StockTransferStatus.APPROVED:
        raise BusinessRuleError(
            "INVALID_STATUS_TRANSITION",
            f"Transfer must be dispatched (APPROVED) before receiving (current: '{locked.status}').",
            status_code=400,
        )

    actor_user = (
        actor if (actor is not None and getattr(actor, "is_authenticated", False)) else None
    )

    for line in locked.lines.all():
        out_mv = (
            StockMovement.objects.filter(
                branch=locked.from_branch,
                item=line.item,
                movement_type=StockMovementType.TRANSFER_OUT,
                reference_type="StockTransfer",
                reference_id=str(locked.id),
            )
            .order_by("-sequence_number")
            .first()
        )
        unit_cost = (
            out_mv.unit_cost_paise
            if out_mv is not None
            else get_branch_item_wac(locked.from_branch, line.item)
        )
        post_stock_movement(
            branch=locked.to_branch,
            location=locked.to_location,
            item=line.item,
            movement_type=StockMovementType.TRANSFER_IN,
            quantity=line.quantity,
            unit_cost_paise=unit_cost,
            reference_type="StockTransfer",
            reference_id=str(locked.id),
            reason_code="INTER_BRANCH_TRANSFER_IN",
            notes=f"Transfer from {locked.from_branch.name}",
            actor=actor_user,
        )

    locked.status = StockTransferStatus.COMPLETED
    locked.save(update_fields=["status", "updated_at"])

    log_audit_event(
        action="inventory.transfer.receive",
        entity_type="StockTransfer",
        entity_id=str(locked.id),
        actor=actor_user,
        tenant=locked.tenant,
        before_state={"status": StockTransferStatus.APPROVED},
        after_state={"status": locked.status},
        request=request,
    )
    return locked


@transaction.atomic
def create_purchase_order(
    *,
    branch: Branch,
    supplier: Supplier | None,
    lines_data: list[dict[str, Any]],
    notes: str = "",
    actor: Any = None,
    request: Any = None,
) -> PurchaseOrder:
    """Creates a DRAFT PurchaseOrder with sequential order_number and integer paise line totals."""
    if not lines_data:
        raise ValidationError({"lines": "Purchase order must contain at least one item line."})

    Branch.objects.select_for_update().only("id").get(pk=branch.pk)
    po_seq = PurchaseOrder.objects.filter(tenant=branch.tenant).count() + 1
    today_str = timezone.now().strftime("%Y%m")
    order_number = f"PO-{today_str}-{po_seq:04d}"

    po = PurchaseOrder.objects.create(
        tenant=branch.tenant,
        branch=branch,
        order_number=order_number,
        supplier=supplier,
        status=PurchaseOrderStatus.DRAFT,
        total_cost_paise=0,
        notes=notes,
    )

    total_cost_paise = 0
    for idx, entry in enumerate(lines_data):
        item: InventoryItem = entry["item"]
        qty = Decimal(str(entry["quantity_ordered"]))
        if qty <= ZERO:
            raise ValidationError({"lines": f"Row {idx + 1}: ordered quantity must be positive."})
        unit_name = str(entry.get("unit_name") or item.base_unit)
        unit_cost_paise = int(entry.get("unit_cost_paise", 0))
        if unit_cost_paise < 0:
            raise ValidationError({"lines": f"Row {idx + 1}: unit cost cannot be negative."})
        line_total = round_paise(qty * Decimal(unit_cost_paise))
        PurchaseOrderLine.objects.create(
            tenant=branch.tenant,
            purchase_order=po,
            item=item,
            quantity_ordered=qty,
            quantity_received=ZERO,
            unit_name=unit_name,
            unit_cost_paise=unit_cost_paise,
            line_total_paise=line_total,
        )
        total_cost_paise += line_total

    po.total_cost_paise = total_cost_paise
    po.save(update_fields=["total_cost_paise", "updated_at"])

    actor_user = (
        actor if (actor is not None and getattr(actor, "is_authenticated", False)) else None
    )
    log_audit_event(
        action="inventory.po.create",
        entity_type="PurchaseOrder",
        entity_id=str(po.id),
        actor=actor_user,
        tenant=branch.tenant,
        after_state={
            "order_number": po.order_number,
            "total_cost_paise": total_cost_paise,
            "line_count": len(lines_data),
        },
        request=request,
    )
    return po


@transaction.atomic
def auto_draft_low_stock_po(
    *,
    branch: Branch,
    supplier: Supplier | None = None,
    actor: Any = None,
    request: Any = None,
) -> PurchaseOrder:
    """Auto-drafts a PurchaseOrder from items currently at or below reorder_level."""
    alerts = compute_branch_alerts(branch, include_costs=True)
    low_items = alerts.get("low_stock", [])
    if not low_items:
        raise BusinessRuleError(
            "NO_LOW_STOCK_ITEMS",
            "No items are currently below their reorder level.",
            status_code=400,
        )

    lines_data: list[dict[str, Any]] = []
    for entry in low_items:
        item = InventoryItem.objects.filter(tenant=branch.tenant, pk=entry["item_id"]).first()
        if item is None:
            continue
        cur_qty = Decimal(str(entry["quantity"]))
        par = item.par_level if item.par_level > ZERO else item.reorder_level * Decimal("2")
        target_order_qty = max(par - max(ZERO, cur_qty), item.reorder_level, Decimal("1.000"))
        wac = int(entry.get("weighted_avg_cost_paise") or get_branch_item_wac(branch, item))
        lines_data.append(
            {
                "item": item,
                "quantity_ordered": target_order_qty,
                "unit_name": item.base_unit,
                "unit_cost_paise": wac,
            }
        )

    return create_purchase_order(
        branch=branch,
        supplier=supplier,
        lines_data=lines_data,
        notes="Auto-drafted from Low Stock Alerts",
        actor=actor,
        request=request,
    )


@transaction.atomic
def receive_purchase_order(
    *,
    purchase_order: PurchaseOrder,
    branch: Branch,
    received_lines: list[dict[str, Any]] | None = None,
    supplier_invoice_number: str = "",
    actor: Any = None,
    request: Any = None,
) -> dict[str, Any]:
    """Converts a PurchaseOrder into an inward GoodsReceipt, updates WAC, and detects price jumps."""
    po = (
        PurchaseOrder.objects.select_for_update(of=("self",))
        .select_related("supplier", "branch", "tenant")
        .prefetch_related("lines__item")
        .get(pk=purchase_order.pk)
    )
    if po.status in (PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.CANCELLED):
        raise BusinessRuleError(
            "INVALID_STATUS_TRANSITION",
            f"Purchase order '{po.order_number}' is already '{po.status}'.",
            status_code=400,
        )

    target_branch = po.branch or branch
    settings_obj = get_or_create_branch_settings(target_branch)
    jump_threshold_pct = settings_obj.price_jump_alert_percent

    overrides_by_item: dict[str, dict[str, Any]] = {}
    for ov in received_lines or []:
        iid = str(ov.get("item") or ov.get("item_id") or "")
        if iid:
            overrides_by_item[iid] = ov

    receipt_lines_data: list[dict[str, Any]] = []
    price_jump_alerts: list[dict[str, Any]] = []
    all_fulfilled = True

    for po_line in po.lines.all():
        ov = overrides_by_item.get(str(po_line.item_id), {})
        remaining_qty = max(ZERO, po_line.quantity_ordered - po_line.quantity_received)
        recv_qty = Decimal(str(ov.get("quantity_received", remaining_qty)))
        unit_cost_paise = int(ov.get("unit_cost_paise", po_line.unit_cost_paise))

        if recv_qty > ZERO:
            prev_wac = get_branch_item_wac(target_branch, po_line.item)
            base_qty = to_base_quantity(po_line.item, recv_qty, po_line.unit_name)
            line_total = round_paise(recv_qty * Decimal(unit_cost_paise))
            new_base_cost = (
                round_paise(Decimal(line_total) / base_qty) if base_qty > ZERO else unit_cost_paise
            )
            if prev_wac > 0 and new_base_cost > prev_wac:
                jump_pct = (
                    (Decimal(new_base_cost - prev_wac) * HUNDRED) / Decimal(prev_wac)
                ).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
                if jump_pct >= jump_threshold_pct:
                    price_jump_alerts.append(
                        {
                            "item_id": str(po_line.item_id),
                            "item_name": po_line.item.name,
                            "previous_wac_paise": prev_wac,
                            "received_unit_cost_paise": new_base_cost,
                            "jump_percent": str(jump_pct),
                        }
                    )

            receipt_lines_data.append(
                {
                    "item": po_line.item,
                    "quantity": recv_qty,
                    "unit_name": po_line.unit_name or po_line.item.base_unit,
                    "unit_cost_paise": unit_cost_paise,
                    "line_total_paise": line_total,
                }
            )
            po_line.quantity_received += recv_qty
            po_line.unit_cost_paise = unit_cost_paise
            po_line.save(update_fields=["quantity_received", "unit_cost_paise", "updated_at"])

        if po_line.quantity_received < po_line.quantity_ordered:
            all_fulfilled = False

    if not receipt_lines_data:
        raise ValidationError(
            {"lines": "At least one line must have a positive received quantity."}
        )

    receipt = create_goods_receipt(
        branch=target_branch,
        supplier=po.supplier,
        supplier_invoice_number=supplier_invoice_number or f"GRN-{po.order_number}",
        notes=f"Converted from {po.order_number}",
        confirm_duplicate=True,
        lines_data=receipt_lines_data,
        actor=actor,
        request=request,
    )
    receipt.purchase_order = po
    receipt.save(update_fields=["purchase_order", "updated_at"])

    po.status = PurchaseOrderStatus.RECEIVED if all_fulfilled else PurchaseOrderStatus.PARTIAL
    po.received_at = timezone.now()
    po.save(update_fields=["status", "received_at", "updated_at"])

    return {
        "purchase_order": po,
        "goods_receipt": receipt,
        "price_jump_alerts": price_jump_alerts,
    }
