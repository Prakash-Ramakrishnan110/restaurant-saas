from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Membership
from apps.core.context import get_current_tenant, reset_current_tenant, set_current_tenant
from apps.menu.models import MenuItem
from apps.orders.models import (
    BillInvoice,
    CourseType,
    Order,
    OrderItem,
    OrderStatus,
    OrderWorkflow,
    PaymentMethod,
)
from apps.tenants.models import Branch
from apps.venues.models import DiningTable, TableSession, TableStatus


@transaction.atomic
def create_order(
    branch: Branch,
    items_data: list[dict[str, Any]],
    user_membership: Membership | None = None,
    table_session: TableSession | None = None,
    token_number: int | None = None,
    order_workflow: str = OrderWorkflow.TABLE_SERVICE,
    notes: str = "",
) -> Order:
    """Creates a production kitchen order ticket with authoritative server-side pricing."""
    if not items_data:
        raise ValidationError({"items": "Order must contain at least one item."})

    prev_tenant = get_current_tenant()
    token = set_current_tenant(branch.tenant) if prev_tenant != branch.tenant else None

    try:
        # Validate table session or counter token
        if order_workflow == OrderWorkflow.TABLE_SERVICE and not table_session:
            raise ValidationError(
                {
                    "table_session": (
                        "Table service orders must be anchored to an active TableSession."
                    )
                }
            )

        if table_session and table_session.status != "OPEN":
            raise ValidationError(
                {"table_session": "Cannot add orders to an expired or closed session."}
            )

        # Bulk fetch menu items strictly within active tenant
        item_ids = [item["menu_item_id"] for item in items_data]
        menu_items_map = {
            str(mi.id): mi for mi in MenuItem.objects.filter(tenant=branch.tenant, id__in=item_ids)
        }

        if len(menu_items_map) != len(set(item_ids)):
            missing = set(item_ids) - set(menu_items_map.keys())
            raise ValidationError({"items": f"Invalid or foreign menu items: {list(missing)}"})

        # Check for 86'd / sold-out items (check BranchItemAvailability and MenuItem.is_active)
        from apps.menu.models import BranchItemAvailability

        unavailable_item_ids = set(
            BranchItemAvailability.objects.filter(
                branch=branch, item__id__in=item_ids, is_available=False
            ).values_list("item_id", flat=True)
        )

        for item_data in items_data:
            m_item = menu_items_map[str(item_data["menu_item_id"])]
            if not m_item.is_active or m_item.id in unavailable_item_ids:
                raise ValidationError(
                    {"items": (f"'{m_item.name}' is currently sold out and cannot be ordered.")}
                )
            if int(item_data.get("quantity", 1)) < 1:
                raise ValidationError({"quantity": "Quantity must be at least 1."})

        # Create Order Header
        order = Order.objects.create(
            tenant=branch.tenant,
            branch=branch,
            table_session=table_session,
            order_workflow=order_workflow,
            status=OrderStatus.PLACED,
            token_number=token_number,
            placed_by=user_membership,
            notes=notes or "",
        )

        # Create Line Items snapshotting server-authoritative prices
        order_items = []
        for item_data in items_data:
            m_item = menu_items_map[str(item_data["menu_item_id"])]
            qty = int(item_data.get("quantity", 1))
            unit_price = getattr(m_item, "base_price_paise", getattr(m_item, "price_paise", 0))
            course = item_data.get("course", CourseType.MAIN)
            hold = bool(item_data.get("hold_mains", False) and course == CourseType.MAIN)
            item_status = "PENDING" if hold else "COOKING"

            order_items.append(
                OrderItem(
                    order=order,
                    menu_item=m_item,
                    item_name=m_item.name,
                    quantity=qty,
                    unit_price_paise=unit_price,
                    subtotal_paise=unit_price * qty,
                    course=course,
                    notes=item_data.get("special_instructions", item_data.get("notes", "")),
                    is_fired=not hold,
                    status=item_status,
                )
            )

        OrderItem.objects.bulk_create(order_items)

        # Update table session activity & mark table occupied
        if table_session:
            table_session.last_activity_at = timezone.now()
            table_session.save(update_fields=["last_activity_at"])
            if table_session.table and table_session.table.status != TableStatus.OCCUPIED:
                table_session.table.status = TableStatus.OCCUPIED
                table_session.table.save(update_fields=["status"])

        return order
    finally:
        if token is not None:
            reset_current_tenant(token)


