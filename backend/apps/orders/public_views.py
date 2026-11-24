import hashlib
import json
import re
import secrets
from datetime import timedelta
from typing import Any

from django.conf import settings
from django.core.signing import BadSignature, SignatureExpired, TimestampSigner
from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.http import Http404
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle
from rest_framework.views import APIView

from apps.core.context import reset_current_tenant, set_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.menu.models import (
    BranchItemAvailability,
    ItemOptionGroup,
    ItemVariant,
    MenuCategory,
    MenuItem,
    Option,
)
from apps.orders.models import (
    BillInvoice,
    FeedbackSuggestionType,
    Order,
    OrderFeedback,
    OrderPaymentStatus,
    OrderSource,
    OrderStatus,
    OrderWorkflow,
    ServiceRequest,
    ServiceRequestStatus,
    ServiceRequestType,
)
from apps.orders.services import create_order
from apps.subscriptions.services import is_tenant_allowed
from apps.tenants.services import get_public_qr_code
from apps.venues.constants import (
    OpenedVia,
    PaymentTiming,
    QROrderingMode,
    QRSessionPolicy,
    QRTargetType,
    SessionStatus,
    TableType,
)
from apps.venues.models import QRDailyScan, TableSession
from apps.venues.services import next_token, open_session

DEFAULT_QR_LIMITS: dict[str, int] = {
    "MAX_LINES_PER_ORDER": 30,
    "MIN_QTY_PER_LINE": 1,
    "MAX_QTY_PER_LINE": 10,
    "MAX_LINE_NOTE_CHARS": 200,
    "MAX_ORDER_NOTE_CHARS": 300,
    "MAX_OPEN_QR_ORDERS_PER_SESSION": 3,
    "MAX_QR_ORDERS_PER_10_MIN": 5,
    "MAX_ORDER_TOTAL_PAISE": 1_000_000,
    "TRACKING_EXPIRE_HOURS": 12,
}


def get_qr_limits() -> dict[str, int]:
    configured = getattr(settings, "PUBLIC_QR_ORDER_LIMITS", {})
    return {**DEFAULT_QR_LIMITS, **configured}


class PublicQRIPThrottle(AnonRateThrottle):
    scope = "public_qr_ip"


class PublicQRTokenThrottle(SimpleRateThrottle):
    scope = "public_qr_token"

    def get_cache_key(self, request: Request, view: Any) -> str | None:
        token = view.kwargs.get("token") if hasattr(view, "kwargs") else None
        if not token:
            return None
        return self.cache_format % {"scope": self.scope, "ident": str(token)}


class PublicOrderTrackThrottle(AnonRateThrottle):
    scope = "public_order_track"


def _resolve_active_qr(token: str) -> Any:
    qr = get_public_qr_code(token)
    if not qr or not qr.is_active or not qr.branch.is_active:
        raise Http404("QR code is invalid or deactivated.")
    if not is_tenant_allowed(qr.branch.tenant):
        raise Http404("QR code is invalid or deactivated.")
    return qr


def _build_target_label(qr: Any) -> tuple[str, str]:
    """Returns (target_type, target_label) for table, room, or counter QR."""
    if qr.table:
        if qr.table.table_type == TableType.ROOM or qr.target_type == QRTargetType.ROOM:
            return QRTargetType.ROOM, qr.table.label
        return QRTargetType.TABLE, qr.table.label
    if qr.target_type == QRTargetType.COUNTER or qr.service_area:
        area_name = qr.service_area.name if qr.service_area else "Counter"
        return QRTargetType.COUNTER, area_name
    return qr.target_type, getattr(qr, "label", "") or ""


def _status_message_key(order: Order, payment_timing: str) -> str:
    if order.status == OrderStatus.PENDING_APPROVAL:
        return "WAITING_FOR_APPROVAL"
    if order.status == OrderStatus.AWAITING_PAYMENT:
        return "PAY_AT_COUNTER_TO_START"
    if order.status == OrderStatus.PLACED:
        return "ORDER_RECEIVED"
    if order.status == OrderStatus.PREPARING:
        return "ORDER_PREPARING"
    if order.status == OrderStatus.READY:
        return "ORDER_READY"
    if order.status == OrderStatus.SERVED:
        return "ORDER_SERVED"
    if order.status == OrderStatus.COMPLETED:
        return "ORDER_COMPLETED"
    if order.status == OrderStatus.CANCELLED:
        return "ORDER_REJECTED" if order.rejected_reason else "ORDER_CANCELLED"
    return "ORDER_RECEIVED"


