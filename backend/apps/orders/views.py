from typing import Any

from django.db.models import Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Membership
from apps.orders.models import (
    BillInvoice,
    CourseType,
    Order,
    OrderStatus,
    OrderWorkflow,
    PaymentMethod,
    ServiceRequest,
    ServiceRequestStatus,
    ServiceRequestType,
)
from apps.orders.serializers import (
    BillInvoiceSerializer,
    CreateOrderSerializer,
    KDSTicketSerializer,
    OrderSerializer,
    ServiceRequestSerializer,
    SettleBillSerializer,
)
from apps.orders.services import (
    calculate_bill,
    create_order,
    get_today_report,
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

        order = create_order(
            branch=branch,
            items_data=data["items"],
            user_membership=membership,
            table_session=table_session,
            token_number=data.get("token_number"),
            order_workflow=data.get("order_workflow", OrderWorkflow.TABLE_SERVICE),
            notes=data.get("notes", ""),
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


class KDSViewSet(viewsets.ReadOnlyModelViewSet):
    """Kitchen Display System real-time ticket queue."""

    serializer_class = KDSTicketSerializer
    permission_classes = [IsAuthenticated]

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
    permission_classes = [IsAuthenticated]

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
            .order_by("-created_at")[:50]
        )
        serializer = BillInvoiceSerializer(qs, many=True)
        return Response(serializer.data)


class InvoiceViewSet(viewsets.ReadOnlyModelViewSet):
    """Authoritative Invoices directory and detail endpoint."""

    serializer_class = BillInvoiceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return BillInvoice.objects.none()

        qs = (
            BillInvoice.objects.filter(tenant=tenant)
            .select_related("table_session__table", "branch", "settled_by__user")
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
