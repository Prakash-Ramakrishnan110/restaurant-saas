import datetime
import zoneinfo
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Membership
from apps.audit.services import log_audit_event
from apps.core.context import get_current_tenant, reset_current_tenant, set_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.menu.models import BranchItemAvailability, ItemOptionGroup, ItemVariant, MenuItem, Option
from apps.orders.models import (
    BillInvoice,
    CourseType,
    Order,
    OrderEvent,
    OrderEventType,
    OrderItem,
    OrderPaymentStatus,
    OrderSource,
    OrderStatus,
    OrderWorkflow,
    PaymentMethod,
)
from apps.tenants.models import Branch, Tenant
from apps.venues.constants import PaymentTiming
from apps.venues.models import DiningTable, TableSession, TableStatus

ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    OrderStatus.PENDING_APPROVAL: [
        OrderStatus.PLACED,
        OrderStatus.AWAITING_PAYMENT,
        OrderStatus.CANCELLED,
    ],
    OrderStatus.AWAITING_PAYMENT: [OrderStatus.PLACED, OrderStatus.CANCELLED],
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
    elif new_status == OrderStatus.COMPLETED:
        order.completed_at = now
    elif new_status == OrderStatus.CANCELLED:
        order.cancelled_at = now
        order.rejected_reason = reason.strip()

    order.save()

    if new_status in (OrderStatus.SERVED, OrderStatus.COMPLETED):
        try:
            from apps.inventory.services import deplete_stock_for_order

            deplete_stock_for_order(order)
        except Exception:
            pass

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
    *,
    source: str = OrderSource.STAFF,
    initial_status: str = OrderStatus.PLACED,
    payment_status: str = OrderPaymentStatus.UNPAID,
    tracking_token: str | None = None,
    idempotency_key: str = "",
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
                    "table_session": "Table service orders must be anchored to an active TableSession."
                }
            )

        if table_session and table_session.status != "OPEN":
            raise ValidationError(
                {"table_session": "Cannot add orders to an expired or closed session."}
            )

        # Bulk fetch menu items strictly within active tenant
        item_ids = [str(item["menu_item_id"]) for item in items_data]
        menu_items_map = {
            str(mi.id): mi for mi in MenuItem.objects.filter(tenant=branch.tenant, id__in=item_ids)
        }

        if len(menu_items_map) != len(set(item_ids)):
            raise BusinessRuleError(
                "INVALID_REFERENCE",
                "One or more menu items are invalid.",
                status_code=400,
            )

        # Check for 86'd / sold-out items
        unavailable_item_ids = set(
            BranchItemAvailability.objects.filter(
                branch=branch, item__id__in=item_ids, is_available=False
            ).values_list("item_id", flat=True)
        )

        sold_out_ids: list[str] = []
        for item_data in items_data:
            m_item = menu_items_map[str(item_data["menu_item_id"])]
            if not m_item.is_active or m_item.id in unavailable_item_ids:
                sold_out_ids.append(str(m_item.id))
            if int(item_data.get("quantity", 1)) < 1:
                raise ValidationError({"quantity": "Quantity must be at least 1."})

        if sold_out_ids:
            raise BusinessRuleError(
                "ITEM_UNAVAILABLE",
                "One or more selected items are currently sold out or unavailable.",
                status_code=400,
                details={"item_ids": sold_out_ids},
            )

        # Preload variants and option groups for selected items
        variants_by_id = {str(v.id): v for v in ItemVariant.objects.filter(item_id__in=item_ids)}
        item_option_links = (
            ItemOptionGroup.objects.filter(item_id__in=item_ids, group__is_active=True)
            .select_related("group")
            .prefetch_related("group__options")
        )
        groups_by_item: dict[str, list[Any]] = {}
        for link in item_option_links:
            groups_by_item.setdefault(str(link.item_id), []).append(link.group)

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
            status=initial_status,
            source=source,
            payment_status=payment_status,
            tracking_token=tracking_token,
            idempotency_key=idempotency_key,
            token_number=token_number,
            placed_by=user_membership,
            notes=notes or "",
        )

        # Create Line Items snapshotting server-authoritative prices (ignoring any client sent prices)
        order_items = []
        for item_data in items_data:
            m_item = menu_items_map[str(item_data["menu_item_id"])]
            qty = int(item_data.get("quantity", 1))
            base_price = getattr(m_item, "base_price_paise", getattr(m_item, "price_paise", 0))
            variant_name = ""

            variant_id = item_data.get("variant_id")
            if variant_id:
                variant = variants_by_id.get(str(variant_id))
                if not variant or str(variant.item_id) != str(m_item.id):
                    raise BusinessRuleError(
                        "INVALID_REFERENCE",
                        "Selected variant is invalid for this item.",
                        status_code=400,
                    )
                base_price = variant.price_paise
                variant_name = variant.name

            raw_option_ids = item_data.get("option_ids")
            options_snapshot: list[dict[str, Any]] = []
            options_extra_paise = 0

            if raw_option_ids is not None or source == OrderSource.QR:
                selected_ids = [str(oid) for oid in (raw_option_ids or [])]
                item_groups = groups_by_item.get(str(m_item.id), [])
                valid_options_by_id: dict[str, Option] = {}
                group_option_ids: dict[str, set[str]] = {}
                for grp in item_groups:
                    opt_ids_for_grp: set[str] = set()
                    for opt in grp.options.all():
                        if opt.is_active:
                            valid_options_by_id[str(opt.id)] = opt
                            opt_ids_for_grp.add(str(opt.id))
                    group_option_ids[str(grp.id)] = opt_ids_for_grp

                for oid in selected_ids:
                    if oid not in valid_options_by_id:
                        raise BusinessRuleError(
                            "INVALID_REFERENCE",
                            "One or more selected options are invalid for this item.",
                            status_code=400,
                        )

                selected_set = set(selected_ids)
                for grp in item_groups:
                    count_in_grp = len(selected_set & group_option_ids.get(str(grp.id), set()))
                    if count_in_grp < grp.min_select or (
                        grp.max_select > 0 and count_in_grp > grp.max_select
                    ):
                        raise ValidationError(
                            {
                                "options": (
                                    f"Option group '{grp.name}' requires between "
                                    f"{grp.min_select} and {grp.max_select} selections."
                                )
                            }
                        )

                for oid in selected_set:
                    opt = valid_options_by_id[oid]
                    options_extra_paise += opt.price_delta_paise
                    options_snapshot.append(
                        {
                            "id": str(opt.id),
                            "name": opt.name,
                            "name_ta": opt.name_ta,
                            "price_delta_paise": opt.price_delta_paise,
                        }
                    )

            unit_price = base_price + options_extra_paise
            course = item_data.get("course", CourseType.MAIN)
            hold = bool(item_data.get("hold_mains", False) and course == CourseType.MAIN)
            item_status = (
                "PENDING"
                if (
                    hold
                    or initial_status
                    in (OrderStatus.PENDING_APPROVAL, OrderStatus.AWAITING_PAYMENT)
                )
                else "COOKING"
            )

            order_items.append(
                OrderItem(
                    order=order,
                    menu_item=m_item,
                    item_name=m_item.name,
                    variant_name=variant_name,
                    options_snapshot=options_snapshot,
                    quantity=qty,
                    unit_price_paise=unit_price,
                    subtotal_paise=unit_price * qty,
                    course=course,
                    seat_number=item_data.get("seat_number"),
                    notes=item_data.get("special_instructions", item_data.get("notes", "")),
                    is_fired=not hold and initial_status == OrderStatus.PLACED,
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
            to_status=initial_status,
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
            now = timezone.now()
            ord_obj.status = OrderStatus.COMPLETED
            ord_obj.payment_status = OrderPaymentStatus.PAID
            ord_obj.served_at = ord_obj.served_at or now
            ord_obj.completed_at = now
            ord_obj.save(update_fields=["status", "payment_status", "served_at", "completed_at"])

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
        inv_count = BillInvoice.objects.filter(tenant=order.tenant, branch=order.branch).count() + 1
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
        now = timezone.now()
        order.payment_status = OrderPaymentStatus.PAID
        if old_st == OrderStatus.AWAITING_PAYMENT:
            # Pay-first order becomes PLACED so kitchen can prepare it
            order.status = OrderStatus.PLACED
            order.save(update_fields=["status", "payment_status"])
            order.items.filter(status="PENDING").update(status="COOKING", is_fired=True)
            OrderEvent.objects.create(
                tenant=order.tenant,
                branch=order.branch,
                order=order,
                event_type=OrderEventType.STATUS_CHANGED,
                from_status=old_st,
                to_status=OrderStatus.PLACED,
                user=user_membership,
                notes=f"Pay-first order paid on invoice {invoice.invoice_number}; released to kitchen",
            )
        else:
            order.status = OrderStatus.COMPLETED
            order.served_at = order.served_at or now
            order.completed_at = now
            order.save(update_fields=["status", "payment_status", "served_at", "completed_at"])

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


def get_range_report(
    tenant: Tenant,
    start_date: datetime.date,
    end_date: datetime.date,
    branch: Branch | None = None,
) -> dict[str, Any]:
    """Generates operational sales, orders, and payment breakdown for a date range without floats."""
    from django.db.models import Count, Sum

    invoices_qs = BillInvoice.objects.filter(
        tenant=tenant,
        is_settled=True,
        settled_at__date__gte=start_date,
        settled_at__date__lte=end_date,
    )
    orders_qs = Order.objects.filter(
        tenant=tenant,
        placed_at__date__gte=start_date,
        placed_at__date__lte=end_date,
    )
    if branch:
        invoices_qs = invoices_qs.filter(branch=branch)
        orders_qs = orders_qs.filter(branch=branch)

    total_sales_paise = invoices_qs.aggregate(total=Sum("total_paise"))["total"] or 0
    orders_count = orders_qs.count()
    settled_invoices_count = invoices_qs.count()
    average_order_value_paise = (
        total_sales_paise // settled_invoices_count if settled_invoices_count > 0 else 0
    )

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

    daily_stats = (
        invoices_qs.values("settled_at__date")
        .annotate(sales_paise=Sum("total_paise"), invoices_count=Count("id"))
        .order_by("settled_at__date")
    )
    daily_breakdown = [
        {
            "date": str(row["settled_at__date"]),
            "sales_paise": row["sales_paise"] or 0,
            "invoices_count": row["invoices_count"] or 0,
        }
        for row in daily_stats
    ]

    top_items_qs = (
        OrderItem.objects.filter(order__in=orders_qs.exclude(status=OrderStatus.CANCELLED))
        .values("item_name")
        .annotate(quantity=Sum("quantity"), total_paise=Sum("subtotal_paise"))
        .order_by("-quantity")[:10]
    )
    top_items = [
        {
            "item_name": it["item_name"],
            "quantity": it["quantity"] or 0,
            "total_paise": it["total_paise"] or 0,
        }
        for it in top_items_qs
    ]

    top_categories_qs = (
        OrderItem.objects.filter(order__in=orders_qs.exclude(status=OrderStatus.CANCELLED))
        .values("menu_item__category__name")
        .annotate(quantity=Sum("quantity"), total_paise=Sum("subtotal_paise"))
        .order_by("-quantity")[:10]
    )
    top_categories = [
        {
            "category_name": it["menu_item__category__name"] or "General",
            "quantity": it["quantity"] or 0,
            "total_paise": it["total_paise"] or 0,
        }
        for it in top_categories_qs
    ]

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "sales_paise": total_sales_paise,
        "orders_count": orders_count,
        "settled_invoices_count": settled_invoices_count,
        "average_order_value_paise": average_order_value_paise,
        "sales_by_payment_method": sales_by_payment_method,
        "daily_breakdown": daily_breakdown,
        "top_items": top_items,
        "top_categories": top_categories,
    }


def get_exceptions_report(
    tenant: Tenant,
    start_date: datetime.date,
    end_date: datetime.date,
    branch: Branch | None = None,
) -> dict[str, Any]:
    """Summarizes operational exceptions: discounts applied, voided / cancelled orders, and reprints (H-01)."""
    from django.db.models import Sum

    from apps.audit.models import AuditLog

    invoices_qs = BillInvoice.objects.filter(
        tenant=tenant,
        is_settled=True,
        settled_at__date__gte=start_date,
        settled_at__date__lte=end_date,
    )
    orders_qs = Order.objects.filter(
        tenant=tenant,
        placed_at__date__gte=start_date,
        placed_at__date__lte=end_date,
    )
    if branch:
        invoices_qs = invoices_qs.filter(branch=branch)
        orders_qs = orders_qs.filter(branch=branch)

    # 1. Discount exceptions
    discounted_invoices = invoices_qs.filter(discount_paise__gt=0).select_related(
        "settled_by__user"
    )
    total_discount_paise = discounted_invoices.aggregate(total=Sum("discount_paise"))["total"] or 0
    discount_count = discounted_invoices.count()

    discount_items = [
        {
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "discount_paise": inv.discount_paise,
            "total_paise": inv.total_paise,
            "authorizer": (
                inv.settled_by.user.full_name
                if inv.settled_by and inv.settled_by.user
                else "System"
            ),
            "notes": inv.notes,
            "settled_at": inv.settled_at.isoformat() if inv.settled_at else "",
        }
        for inv in discounted_invoices[:50]
    ]

    # 2. Voided / Cancelled order exceptions
    cancelled_orders = orders_qs.filter(status=OrderStatus.CANCELLED)
    cancelled_count = cancelled_orders.count()
    cancelled_items = [
        {
            "id": str(ord.id),
            "order_number": str(ord.id)[:8],
            "workflow": ord.order_workflow,
            "notes": ord.notes,
            "placed_at": ord.placed_at.isoformat() if ord.placed_at else "",
        }
        for ord in cancelled_orders[:50]
    ]

    # 3. Reprint audit exceptions
    reprints_qs = AuditLog.objects.filter(
        tenant=tenant,
        action="printer.reprint",
        timestamp__date__gte=start_date,
        timestamp__date__lte=end_date,
    ).select_related("actor")
    reprints_count = reprints_qs.count()
    reprint_events = [
        {
            "id": str(ev.id),
            "actor": ev.actor.full_name if ev.actor else "Staff",
            "timestamp": ev.timestamp.isoformat(),
            "notes": f"Reprint of {ev.entity_type} {ev.entity_id[:8]}",
        }
        for ev in reprints_qs[:50]
    ]

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_discount_paise": total_discount_paise,
        "discounted_invoices_count": discount_count,
        "cancelled_orders_count": cancelled_count,
        "reprints_count": reprints_count,
        "discounts": discount_items,
        "cancellations": cancelled_items,
        "reprints": reprint_events,
    }