class PublicQRMenuView(APIView):
    """Public unauthenticated read-only endpoint returning branch menu for a scanned QR."""

    permission_classes = [AllowAny]
    throttle_classes = [PublicQRIPThrottle, PublicQRTokenThrottle]

    def get(self, request: Request, token: str) -> Response:
        qr = _resolve_active_qr(token)
        tenant = qr.branch.tenant
        ctx_token = set_current_tenant(tenant)

        try:
            capabilities = getattr(qr.branch, "capabilities", None)
            ordering_mode = (
                capabilities.qr_ordering_mode
                if capabilities
                else QROrderingMode.ORDER_WITH_APPROVAL
            )
            payment_timing = (
                capabilities.payment_timing if capabilities else PaymentTiming.PAY_LATER
            )
            session_policy = (
                capabilities.qr_session_policy
                if capabilities
                else QRSessionPolicy.CUSTOMER_CAN_OPEN
            )

            business_settings = getattr(tenant, "business_settings", None)
            display_name = (
                business_settings.legal_name
                if business_settings and business_settings.legal_name
                else tenant.name
            )
            logo_url = business_settings.logo_url if business_settings else ""
            brand_color = business_settings.brand_primary_color if business_settings else "#FF6A00"
            target_type, target_label = _build_target_label(qr)

            # Stage D5: Privacy-safe daily scan count (zero cookies, zero IP storage, zero PII)
            from django.db.models import F

            today = timezone.localdate()
            updated_scans = QRDailyScan.objects.filter(
                tenant=tenant,
                branch=qr.branch,
                qr_code=qr,
                scan_date=today,
            ).update(scan_count=F("scan_count") + 1)
            if not updated_scans:
                QRDailyScan.objects.create(
                    tenant=tenant,
                    branch=qr.branch,
                    qr_code=qr,
                    scan_date=today,
                    scan_count=1,
                )

            active_session = (
                TableSession.objects.filter(table=qr.table, status=SessionStatus.OPEN).first()
                if qr.table
                else None
            )

            categories_payload: list[dict[str, Any]] = []
            if ordering_mode != QROrderingMode.DISABLED:
                unavailable_ids = set(
                    BranchItemAvailability.objects.filter(
                        branch=qr.branch, is_available=False
                    ).values_list("item_id", flat=True)
                )

                from apps.menu.translation_service import (
                    LANGUAGE_MAP,
                    get_published_translations_map,
                )

                requested_lang = str(request.query_params.get("lang") or "ta")
                _ = LANGUAGE_MAP.get(requested_lang)
                published_map = get_published_translations_map(tenant, requested_lang)

                categories = list(
                    MenuCategory.objects.filter(tenant=tenant, is_active=True).order_by(
                        "sort_order", "name"
                    )
                )
                items = list(
                    MenuItem.objects.filter(tenant=tenant, is_active=True, category__is_active=True)
                    .select_related("category")
                    .prefetch_related(
                        "variants",
                        "gallery_images",
                        Prefetch(
                            "item_option_groups",
                            queryset=ItemOptionGroup.objects.filter(group__is_active=True)
                            .select_related("group")
                            .prefetch_related("group__options")
                            .order_by("sort_order", "id"),
                        ),
                    )
                    .order_by("sort_order", "name")
                )

                items_by_cat: dict[str, list[dict[str, Any]]] = {}
                for item in items:
                    variants_list = [
                        {
                            "id": str(v.id),
                            "name": v.name,
                            "name_ta": published_map.get(("VARIANT", str(v.id), "name"), v.name_ta),
                            "price_paise": v.price_paise,
                            "is_default": v.is_default,
                        }
                        for v in sorted(
                            item.variants.all(), key=lambda x: (x.sort_order, str(x.id))
                        )
                    ]

                    option_groups_list: list[dict[str, Any]] = []
                    for link in item.item_option_groups.all():
                        grp = link.group
                        active_opts = [
                            {
                                "id": str(opt.id),
                                "name": opt.name,
                                "name_ta": published_map.get(
                                    ("OPTION", str(opt.id), "name"), opt.name_ta
                                ),
                                "price_delta_paise": opt.price_delta_paise,
                                "is_default": opt.is_default,
                            }
                            for opt in sorted(
                                grp.options.all(), key=lambda x: (x.sort_order, x.name)
                            )
                            if opt.is_active
                        ]
                        if active_opts:
                            option_groups_list.append(
                                {
                                    "id": str(grp.id),
                                    "name": grp.name,
                                    "name_ta": published_map.get(
                                        ("OPTION_GROUP", str(grp.id), "name"), grp.name_ta
                                    ),
                                    "min_select": grp.min_select,
                                    "max_select": grp.max_select,
                                    "options": active_opts,
                                }
                            )

                    gallery_list = [
                        {
                            "id": str(g.id),
                            "image_card": g.image_card,
                            "image_thumb": g.image_thumb,
                            "is_primary": g.is_primary,
                        }
                        for g in item.gallery_images.all()
                    ]

                    items_by_cat.setdefault(str(item.category_id), []).append(
                        {
                            "id": str(item.id),
                            "name": item.name,
                            "name_ta": published_map.get(
                                ("ITEM", str(item.id), "name"), item.name_ta
                            ),
                            "description": item.description,
                            "description_ta": published_map.get(
                                ("ITEM", str(item.id), "description"), item.description_ta
                            ),
                            "ingredients_note": published_map.get(
                                ("ITEM", str(item.id), "ingredients_note"), item.ingredients_note
                            ),
                            "allergen_note": published_map.get(
                                ("ITEM", str(item.id), "allergen_note"), item.allergen_note
                            ),
                            "price_paise": item.base_price_paise,
                            "food_type": item.food_type,
                            "is_bestseller": item.is_bestseller,
                            "image_card": item.image_card,
                            "image_thumb": item.image_thumb,
                            "gallery": gallery_list,
                            "is_available": item.id not in unavailable_ids,
                            "variants": variants_list,
                            "option_groups": option_groups_list,
                        }
                    )

                for cat in categories:
                    cat_items = items_by_cat.get(str(cat.id), [])
                    if cat_items:
                        categories_payload.append(
                            {
                                "id": str(cat.id),
                                "name": cat.name,
                                "name_ta": published_map.get(
                                    ("CATEGORY", str(cat.id), "name"), cat.name_ta
                                ),
                                "items": cat_items,
                            }
                        )

            payload = {
                "display_name": display_name,
                "logo_url": logo_url,
                "brand_primary_color": brand_color,
                "branch_name": qr.branch.name,
                "area_name": (
                    qr.table.section.service_area.name
                    if (qr.table and qr.table.section and qr.table.section.service_area)
                    else (qr.service_area.name if qr.service_area else "")
                ),
                "target_type": target_type,
                "target_label": target_label,
                "ordering_mode": ordering_mode,
                "payment_timing": payment_timing,
                "session_policy": session_policy,
                "active_session_open": active_session is not None,
                "allows_takeaway": (
                    False
                    if target_type == QRTargetType.ROOM
                    else (bool(capabilities.allows_takeaway) if capabilities else True)
                ),
                "categories": categories_payload,
            }

            etag_raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
            etag = f'"{hashlib.sha256(etag_raw).hexdigest()[:24]}"'
            if request.META.get("HTTP_IF_NONE_MATCH") == etag:
                resp_304 = Response(status=status.HTTP_304_NOT_MODIFIED)
                resp_304["ETag"] = etag
                resp_304["Cache-Control"] = "public, max-age=30"
                return resp_304

            resp = Response(payload, status=status.HTTP_200_OK)
            resp["ETag"] = etag
            resp["Cache-Control"] = "public, max-age=30"
            return resp
        finally:
            reset_current_tenant(ctx_token)


