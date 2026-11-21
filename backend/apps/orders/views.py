from typing import Any

from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import filters, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Membership
from apps.core.exceptions import BusinessRuleError
from apps.orders.models import (
    BillInvoice,
    CashierShiftCloseout,
    CourseType,
    Customer,
    Order,
    OrderFeedback,
    OrderStatus,
    OrderWorkflow,
    PaymentMethod,
    ServiceRequest,
    ServiceRequestStatus,
    ServiceRequestType,
)
from apps.orders.serializers import (
    BillInvoiceSerializer,
    CashierShiftCloseoutSerializer,
    CashMovementSerializer,
    CloseShiftInputSerializer,
    CreateCashMovementSerializer,
    CreateInvoiceRefundSerializer,
    CreateOrderSerializer,
    CustomerSerializer,
    InvoiceRefundSerializer,
    KDSTicketSerializer,
    OrderFeedbackSerializer,
    OrderSerializer,
    ServiceRequestSerializer,
    SettleBillSerializer,
)
from apps.orders.services import (
    approve_qr_order,
    calculate_bill,
    close_shift,
    create_invoice_refund,
    create_order,
    get_exceptions_report,
    get_or_open_shift,
    get_orders_delay_report,
    get_outlets_report,
    get_range_report,
    get_staff_report,
    get_today_report,
    merge_table_sessions,
    move_session_items,
    preview_split_bill,
    record_cash_movement,
    reject_qr_order,
    settle_bill,
    settle_order_bill,
    transition_order_status,
)
from apps.rbac.constants import Permission
from apps.rbac.permissions import ActionPermission, HasTenantPermission
from apps.tenants.models import Branch
from apps.venues.models import DiningTable, TableSession


class OrderViewSet(viewsets.ModelViewSet):
    """Production ViewSet for placing, tracking, serving, and cancelling orders."""

    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.MENU_VIEW,
        "retrieve": Permission.MENU_VIEW,
        "create": Permission.ORDER_CREATE,
        "cancel": Permission.ORDER_CANCEL,
        "serve": Permission.ORDER_CREATE,
        "fire_mains": Permission.ORDER_CREATE,
        "approve": Permission.ORDER_CREATE,
        "reject": Permission.ORDER_CREATE,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return Order.objects.none()
        qs = (
            Order.objects.filter(tenant=tenant)
            .select_related("table_session__table", "branch", "placed_by__user")
            .prefetch_related("items", "events__user__user")
        )

        branch_id = self.request.query_params.get("branch_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        workflow = self.request.query_params.get("workflow") or self.request.query_params.get(
            "order_workflow"
        )
        if workflow:
            qs = qs.filter(order_workflow=workflow)

        session_id = self.request.query_params.get("session_id")
        if session_id:
            qs = qs.filter(table_session_id=session_id)

        date_param = self.request.query_params.get("date")
        if date_param:
            qs = qs.filter(placed_at__date=date_param)

        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(order_number__icontains=q)
                | Q(table_session__table__label__icontains=q)
                | Q(token_number__icontains=q)
            )

        return qs

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = CreateOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        tenant = getattr(request, "tenant", None)
        branch_id = data.get("branch_id") or request.headers.get("X-Branch-ID")
        branch = None
        if branch_id:
            branch = Branch.objects.filter(tenant=tenant, id=branch_id).first()
        if not branch:
            branch = Branch.objects.filter(tenant=tenant, is_active=True).first()
        if not branch:
            raise ValidationError({"branch": "No active branch found for tenant."})

        # Find table session if given
        table_session = None
        session_id = data.get("table_session_id")
        if session_id:
            table_session = TableSession.objects.filter(
                tenant=tenant, id=session_id, status="OPEN"
            ).first()
            if not table_session:
                raise ValidationError({"table_session_id": "Active open table session not found."})

        membership = Membership.objects.filter(
            tenant=tenant, user_id=request.user.pk, is_active=True
        ).first()

        idem_key = (
            request.headers.get("Idempotency-Key") or data.get("idempotency_key") or ""
        ).strip()[:128]
        if idem_key:
            existing_order = Order.objects.filter(
                tenant=tenant, branch=branch, idempotency_key=idem_key
            ).first()
            if existing_order is not None:
                return Response(OrderSerializer(existing_order).data, status=status.HTTP_200_OK)

        order = create_order(
            branch=branch,
            items_data=data["items"],
            user_membership=membership,
            table_session=table_session,
            token_number=data.get("token_number"),
            order_workflow=data.get("order_workflow", OrderWorkflow.TABLE_SERVICE),
            notes=data.get("notes", ""),
            idempotency_key=idem_key,
        )

        out_serializer = OrderSerializer(order)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request: Request, pk: str | None = None) -> Response:
        membership = getattr(request, "membership", None)
        role = getattr(membership, "role", "")
        if role not in ["OWNER", "BRANCH_MANAGER"] and not getattr(
            request.user, "is_platform_admin", False
        ):
            raise PermissionDenied("Only an Owner or Branch Manager can cancel an order.")

        reason = str(request.data.get("reason", "")).strip()
        if not reason:
            raise ValidationError({"reason": "A cancellation reason is required."})

        order = self.get_object()
        transition_order_status(
            order, OrderStatus.CANCELLED, user_membership=membership, reason=reason
        )
        return Response({"status": "CANCELLED", "order_id": str(order.id)})

    @action(detail=True, methods=["post"], url_path="serve")
    def serve(self, request: Request, pk: str | None = None) -> Response:
        membership = getattr(request, "membership", None)
        order = self.get_object()
        transition_order_status(order, OrderStatus.SERVED, user_membership=membership)
        return Response({"status": "SERVED", "order_id": str(order.id)})

    @action(detail=True, methods=["post"], url_path="fire-mains")
    def fire_mains(self, request: Request, pk: str | None = None) -> Response:
        order = self.get_object()
        updated_count = order.items.filter(course=CourseType.MAIN, is_fired=False).update(
            is_fired=True, status="COOKING"
        )
        return Response({"fired_count": updated_count, "order_id": str(order.id)})

    def _check_qr_review_access(self, request: Request, order: Order) -> Any:
        membership = getattr(request, "membership", None)
        role = getattr(membership, "role", "")
        if role not in {"OWNER", "BRANCH_MANAGER", "CASHIER", "WAITER"} and not getattr(
            request.user, "is_platform_admin", False
        ):
            raise PermissionDenied(
                "Only Owner, Branch Manager, Cashier, or Waiter can approve or reject QR orders."
            )
        if (
            membership
            and role != "OWNER"
            and membership.branches.exists()
            and not membership.branches.filter(id=order.branch_id).exists()
        ):
            raise PermissionDenied("You do not have access to this branch's orders.")
        return membership

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request: Request, pk: str | None = None) -> Response:
        order = self.get_object()
        membership = self._check_qr_review_access(request, order)
        updated = approve_qr_order(order, user_membership=membership, request=request)
        return Response(OrderSerializer(updated).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request: Request, pk: str | None = None) -> Response:
        order = self.get_object()
        membership = self._check_qr_review_access(request, order)
        reason = str(request.data.get("reason", "")).strip()
        updated = reject_qr_order(order, reason=reason, user_membership=membership, request=request)
        return Response(OrderSerializer(updated).data, status=status.HTTP_200_OK)