def get_staff_report(
    tenant: Tenant,
    start_date: datetime.date,
    end_date: datetime.date,
    branch: Branch | None = None,
) -> dict[str, Any]:
    """Summarizes staff efficiency: bills settled, sales generated, and average ticket size (H-22)."""
    from django.db.models import Count, Sum

    invoices_qs = BillInvoice.objects.filter(
        tenant=tenant,
        is_settled=True,
        settled_at__date__gte=start_date,
        settled_at__date__lte=end_date,
    )
    if branch:
        invoices_qs = invoices_qs.filter(branch=branch)

    staff_sales = (
        invoices_qs.filter(settled_by__isnull=False)
        .values("settled_by__user__id", "settled_by__user__full_name", "settled_by__role")
        .annotate(total_sales_paise=Sum("total_paise"), settled_count=Count("id"))
        .order_by("-total_sales_paise")
    )

    staff_list = [
        {
            "user_id": str(row["settled_by__user__id"]),
            "full_name": row["settled_by__user__full_name"] or "Staff Member",
            "role": row["settled_by__role"] or "CASHIER",
            "settled_count": row["settled_count"] or 0,
            "total_sales_paise": row["total_sales_paise"] or 0,
            "average_ticket_paise": (
                (row["total_sales_paise"] // row["settled_count"])
                if row["settled_count"] > 0
                else 0
            ),
        }
        for row in staff_sales
    ]

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "staff": staff_list,
    }