class PublicQROrderCreateView(APIView):
    """Public unauthenticated endpoint to place a server-priced QR order."""

    permission_classes = [AllowAny]
    throttle_classes = [PublicQRIPThrottle, PublicQRTokenThrottle]

    def post(self, request: Request, token: str) -> Response:
        qr = _resolve_active_qr(token)
        tenant = qr.branch.tenant
        ctx_token = set_current_tenant(tenant)

        try:
            capabilities = getattr(qr.branch, "capabilities", None)
            ordering_mode = (
                capabilities.qr_ordering_mode
                if capabilities
                else QROrderingMode.ORDER_WITH_APPROVAL
            )
            payment_timing = (
                capabilities.payment_timing if capabilities else PaymentTiming.PAY_LATER
            )
            session_policy = (
                capabilities.qr_session_policy
                if capabilities
                else QRSessionPolicy.CUSTOMER_CAN_OPEN
            )

            if ordering_mode in (QROrderingMode.DISABLED, QROrderingMode.BROWSE_ONLY):
                raise BusinessRuleError(
                    "ORDERING_DISABLED",
                    "Ordering from this QR code is currently disabled.",
                    status_code=403,
                )

            idem_key = (
                request.META.get("HTTP_IDEMPOTENCY_KEY")
                or request.headers.get("Idempotency-Key")
                or ""
            ).strip()
            if not idem_key or len(idem_key) > 128:
                raise BusinessRuleError(
                    "IDEMPOTENCY_KEY_REQUIRED",
                    "A valid Idempotency-Key header is required.",
                    status_code=400,
                )

            # Return existing order on idempotent retry
            existing = Order.objects.filter(branch=qr.branch, idempotency_key=idem_key).first()
            if existing:
                return Response(
                    {
                        "order_number": existing.order_number,
                        "token_number": existing.token_number,
                        "status": existing.status,
                        "payment_status": existing.payment_status,
                        "customer_message_key": _status_message_key(existing, payment_timing),
                        "tracking_token": existing.tracking_token,
                        "tracking_url": f"/q/{token}/o/{existing.tracking_token}",
                        "total_paise": existing.total_paise,
                    },
                    status=status.HTTP_200_OK,
                )

            limits = get_qr_limits()
            items = request.data.get("items")
            if not isinstance(items, list) or len(items) == 0:
                raise BusinessRuleError(
                    "INVALID_ORDER_ITEMS",
                    "Order must include at least one item.",
                    status_code=400,
                )
            if len(items) > limits["MAX_LINES_PER_ORDER"]:
                raise BusinessRuleError(
                    "ORDER_LIMIT_EXCEEDED",
                    f"Maximum {limits['MAX_LINES_PER_ORDER']} items allowed per order.",
                    status_code=400,
                )

            order_notes = str(request.data.get("notes") or "").strip()
            if len(order_notes) > limits["MAX_ORDER_NOTE_CHARS"]:
                raise BusinessRuleError(
                    "NOTE_TOO_LONG",
                    f"Order note cannot exceed {limits['MAX_ORDER_NOTE_CHARS']} characters.",
                    status_code=400,
                )

            normalized_items: list[dict[str, Any]] = []
            for idx, raw in enumerate(items):
                if not isinstance(raw, dict) or not raw.get("menu_item_id"):
                    raise BusinessRuleError(
                        "INVALID_REFERENCE",
                        f"Item at position {idx + 1} is invalid.",
                        status_code=400,
                    )
                try:
                    qty = int(raw.get("quantity", 1))
                except (TypeError, ValueError):
                    raise BusinessRuleError(
                        "INVALID_QUANTITY",
                        "Item quantity must be a whole number.",
                        status_code=400,
                    ) from None
                if qty < limits["MIN_QTY_PER_LINE"] or qty > limits["MAX_QTY_PER_LINE"]:
                    raise BusinessRuleError(
                        "INVALID_QUANTITY",
                        f"Quantity per item must be between {limits['MIN_QTY_PER_LINE']} and {limits['MAX_QTY_PER_LINE']}.",
                        status_code=400,
                    )

                line_note = str(raw.get("notes") or "").strip()
                if len(line_note) > limits["MAX_LINE_NOTE_CHARS"]:
                    raise BusinessRuleError(
                        "NOTE_TOO_LONG",
                        f"Item note cannot exceed {limits['MAX_LINE_NOTE_CHARS']} characters.",
                        status_code=400,
                    )

                option_ids = raw.get("option_ids") or []
                if not isinstance(option_ids, list):
                    raise BusinessRuleError(
                        "INVALID_REFERENCE",
                        "option_ids must be a list.",
                        status_code=400,
                    )

                normalized_items.append(
                    {
                        "menu_item_id": str(raw["menu_item_id"]),
                        "variant_id": str(raw["variant_id"]) if raw.get("variant_id") else None,
                        "option_ids": [str(oid) for oid in option_ids],
                        "quantity": qty,
                        "notes": line_note,
                    }
                )

            # Resolve table session or counter token
            table_session: TableSession | None = None
            token_number: int | None = None
            target_type, _ = _build_target_label(qr)

            if target_type in (QRTargetType.TABLE, QRTargetType.ROOM):
                workflow = (
                    OrderWorkflow.ROOM_SERVICE
                    if target_type == QRTargetType.ROOM
                    else OrderWorkflow.TABLE_SERVICE
                )
                raw_session_token = (
                    request.META.get("HTTP_X_QR_SESSION") or request.data.get("session_token") or ""
                ).strip()

                if raw_session_token:
                    signer = TimestampSigner(salt="qr-session")
                    try:
                        session_code = signer.unsign(raw_session_token, max_age=86400)
                    except (BadSignature, SignatureExpired):
                        raise BusinessRuleError(
                            "INVALID_SESSION_TOKEN",
                            "Table session token is invalid or expired.",
                            status_code=403,
                        ) from None
                    table_session = TableSession.objects.filter(
                        table=qr.table, session_code=session_code, status=SessionStatus.OPEN
                    ).first()
                    if not table_session:
                        raise BusinessRuleError(
                            "SESSION_CLOSED",
                            "This table session is no longer open.",
                            status_code=403,
                        )
                else:
                    table_session = TableSession.objects.filter(
                        table=qr.table, status=SessionStatus.OPEN
                    ).first()
                    if not table_session:
                        if session_policy == QRSessionPolicy.STAFF_ONLY:
                            raise BusinessRuleError(
                                "STAFF_ACTION_REQUIRED",
                                "This table requires staff to open a session.",
                                status_code=403,
                            )
                        table_session = open_session(
                            branch=qr.branch,
                            table=qr.table,
                            opened_via=OpenedVia.QR_CUSTOMER,
                            guest_count=1,
                            actor=None,
                            request=request,
                        )

                # Per-session abuse checks
                open_qr_count = Order.objects.filter(
                    table_session=table_session,
                    source=OrderSource.QR,
                    status__in=[
                        OrderStatus.PENDING_APPROVAL,
                        OrderStatus.AWAITING_PAYMENT,
                        OrderStatus.PLACED,
                        OrderStatus.PREPARING,
                        OrderStatus.READY,
                    ],
                ).count()
                if open_qr_count >= limits["MAX_OPEN_QR_ORDERS_PER_SESSION"]:
                    raise BusinessRuleError(
                        "TOO_MANY_OPEN_ORDERS",
                        "Too many active orders on this table. Please wait for current orders to be served.",
                        status_code=429,
                    )

                ten_min_ago = timezone.now() - timedelta(minutes=10)
                recent_qr_count = Order.objects.filter(
                    table_session=table_session,
                    source=OrderSource.QR,
                    placed_at__gte=ten_min_ago,
                ).count()
                if recent_qr_count >= limits["MAX_QR_ORDERS_PER_10_MIN"]:
                    raise BusinessRuleError(
                        "ORDER_RATE_LIMIT",
                        "Too many orders placed recently. Please wait a few minutes.",
                        status_code=429,
                    )
            else:
                workflow = OrderWorkflow.COUNTER_TOKEN
                ten_min_ago = timezone.now() - timedelta(minutes=10)
                recent_counter_count = Order.objects.filter(
                    branch=qr.branch,
                    source=OrderSource.QR,
                    order_workflow=OrderWorkflow.COUNTER_TOKEN,
                    placed_at__gte=ten_min_ago,
                ).count()
                if recent_counter_count >= limits["MAX_QR_ORDERS_PER_10_MIN"]:
                    raise BusinessRuleError(
                        "ORDER_RATE_LIMIT",
                        "Too many orders placed recently. Please wait a few minutes.",
                        status_code=429,
                    )
                token_number = next_token(qr.branch, qr.service_area)

            if ordering_mode == QROrderingMode.ORDER_WITH_APPROVAL:
                initial_status = OrderStatus.PENDING_APPROVAL
            elif payment_timing == PaymentTiming.PAY_FIRST:
                initial_status = OrderStatus.AWAITING_PAYMENT
            else:
                initial_status = OrderStatus.PLACED

            tracking_token = secrets.token_urlsafe(16)
            guest_label = str(request.data.get("guest_label") or "").strip()[:20]
            dining_preference = str(request.data.get("dining_preference") or "").strip().upper()
            can_takeaway = target_type != QRTargetType.ROOM and (
                capabilities is None or bool(capabilities.allows_takeaway)
            )
            if (
                dining_preference == "TAKEAWAY"
                and can_takeaway
                and not order_notes.startswith("[PARCEL]")
            ):
                order_notes = (f"[PARCEL] {order_notes}".strip())[:300]

            try:
                with transaction.atomic():
                    order = create_order(
                        branch=qr.branch,
                        items_data=normalized_items,
                        user_membership=None,
                        table_session=table_session,
                        token_number=token_number,
                        order_workflow=workflow,
                        notes=order_notes,
                        source=OrderSource.QR,
                        initial_status=initial_status,
                        payment_status=OrderPaymentStatus.UNPAID,
                        tracking_token=tracking_token,
                        idempotency_key=idem_key,
                        guest_label=guest_label,
                    )
                    if order.total_paise > limits["MAX_ORDER_TOTAL_PAISE"]:
                        raise BusinessRuleError(
                            "ORDER_TOTAL_EXCEEDED",
                            "Order total exceeds the maximum allowed for QR ordering.",
                            status_code=400,
                        )
            except IntegrityError:
                existing = Order.objects.filter(branch=qr.branch, idempotency_key=idem_key).first()
                if existing:
                    return Response(
                        {
                            "order_number": existing.order_number,
                            "token_number": existing.token_number,
                            "status": existing.status,
                            "payment_status": existing.payment_status,
                            "customer_message_key": _status_message_key(existing, payment_timing),
                            "tracking_token": existing.tracking_token,
                            "tracking_url": f"/q/{token}/o/{existing.tracking_token}",
                            "total_paise": existing.total_paise,
                        },
                        status=status.HTTP_200_OK,
                    )
                raise

            return Response(
                {
                    "order_number": order.order_number,
                    "token_number": order.token_number,
                    "status": order.status,
                    "payment_status": order.payment_status,
                    "customer_message_key": _status_message_key(order, payment_timing),
                    "tracking_token": order.tracking_token,
                    "tracking_url": f"/q/{token}/o/{order.tracking_token}",
                    "total_paise": order.total_paise,
                },
                status=status.HTTP_201_CREATED,
            )
        finally:
            reset_current_tenant(ctx_token)


