from decimal import Decimal

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.context import get_current_tenant
from apps.inventory.constants import StockTransactionType
from apps.inventory.models import (
    Ingredient,
    PurchaseOrder,
    Recipe,
    StockTransaction,
    Supplier,
    WastageLog,
)
from apps.inventory.serializers import (
    IngredientSerializer,
    PurchaseOrderSerializer,
    RecipeSerializer,
    StockAdjustmentSerializer,
    StockTransactionSerializer,
    SupplierSerializer,
    WastageLogSerializer,
)
from apps.inventory.services import (
    get_inventory_variance_report,
    get_low_stock_alerts,
    receive_purchase_order,
    record_stock_transaction,
    record_wastage,
)
from apps.rbac.constants import Permission
from apps.rbac.permissions import ActionPermission, HasTenantPermission


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.INVENTORY_VIEW,
        "retrieve": Permission.INVENTORY_VIEW,
        "create": Permission.INVENTORY_MANAGE,
        "update": Permission.INVENTORY_MANAGE,
        "partial_update": Permission.INVENTORY_MANAGE,
        "destroy": Permission.INVENTORY_MANAGE,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        return Supplier.objects.filter(tenant=tenant)

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        serializer.save(tenant=tenant)


class IngredientViewSet(viewsets.ModelViewSet):
    serializer_class = IngredientSerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.INVENTORY_VIEW,
        "retrieve": Permission.INVENTORY_VIEW,
        "create": Permission.INVENTORY_MANAGE,
        "update": Permission.INVENTORY_MANAGE,
        "partial_update": Permission.INVENTORY_MANAGE,
        "destroy": Permission.INVENTORY_MANAGE,
        "adjust_stock": Permission.INVENTORY_MANAGE,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        qs = Ingredient.objects.filter(tenant=tenant)
        category = self.request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        return qs

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        serializer.save(tenant=tenant)

    @action(detail=True, methods=["post"], url_path="adjust-stock")
    def adjust_stock(self, request, pk=None):
        ingredient = self.get_object()
        serializer = StockAdjustmentSerializer(
            data={**request.data, "ingredient_id": str(ingredient.id)}
        )
        serializer.is_valid(raise_exception=True)

        new_stock = Decimal(str(serializer.validated_data["new_stock"]))
        notes = serializer.validated_data.get("notes", "Manual Stock Reconciliation")
        qty_change = new_stock - ingredient.current_stock

        record_stock_transaction(
            ingredient=ingredient,
            transaction_type=StockTransactionType.MANUAL_ADJUSTMENT,
            quantity_change=qty_change,
            notes=notes,
        )
        ingredient.refresh_from_db()
        return Response(IngredientSerializer(ingredient).data)


class RecipeViewSet(viewsets.ModelViewSet):
    serializer_class = RecipeSerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.INVENTORY_VIEW,
        "retrieve": Permission.INVENTORY_VIEW,
        "create": Permission.INVENTORY_MANAGE,
        "update": Permission.INVENTORY_MANAGE,
        "partial_update": Permission.INVENTORY_MANAGE,
        "destroy": Permission.INVENTORY_MANAGE,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        return Recipe.objects.filter(tenant=tenant).prefetch_related(
            "items__ingredient", "menu_item"
        )

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        serializer.save(tenant=tenant)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.INVENTORY_VIEW,
        "retrieve": Permission.INVENTORY_VIEW,
        "create": Permission.INVENTORY_MANAGE,
        "update": Permission.INVENTORY_MANAGE,
        "partial_update": Permission.INVENTORY_MANAGE,
        "destroy": Permission.INVENTORY_MANAGE,
        "receive": Permission.INVENTORY_MANAGE,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        return PurchaseOrder.objects.filter(tenant=tenant).prefetch_related(
            "items__ingredient", "supplier"
        )

    def perform_create(self, serializer):
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        serializer.save(tenant=tenant)

    @action(detail=True, methods=["post"], url_path="receive")
    def receive(self, request, pk=None):
        po = self.get_object()
        updated_po = receive_purchase_order(po)
        return Response(PurchaseOrderSerializer(updated_po).data)


class WastageLogViewSet(viewsets.ModelViewSet):
    serializer_class = WastageLogSerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.INVENTORY_VIEW,
        "retrieve": Permission.INVENTORY_VIEW,
        "create": Permission.INVENTORY_MANAGE,
        "update": Permission.INVENTORY_MANAGE,
        "partial_update": Permission.INVENTORY_MANAGE,
        "destroy": Permission.INVENTORY_MANAGE,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        return WastageLog.objects.filter(tenant=tenant).select_related("ingredient", "logged_by")

    def create(self, request, *args, **kwargs):
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        ingredient_id = request.data.get("ingredient")
        ingredient = get_object_or_404(Ingredient, id=ingredient_id, tenant=tenant)
        quantity = Decimal(str(request.data.get("quantity", 0)))
        reason = request.data.get("reason", "SPOILED")
        notes = request.data.get("notes", "")

        log = record_wastage(
            ingredient=ingredient,
            quantity=quantity,
            reason=reason,
            notes=notes,
            logged_by=request.user,
        )
        return Response(WastageLogSerializer(log).data, status=status.HTTP_201_CREATED)


class StockTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockTransactionSerializer
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.INVENTORY_VIEW)]

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        qs = StockTransaction.objects.filter(tenant=tenant).select_related("ingredient")
        ingredient_id = self.request.query_params.get("ingredient")
        if ingredient_id:
            qs = qs.filter(ingredient_id=ingredient_id)
        return qs


class LowStockAlertsView(APIView):
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.INVENTORY_VIEW)]

    @extend_schema(
        summary="Get low stock ingredient alerts",
        responses={200: serializers.ListSerializer(child=serializers.DictField())},
    )
    def get(self, request):
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not tenant:
            return Response(
                {"detail": "Active tenant context required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        alerts = get_low_stock_alerts(tenant)
        return Response(alerts)


class InventoryVarianceReportView(APIView):
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.INVENTORY_VIEW)]

    @extend_schema(
        summary="Get theoretical vs actual inventory variance and food cost report",
        responses={200: serializers.DictField()},
    )
    def get(self, request):
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not tenant:
            return Response(
                {"detail": "Active tenant context required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")
        report = get_inventory_variance_report(tenant, start_date=start_date, end_date=end_date)
        return Response(report)
