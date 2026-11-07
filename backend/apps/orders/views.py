from typing import Any

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

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
    CreateServiceRequestSerializer,
    KDSTicketSerializer,
    OrderSerializer,
    ServiceRequestSerializer,
    SettleBillSerializer,
)
from apps.orders.services import (
    calculate_bill,
    create_order,
    settle_bill,
)
from apps.rbac.constants import Permission
from apps.rbac.permissions import ActionPermission
from apps.tenants.models import Branch
from apps.venues.models import DiningTable, TableSession


class OrderViewSet(viewsets.ModelViewSet):
    """Production ViewSet for placing, tracking, and cancelling orders."""

    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.MENU_VIEW,
        "retrieve": Permission.MENU_VIEW,
        "create": Permission.ORDER_CREATE,
        "cancel": Permission.ORDER_CANCEL,
        "fire_mains": Permission.ORDER_CREATE,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return Order.objects.none()
        qs = (
            Order.objects.filter(tenant=tenant)
            .select_related("table_session__table", "branch")
            .prefetch_related("items")
        )

        branch_id = self.request.query_params.get("branch_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)

        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)

        session_id = self.request.query_params.get("session_id")
        if session_id:
            qs = qs.filter(table_session_id=session_id)

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
        order = self.get_object()
        if order.status in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
            raise ValidationError({"status": f"Cannot cancel order in status '{order.status}'."})
        order.status = OrderStatus.CANCELLED
        order.save(update_fields=["status"])
        return Response({"status": "CANCELLED", "order_id": str(order.id)})

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
        if order.status == OrderStatus.PLACED:
            order.status = OrderStatus.PREPARING
        elif order.status == OrderStatus.PREPARING:
            order.status = OrderStatus.READY
            order.ready_at = timezone.now()
        elif order.status == OrderStatus.READY:
            order.status = OrderStatus.SERVED
            order.served_at = timezone.now()
        else:
            raise ValidationError({"status": f"Order in status '{order.status}' cannot be bumped."})

        order.save()
        return Response({"order_id": str(order.id), "status": order.status})


class BillingViewSet(viewsets.ViewSet):
    """Cashier billing, split payment, and invoice generation."""

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
        serializer = CreateServiceRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        table = DiningTable.objects.filter(id=data["table_id"]).first()
        if not table:
            raise ValidationError({"table_id": "Table not found."})

        session = TableSession.objects.filter(table=table, status="OPEN").first()

        srv_req = ServiceRequest.objects.create(
            tenant=table.tenant,
            branch=table.branch,
            table=table,
            table_session=session,
            request_type=data.get("request_type", ServiceRequestType.CALL_WAITER),
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