def _resolve_tracked_order(tracking_token: str) -> Order:
    """Resolve an active public order by 128-bit tracking_token or raise generic 404."""
    if not tracking_token or len(tracking_token) > 64:
        raise Http404("Order not found.")

    order = (
        Order.unscoped.select_related(
            "branch",
            "branch__tenant",
            "branch__tenant__business_settings",
            "branch__capabilities",
            "table_session__table",
        )
        .prefetch_related("items")
        .filter(tracking_token=tracking_token)
        .first()
    )
    if not order:
        raise Http404("Order not found.")

    limits = get_qr_limits()
    if order.status in (OrderStatus.COMPLETED, OrderStatus.CANCELLED):
        ref_time = order.completed_at or order.cancelled_at or order.updated_at
        if ref_time and (timezone.now() - ref_time) > timedelta(
            hours=limits["TRACKING_EXPIRE_HOURS"]
        ):
            raise Http404("Order tracking has expired.")

    return order


def _derive_order_target_and_branding(order: Order) -> tuple[str, str, str]:
    """Return (display_name, logo_url, target_label) for public order views."""
    tenant = order.branch.tenant
    business_settings = getattr(tenant, "business_settings", None)
    display_name = (
        business_settings.legal_name
        if business_settings and business_settings.legal_name
        else tenant.name
    )
    logo_url = business_settings.logo_url if business_settings else ""

    target_label = ""
    if order.table_session and order.table_session.table:
        target_label = order.table_session.table.label
    elif order.token_number is not None:
        target_label = f"Token #{order.token_number}"

    return display_name, logo_url, target_label


