import datetime
import zoneinfo
from typing import Any

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import Membership
from apps.audit.services import log_audit_event
from apps.core.context import get_current_tenant, reset_current_tenant, set_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.menu.models import BranchItemAvailability, ItemOptionGroup, ItemVariant, MenuItem, Option
from apps.orders.models import (
    BillInvoice,
    BranchNotificationEvent,
    CashierShiftCloseout,
    CashMovement,
    CashMovementType,
    CourseType,
    InvoiceRefund,
    Order,
    OrderEvent,
    OrderEventType,
    OrderItem,
    OrderPaymentStatus,
    OrderSource,
    OrderStatus,
    OrderWorkflow,
    PaymentMethod,
    RefundReasonCode,
    RefundRestockAction,
    ShiftStatus,
    VarianceReasonCode,
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
def _schedule_order_stock_deduction(order: Order) -> None:
    """Enqueue idempotent post-commit stock & takeaway packaging deduction tasks."""
    line_ids = [str(lid) for lid in order.items.values_list("id", flat=True)]
    order_id = str(order.id)
    tenant_id = str(order.tenant_id)
    is_takeaway = order.order_workflow == OrderWorkflow.COUNTER_TOKEN

    def _enqueue() -> None:
        try:
            from apps.inventory.tasks import (
                deduct_order_line_stock_task,
                deduct_takeaway_packaging_task,
            )

            for lid in line_ids:
                deduct_order_line_stock_task.delay(lid, tenant_id)
            if is_takeaway:
                deduct_takeaway_packaging_task.delay(order_id, tenant_id)
        except Exception:
            pass
        finally:
            try:
                from celery._state import _set_task_join_will_block

                _set_task_join_will_block(False)
            except Exception:
                pass

    transaction.on_commit(_enqueue)


def _schedule_order_cancellation_waste(order: Order, *, was_preparing: bool) -> None:
    """Enqueue post-commit CANCELLED_AFTER_COOKING waste task when cancelled after preparing."""
    if not was_preparing:
        return
    line_ids = [str(lid) for lid in order.items.values_list("id", flat=True)]
    tenant_id = str(order.tenant_id)

    def _enqueue() -> None:
        try:
            from apps.inventory.tasks import cancel_order_line_deduction_task

            for lid in line_ids:
                cancel_order_line_deduction_task.delay(lid, True, tenant_id)
        except Exception:
            pass
        finally:
            try:
                from celery._state import _set_task_join_will_block

                _set_task_join_will_block(False)
            except Exception:
                pass

    transaction.on_commit(_enqueue)


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
        if order.token_number is not None:
            order.last_called_at = now
            if order.call_count < 1:
                order.call_count = 1
    elif new_status == OrderStatus.SERVED:
        order.served_at = now
    elif new_status == OrderStatus.COMPLETED:
        order.completed_at = now
    elif new_status == OrderStatus.CANCELLED:
        order.cancelled_at = now
        order.rejected_reason = reason.strip()

    order.save()

    if new_status == OrderStatus.PREPARING:
        _schedule_order_stock_deduction(order)
    elif new_status == OrderStatus.CANCELLED:
        was_preparing = from_status in {
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.SERVED,
        }
        _schedule_order_cancellation_waste(order, was_preparing=was_preparing)

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
    try:
        from apps.orders.consumers import broadcast_branch_event

        broadcast_branch_event(
            order.tenant_id,
            order.branch_id,
            "order.status_changed",
            {
                "order_id": str(order.id),
                "order_number": order.order_number,
                "from_status": from_status,
                "status": new_status,
            },
        )
    except Exception:
        pass
    if new_status == OrderStatus.READY:
        t_type, t_label = _safe_target_label_for_order(order)
        ev_type = "token_ready" if t_type == "TOKEN" else "table_ready"
        record_branch_notification_event(
            branch=order.branch,
            event_type=ev_type,
            order=order,
            target_label=t_label,
            token_number=order.token_number,
        )
    return order


EVENT_ROLE_CATALOG: dict[str, list[str]] = {
    "new_order": ["KITCHEN", "BRANCH_MANAGER", "OWNER"],
    "qr_needs_approval": ["WAITER", "CASHIER", "BRANCH_MANAGER", "OWNER"],
    "pay_first_waiting": ["CASHIER", "BRANCH_MANAGER", "OWNER"],
    "table_ready": ["WAITER", "BRANCH_MANAGER", "OWNER"],
    "token_ready": ["CASHIER", "WAITER", "BRANCH_MANAGER", "OWNER"],
    "guest_request_service": ["WAITER", "BRANCH_MANAGER", "OWNER"],
    "guest_request_bill": ["CASHIER", "WAITER", "BRANCH_MANAGER", "OWNER"],
    "ticket_late": ["KITCHEN", "BRANCH_MANAGER", "OWNER"],
    "payment_received": ["CASHIER", "BRANCH_MANAGER", "OWNER"],
}

DEFAULT_BRANCH_SOUND_SETTINGS: dict[str, Any] = {
    "voice_language": "AUTO",
    "dish_announcement_level": "SUMMARY",
    "speech_rate": 1.0,
    "events": {
        "new_order": {"chime": True, "voice": True, "repeat_seconds": 60, "nag": False},
        "qr_needs_approval": {"chime": True, "voice": True, "repeat_seconds": 90, "nag": True},
        "pay_first_waiting": {"chime": True, "voice": True, "repeat_seconds": 0, "nag": False},
        "table_ready": {"chime": True, "voice": True, "repeat_seconds": 45, "max_repeats": 3},
        "token_ready": {"chime": True, "voice": True, "repeat_seconds": 0, "nag": False},
        "guest_request_service": {
            "chime": True,
            "voice": True,
            "repeat_seconds": 90,
            "nag": True,
        },
        "guest_request_bill": {"chime": True, "voice": True, "repeat_seconds": 90, "nag": True},
        "ticket_late": {"chime": True, "voice": True, "repeat_seconds": 120, "nag": True},
        "payment_received": {"chime": True, "voice": False, "repeat_seconds": 0, "nag": False},
    },
}


def _safe_target_label_for_order(order: Order) -> tuple[str, str]:
    """Return (target_type, safe_target_label) without any customer PII or notes."""
    if order.token_number is not None or order.order_workflow == OrderWorkflow.COUNTER_TOKEN:
        tok = order.token_number or 0
        return "TOKEN", f"Token {tok}"
    if order.table_session and order.table_session.table:
        return "TABLE", str(order.table_session.table.label)
    return "ORDER", str(order.order_number or "Order")


def _safe_dishes_for_order(order: Order) -> tuple[list[dict[str, Any]], int]:
    """Return up to 8 safe {name, name_ta, qty} entries and total line count (no prices or notes)."""
    items = list(order.items.select_related("menu_item").all())
    dishes: list[dict[str, Any]] = []
    for it in items[:8]:
        name_ta = ""
        if getattr(it, "menu_item", None) is not None:
            name_ta = str(getattr(it.menu_item, "name_ta", "") or "")
        dishes.append(
            {
                "name": str(it.item_name or "")[:80],
                "name_ta": name_ta[:80],
                "qty": int(it.quantity or 1),
            }
        )
    return dishes, len(items)


@transaction.atomic
def record_branch_notification_event(
    *,
    branch: Branch,
    event_type: str,
    order: Order | None = None,
    service_request: Any | None = None,
    target_label: str = "",
    token_number: int | None = None,
    dishes: list[dict[str, Any]] | None = None,
    total_items: int | None = None,
    request_type: str = "",
    is_recall: bool = False,
    elapsed_minutes: int | None = None,
) -> BranchNotificationEvent:
    """Append an atomic branch-sequenced notification event containing zero PII or prices."""
    Branch.unscoped.select_for_update().only("id").get(pk=branch.pk)
    last_seq = (
        BranchNotificationEvent.unscoped.filter(branch=branch).aggregate(m=Max("seq"))["m"] or 0
    )
    safe_dishes = [
        {
            "name": str(d.get("name", ""))[:80],
            "name_ta": str(d.get("name_ta", ""))[:80],
            "qty": int(d.get("qty", 1)),
        }
        for d in (dishes or [])[:8]
    ]
    payload: dict[str, Any] = {
        "order_id": str(order.id) if order else None,
        "service_request_id": str(service_request.id) if service_request else None,
        "dishes": safe_dishes,
        "total_items": int(total_items if total_items is not None else len(safe_dishes)),
        "request_type": str(request_type or "")[:32],
        "is_recall": bool(is_recall),
        "elapsed_minutes": elapsed_minutes,
    }
    return BranchNotificationEvent.unscoped.create(
        tenant=branch.tenant,
        branch=branch,
        seq=last_seq + 1,
        event_type=event_type,
        order=order,
        service_request=service_request,
        target_label=str(target_label or "")[:64],
        token_number=token_number,
        target_roles=EVENT_ROLE_CATALOG.get(event_type, ["BRANCH_MANAGER", "OWNER"]),
        payload=payload,
    )


@transaction.atomic
def call_order_token(
    order: Order,
    *,
    user_membership: Membership | None = None,
) -> Order:
    """Marks/re-announces a counter token order as actively called for Token TV."""
    if order.token_number is None:
        raise BusinessRuleError(
            "NO_TOKEN_ASSIGNED",
            "Only orders with a counter token number can be called on Token TV.",
            status_code=400,
        )
    if order.status not in (OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.READY):
        raise BusinessRuleError(
            "INVALID_ORDER_STATE",
            f"Cannot call token while order is in '{order.status}' state.",
            status_code=400,
        )

    now = timezone.now()
    from_status = order.status
    if order.status in (OrderStatus.PLACED, OrderStatus.PREPARING):
        order.status = OrderStatus.READY
        if order.ready_at is None:
            order.ready_at = now
    order.call_count = (order.call_count or 0) + 1
    order.last_called_at = now
    order.save(update_fields=["status", "ready_at", "call_count", "last_called_at", "updated_at"])

    OrderEvent.objects.create(
        tenant=order.tenant,
        branch=order.branch,
        order=order,
        event_type=OrderEventType.TOKEN_CALLED,
        from_status=from_status,
        to_status=order.status,
        user=user_membership,
        notes=f"Token #{order.token_number} called (#{order.call_count})",
    )
    log_audit_event(
        action="order.token_called",
        entity_type="Order",
        entity_id=str(order.id),
        actor=user_membership.user if user_membership else None,
        tenant=order.tenant,
        after_state={
            "order_number": order.order_number,
            "token_number": order.token_number,
            "call_count": order.call_count,
            "status": order.status,
        },
    )
    try:
        from apps.orders.consumers import broadcast_branch_event

        broadcast_branch_event(
            order.tenant_id,
            order.branch_id,
            "order.token_called",
            {
                "order_id": str(order.id),
                "order_number": order.order_number,
                "token_number": order.token_number,
                "call_count": order.call_count,
                "last_called_at": now.isoformat(),
                "status": order.status,
            },
        )
    except Exception:
        pass
    record_branch_notification_event(
        branch=order.branch,
        event_type="token_ready",
        order=order,
        target_label=f"Token {order.token_number}",
        token_number=order.token_number,
        is_recall=(order.call_count > 1),
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
    guest_label: str = "",
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
        Branch.unscoped.select_for_update().only("id").get(pk=branch.pk)

        if order_workflow == OrderWorkflow.COUNTER_TOKEN and token_number is None:
            from apps.venues.services import next_token

            token_number = next_token(branch)

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
            guest_label=(guest_label or "").strip()[:20],
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

        try:
            from apps.orders.consumers import broadcast_branch_event

            broadcast_branch_event(
                branch.tenant_id,
                branch.id,
                "order.created",
                {
                    "order_id": str(order.id),
                    "order_number": order.order_number,
                    "status": order.status,
                },
            )
        except Exception:
            pass

        t_type, t_label = _safe_target_label_for_order(order)
        safe_dishes, total_count = _safe_dishes_for_order(order)
        if initial_status == OrderStatus.PENDING_APPROVAL:
            record_branch_notification_event(
                branch=branch,
                event_type="qr_needs_approval",
                order=order,
                target_label=t_label,
                token_number=order.token_number,
            )
        elif initial_status == OrderStatus.AWAITING_PAYMENT:
            record_branch_notification_event(
                branch=branch,
                event_type="pay_first_waiting",
                order=order,
                target_label=t_label,
                token_number=order.token_number,
            )
        elif initial_status == OrderStatus.PLACED:
            record_branch_notification_event(
                branch=branch,
                event_type="new_order",
                order=order,
                target_label=t_label,
                token_number=order.token_number,
                dishes=safe_dishes,
                total_items=total_count,
            )

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
                        "id": str(it.id),
                        "order_id": str(order.id),
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
    customer_id: Any = None,
    redeem_loyalty_points: int = 0,
) -> BillInvoice:
    """Settles an active table bill, processes guest loyalty points, generates invoice, and frees the table."""
    from apps.orders.models import Customer

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

        customer_obj: Customer | None = None
        points_to_redeem = max(0, int(redeem_loyalty_points or 0))
        if customer_id:
            customer_obj = (
                Customer.objects.select_for_update()
                .filter(tenant=table_session.tenant, id=customer_id)
                .first()
            )
            if customer_obj is None:
                raise ValidationError({"customer_id": "Guest profile not found."})
            if points_to_redeem > 0:
                if not customer_obj.consent_given:
                    raise BusinessRuleError(
                        "CONSENT_REQUIRED",
                        "Guest must provide explicit consent to earn or redeem loyalty points.",
                        status_code=400,
                    )
                if points_to_redeem > customer_obj.loyalty_points:
                    raise BusinessRuleError(
                        "INSUFFICIENT_LOYALTY_POINTS",
                        f"Guest only has {customer_obj.loyalty_points} loyalty points available.",
                        status_code=400,
                    )
                loyalty_discount_paise = points_to_redeem * 100
                discount_paise = min(
                    bill_calc["total_paise"], discount_paise + loyalty_discount_paise
                )

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
            _schedule_order_stock_deduction(ord_obj)

        # Close table session and release physical table
        table_session.status = "CLOSED"
        table_session.closed_at = timezone.now()
        table_session.save(update_fields=["status", "closed_at"])

        if table_session.table:
            table_session.table.status = TableStatus.AVAILABLE
            table_session.table.save(update_fields=["status"])

        if customer_obj is not None:
            customer_obj.visit_count += 1
            customer_obj.total_spend_paise += total_paise
            customer_obj.last_visit_at = timezone.now()
            if customer_obj.consent_given:
                earned_points = total_paise // 10000
                customer_obj.loyalty_points = (
                    max(0, customer_obj.loyalty_points - points_to_redeem) + earned_points
                )
                customer_obj.lifetime_points_earned += earned_points
                customer_obj.lifetime_points_redeemed += points_to_redeem
            customer_obj.save()

        session_label = (
            table_session.table.label if table_session.table else f"Bill {invoice.invoice_number}"
        )
        record_branch_notification_event(
            branch=table_session.branch,
            event_type="payment_received",
            target_label=session_label,
        )

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
        _schedule_order_stock_deduction(order)
        t_type, t_label = _safe_target_label_for_order(order)
        if old_st == OrderStatus.AWAITING_PAYMENT:
            safe_dishes, total_count = _safe_dishes_for_order(order)
            record_branch_notification_event(
                branch=order.branch,
                event_type="new_order",
                order=order,
                target_label=t_label,
                token_number=order.token_number,
                dishes=safe_dishes,
                total_items=total_count,
            )
        record_branch_notification_event(
            branch=order.branch,
            event_type="payment_received",
            order=order,
            target_label=t_label,
            token_number=order.token_number,
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

    refunds_qs = InvoiceRefund.objects.filter(
        tenant=tenant,
        created_at__date=today,
    )
    if branch:
        refunds_qs = refunds_qs.filter(branch=branch)
    refunds_paise = refunds_qs.aggregate(total=Sum("amount_paise"))["total"] or 0
    net_sales_paise = max(0, total_sales_paise - refunds_paise)

    return {
        "date": today.isoformat(),
        "sales_paise": total_sales_paise,
        "gross_sales_paise": total_sales_paise,
        "refunds_paise": refunds_paise,
        "net_sales_paise": net_sales_paise,
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

    refunds_qs = InvoiceRefund.objects.filter(
        tenant=tenant,
        created_at__date__gte=start_date,
        created_at__date__lte=end_date,
    )
    if branch:
        refunds_qs = refunds_qs.filter(branch=branch)
    refunds_paise = refunds_qs.aggregate(total=Sum("amount_paise"))["total"] or 0
    net_sales_paise = max(0, total_sales_paise - refunds_paise)

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "sales_paise": total_sales_paise,
        "gross_sales_paise": total_sales_paise,
        "refunds_paise": refunds_paise,
        "net_sales_paise": net_sales_paise,
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
    """Compares consolidated sales, refunds, net sales, COGS, gross margin, and wastage across all active branches (H-21, Stage D1)."""
    from django.db.models import Count, Sum

    from apps.inventory.constants import StockMovementType
    from apps.inventory.models import StockMovement
    from apps.orders.models import InvoiceRefund

    branches = list(Branch.objects.filter(tenant=tenant, is_active=True).order_by("created_at"))
    outlets: list[dict[str, Any]] = []

    tot_gross = 0
    tot_refunds = 0
    tot_net = 0
    tot_cogs = 0
    tot_wastage = 0
    tot_invoices = 0
    tot_orders = 0

    for b in branches:
        inv_agg = BillInvoice.objects.filter(
            tenant=tenant,
            branch=b,
            is_settled=True,
            settled_at__date__gte=start_date,
            settled_at__date__lte=end_date,
        ).aggregate(s=Sum("total_paise"), c=Count("id"))
        gross_paise = int(inv_agg["s"] or 0)
        inv_count = int(inv_agg["c"] or 0)

        ref_agg = InvoiceRefund.objects.filter(
            tenant=tenant,
            branch=b,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        ).aggregate(s=Sum("amount_paise"))
        refunds_paise = int(ref_agg["s"] or 0)
        net_paise = max(0, gross_paise - refunds_paise)

        ord_count = (
            Order.objects.filter(
                tenant=tenant,
                branch=b,
                placed_at__date__gte=start_date,
                placed_at__date__lte=end_date,
            )
            .exclude(status=OrderStatus.CANCELLED)
            .count()
        )

        cogs_movements = StockMovement.objects.filter(
            tenant=tenant,
            branch=b,
            movement_type__in=[
                StockMovementType.SALE_USAGE,
                StockMovementType.PRODUCTION_USAGE,
                StockMovementType.PACKAGING_USAGE,
            ],
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        ).values_list("value_paise", flat=True)
        cogs_paise = sum(abs(int(v or 0)) for v in cogs_movements)

        waste_movements = StockMovement.objects.filter(
            tenant=tenant,
            branch=b,
            movement_type=StockMovementType.WASTE,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        ).values_list("value_paise", flat=True)
        wastage_paise = sum(abs(int(v or 0)) for v in waste_movements)

        gross_margin_paise = net_paise - cogs_paise
        if net_paise > 0:
            m_sign = -1 if gross_margin_paise < 0 else 1
            margin_pct = (
                m_sign * ((abs(gross_margin_paise) * 1000 + net_paise // 2) // net_paise)
            ) / 10
        else:
            margin_pct = 0.0

        tot_gross += gross_paise
        tot_refunds += refunds_paise
        tot_net += net_paise
        tot_cogs += cogs_paise
        tot_wastage += wastage_paise
        tot_invoices += inv_count
        tot_orders += ord_count

        outlets.append(
            {
                "branch_id": str(b.id),
                "name": b.name or "Main Outlet",
                "venue_profile": getattr(b, "venue_profile", "") or "CASUAL_DINING",
                "orders_count": ord_count,
                "invoices_count": inv_count,
                "total_sales_paise": gross_paise,
                "gross_sales_paise": gross_paise,
                "refunds_paise": refunds_paise,
                "net_sales_paise": net_paise,
                "cogs_paise": cogs_paise,
                "gross_margin_paise": gross_margin_paise,
                "gross_margin_percent": margin_pct,
                "wastage_paise": wastage_paise,
                "average_ticket_paise": (gross_paise // inv_count) if inv_count > 0 else 0,
            }
        )

    outlets.sort(key=lambda x: x["net_sales_paise"], reverse=True)
    tot_margin = tot_net - tot_cogs
    if tot_net > 0:
        t_sign = -1 if tot_margin < 0 else 1
        tot_margin_pct = (t_sign * ((abs(tot_margin) * 1000 + tot_net // 2) // tot_net)) / 10
    else:
        tot_margin_pct = 0.0

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "totals": {
            "orders_count": tot_orders,
            "invoices_count": tot_invoices,
            "gross_sales_paise": tot_gross,
            "refunds_paise": tot_refunds,
            "net_sales_paise": tot_net,
            "cogs_paise": tot_cogs,
            "gross_margin_paise": tot_margin,
            "gross_margin_percent": tot_margin_pct,
            "wastage_paise": tot_wastage,
        },
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
    t_type, t_label = _safe_target_label_for_order(order)
    if next_status == OrderStatus.PLACED:
        safe_dishes, total_count = _safe_dishes_for_order(order)
        record_branch_notification_event(
            branch=order.branch,
            event_type="new_order",
            order=order,
            target_label=t_label,
            token_number=order.token_number,
            dishes=safe_dishes,
            total_items=total_count,
        )
    elif next_status == OrderStatus.AWAITING_PAYMENT:
        record_branch_notification_event(
            branch=order.branch,
            event_type="pay_first_waiting",
            order=order,
            target_label=t_label,
            token_number=order.token_number,
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


# ---------------------------------------------------------------------------
# Stage B: Operational Hardening (Shift Handover, Partial Refunds, Split/Merge)
# ---------------------------------------------------------------------------

MANAGER_REFUND_THRESHOLD_PAISE = 50000  # ₹500.00


@transaction.atomic
def get_or_open_shift(
    branch: Branch,
    cashier: Membership,
    opening_cash_paise: int = 200000,
) -> CashierShiftCloseout:
    """Finds the active OPEN shift for a branch or opens a new one."""
    if opening_cash_paise < 0:
        raise ValidationError({"opening_cash_paise": "Opening cash cannot be negative."})

    existing = (
        CashierShiftCloseout.objects.filter(
            tenant=branch.tenant,
            branch=branch,
            status=ShiftStatus.OPEN,
            is_locked=False,
        )
        .order_by("-opened_at")
        .first()
    )
    if existing:
        return existing

    return CashierShiftCloseout.objects.create(
        tenant=branch.tenant,
        branch=branch,
        cashier=cashier,
        status=ShiftStatus.OPEN,
        is_locked=False,
        opening_cash_paise=opening_cash_paise,
    )


@transaction.atomic
def record_cash_movement(
    shift: CashierShiftCloseout,
    movement_type: str,
    amount_paise: int,
    reason: str,
    actor: Membership | None = None,
    request: Any = None,
) -> CashMovement:
    """Records an append-only cash movement on an open shift; rejects locked/closed shifts."""
    if shift.is_locked or shift.status == ShiftStatus.CLOSED:
        raise BusinessRuleError(
            "SHIFT_LOCKED",
            "Cannot record cash movements on a closed or locked shift.",
            status_code=400,
        )
    if movement_type not in CashMovementType.values:
        raise ValidationError({"movement_type": "Invalid cash movement type."})
    if amount_paise <= 0:
        raise ValidationError({"amount_paise": "Cash movement amount must be positive."})
    clean_reason = (reason or "").strip()
    if not clean_reason:
        raise ValidationError({"reason": "A reason is required for cash drawer movements."})

    movement = CashMovement.objects.create(
        tenant=shift.tenant,
        branch=shift.branch,
        shift=shift,
        movement_type=movement_type,
        amount_paise=amount_paise,
        reason=clean_reason,
        recorded_by=actor,
    )

    if movement_type == CashMovementType.FLOAT_IN:
        shift.cash_in_paise += amount_paise
        shift.save(update_fields=["cash_in_paise", "updated_at"])
    elif movement_type in (CashMovementType.CASH_DROP, CashMovementType.PETTY_CASH_OUT):
        shift.cash_out_paise += amount_paise
        shift.save(update_fields=["cash_out_paise", "updated_at"])
    elif movement_type == CashMovementType.REFUND_CASH_OUT:
        shift.cash_refunds_paise += amount_paise
        shift.save(update_fields=["cash_refunds_paise", "updated_at"])

    log_audit_event(
        action="shift.cash_movement",
        entity_type="CashMovement",
        entity_id=str(movement.id),
        actor=actor.user if actor else None,
        tenant=shift.tenant,
        after_state={
            "shift_id": str(shift.id),
            "movement_type": movement_type,
            "amount_paise": amount_paise,
            "reason": clean_reason,
        },
        request=request,
    )
    return movement


@transaction.atomic
def close_shift(
    shift: CashierShiftCloseout,
    actual_cash_paise: int,
    opening_cash_paise: int | None = None,
    denominations_snapshot: dict[str, int] | None = None,
    variance_reason_code: str = "",
    notes: str = "",
    actor: Membership | None = None,
    request: Any = None,
) -> CashierShiftCloseout:
    """Performs blind cash handover reconciliation, checks variance reason threshold, and locks shift."""
    from django.db.models import Sum

    if shift.is_locked or shift.status == ShiftStatus.CLOSED:
        raise BusinessRuleError(
            "SHIFT_LOCKED",
            "This shift has already been closed and locked.",
            status_code=400,
        )
    if actual_cash_paise < 0:
        raise ValidationError({"actual_cash_paise": "Actual counted cash cannot be negative."})

    if opening_cash_paise is not None and opening_cash_paise >= 0:
        shift.opening_cash_paise = opening_cash_paise

    # Aggregate settled invoices for this branch on the shift date / window
    shift_date = shift.opened_at.date()
    invoices_qs = BillInvoice.objects.filter(
        tenant=shift.tenant,
        branch=shift.branch,
        is_settled=True,
        settled_at__date__gte=shift_date,
    )

    cash_sales_paise = (
        invoices_qs.filter(payment_method=PaymentMethod.CASH).aggregate(t=Sum("total_paise"))["t"]
        or 0
    )
    upi_total_paise = (
        invoices_qs.filter(payment_method=PaymentMethod.UPI).aggregate(t=Sum("total_paise"))["t"]
        or 0
    )
    card_total_paise = (
        invoices_qs.filter(payment_method=PaymentMethod.CARD).aggregate(t=Sum("total_paise"))["t"]
        or 0
    )
    total_invoices_count = invoices_qs.count()

    movements_qs = shift.cash_movements.all()
    cash_in_paise = (
        movements_qs.filter(movement_type=CashMovementType.FLOAT_IN).aggregate(
            t=Sum("amount_paise")
        )["t"]
        or 0
    )
    cash_out_paise = (
        movements_qs.filter(
            movement_type__in=[CashMovementType.CASH_DROP, CashMovementType.PETTY_CASH_OUT]
        ).aggregate(t=Sum("amount_paise"))["t"]
        or 0
    )
    cash_refunds_paise = (
        movements_qs.filter(movement_type=CashMovementType.REFUND_CASH_OUT).aggregate(
            t=Sum("amount_paise")
        )["t"]
        or 0
    )

    expected_cash_paise = (
        shift.opening_cash_paise
        + cash_sales_paise
        + cash_in_paise
        - cash_out_paise
        - cash_refunds_paise
    )
    cash_variance_paise = actual_cash_paise - expected_cash_paise

    clean_reason_code = (variance_reason_code or "").strip()
    if abs(cash_variance_paise) > shift.variance_threshold_paise and not clean_reason_code:
        raise BusinessRuleError(
            "VARIANCE_REASON_REQUIRED",
            "A variance reason code is required when cash over/short exceeds the branch threshold.",
            status_code=400,
            details={
                "variance_paise": cash_variance_paise,
                "threshold_paise": shift.variance_threshold_paise,
            },
        )
    if clean_reason_code and clean_reason_code not in VarianceReasonCode.values:
        raise ValidationError({"variance_reason_code": "Invalid variance reason code."})

    shift.cash_sales_paise = cash_sales_paise
    shift.cash_in_paise = cash_in_paise
    shift.cash_out_paise = cash_out_paise
    shift.cash_refunds_paise = cash_refunds_paise
    shift.expected_cash_paise = expected_cash_paise
    shift.actual_cash_paise = actual_cash_paise
    shift.cash_variance_paise = cash_variance_paise
    shift.variance_reason_code = clean_reason_code
    shift.denominations_snapshot = denominations_snapshot or {}
    shift.upi_total_paise = upi_total_paise
    shift.card_total_paise = card_total_paise
    shift.total_settled_paise = cash_sales_paise + upi_total_paise + card_total_paise
    shift.total_invoices_count = total_invoices_count
    shift.notes = notes or shift.notes
    shift.status = ShiftStatus.CLOSED
    shift.is_locked = True
    shift.closed_at = timezone.now()
    shift.save()

    log_audit_event(
        action="shift.closeout",
        entity_type="CashierShiftCloseout",
        entity_id=str(shift.id),
        actor=actor.user if actor else shift.cashier.user,
        tenant=shift.tenant,
        after_state={
            "status": ShiftStatus.CLOSED,
            "is_locked": True,
            "expected_cash_paise": expected_cash_paise,
            "actual_cash_paise": actual_cash_paise,
            "cash_variance_paise": cash_variance_paise,
            "variance_reason_code": clean_reason_code,
        },
        request=request,
    )
    return shift


@transaction.atomic
def create_invoice_refund(
    invoice: BillInvoice,
    amount_paise: int,
    reason_code: str,
    refund_method: str | None = None,
    restock_action: str = RefundRestockAction.NONE,
    refunded_lines: list[dict[str, Any]] | None = None,
    notes: str = "",
    actor_membership: Membership | None = None,
    request: Any = None,
) -> InvoiceRefund:
    """Creates an append-only partial or full refund without mutating BillInvoice.total_paise."""
    from django.db.models import Sum

    locked_invoice = BillInvoice.objects.select_for_update().get(pk=invoice.pk)
    if not locked_invoice.is_settled:
        raise BusinessRuleError(
            "INVOICE_NOT_SETTLED",
            "Only settled invoices can be refunded.",
            status_code=400,
        )
    if amount_paise <= 0:
        raise ValidationError({"amount_paise": "Refund amount must be at least 1 paisa."})
    if reason_code not in RefundReasonCode.values:
        raise ValidationError({"reason_code": "A valid refund reason code is required."})
    if restock_action not in RefundRestockAction.values:
        raise ValidationError({"restock_action": "Invalid restock action."})

    role = getattr(actor_membership, "role", "")
    is_manager_or_owner = role in ("OWNER", "BRANCH_MANAGER")
    if not is_manager_or_owner and amount_paise > MANAGER_REFUND_THRESHOLD_PAISE:
        raise BusinessRuleError(
            "MANAGER_APPROVAL_REQUIRED",
            "Refunds above ₹500.00 require Owner or Branch Manager approval.",
            status_code=403,
            details={"threshold_paise": MANAGER_REFUND_THRESHOLD_PAISE},
        )

    already_refunded = (
        InvoiceRefund.objects.filter(invoice=locked_invoice).aggregate(t=Sum("amount_paise"))["t"]
        or 0
    )
    remaining_paise = locked_invoice.total_paise - already_refunded
    if amount_paise > remaining_paise:
        raise BusinessRuleError(
            "REFUND_EXCEEDS_TOTAL",
            f"Refund amount ({amount_paise} paise) exceeds remaining refundable amount ({remaining_paise} paise).",
            status_code=400,
            details={
                "invoice_total_paise": locked_invoice.total_paise,
                "already_refunded_paise": already_refunded,
                "remaining_refundable_paise": remaining_paise,
            },
        )

    Branch.objects.select_for_update().only("id").get(pk=locked_invoice.branch.pk)
    today_str = timezone.now().strftime("%Y%m")
    rfd_count = (
        InvoiceRefund.objects.filter(
            tenant=locked_invoice.tenant, branch=locked_invoice.branch
        ).count()
        + 1
    )
    refund_number = f"RFD-{today_str}-{rfd_count:04d}"
    resolved_method = refund_method or locked_invoice.payment_method

    refund = InvoiceRefund.objects.create(
        tenant=locked_invoice.tenant,
        branch=locked_invoice.branch,
        invoice=locked_invoice,
        refund_number=refund_number,
        amount_paise=amount_paise,
        reason_code=reason_code,
        refund_method=resolved_method,
        restock_action=restock_action,
        refunded_lines=refunded_lines or [],
        notes=notes or "",
        processed_by=actor_membership,
        approved_by=actor_membership if is_manager_or_owner else None,
    )

    if resolved_method == PaymentMethod.CASH:
        open_shift = (
            CashierShiftCloseout.objects.filter(
                tenant=locked_invoice.tenant,
                branch=locked_invoice.branch,
                status=ShiftStatus.OPEN,
                is_locked=False,
            )
            .order_by("-opened_at")
            .first()
        )
        if open_shift is not None:
            record_cash_movement(
                shift=open_shift,
                movement_type=CashMovementType.REFUND_CASH_OUT,
                amount_paise=amount_paise,
                reason=f"Refund {refund_number} for {locked_invoice.invoice_number}",
                actor=actor_membership,
                request=request,
            )

    log_audit_event(
        action="invoice.refund",
        entity_type="InvoiceRefund",
        entity_id=str(refund.id),
        actor=actor_membership.user if actor_membership else None,
        tenant=locked_invoice.tenant,
        after_state={
            "invoice_id": str(locked_invoice.id),
            "invoice_number": locked_invoice.invoice_number,
            "refund_number": refund_number,
            "amount_paise": amount_paise,
            "reason_code": reason_code,
            "restock_action": restock_action,
        },
        request=request,
    )
    return refund


def preview_split_bill(
    table_session: TableSession,
    mode: str = "EQUAL",
    shares: int = 2,
    item_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Computes exact integer-paise equal N-way or itemized split breakdown with zero rounding drift."""
    bill = calculate_bill(table_session)
    total_paise = int(bill["total_paise"])

    clean_mode = (mode or "EQUAL").upper()
    if clean_mode == "EQUAL":
        if shares < 2 or shares > 20:
            raise ValidationError({"shares": "Number of equal shares must be between 2 and 20."})
        base_share = total_paise // shares
        remainder = total_paise - (base_share * shares)
        splits = [
            {
                "share_index": idx + 1,
                "label": f"Share {idx + 1} of {shares}",
                "amount_paise": base_share + (remainder if idx == 0 else 0),
            }
            for idx in range(shares)
        ]
        return {
            "mode": "EQUAL",
            "total_paise": total_paise,
            "shares": shares,
            "splits": splits,
        }

    if clean_mode == "ITEMS":
        selected_set = {str(x) for x in (item_ids or [])}
        if not selected_set:
            raise ValidationError(
                {"item_ids": "At least one item must be selected for item split."}
            )
        selected_items = [it for it in bill["items"] if str(it.get("id")) in selected_set]
        if not selected_items:
            raise ValidationError({"item_ids": "Selected items were not found on this session."})
        selected_paise = sum(int(it["subtotal_paise"]) for it in selected_items)
        remaining_paise = max(0, total_paise - selected_paise)
        return {
            "mode": "ITEMS",
            "total_paise": total_paise,
            "selected_paise": selected_paise,
            "remaining_paise": remaining_paise,
            "splits": [
                {
                    "share_index": 1,
                    "label": "Split Bill A (Selected Items)",
                    "amount_paise": selected_paise,
                    "items_count": sum(int(it["quantity"]) for it in selected_items),
                },
                {
                    "share_index": 2,
                    "label": "Split Bill B (Remaining Items)",
                    "amount_paise": remaining_paise,
                    "items_count": bill["items_count"]
                    - sum(int(it["quantity"]) for it in selected_items),
                },
            ],
        }

    raise ValidationError({"mode": "Split mode must be 'EQUAL' or 'ITEMS'."})


@transaction.atomic
def move_session_items(
    source_session: TableSession,
    target_session: TableSession,
    item_ids: list[str],
    user_membership: Membership | None = None,
    request: Any = None,
) -> dict[str, Any]:
    """Moves selected OrderItem rows from one open table session to another open table session."""
    if source_session.status != "OPEN" or target_session.status != "OPEN":
        raise BusinessRuleError(
            "SESSION_NOT_OPEN",
            "Both source and target dining sessions must be OPEN to move items.",
            status_code=400,
        )
    if (
        source_session.tenant_id != target_session.tenant_id
        or source_session.branch_id != target_session.branch_id
    ):
        raise ValidationError({"target_session_id": "Target session must be in the same branch."})
    if source_session.id == target_session.id:
        raise ValidationError(
            {"target_session_id": "Source and target sessions must be different."}
        )

    active_statuses = [
        OrderStatus.PLACED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.SERVED,
    ]
    source_orders = list(
        Order.objects.filter(table_session=source_session, status__in=active_statuses)
    )
    items_to_move = list(
        OrderItem.objects.filter(order__in=source_orders, id__in=item_ids).select_related("order")
    )
    if not items_to_move:
        raise ValidationError({"item_ids": "No matching active items found on source session."})

    target_order = (
        Order.objects.filter(table_session=target_session, status__in=active_statuses)
        .order_by("-placed_at")
        .first()
    )
    if target_order is None:
        Branch.objects.select_for_update().only("id").get(pk=target_session.branch.pk)
        ord_count = Order.objects.filter(branch=target_session.branch).count() + 1
        target_order = Order.objects.create(
            tenant=target_session.tenant,
            branch=target_session.branch,
            table_session=target_session,
            order_number=f"ORD-{timezone.now().strftime('%Y%m%d')}-{ord_count:04d}",
            order_workflow=OrderWorkflow.TABLE_SERVICE,
            status=OrderStatus.PLACED,
            placed_by=user_membership,
            notes=f"Moved items from Table {source_session.table.label if source_session.table else source_session.session_code}",
        )

    moved_names: list[str] = []
    affected_orders: set[Order] = set()
    for item in items_to_move:
        affected_orders.add(item.order)
        moved_names.append(f"{item.quantity}x {item.item_name}")
        item.order = target_order
        item.save(update_fields=["order", "updated_at"])

    src_label = source_session.table.label if source_session.table else source_session.session_code
    tgt_label = target_session.table.label if target_session.table else target_session.session_code

    for src_ord in affected_orders:
        if src_ord.items.count() == 0:
            old_st = src_ord.status
            src_ord.status = OrderStatus.CANCELLED
            src_ord.cancelled_at = timezone.now()
            src_ord.save(update_fields=["status", "cancelled_at"])
            OrderEvent.objects.create(
                tenant=src_ord.tenant,
                branch=src_ord.branch,
                order=src_ord,
                event_type=OrderEventType.CANCELLED,
                from_status=old_st,
                to_status=OrderStatus.CANCELLED,
                user=user_membership,
                notes=f"All items moved to Table {tgt_label}",
            )

    OrderEvent.objects.create(
        tenant=target_order.tenant,
        branch=target_order.branch,
        order=target_order,
        event_type=OrderEventType.STATUS_CHANGED,
        from_status=target_order.status,
        to_status=target_order.status,
        user=user_membership,
        notes=f"Received moved items ({', '.join(moved_names)}) from Table {src_label}",
    )

    log_audit_event(
        action="table_session.move_items",
        entity_type="TableSession",
        entity_id=str(source_session.id),
        actor=user_membership.user if user_membership else None,
        tenant=source_session.tenant,
        after_state={
            "source_session_id": str(source_session.id),
            "target_session_id": str(target_session.id),
            "moved_item_ids": [str(it.id) for it in items_to_move],
        },
        request=request,
    )
    return {
        "source_session_id": str(source_session.id),
        "target_session_id": str(target_session.id),
        "moved_count": len(items_to_move),
    }


@transaction.atomic
def merge_table_sessions(
    source_session: TableSession,
    target_session: TableSession,
    user_membership: Membership | None = None,
    request: Any = None,
) -> TableSession:
    """Merges all active orders from source_session into target_session and frees source table."""
    if source_session.status != "OPEN" or target_session.status != "OPEN":
        raise BusinessRuleError(
            "SESSION_NOT_OPEN",
            "Both source and target dining sessions must be OPEN to merge.",
            status_code=400,
        )
    if (
        source_session.tenant_id != target_session.tenant_id
        or source_session.branch_id != target_session.branch_id
    ):
        raise ValidationError({"target_session_id": "Target session must be in the same branch."})
    if source_session.id == target_session.id:
        raise ValidationError({"target_session_id": "Cannot merge a table session into itself."})

    src_label = source_session.table.label if source_session.table else source_session.session_code
    tgt_label = target_session.table.label if target_session.table else target_session.session_code

    orders_to_move = list(
        Order.objects.filter(table_session=source_session).exclude(status=OrderStatus.CANCELLED)
    )
    for ord_obj in orders_to_move:
        ord_obj.table_session = target_session
        ord_obj.save(update_fields=["table_session", "updated_at"])
        OrderEvent.objects.create(
            tenant=ord_obj.tenant,
            branch=ord_obj.branch,
            order=ord_obj,
            event_type=OrderEventType.STATUS_CHANGED,
            from_status=ord_obj.status,
            to_status=ord_obj.status,
            user=user_membership,
            notes=f"Merged from Table {src_label} into Table {tgt_label}",
        )

    source_session.status = "CLOSED"
    source_session.closed_at = timezone.now()
    source_session.save(update_fields=["status", "closed_at"])

    if source_session.table:
        source_session.table.status = TableStatus.AVAILABLE
        source_session.table.save(update_fields=["status"])

    log_audit_event(
        action="table_session.merge",
        entity_type="TableSession",
        entity_id=str(target_session.id),
        actor=user_membership.user if user_membership else None,
        tenant=target_session.tenant,
        before_state={"source_session_id": str(source_session.id)},
        after_state={
            "target_session_id": str(target_session.id),
            "merged_orders_count": len(orders_to_move),
        },
        request=request,
    )
    return target_session