def calculate_bill(table_session: TableSession) -> dict[str, Any]:
    """Calculates authoritative bill breakdown for an active table session."""
    prev_tenant = get_current_tenant()
    token = (
        set_current_tenant(table_session.tenant) if prev_tenant != table_session.tenant else None
    )

    try:
        active_orders = Order.objects.filter(
            table_session=table_session,
            status__in=[
                OrderStatus.PLACED,
                OrderStatus.PREPARING,
                OrderStatus.READY,
                OrderStatus.SERVED,
            ],
        ).prefetch_related("items")

        items_summary = []
        subtotal_paise = 0

        for order in active_orders:
            for it in order.items.all():
                items_summary.append(
                    {
                        "item_name": it.item_name,
                        "quantity": it.quantity,
                        "unit_price_paise": it.unit_price_paise,
                        "subtotal_paise": it.subtotal_paise,
                        "course": it.course,
                    }
                )
                subtotal_paise += it.subtotal_paise

        # Standard Restaurant GST Calculation (5% total: 2.5% CGST + 2.5% SGST)
        # Check tenant tax mode
        settings = getattr(table_session.tenant, "settings", None)
        is_inclusive = getattr(settings, "tax_mode", "EXCLUSIVE") == "INCLUSIVE"

        if is_inclusive:
            total_paise = subtotal_paise
            tax_paise = int(round(total_paise * 5 / 105))
            cgst_paise = tax_paise // 2
            sgst_paise = tax_paise - cgst_paise
            net_subtotal_paise = total_paise - tax_paise
        else:
            net_subtotal_paise = subtotal_paise
            cgst_paise = int(round(subtotal_paise * 0.025))
            sgst_paise = int(round(subtotal_paise * 0.025))
            total_paise = subtotal_paise + cgst_paise + sgst_paise

        return {
            "table_label": (table_session.table.label if table_session.table else "N/A"),
            "session_code": table_session.session_code,
            "items": items_summary,
            "items_count": sum(it["quantity"] for it in items_summary),
            "net_subtotal_paise": net_subtotal_paise,
            "cgst_paise": cgst_paise,
            "sgst_paise": sgst_paise,
            "total_tax_paise": cgst_paise + sgst_paise,
            "total_paise": total_paise,
            "is_inclusive": is_inclusive,
        }
    finally:
        if token is not None:
            reset_current_tenant(token)


@transaction.atomic
def settle_bill(
    table_session: TableSession,
    payment_method: str = PaymentMethod.CASH,
    amount_tendered_paise: int | None = None,
    user_membership: Membership | None = None,
    discount_paise: int = 0,
    notes: str = "",
) -> BillInvoice:
    """Settles an active table bill, generates commercial tax invoice, and frees the table."""
    prev_tenant = get_current_tenant()
    token = (
        set_current_tenant(table_session.tenant) if prev_tenant != table_session.tenant else None
    )

    try:
        bill_calc = calculate_bill(table_session)
        total_paise = max(0, bill_calc["total_paise"] - discount_paise)

        if amount_tendered_paise is None or amount_tendered_paise < total_paise:
            amount_tendered_paise = total_paise

        change_due_paise = max(0, amount_tendered_paise - total_paise)

        # Generate sequential invoice number: [PREFIX]-[YYYYMM]-[RAND4]
        prefix = getattr(table_session.branch, "invoice_prefix", "INV") or "INV"
        today_str = timezone.now().strftime("%Y%m")
        inv_count = (
            BillInvoice.objects.filter(
                tenant=table_session.tenant, branch=table_session.branch
            ).count()
            + 1
        )
        invoice_number = f"{prefix}-{today_str}-{inv_count:04d}"

        invoice = BillInvoice.objects.create(
            tenant=table_session.tenant,
            branch=table_session.branch,
            table_session=table_session,
            invoice_number=invoice_number,
            subtotal_paise=bill_calc["net_subtotal_paise"],
            cgst_paise=bill_calc["cgst_paise"],
            sgst_paise=bill_calc["sgst_paise"],
            discount_paise=discount_paise,
            total_paise=total_paise,
            payment_method=payment_method,
            amount_tendered_paise=amount_tendered_paise,
            change_due_paise=change_due_paise,
            is_settled=True,
            settled_at=timezone.now(),
            settled_by=user_membership,
            notes=notes or "",
        )

        # Transition all orders to COMPLETED
        Order.objects.filter(table_session=table_session).update(
            status=OrderStatus.COMPLETED,
            served_at=timezone.now(),
        )

        # Close table session and release physical table
        table_session.status = "CLOSED"
        table_session.closed_at = timezone.now()
        table_session.save(update_fields=["status", "closed_at"])

        if table_session.table:
            table_session.table.status = TableStatus.AVAILABLE
            table_session.table.save(update_fields=["status"])

        return invoice
    finally:
        if token is not None:
            reset_current_tenant(token)


@transaction.atomic
def transfer_table_session(
    table_session: TableSession,
    new_table: DiningTable,
    user_membership: Membership | None = None,
) -> TableSession:
    """Transfers an active dining session to a new physical table."""
    if table_session.status != "OPEN":
        raise ValidationError({"session": "Only open sessions can be transferred."})

    if new_table.tenant != table_session.tenant:
        raise ValidationError({"table": "Target table belongs to a different tenant."})

    if new_table.branch != table_session.branch:
        raise ValidationError({"table": "Target table belongs to a different branch."})

    if new_table.status != TableStatus.AVAILABLE:
        raise ValidationError(
            {"table": f"Table '{new_table.label}' is currently occupied or unavailable."}
        )

    old_table = table_session.table
    table_session.table = new_table
    table_session.save(update_fields=["table"])

    new_table.status = TableStatus.OCCUPIED
    new_table.save(update_fields=["status"])

    if old_table:
        old_table.status = TableStatus.AVAILABLE
        old_table.save(update_fields=["status"])

    return table_session