def _compute_pickup_code(order: Order) -> str | None:
    """Return 4-digit pickup code strictly when READY for counter or parcel orders."""
    is_counter_or_parcel = order.order_workflow == OrderWorkflow.COUNTER_TOKEN or "[PARCEL]" in (
        order.notes or ""
    )
    if not is_counter_or_parcel or order.status != OrderStatus.READY:
        return None
    digits = re.sub(r"\D", "", order.order_number or "")
    return digits[-4:] if digits else "1234"


class PublicOrderTrackerView(APIView):
    """Public read-only order status tracker by random 128-bit tracking_token."""

    permission_classes = [AllowAny]
    throttle_classes = [PublicOrderTrackThrottle]

    @extend_schema(
        responses={
            200: inline_serializer(
                name="PublicOrderTrackerResponse",
                fields={
                    "display_name": serializers.CharField(),
                    "logo_url": serializers.CharField(),
                    "branch_name": serializers.CharField(),
                    "order_number": serializers.CharField(),
                    "order_workflow": serializers.CharField(),
                    "status": serializers.CharField(),
                    "status_key": serializers.CharField(),
                    "payment_status": serializers.CharField(),
                    "payment_timing": serializers.CharField(),
                    "target_label": serializers.CharField(),
                    "token_number": serializers.IntegerField(allow_null=True),
                    "pickup_code": serializers.CharField(allow_null=True),
                    "rejected_reason": serializers.CharField(),
                    "show_bill": serializers.BooleanField(),
                    "total_paise": serializers.IntegerField(),
                    "placed_at": serializers.CharField(allow_null=True),
                    "ready_at": serializers.CharField(allow_null=True),
                    "served_at": serializers.CharField(allow_null=True),
                    "completed_at": serializers.CharField(allow_null=True),
                    "cancelled_at": serializers.CharField(allow_null=True),
                    "items": serializers.ListField(child=serializers.DictField()),
                },
            ),
            404: OpenApiResponse(description="Order not found or expired"),
        }
    )
    def get(self, request: Request, tracking_token: str) -> Response:
        order = _resolve_tracked_order(tracking_token)
        capabilities = getattr(order.branch, "capabilities", None)
        payment_timing = capabilities.payment_timing if capabilities else PaymentTiming.PAY_LATER
        display_name, logo_url, target_label = _derive_order_target_and_branding(order)

        # Bill & printable receipt unlock strictly after server-confirmed payment.
        show_bill = order.payment_status == OrderPaymentStatus.PAID

        return Response(
            {
                "display_name": display_name,
                "logo_url": logo_url,
                "branch_name": order.branch.name,
                "order_number": order.order_number,
                "order_workflow": order.order_workflow,
                "status": order.status,
                "status_key": _status_message_key(order, payment_timing),
                "payment_status": order.payment_status,
                "payment_timing": payment_timing,
                "target_label": target_label,
                "token_number": order.token_number,
                "pickup_code": _compute_pickup_code(order),
                "rejected_reason": order.rejected_reason,
                "show_bill": show_bill,
                "total_paise": order.total_paise,
                "placed_at": order.placed_at.isoformat() if order.placed_at else None,
                "ready_at": order.ready_at.isoformat() if order.ready_at else None,
                "served_at": order.served_at.isoformat() if order.served_at else None,
                "completed_at": order.completed_at.isoformat() if order.completed_at else None,
                "cancelled_at": order.cancelled_at.isoformat() if order.cancelled_at else None,
                "items": [
                    {
                        "item_name": it.item_name,
                        "variant_name": it.variant_name,
                        "options": it.options_snapshot,
                        "quantity": it.quantity,
                        "notes": it.notes,
                        "unit_price_paise": it.unit_price_paise,
                        "subtotal_paise": it.subtotal_paise,
                    }
                    for it in order.items.all()
                ],
            },
            status=status.HTTP_200_OK,
        )


