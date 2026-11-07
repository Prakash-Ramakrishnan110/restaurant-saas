import zoneinfo
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.accounts.models import Membership
from apps.core.context import get_current_tenant, reset_current_tenant, set_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.menu.models import BranchItemAvailability, MenuItem
from apps.orders.models import (
    BillInvoice,
    CourseType,
    Order,
    OrderEvent,
    OrderEventType,
    OrderItem,
    OrderStatus,
    OrderWorkflow,
    PaymentMethod,
)
from apps.tenants.models import Branch, Tenant
from apps.venues.models import DiningTable, TableSession, TableStatus

ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    OrderStatus.PLACED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    OrderStatus.PREPARING: [OrderStatus.READY, OrderStatus.CANCELLED],
    OrderStatus.READY: [OrderStatus.SERVED, OrderStatus.CANCELLED],
    OrderStatus.SERVED: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    OrderStatus.COMPLETED: [],
    OrderStatus.CANCELLED: [],
}


@transaction.atomic
def transition_order_status(
    order: Order,
    new_status: str,
    user_membership: Membership | None = None,
    reason: str = "",
) -> Order:
    """Transitions order status enforcing state machine and logging OrderEvent."""
    from_status = order.status
    allowed = ALLOWED_TRANSITIONS.get(from_status, [])

    if new_status not in allowed:
        raise BusinessRuleError(
            error_code="INVALID_STATUS_TRANSITION",
            message=f"Cannot transition order from {from_status} to {new_status}.",
            details={"from": from_status, "to": new_status, "allowed": allowed},
        )

    if new_status == OrderStatus.CANCELLED:
        if not reason.strip():
            raise ValidationError({"reason": "A cancellation reason is required."})

    order.status = new_status
    now = timezone.now()
    if new_status == OrderStatus.READY:
        order.ready_at = now
    elif new_status == OrderStatus.SERVED:
        order.served_at = now

    order.save()

    event_type = (
        OrderEventType.CANCELLED
        if new_status == OrderStatus.CANCELLED
        else OrderEventType.STATUS_CHANGED
    )
    OrderEvent.objects.create(
        tenant=order.tenant,
        branch=order.branch,
        order=order,
        event_type=event_type,
        from_status=from_status,
        to_status=new_status,
        user=user_membership,
        notes=reason if new_status == OrderStatus.CANCELLED else f"Status changed to {new_status}",
    )
    return order


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
                {"table_session": "Table service orders must be anchored to an active TableSession."}
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

        # Check for 86'd / sold-out items
        unavailable_item_ids = set(
            BranchItemAvailability.objects.filter(
                branch=branch, item__id__in=item_ids, is_available=False
            ).values_list("item_id", flat=True)
        )

        for item_data in items_data:
            m_item = menu_items_map[str(item_data["menu_item_id"])]
            if not m_item.is_active or m_item.id in unavailable_item_ids:
                raise ValidationError(
                    {"items": f"'{m_item.name}' is currently sold out and cannot be ordered."}
                )
            if int(item_data.get("quantity", 1)) < 1:
                raise ValidationError({"quantity": "Quantity must be at least 1."})

        # Lock branch to serialize order sequence generation concurrently
        Branch.objects.select_for_update().only("id").get(pk=branch.pk)

        order_count = Order.objects.filter(tenant=branch.tenant, branch=branch).count() + 1
        today_str = timezone.now().strftime("%Y%m")
        order_number = f"ORD-{today_str}-{order_count:04d}"

        # Create Order Header
        order = Order.objects.create(
            tenant=branch.tenant,
            branch=branch,
            order_number=order_number,
            table_session=table_session,
            order_workflow=order_workflow,
            status=OrderStatus.PLACED,
            token_number=token_number,
            placed_by=user_membership,
            notes=notes or "",
        )

        # Create Line Items snapshotting server-authoritative prices (ignoring any client sent prices)
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

        # Create audit event
        OrderEvent.objects.create(
            tenant=branch.tenant,
            branch=branch,
            order=order,
            event_type=OrderEventType.CREATED,
            to_status=OrderStatus.PLACED,
            user=user_membership,
            notes=notes or "Order placed",
        )

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
    """Calculates authoritative bill breakdown for an active table session without tax (pure sum of lines)."""
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

        items_summary: list[dict[str, Any]] = []
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

        # No tax calculation - pending accountant confirmation.
        total_paise = subtotal_paise

        return {
            "table_label": (table_session.table.label if table_session.table else "N/A"),
            "session_code": table_session.session_code,
            "items": items_summary,
            "items_count": sum(it["quantity"] for it in items_summary),
            "subtotal_paise": subtotal_paise,
            "discount_paise": 0,
            "total_paise": total_paise,
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
    """Settles an active table bill, generates invoice, and frees the table."""
    prev_tenant = get_current_tenant()
    token = (
        set_current_tenant(table_session.tenant) if prev_tenant != table_session.tenant else None
    )

    try:
        # Prevent double payment
        if BillInvoice.objects.filter(table_session=table_session, is_settled=True).exists():
            raise ValidationError(
                {"table_session": "Bill has already been settled for this dining session."}
            )

        bill_calc = calculate_bill(table_session)
        total_paise = max(0, bill_calc["total_paise"] - discount_paise)

        if amount_tendered_paise is not None and amount_tendered_paise < total_paise:
            raise ValidationError(
                {
                    "amount_tendered_paise": (
                        f"Amount tendered ({amount_tendered_paise} paise) cannot be less than total ({total_paise} paise)."
                    )
                }
            )

        if amount_tendered_paise is None:
            amount_tendered_paise = total_paise

        change_due_paise = max(0, amount_tendered_paise - total_paise)

        # Lock branch row to serialize concurrent invoice number generation
        Branch.objects.select_for_update().only("id").get(pk=table_session.branch.pk)

        # Generate sequential invoice number: [PREFIX]-[YYYYMM]-[SEQ4]
        prefix = getattr(table_session.branch, "invoice_prefix", "INV") or "INV"
        today_str = timezone.now().strftime("%Y%m")
        inv_count = (
            BillInvoice.objects.filter(
                tenant=table_session.tenant, branch=table_session.branch
            ).count()
            + 1
        )
        invoice_number = f"{prefix}-{today_str}-{inv_count:04d}"

        # Snapshot line items
        snapshot_lines = [
            {
                "item_name": it["item_name"],
                "quantity": it["quantity"],
                "unit_price_paise": it["unit_price_paise"],
                "subtotal_paise": it["subtotal_paise"],
            }
            for it in bill_calc["items"]
        ]

        invoice = BillInvoice.objects.create(
            tenant=table_session.tenant,
            branch=table_session.branch,
            table_session=table_session,
            invoice_number=invoice_number,
            subtotal_paise=bill_calc["subtotal_paise"],
            discount_paise=discount_paise,
            total_paise=total_paise,
            snapshot_lines=snapshot_lines,
            payment_method=payment_method,
            amount_tendered_paise=amount_tendered_paise,
            change_due_paise=change_due_paise,
            is_settled=True,
            settled_at=timezone.now(),
            settled_by=user_membership,
            notes=notes or "",
        )

        # Transition all active orders to COMPLETED and log events
        for ord_obj in Order.objects.filter(table_session=table_session).exclude(
            status=OrderStatus.CANCELLED
        ):
            old_st = ord_obj.status
            ord_obj.status = OrderStatus.COMPLETED
            ord_obj.served_at = timezone.now()
            ord_obj.save(update_fields=["status", "served_at"])

            OrderEvent.objects.create(
                tenant=table_session.tenant,
                branch=table_session.branch,
                order=ord_obj,
                event_type=OrderEventType.COMPLETED,
                from_status=old_st,
                to_status=OrderStatus.COMPLETED,
                user=user_membership,
                notes=f"Settled on invoice {invoice.invoice_number}",
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
def settle_order_bill(
    order: Order,
    payment_method: str = PaymentMethod.CASH,
    amount_tendered_paise: int | None = None,
    user_membership: Membership | None = None,
    discount_paise: int = 0,
    notes: str = "",
) -> BillInvoice:
    """Settles a direct counter / takeaway order without table session."""
    prev_tenant = get_current_tenant()
    token = set_current_tenant(order.tenant) if prev_tenant != order.tenant else None

    try:
        if order.status == OrderStatus.COMPLETED:
            raise ValidationError({"order": "Order is already settled and completed."})

        total_paise = max(0, order.total_paise - discount_paise)
        if amount_tendered_paise is not None and amount_tendered_paise < total_paise:
            raise ValidationError(
                {
                    "amount_tendered_paise": (
                        f"Amount tendered ({amount_tendered_paise} paise) cannot be less than total ({total_paise} paise)."
                    )
                }
            )

        if amount_tendered_paise is None:
            amount_tendered_paise = total_paise

        change_due_paise = max(0, amount_tendered_paise - total_paise)

        Branch.objects.select_for_update().only("id").get(pk=order.branch.pk)

        prefix = getattr(order.branch, "invoice_prefix", "INV") or "INV"
        today_str = timezone.now().strftime("%Y%m")
        inv_count = (
            BillInvoice.objects.filter(tenant=order.tenant, branch=order.branch).count() + 1
        )
        invoice_number = f"{prefix}-{today_str}-{inv_count:04d}"

        snapshot_lines = [
            {
                "item_name": it.item_name,
                "quantity": it.quantity,
                "unit_price_paise": it.unit_price_paise,
                "subtotal_paise": it.subtotal_paise,
            }
            for it in order.items.all()
        ]

        invoice = BillInvoice.objects.create(
            tenant=order.tenant,
            branch=order.branch,
            table_session=None,
            invoice_number=invoice_number,
            subtotal_paise=order.total_paise,
            discount_paise=discount_paise,
            total_paise=total_paise,
            snapshot_lines=snapshot_lines,
            payment_method=payment_method,
            amount_tendered_paise=amount_tendered_paise,
            change_due_paise=change_due_paise,
            is_settled=True,
            settled_at=timezone.now(),
            settled_by=user_membership,
            notes=notes or "",
        )

        old_st = order.status
        order.status = OrderStatus.COMPLETED
        order.served_at = timezone.now()
        order.save(update_fields=["status", "served_at"])

        OrderEvent.objects.create(
            tenant=order.tenant,
            branch=order.branch,
            order=order,
            event_type=OrderEventType.COMPLETED,
            from_status=old_st,
            to_status=OrderStatus.COMPLETED,
            user=user_membership,
            notes=f"Settled on counter invoice {invoice.invoice_number}",
        )
        return invoice
    finally:
        if token is not None:
            reset_current_tenant(token)


def get_today_report(tenant: Tenant, branch: Branch | None = None) -> dict[str, Any]:
    """Generates today's operational sales, orders, and payment breakdown without floats."""
    tz_name = getattr(tenant, "timezone", None) or "Asia/Kolkata"
    try:
        tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        tz = zoneinfo.ZoneInfo("Asia/Kolkata")

    today = timezone.now().astimezone(tz).date()

    invoices_qs = BillInvoice.objects.filter(
        tenant=tenant,
        is_settled=True,
        settled_at__date=today,
    )
    orders_qs = Order.objects.filter(
        tenant=tenant,
        placed_at__date=today,
    )
    if branch:
        invoices_qs = invoices_qs.filter(branch=branch)
        orders_qs = orders_qs.filter(branch=branch)

    from django.db.models import Sum

    total_sales_paise = invoices_qs.aggregate(total=Sum("total_paise"))["total"] or 0
    orders_count = orders_qs.count()
    settled_invoices_count = invoices_qs.count()
    average_order_value_paise = (
        total_sales_paise // settled_invoices_count if settled_invoices_count > 0 else 0
    )

    open_orders_count = orders_qs.filter(
        status__in=[OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.READY]
    ).count()

    sales_by_payment_method: dict[str, int] = {
        "CASH": 0,
        "UPI": 0,
        "CARD": 0,
        "ROOM_FOLIO": 0,
    }
    for row in invoices_qs.values("payment_method").annotate(total=Sum("total_paise")):
        method = row["payment_method"]
        if method in sales_by_payment_method:
            sales_by_payment_method[method] = row["total"] or 0

    top_items = []
    items_qs = (
        OrderItem.objects.filter(order__in=orders_qs.exclude(status=OrderStatus.CANCELLED))
        .values("item_name")
        .annotate(qty=Sum("quantity"), total_paise=Sum("subtotal_paise"))
        .order_by("-qty")[:5]
    )
    for it in items_qs:
        top_items.append(
            {
                "item_name": it["item_name"],
                "quantity": it["qty"] or 0,
                "total_paise": it["total_paise"] or 0,
            }
        )

    last_bills = []
    for inv in invoices_qs.select_related("table_session__table").order_by("-settled_at")[:10]:
        t_label = (
            inv.table_session.table.label
            if inv.table_session and inv.table_session.table
            else "Counter"
        )
        last_bills.append(
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "table_label": t_label,
                "total_paise": inv.total_paise,
                "payment_method": inv.payment_method,
                "settled_at": inv.settled_at.isoformat() if inv.settled_at else "",
            }
        )

    return {
        "date": today.isoformat(),
        "sales_paise": total_sales_paise,
        "orders_count": orders_count,
        "settled_invoices_count": settled_invoices_count,
        "average_order_value_paise": average_order_value_paise,
        "open_orders": open_orders_count,
        "sales_by_payment_method": sales_by_payment_method,
        "top_items": top_items,
        "last_bills": last_bills,
    }


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