def get_outlets_report(
    tenant: Tenant,
    start_date: datetime.date,
    end_date: datetime.date,
) -> dict[str, Any]:
    """Compares performance across all branches/outlets (e.g. Lobby Cafe vs Rooftop Bar vs Room Service) (H-21)."""
    from django.db.models import Count, Sum

    invoices_qs = BillInvoice.objects.filter(
        tenant=tenant,
        is_settled=True,
        settled_at__date__gte=start_date,
        settled_at__date__lte=end_date,
    )

    outlet_stats = (
        invoices_qs.values("branch__id", "branch__name", "branch__venue_profile")
        .annotate(total_sales_paise=Sum("total_paise"), invoices_count=Count("id"))
        .order_by("-total_sales_paise")
    )

    outlets = [
        {
            "branch_id": str(row["branch__id"]),
            "name": row["branch__name"] or "Main Outlet",
            "venue_profile": row["branch__venue_profile"] or "CASUAL_DINING",
            "invoices_count": row["invoices_count"] or 0,
            "total_sales_paise": row["total_sales_paise"] or 0,
            "average_ticket_paise": (
                (row["total_sales_paise"] // row["invoices_count"])
                if row["invoices_count"] > 0
                else 0
            ),
        }
        for row in outlet_stats
    ]

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "outlets": outlets,
    }