class PublicOrderReceiptView(APIView):
    """Server-enforced public paid receipt endpoint (blocks unpaid orders with 403)."""

    permission_classes = [AllowAny]
    throttle_classes = [PublicOrderTrackThrottle]

    @extend_schema(
        responses={
            200: inline_serializer(
                name="PublicOrderReceiptResponse",
                fields={
                    "demo_notice": serializers.CharField(),
                    "display_name": serializers.CharField(),
                    "logo_url": serializers.CharField(),
                    "branch_name": serializers.CharField(),
                    "order_number": serializers.CharField(),
                    "invoice_number": serializers.CharField(),
                    "target_label": serializers.CharField(),
                    "token_number": serializers.IntegerField(allow_null=True),
                    "payment_status": serializers.CharField(),
                    "payment_method": serializers.CharField(),
                    "settled_at": serializers.CharField(allow_null=True),
                    "subtotal_paise": serializers.IntegerField(),
                    "discount_paise": serializers.IntegerField(),
                    "total_paise": serializers.IntegerField(),
                    "items": serializers.ListField(child=serializers.DictField()),
                },
            ),
            403: OpenApiResponse(description="Receipt is only available after payment"),
            404: OpenApiResponse(description="Order not found or expired"),
        }
    )
    def get(self, request: Request, tracking_token: str) -> Response:
        order = _resolve_tracked_order(tracking_token)
        if not is_tenant_allowed(order.branch.tenant):
            raise Http404("Order not found.")

        if order.payment_status != OrderPaymentStatus.PAID:
            raise BusinessRuleError(
                "BILL_NOT_PAID",
                "Receipt is only available after payment is completed.",
                status_code=403,
            )

        display_name, logo_url, target_label = _derive_order_target_and_branding(order)
        items = list(order.items.all())
        subtotal_paise = sum(it.subtotal_paise for it in items)

        invoice = None
        if order.table_session_id:
            invoice = (
                BillInvoice.unscoped.filter(
                    tenant=order.tenant,
                    table_session_id=order.table_session_id,
                    is_settled=True,
                )
                .order_by("-settled_at")
                .first()
            )

        invoice_number = invoice.invoice_number if invoice else ""
        payment_method = invoice.payment_method if invoice else ""
        settled_at = (
            invoice.settled_at.isoformat()
            if invoice and invoice.settled_at
            else (order.completed_at.isoformat() if order.completed_at else None)
        )

        # Strip notes, customer names, phone numbers, and staff data per public endpoint rules.
        return Response(
            {
                "demo_notice": "DEMO RECEIPT - NOT A TAX INVOICE",
                "display_name": display_name,
                "logo_url": logo_url,
                "branch_name": order.branch.name,
                "order_number": order.order_number,
                "invoice_number": invoice_number,
                "target_label": target_label,
                "token_number": order.token_number,
                "payment_status": order.payment_status,
                "payment_method": payment_method,
                "settled_at": settled_at,
                "subtotal_paise": subtotal_paise,
                "discount_paise": 0,
                "total_paise": subtotal_paise,
                "items": [
                    {
                        "item_name": it.item_name,
                        "variant_name": it.variant_name,
                        "options": it.options_snapshot,
                        "quantity": it.quantity,
                        "unit_price_paise": it.unit_price_paise,
                        "subtotal_paise": it.subtotal_paise,
                    }
                    for it in items
                ],
            },
            status=status.HTTP_200_OK,
        )