class KDSViewSet(viewsets.ReadOnlyModelViewSet):
    """Kitchen Display System real-time ticket queue."""

    serializer_class = KDSTicketSerializer
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.MENU_VIEW)]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return Order.objects.none()
        qs = (
            Order.objects.filter(
                tenant=tenant,
                status__in=[OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.READY],
            )
            .select_related("table_session__table", "branch")
            .prefetch_related("items")
            .order_by("placed_at")
        )

        branch_id = self.request.query_params.get("branch_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        station = self.request.query_params.get("station")
        if station and station != "ALL":
            qs = qs.filter(items__station=station).distinct()

        return qs

    @action(detail=True, methods=["post"], url_path="bump")
    def bump(self, request: Request, pk: str | None = None) -> Response:
        order = self.get_object()
        membership = getattr(request, "membership", None)

        if order.status == OrderStatus.PLACED:
            next_status = OrderStatus.PREPARING
        elif order.status == OrderStatus.PREPARING:
            next_status = OrderStatus.READY
        elif order.status == OrderStatus.READY:
            next_status = OrderStatus.SERVED
        else:
            next_status = OrderStatus.COMPLETED

        transition_order_status(order, next_status, user_membership=membership)
        return Response({"order_id": str(order.id), "status": order.status})


class BillingViewSet(viewsets.ViewSet):
    """Cashier billing and table session checkout."""

    serializer_class = BillInvoiceSerializer
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.TABLE_SESSION_CLOSE)]

    @action(detail=False, methods=["get"], url_path="session/(?P<session_id>[^/.]+)")
    def session_bill(self, request: Request, session_id: str | None = None) -> Response:
        tenant = getattr(request, "tenant", None)
        session = (
            TableSession.objects.filter(tenant=tenant, id=session_id)
            .select_related("table", "branch")
            .first()
        )
        if not session:
            raise NotFound("Active table session not found.")
        bill = calculate_bill(session)
        return Response(bill)

    @action(detail=False, methods=["post"], url_path="session/(?P<session_id>[^/.]+)/settle")
    def settle(self, request: Request, session_id: str | None = None) -> Response:
        tenant = getattr(request, "tenant", None)
        session = (
            TableSession.objects.filter(tenant=tenant, id=session_id)
            .select_related("table", "branch")
            .first()
        )
        if not session:
            raise NotFound("Table session not found.")

        serializer = SettleBillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        membership = Membership.objects.filter(
            tenant=tenant, user_id=request.user.pk, is_active=True
        ).first()

        invoice = settle_bill(
            table_session=session,
            payment_method=data.get("payment_method", PaymentMethod.CASH),
            amount_tendered_paise=data.get("amount_tendered_paise"),
            user_membership=membership,
            discount_paise=data.get("discount_paise", 0),
            notes=data.get("notes", ""),
            customer_id=data.get("customer_id"),
            redeem_loyalty_points=data.get("redeem_loyalty_points", 0),
        )

        out_serializer = BillInvoiceSerializer(invoice)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="order/(?P<order_id>[^/.]+)/settle")
    def settle_order(self, request: Request, order_id: str | None = None) -> Response:
        tenant = getattr(request, "tenant", None)
        order = Order.objects.filter(tenant=tenant, id=order_id).first()
        if not order:
            raise NotFound("Order not found.")

        serializer = SettleBillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        membership = Membership.objects.filter(
            tenant=tenant, user_id=request.user.pk, is_active=True
        ).first()

        invoice = settle_order_bill(
            order=order,
            payment_method=data.get("payment_method", PaymentMethod.CASH),
            amount_tendered_paise=data.get("amount_tendered_paise"),
            user_membership=membership,
            discount_paise=data.get("discount_paise", 0),
            notes=data.get("notes", ""),
        )

        out_serializer = BillInvoiceSerializer(invoice)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"], url_path="invoices")
    def list_invoices(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None)
        qs = (
            BillInvoice.objects.filter(tenant=tenant)
            .select_related("table_session__table", "branch")
            .prefetch_related("refunds__processed_by__user", "refunds__approved_by__user")
            .order_by("-created_at")[:50]
        )
        serializer = BillInvoiceSerializer(qs, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="session/(?P<session_id>[^/.]+)/split-preview",
    )
    def split_preview(self, request: Request, session_id: str | None = None) -> Response:
        tenant = getattr(request, "tenant", None)
        session = (
            TableSession.objects.filter(tenant=tenant, id=session_id)
            .select_related("table", "branch")
            .first()
        )
        if not session:
            raise NotFound("Table session not found.")
        mode = str(request.data.get("mode", "EQUAL"))
        shares = int(request.data.get("shares", 2))
        item_ids = request.data.get("item_ids") or []
        result = preview_split_bill(
            table_session=session,
            mode=mode,
            shares=shares,
            item_ids=[str(x) for x in item_ids],
        )
        return Response(result)

    @action(
        detail=False,
        methods=["post"],
        url_path="session/(?P<session_id>[^/.]+)/move-items",
    )
    def move_items(self, request: Request, session_id: str | None = None) -> Response:
        tenant = getattr(request, "tenant", None)
        source_session = (
            TableSession.objects.filter(tenant=tenant, id=session_id)
            .select_related("table", "branch")
            .first()
        )
        if not source_session:
            raise NotFound("Source table session not found.")
        target_id = request.data.get("target_session_id")
        target_session = (
            TableSession.objects.filter(tenant=tenant, id=target_id)
            .select_related("table", "branch")
            .first()
        )
        if not target_session:
            raise NotFound("Target table session not found.")
        item_ids = [str(x) for x in (request.data.get("item_ids") or [])]
        membership = Membership.objects.filter(
            tenant=tenant, user_id=request.user.pk, is_active=True
        ).first()
        result = move_session_items(
            source_session=source_session,
            target_session=target_session,
            item_ids=item_ids,
            user_membership=membership,
            request=request,
        )
        return Response(result)

    @action(
        detail=False,
        methods=["post"],
        url_path="session/(?P<session_id>[^/.]+)/merge",
    )
    def merge_sessions(self, request: Request, session_id: str | None = None) -> Response:
        tenant = getattr(request, "tenant", None)
        source_session = (
            TableSession.objects.filter(tenant=tenant, id=session_id)
            .select_related("table", "branch")
            .first()
        )
        if not source_session:
            raise NotFound("Source table session not found.")
        target_id = request.data.get("target_session_id")
        target_session = (
            TableSession.objects.filter(tenant=tenant, id=target_id)
            .select_related("table", "branch")
            .first()
        )
        if not target_session:
            raise NotFound("Target table session not found.")
        membership = Membership.objects.filter(
            tenant=tenant, user_id=request.user.pk, is_active=True
        ).first()
        merged = merge_table_sessions(
            source_session=source_session,
            target_session=target_session,
            user_membership=membership,
            request=request,
        )
        return Response(
            {
                "source_session_id": str(source_session.id),
                "target_session_id": str(merged.id),
                "status": "MERGED",
            }
        )


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Authoritative Invoices directory, detail, and append-only refund endpoints."""

    serializer_class = BillInvoiceSerializer
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.PRINTER_REPRINT)]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return BillInvoice.objects.none()

        qs = (
            BillInvoice.objects.filter(tenant=tenant)
            .select_related("table_session__table", "branch", "settled_by__user")
            .prefetch_related("refunds__processed_by__user", "refunds__approved_by__user")
            .order_by("-created_at")
        )

        date_param = self.request.query_params.get("date")
        if date_param:
            qs = qs.filter(settled_at__date=date_param)

        method = self.request.query_params.get("payment_method")
        if method:
            qs = qs.filter(payment_method=method)

        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(invoice_number__icontains=q)
                | Q(table_session__table__label__icontains=q)
                | Q(notes__icontains=q)
            )

        return qs

    @action(detail=True, methods=["get", "post"], url_path="refunds")
    def refunds(self, request: Request, pk: str | None = None) -> Response:
        invoice = self.get_object()
        if request.method == "GET":
            qs = invoice.refunds.select_related("processed_by__user", "approved_by__user").all()
            return Response(InvoiceRefundSerializer(qs, many=True).data)

        membership = Membership.objects.filter(
            tenant=invoice.tenant, user_id=request.user.pk, is_active=True
        ).first()
        role = getattr(membership, "role", "")
        if role not in ("OWNER", "BRANCH_MANAGER", "CASHIER"):
            raise PermissionDenied(
                "Only Owner, Branch Manager, or Cashier can process invoice refunds."
            )

        serializer = CreateInvoiceRefundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        refund = create_invoice_refund(
            invoice=invoice,
            amount_paise=data["amount_paise"],
            reason_code=data["reason_code"],
            refund_method=data.get("refund_method"),
            restock_action=data.get("restock_action", "NONE"),
            refunded_lines=data.get("refunded_lines", []),
            notes=data.get("notes", ""),
            actor_membership=membership,
            request=request,
        )
        return Response(InvoiceRefundSerializer(refund).data, status=status.HTTP_201_CREATED)


class ShiftCloseoutViewSet(viewsets.ReadOnlyModelViewSet):
    """Blind cash drawer handover, mid-shift cash movements, and Z-Report closeout."""

    serializer_class = CashierShiftCloseoutSerializer
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.TABLE_SESSION_CLOSE)]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return CashierShiftCloseout.objects.none()
        qs = (
            CashierShiftCloseout.objects.filter(tenant=tenant)
            .select_related("cashier__user", "branch")
            .prefetch_related("cash_movements__recorded_by__user")
            .order_by("-opened_at")
        )
        branch_id = self.request.query_params.get("branch_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    def _resolve_branch_and_membership(self, request: Request) -> tuple[Branch, Membership]:
        tenant = getattr(request, "tenant", None)
        if not tenant:
            raise ValidationError({"tenant": "Active tenant context required."})
        branch_id = (
            request.query_params.get("branch_id")
            or request.data.get("branch_id")
            or request.headers.get("X-Branch-ID")
        )
        branch = None
        if branch_id:
            branch = Branch.objects.filter(tenant=tenant, id=branch_id).first()
        if not branch:
            branch = Branch.objects.filter(tenant=tenant, is_active=True).first()
        if not branch:
            raise ValidationError({"branch": "No active branch found for tenant."})
        membership = Membership.objects.filter(
            tenant=tenant, user_id=request.user.pk, is_active=True
        ).first()
        if not membership:
            raise PermissionDenied("Active tenant membership required.")
        return branch, membership

    @action(detail=False, methods=["get", "post"], url_path="current")
    def current(self, request: Request) -> Response:
        branch, membership = self._resolve_branch_and_membership(request)
        opening_paise = int(request.data.get("opening_cash_paise", 200000))
        shift = get_or_open_shift(
            branch=branch,
            cashier=membership,
            opening_cash_paise=opening_paise,
        )
        return Response(CashierShiftCloseoutSerializer(shift).data)

    @action(detail=True, methods=["post"], url_path="cash-movements")
    def cash_movements(self, request: Request, pk: str | None = None) -> Response:
        shift = self.get_object()
        _branch, membership = self._resolve_branch_and_membership(request)
        serializer = CreateCashMovementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        mv = record_cash_movement(
            shift=shift,
            movement_type=data["movement_type"],
            amount_paise=data["amount_paise"],
            reason=data["reason"],
            actor=membership,
            request=request,
        )
        return Response(CashMovementSerializer(mv).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="close")
    def close(self, request: Request, pk: str | None = None) -> Response:
        shift = self.get_object()
        _branch, membership = self._resolve_branch_and_membership(request)
        serializer = CloseShiftInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        closed = close_shift(
            shift=shift,
            actual_cash_paise=data["actual_cash_paise"],
            opening_cash_paise=data.get("opening_cash_paise"),
            denominations_snapshot=data.get("denominations_snapshot", {}),
            variance_reason_code=data.get("variance_reason_code", ""),
            notes=data.get("notes", ""),
            actor=membership,
            request=request,
        )
        return Response(CashierShiftCloseoutSerializer(closed).data)


class TodayReportView(APIView):
    """GET /api/v1/reports/today/ returning sales, orders, and payment totals."""

    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.REPORT_VIEW)]

    @extend_schema(responses={200: serializers.DictField()})
    def get(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant context required."}, status=400)

        membership = getattr(request, "membership", None)
        branch = None
        branch_id = request.query_params.get("branch_id")
        if branch_id:
            branch = Branch.objects.filter(tenant=tenant, id=branch_id).first()
        elif membership and membership.branches.exists():
            branch = membership.branches.first()

        report = get_today_report(tenant, branch=branch)
        return Response(report)


def _parse_report_dates_and_branch(
    request: Request,
) -> tuple[Any, Any, Branch | None, Response | None]:
    import datetime
    import zoneinfo

    tenant = getattr(request, "tenant", None)
    if not tenant:
        return (
            datetime.date.today(),
            datetime.date.today(),
            None,
            Response({"error": "Tenant context required."}, status=400),
        )

    tz_name = getattr(tenant, "timezone", None) or "Asia/Kolkata"
    try:
        tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        tz = zoneinfo.ZoneInfo("Asia/Kolkata")

    today = timezone.now().astimezone(tz).date()

    start_date_str = request.query_params.get("start_date")
    end_date_str = request.query_params.get("end_date")

    if not start_date_str:
        start_date = today - datetime.timedelta(days=6)
    else:
        try:
            start_date = datetime.date.fromisoformat(start_date_str)
        except ValueError:
            return (
                today,
                today,
                None,
                Response({"error": "Invalid start_date format (YYYY-MM-DD required)."}, status=400),
            )

    if not end_date_str:
        end_date = today
    else:
        try:
            end_date = datetime.date.fromisoformat(end_date_str)
        except ValueError:
            return (
                today,
                today,
                None,
                Response({"error": "Invalid end_date format (YYYY-MM-DD required)."}, status=400),
            )

    if start_date > end_date:
        return (
            today,
            today,
            None,
            Response({"error": "start_date cannot be greater than end_date."}, status=400),
        )

    membership = getattr(request, "membership", None)
    branch = None
    branch_id = request.query_params.get("branch_id")
    if branch_id:
        branch = Branch.objects.filter(tenant=tenant, id=branch_id).first()
    elif membership and membership.branches.exists():
        branch = membership.branches.first()

    return start_date, end_date, branch, None


class RangeReportView(APIView):
    """GET /api/v1/reports/range/ returning sales, orders, and payment totals for a date range."""

    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.REPORT_VIEW)]

    @extend_schema(responses={200: serializers.DictField()})
    def get(self, request: Request) -> Response:
        start_date, end_date, branch, err_response = _parse_report_dates_and_branch(request)
        if err_response:
            return err_response
        report = get_range_report(
            request.tenant, start_date=start_date, end_date=end_date, branch=branch
        )
        return Response(report)


class ExceptionsReportView(APIView):
    """GET /api/v1/reports/exceptions/ returning discounts, voids, and reprint audit trails (H-01)."""

    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.REPORT_VIEW)]

    @extend_schema(responses={200: serializers.DictField()})
    def get(self, request: Request) -> Response:
        start_date, end_date, branch, err_response = _parse_report_dates_and_branch(request)
        if err_response:
            return err_response
        report = get_exceptions_report(
            request.tenant, start_date=start_date, end_date=end_date, branch=branch
        )
        return Response(report)


class StaffReportView(APIView):
    """GET /api/v1/reports/staff/ returning staff sales and efficiency metrics (H-22)."""

    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.REPORT_VIEW)]

    @extend_schema(responses={200: serializers.DictField()})
    def get(self, request: Request) -> Response:
        start_date, end_date, branch, err_response = _parse_report_dates_and_branch(request)
        if err_response:
            return err_response
        report = get_staff_report(
            request.tenant, start_date=start_date, end_date=end_date, branch=branch
        )
        return Response(report)


class OutletComparisonReportView(APIView):
    """GET /api/v1/reports/outlets/ comparing performance across branches/outlets (H-21)."""

    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.REPORT_VIEW)]

    @extend_schema(responses={200: serializers.DictField()})
    def get(self, request: Request) -> Response:
        start_date, end_date, _branch, err_response = _parse_report_dates_and_branch(request)
        if err_response:
            return err_response
        report = get_outlets_report(request.tenant, start_date=start_date, end_date=end_date)
        return Response(report)


class OrdersDelayReportView(APIView):
    """GET /api/v1/reports/orders-delay/ analyzing prep times and delays (H-06)."""

    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.REPORT_VIEW)]

    @extend_schema(responses={200: serializers.DictField()})
    def get(self, request: Request) -> Response:
        start_date, end_date, branch, err_response = _parse_report_dates_and_branch(request)
        if err_response:
            return err_response
        report = get_orders_delay_report(
            request.tenant, start_date=start_date, end_date=end_date, branch=branch
        )
        return Response(report)


class ServiceRequestViewSet(viewsets.ModelViewSet):
    """Customer Call Bell and service requests."""

    serializer_class = ServiceRequestSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return ServiceRequest.objects.none()
        qs = ServiceRequest.objects.filter(tenant=tenant).select_related("table", "table_session")
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        table_id = request.data.get("table_id")
        table = DiningTable.objects.filter(id=table_id).first()
        if not table:
            raise ValidationError({"table_id": "Table not found."})

        session = TableSession.objects.filter(table=table, status="OPEN").first()

        srv_req = ServiceRequest.objects.create(
            tenant=table.tenant,
            branch=table.branch,
            table=table,
            table_session=session,
            request_type=request.data.get("request_type", ServiceRequestType.CALL_WAITER),
            status=ServiceRequestStatus.PENDING,
        )

        out_serializer = ServiceRequestSerializer(srv_req)
        return Response(out_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="acknowledge")
    def acknowledge(self, request: Request, pk: str | None = None) -> Response:
        srv_req = self.get_object()
        srv_req.status = ServiceRequestStatus.ACKNOWLEDGED
        srv_req.acknowledged_at = timezone.now()
        srv_req.save(update_fields=["status", "acknowledged_at"])
        return Response({"id": str(srv_req.id), "status": srv_req.status})


class CustomerViewSet(viewsets.ModelViewSet):
    """Customer CRM directory for guest preferences, visit counts, and consent (H-24)."""

    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.ORDER_CREATE)]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "phone", "email"]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return Customer.objects.none()
        qs = Customer.objects.filter(tenant=tenant)
        phone = self.request.query_params.get("phone")
        if phone:
            qs = qs.filter(phone=phone)
        return qs

    def perform_create(self, serializer: serializers.BaseSerializer[Customer]) -> None:
        tenant = getattr(self.request, "tenant", None)
        serializer.save(tenant=tenant)

    @action(detail=True, methods=["post"], url_path="loyalty")
    def loyalty(self, request: Request, pk: str | None = None) -> Response:
        customer = self.get_object()
        if not customer.consent_given:
            raise BusinessRuleError(
                "CONSENT_REQUIRED",
                "Guest must provide explicit consent to earn or redeem loyalty points.",
                status_code=400,
            )

        action_type = str(request.data.get("action") or "EARN").upper()
        if action_type == "EARN":
            spend_paise = int(request.data.get("spend_paise", 0))
            pts = int(request.data.get("points", spend_paise // 10000))
            if pts < 0:
                raise ValidationError({"points": "Earned points cannot be negative."})
            customer.loyalty_points += pts
            customer.lifetime_points_earned += pts
            if spend_paise > 0:
                customer.total_spend_paise += spend_paise
                customer.visit_count += 1
            customer.last_visit_at = timezone.now()
            customer.save()
        elif action_type == "REDEEM":
            pts = int(request.data.get("points", 0))
            if pts <= 0:
                raise ValidationError({"points": "Points to redeem must be positive."})
            if pts > customer.loyalty_points:
                raise BusinessRuleError(
                    "INSUFFICIENT_LOYALTY_POINTS",
                    f"Guest only has {customer.loyalty_points} loyalty points available.",
                    status_code=400,
                )
            customer.loyalty_points -= pts
            customer.lifetime_points_redeemed += pts
            customer.save()
        else:
            raise ValidationError({"action": "Action must be EARN or REDEEM."})

        return Response(CustomerSerializer(customer).data)


class ExportMyDataView(APIView):
    """Owner self-service ZIP data export (CSVs + manifest, zero secrets or password hashes)."""

    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.BUSINESS_MANAGE)]

    @extend_schema(responses={200: serializers.FileField()})
    def get(self, request: Request) -> Any:
        import csv
        import hashlib
        import io
        import json
        import zipfile

        from django.http import HttpResponse

        from apps.audit.services import log_audit_event
        from apps.inventory.models import InventoryItem, StockMovement
        from apps.menu.models import MenuItem
        from apps.orders.models import InvoiceRefund

        tenant = getattr(request, "tenant", None)
        if not tenant:
            raise ValidationError({"tenant": "Active tenant context required."})

        def _csv_bytes(headers: list[str], rows: list[list[Any]]) -> bytes:
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow(headers)
            for r in rows:
                writer.writerow(r)
            return buf.getvalue().encode("utf-8")

        branches_rows = [
            [
                str(b.id),
                b.name,
                getattr(b, "city", getattr(b, "address", "")),
                getattr(b, "venue_profile", ""),
                str(b.is_active),
            ]
            for b in Branch.objects.filter(tenant=tenant).order_by("created_at")
        ]
        menu_rows = [
            [
                str(m.id),
                m.name,
                m.name_ta,
                m.category.name if m.category else "",
                m.food_type,
                str(m.base_price_paise),
                str(m.is_active),
            ]
            for m in MenuItem.objects.filter(tenant=tenant)
            .select_related("category")
            .order_by("name")
        ]
        order_rows = [
            [
                str(o.id),
                o.order_number,
                str(o.branch_id),
                o.order_workflow,
                o.source,
                o.status,
                o.payment_status,
                o.placed_at.isoformat() if o.placed_at else "",
            ]
            for o in Order.objects.filter(tenant=tenant).order_by("-placed_at")[:5000]
        ]
        invoice_rows = [
            [
                str(inv.id),
                inv.invoice_number,
                str(inv.branch_id),
                str(inv.subtotal_paise),
                str(inv.discount_paise),
                str(inv.total_paise),
                inv.payment_method,
                inv.settled_at.isoformat() if inv.settled_at else "",
            ]
            for inv in BillInvoice.objects.filter(tenant=tenant).order_by("-created_at")[:5000]
        ]
        refund_rows = [
            [
                str(r.id),
                r.refund_number,
                r.invoice.invoice_number,
                str(r.amount_paise),
                r.reason_code,
                r.refund_method,
                r.restock_action,
                r.created_at.isoformat(),
            ]
            for r in InvoiceRefund.objects.filter(tenant=tenant)
            .select_related("invoice")
            .order_by("-created_at")[:5000]
        ]
        inv_item_rows = [
            [
                str(it.id),
                it.name,
                it.name_ta,
                it.item_type,
                it.base_unit,
                it.category,
                str(it.reorder_level),
                str(it.par_level),
            ]
            for it in InventoryItem.objects.filter(tenant=tenant).order_by("name")
        ]
        movement_rows = [
            [
                str(mv.sequence_number),
                str(mv.branch_id),
                mv.item.name,
                mv.movement_type,
                str(mv.quantity),
                str(mv.unit_cost_paise),
                str(mv.value_paise),
                mv.reason_code,
                mv.created_at.isoformat(),
            ]
            for mv in StockMovement.objects.filter(tenant=tenant)
            .select_related("item")
            .order_by("-sequence_number")[:10000]
        ]
        customer_rows = [
            [
                str(c.id),
                c.name,
                c.phone,
                c.email,
                c.dietary_preference,
                str(c.visit_count),
                str(c.total_spend_paise),
            ]
            for c in Customer.objects.filter(tenant=tenant).order_by("-last_visit_at")
        ]

        csv_files: dict[str, bytes] = {
            "branches.csv": _csv_bytes(
                ["id", "name", "city", "venue_profile", "is_active"], branches_rows
            ),
            "menu_items.csv": _csv_bytes(
                [
                    "id",
                    "name",
                    "name_ta",
                    "category",
                    "food_type",
                    "base_price_paise",
                    "is_active",
                ],
                menu_rows,
            ),
            "orders.csv": _csv_bytes(
                [
                    "id",
                    "order_number",
                    "branch_id",
                    "workflow",
                    "source",
                    "status",
                    "payment_status",
                    "placed_at",
                ],
                order_rows,
            ),
            "invoices.csv": _csv_bytes(
                [
                    "id",
                    "invoice_number",
                    "branch_id",
                    "subtotal_paise",
                    "discount_paise",
                    "total_paise",
                    "payment_method",
                    "settled_at",
                ],
                invoice_rows,
            ),
            "refunds.csv": _csv_bytes(
                [
                    "id",
                    "refund_number",
                    "invoice_number",
                    "amount_paise",
                    "reason_code",
                    "refund_method",
                    "restock_action",
                    "created_at",
                ],
                refund_rows,
            ),
            "inventory_items.csv": _csv_bytes(
                [
                    "id",
                    "name",
                    "name_ta",
                    "item_type",
                    "base_unit",
                    "category",
                    "reorder_level",
                    "par_level",
                ],
                inv_item_rows,
            ),
            "stock_movements.csv": _csv_bytes(
                [
                    "sequence_number",
                    "branch_id",
                    "item_name",
                    "movement_type",
                    "quantity",
                    "unit_cost_paise",
                    "value_paise",
                    "reason_code",
                    "created_at",
                ],
                movement_rows,
            ),
            "customers.csv": _csv_bytes(
                [
                    "id",
                    "name",
                    "phone",
                    "email",
                    "dietary_preference",
                    "visit_count",
                    "total_spend_paise",
                ],
                customer_rows,
            ),
        }

        zip_buf = io.BytesIO()
        with zipfile.ZipFile(zip_buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            files_manifest: dict[str, dict[str, Any]] = {}
            for fname, raw_bytes in csv_files.items():
                zf.writestr(fname, raw_bytes)
                files_manifest[fname] = {
                    "sha256": hashlib.sha256(raw_bytes).hexdigest(),
                    "bytes": len(raw_bytes),
                }

            manifest = {
                "tenant_id": str(tenant.id),
                "tenant_slug": tenant.slug,
                "tenant_name": tenant.name,
                "exported_at": timezone.now().isoformat(),
                "counts": {
                    "branches": len(branches_rows),
                    "menu_items": len(menu_rows),
                    "orders": len(order_rows),
                    "invoices": len(invoice_rows),
                    "refunds": len(refund_rows),
                    "inventory_items": len(inv_item_rows),
                    "stock_movements": len(movement_rows),
                    "customers": len(customer_rows),
                },
                "files": files_manifest,
            }
            zf.writestr("manifest.json", json.dumps(manifest, indent=2).encode("utf-8"))

        log_audit_event(
            action="tenant.export_data",
            entity_type="Tenant",
            entity_id=str(tenant.id),
            actor=request.user,
            tenant=tenant,
            after_state={"counts": manifest["counts"]},
            request=request,
        )

        resp = HttpResponse(zip_buf.getvalue(), content_type="application/zip")
        resp["Content-Disposition"] = f'attachment; filename="servemyfood-export-{tenant.slug}.zip"'
        return resp


class OrderFeedbackViewSet(viewsets.ReadOnlyModelViewSet):
    """Stage D3: Owner & Branch Manager private feedback inbox, moderation, and CSV export."""

    serializer_class = OrderFeedbackSerializer
    permission_classes = [IsAuthenticated]

    def _require_owner_or_manager(self, request: Request) -> None:
        m = Membership.objects.filter(
            tenant=getattr(request, "tenant", None),
            user_id=request.user.pk,
            is_active=True,
        ).first()
        if not m or m.role not in ("OWNER", "BRANCH_MANAGER"):
            raise PermissionDenied("Only Owners and Branch Managers can access guest feedback.")

    def get_queryset(self):
        self._require_owner_or_manager(self.request)
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return OrderFeedback.objects.none()
        qs = OrderFeedback.objects.filter(tenant=tenant).select_related("order", "branch")
        min_rating = self.request.query_params.get("rating")
        if min_rating:
            qs = qs.filter(food_rating=int(min_rating))
        if self.request.query_params.get("unanswered") == "true":
            qs = qs.filter(is_resolved=False)
        return qs

    @action(detail=True, methods=["post"], url_path="moderate")
    def moderate(self, request: Request, pk: str | None = None) -> Response:
        self._require_owner_or_manager(request)
        fb = self.get_object()
        if "is_hidden" in request.data:
            fb.is_hidden = bool(request.data["is_hidden"])
        if "is_resolved" in request.data:
            fb.is_resolved = bool(request.data["is_resolved"])
        if "owner_note" in request.data:
            fb.owner_note = str(request.data["owner_note"] or "")[:500]
        fb.save()
        return Response(OrderFeedbackSerializer(fb).data)

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request: Request) -> Any:
        import csv
        import io

        from django.http import HttpResponse

        self._require_owner_or_manager(request)
        qs = self.get_queryset()

        def _safe(val: Any) -> str:
            s = str(val or "")
            return f"'{s}" if s[:1] in ("=", "+", "-", "@") else s

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "Order",
                "Branch",
                "Food Rating",
                "Service Rating",
                "Type",
                "Comment",
                "Resolved",
                "Created At",
            ]
        )
        for fb in qs:
            writer.writerow(
                [
                    _safe(fb.order.order_number),
                    _safe(fb.branch.name),
                    fb.food_rating,
                    fb.service_rating,
                    _safe(fb.suggestion_type),
                    _safe(fb.comment),
                    fb.is_resolved,
                    fb.created_at.isoformat(),
                ]
            )
        resp = HttpResponse(buf.getvalue(), content_type="text/csv")
        resp["Content-Disposition"] = 'attachment; filename="guest-feedback.csv"'
        return resp