def get_orders_delay_report(
    tenant: Tenant,
    start_date: datetime.date,
    end_date: datetime.date,
    branch: Branch | None = None,
) -> dict[str, Any]:
    """Analyzes order fulfillment speed and kitchen prep delays (H-06)."""
    orders_qs = Order.objects.filter(
        tenant=tenant,
        placed_at__date__gte=start_date,
        placed_at__date__lte=end_date,
    )
    if branch:
        orders_qs = orders_qs.filter(branch=branch)

    total_orders = orders_qs.count()
    completed_orders = orders_qs.filter(status=OrderStatus.COMPLETED)

    prep_times = []
    delayed_orders = []
    for ord in orders_qs.filter(ready_at__isnull=False, placed_at__isnull=False)[:100]:
        diff_mins = int((ord.ready_at - ord.placed_at).total_seconds() // 60)
        prep_times.append(diff_mins)
        if diff_mins > 25:
            delayed_orders.append(
                {
                    "id": str(ord.id),
                    "order_number": str(ord.id)[:8],
                    "workflow": ord.order_workflow,
                    "prep_minutes": diff_mins,
                    "status": ord.status,
                }
            )

    avg_prep_minutes = (sum(prep_times) // len(prep_times)) if prep_times else 15

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_orders": total_orders,
        "completed_count": completed_orders.count(),
        "average_prep_minutes": avg_prep_minutes,
        "delayed_orders_count": len(delayed_orders),
        "delayed_orders": delayed_orders[:20],
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


@transaction.atomic
def approve_qr_order(
    order: Order,
    user_membership: Membership | None = None,
    request: Any = None,
) -> Order:
    """Approve a PENDING_APPROVAL QR order, moving it to AWAITING_PAYMENT (if PAY_FIRST) or PLACED."""
    if order.status != OrderStatus.PENDING_APPROVAL:
        raise BusinessRuleError(
            "INVALID_STATUS_TRANSITION",
            f"Order is in '{order.status}' status and cannot be approved.",
            status_code=400,
        )

    capabilities = getattr(order.branch, "capabilities", None)
    is_pay_first = bool(capabilities and capabilities.payment_timing == PaymentTiming.PAY_FIRST)
    next_status = (
        OrderStatus.AWAITING_PAYMENT
        if is_pay_first and order.payment_status != OrderPaymentStatus.PAID
        else OrderStatus.PLACED
    )

    order.status = next_status
    order.save(update_fields=["status"])

    if next_status == OrderStatus.PLACED:
        order.items.filter(status="PENDING").update(status="COOKING", is_fired=True)

    OrderEvent.objects.create(
        tenant=order.tenant,
        branch=order.branch,
        order=order,
        event_type=OrderEventType.STATUS_CHANGED,
        from_status=OrderStatus.PENDING_APPROVAL,
        to_status=next_status,
        user=user_membership,
        notes="QR order approved by staff",
    )

    log_audit_event(
        action="order.qr_approved",
        entity_type="Order",
        entity_id=str(order.id),
        actor=user_membership.user if user_membership else None,
        tenant=order.tenant,
        before_state={"status": OrderStatus.PENDING_APPROVAL},
        after_state={"status": next_status},
        request=request,
    )
    return order


@transaction.atomic
def reject_qr_order(
    order: Order,
    reason: str,
    user_membership: Membership | None = None,
    request: Any = None,
) -> Order:
    """Reject a PENDING_APPROVAL QR order with a mandatory customer-visible reason."""
    clean_reason = (reason or "").strip()
    if not clean_reason:
        raise ValidationError({"reason": "A rejection reason is required."})

    if order.status != OrderStatus.PENDING_APPROVAL:
        raise BusinessRuleError(
            "INVALID_STATUS_TRANSITION",
            f"Order is in '{order.status}' status and cannot be rejected.",
            status_code=400,
        )

    order.status = OrderStatus.CANCELLED
    order.rejected_reason = clean_reason
    order.cancelled_at = timezone.now()
    order.save(update_fields=["status", "rejected_reason", "cancelled_at"])

    OrderEvent.objects.create(
        tenant=order.tenant,
        branch=order.branch,
        order=order,
        event_type=OrderEventType.CANCELLED,
        from_status=OrderStatus.PENDING_APPROVAL,
        to_status=OrderStatus.CANCELLED,
        user=user_membership,
        notes=clean_reason,
    )

    log_audit_event(
        action="order.qr_rejected",
        entity_type="Order",
        entity_id=str(order.id),
        actor=user_membership.user if user_membership else None,
        tenant=order.tenant,
        before_state={"status": OrderStatus.PENDING_APPROVAL},
        after_state={"status": OrderStatus.CANCELLED, "rejected_reason": clean_reason},
        request=request,
    )
    return order