class PublicQRReorderPreviewView(APIView):
    """Stage D2: Revalidates guest phone-only order history items against current server prices & availability."""

    permission_classes = [AllowAny]
    throttle_classes = [PublicQRIPThrottle, PublicQRTokenThrottle]

    def post(self, request: Request, token: str) -> Response:
        qr = _resolve_active_qr(token)
        tenant = qr.branch.tenant
        ctx_token = set_current_tenant(tenant)
        try:
            raw_items = request.data.get("items") or []
            if not isinstance(raw_items, list) or not raw_items:
                raise BusinessRuleError(
                    "EMPTY_ITEMS", "No items provided for reorder preview.", status_code=400
                )

            unavailable_ids = set(
                BranchItemAvailability.objects.filter(
                    branch=qr.branch, is_available=False
                ).values_list("item_id", flat=True)
            )

            preview_lines: list[dict[str, Any]] = []
            has_changes = False

            for entry in raw_items[:20]:
                mid = str(entry.get("menu_item_id") or "")
                qty = max(1, min(10, int(entry.get("quantity") or 1)))
                vid = entry.get("variant_id")
                opt_ids = [str(o) for o in (entry.get("option_ids") or [])]

                item = MenuItem.objects.filter(tenant=tenant, id=mid, is_active=True).first()
                if not item or item.id in unavailable_ids:
                    has_changes = True
                    preview_lines.append(
                        {
                            "menu_item_id": mid,
                            "item_name": item.name if item else "Removed Dish",
                            "quantity": qty,
                            "is_available": False,
                            "reason": "SOLD_OUT_OR_REMOVED",
                            "current_unit_price_paise": 0,
                        }
                    )
                    continue

                unit_price = item.base_price_paise
                if vid:
                    var = ItemVariant.objects.filter(item=item, id=str(vid)).first()
                    if not var:
                        has_changes = True
                        preview_lines.append(
                            {
                                "menu_item_id": mid,
                                "item_name": item.name,
                                "quantity": qty,
                                "is_available": False,
                                "reason": "VARIANT_UNAVAILABLE",
                                "current_unit_price_paise": 0,
                            }
                        )
                        continue
                    unit_price = var.price_paise

                opts_extra = 0
                if opt_ids:
                    valid_opts = list(Option.objects.filter(id__in=opt_ids, is_active=True))
                    if len(valid_opts) != len(set(opt_ids)):
                        has_changes = True
                    opts_extra = sum(o.price_delta_paise for o in valid_opts)

                current_unit = unit_price + opts_extra
                prev_unit = entry.get("previous_unit_price_paise")
                price_changed = prev_unit is not None and int(prev_unit) != current_unit
                if price_changed:
                    has_changes = True

                preview_lines.append(
                    {
                        "menu_item_id": str(item.id),
                        "item_name": item.name,
                        "variant_id": str(vid) if vid else None,
                        "option_ids": opt_ids,
                        "quantity": qty,
                        "is_available": True,
                        "price_changed": price_changed,
                        "current_unit_price_paise": current_unit,
                        "current_subtotal_paise": current_unit * qty,
                    }
                )

            return Response({"has_changes": has_changes, "items": preview_lines})
        finally:
            reset_current_tenant(ctx_token)


class PublicOrderFeedbackView(APIView):
    """Stage D3: Verified-order guest feedback (private to OWNER/BRANCH_MANAGER, never public)."""

    permission_classes = [AllowAny]
    throttle_classes = [PublicOrderTrackThrottle]

    def post(self, request: Request, tracking_token: str) -> Response:
        import re

        # Honeypot check
        if request.data.get("website") or request.data.get("hp_field"):
            raise BusinessRuleError("SPAM_DETECTED", "Invalid submission.", status_code=400)

        order = (
            Order.unscoped.select_related("branch", "tenant")
            .filter(tracking_token=tracking_token)
            .first()
        )
        if not order:
            raise Http404("Order not found.")

        if order.status not in (OrderStatus.SERVED, OrderStatus.COMPLETED):
            raise BusinessRuleError(
                "FEEDBACK_NOT_ELIGIBLE",
                "Feedback can only be submitted after your order is served or completed.",
                status_code=400,
            )

        ref_time = order.completed_at or order.served_at or order.updated_at
        if ref_time and (timezone.now() - ref_time) > timedelta(hours=24):
            raise BusinessRuleError(
                "FEEDBACK_WINDOW_EXPIRED",
                "The 24-hour feedback window for this order has closed.",
                status_code=400,
            )

        if OrderFeedback.unscoped.filter(order=order).exists():
            raise BusinessRuleError(
                "FEEDBACK_ALREADY_SUBMITTED",
                "Feedback has already been submitted for this order.",
                status_code=400,
            )

        food_rating = int(request.data.get("food_rating", 0))
        service_rating = int(request.data.get("service_rating", 0))
        if not (1 <= food_rating <= 5 and 1 <= service_rating <= 5):
            raise BusinessRuleError(
                "INVALID_RATING",
                "Ratings must be between 1 and 5.",
                status_code=400,
            )

        raw_comment = str(request.data.get("comment") or "")
        # Reject URLs/links and strip control characters
        if re.search(r"(https?://|www\.|[a-z0-9-]+\.[a-z]{2,}/)", raw_comment, re.IGNORECASE):
            raise BusinessRuleError(
                "LINKS_NOT_ALLOWED",
                "Links and URLs are not permitted in feedback comments.",
                status_code=400,
            )
        clean_comment = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", raw_comment).strip()[:500]
        suggestion_type = str(request.data.get("suggestion_type") or FeedbackSuggestionType.OTHER)
        if suggestion_type not in FeedbackSuggestionType.values:
            suggestion_type = FeedbackSuggestionType.OTHER

        ctx_token = set_current_tenant(order.tenant)
        try:
            fb = OrderFeedback.objects.create(
                tenant=order.tenant,
                branch=order.branch,
                order=order,
                food_rating=food_rating,
                service_rating=service_rating,
                item_ratings=request.data.get("item_ratings") or {},
                comment=clean_comment,
                suggestion_type=suggestion_type,
            )
            return Response(
                {"id": str(fb.id), "status": "RECEIVED"},
                status=status.HTTP_201_CREATED,
            )
        finally:
            reset_current_tenant(ctx_token)


class PublicQRServiceRequestView(APIView):
    """Stage D4: Guest table service requests (Call waiter, Water, Bill, Cutlery) with anti-spam limits."""

    permission_classes = [AllowAny]
    throttle_classes = [PublicQRIPThrottle, PublicQRTokenThrottle]

    def get(self, request: Request, token: str) -> Response:
        qr = _resolve_active_qr(token)
        if not qr.table:
            return Response([])
        ctx_token = set_current_tenant(qr.branch.tenant)
        try:
            session = TableSession.objects.filter(table=qr.table, status=SessionStatus.OPEN).first()
            if not session:
                return Response([])
            reqs = ServiceRequest.objects.filter(table_session=session).order_by("-created_at")[:10]
            status_map = {
                ServiceRequestStatus.PENDING: "Sent",
                ServiceRequestStatus.ACKNOWLEDGED: "On the way",
                ServiceRequestStatus.RESOLVED: "Done",
            }
            return Response(
                [
                    {
                        "id": str(r.id),
                        "request_type": r.request_type,
                        "status": r.status,
                        "guest_status_label": status_map.get(r.status, "Sent"),
                        "created_at": r.created_at.isoformat(),
                    }
                    for r in reqs
                ]
            )
        finally:
            reset_current_tenant(ctx_token)

    def post(self, request: Request, token: str) -> Response:
        qr = _resolve_active_qr(token)
        tenant = qr.branch.tenant
        ctx_token = set_current_tenant(tenant)
        try:
            capabilities = getattr(qr.branch, "capabilities", None)
            if capabilities and (
                not capabilities.allows_service_requests
                or capabilities.qr_ordering_mode
                in (QROrderingMode.DISABLED, QROrderingMode.BROWSE_ONLY)
            ):
                raise BusinessRuleError(
                    "SERVICE_REQUESTS_DISABLED",
                    "Service requests are disabled for this table.",
                    status_code=403,
                )

            if not qr.table:
                raise BusinessRuleError(
                    "TABLE_REQUIRED",
                    "Service requests are only available for table QR codes.",
                    status_code=400,
                )

            session = TableSession.objects.filter(table=qr.table, status=SessionStatus.OPEN).first()
            if not session:
                raise BusinessRuleError(
                    "SESSION_NOT_OPEN",
                    "Table session is not open.",
                    status_code=400,
                )

            req_type = str(request.data.get("request_type") or "")
            if req_type not in ServiceRequestType.values:
                raise BusinessRuleError(
                    "INVALID_REQUEST_TYPE", "Invalid service request type.", status_code=400
                )

            # One open request per type per table
            if ServiceRequest.objects.filter(
                table=qr.table,
                request_type=req_type,
                status__in=[ServiceRequestStatus.PENDING, ServiceRequestStatus.ACKNOWLEDGED],
            ).exists():
                raise BusinessRuleError(
                    "REQUEST_ALREADY_OPEN",
                    f"A '{req_type}' request is already open for this table.",
                    status_code=400,
                )

            # Max 3 requests per 10 minutes per table session
            ten_mins_ago = timezone.now() - timedelta(minutes=10)
            recent_count = ServiceRequest.objects.filter(
                table_session=session, created_at__gte=ten_mins_ago
            ).count()
            if recent_count >= 3:
                raise BusinessRuleError(
                    "SERVICE_REQUEST_RATE_LIMIT",
                    "Maximum 3 service requests per 10 minutes per table session.",
                    status_code=429,
                )

            srv = ServiceRequest.objects.create(
                tenant=tenant,
                branch=qr.branch,
                table=qr.table,
                table_session=session,
                request_type=req_type,
                status=ServiceRequestStatus.PENDING,
            )
            return Response(
                {
                    "id": str(srv.id),
                    "request_type": srv.request_type,
                    "status": srv.status,
                    "guest_status_label": "Sent",
                },
                status=status.HTTP_201_CREATED,
            )
        finally:
            reset_current_tenant(ctx_token)
