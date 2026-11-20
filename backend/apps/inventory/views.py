from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Max, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncDate
from django.http import Http404, HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log_audit_event
from apps.core.context import get_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.inventory.constants import (
    DeductionStatus,
    InventoryMode,
    StockMovementType,
    WasteReason,
)
from apps.inventory.models import (
    GoodsReceipt,
    InventoryItem,
    OrderLineStockDeduction,
    PurchaseOrder,
    Recipe,
    RecipeLine,
    StockCount,
    StockLevel,
    StockLocation,
    StockMovement,
    Supplier,
)
from apps.inventory.serializers import (
    GoodsReceiptSerializer,
    InventoryItemSerializer,
    InventorySettingsSerializer,
    OrderLineStockDeductionSerializer,
    PurchaseOrderSerializer,
    RecipeSerializer,
    StockCountSerializer,
    StockLocationSerializer,
    StockMovementSerializer,
    SupplierSerializer,
    UnitConversionSerializer,
)
from apps.inventory.services import (
    apply_stock_paste,
    approve_stock_count,
    compute_branch_alerts,
    create_goods_receipt,
    create_stock_count,
    deduct_order_line,
    get_or_create_branch_settings,
    get_or_create_default_location,
    preview_stock_paste,
    quick_update_stock,
    record_wastage,
    render_csv_string,
    round_paise,
    submit_stock_count,
    validate_recipe_no_cycles,
)
from apps.menu.models import ItemVariant, MenuItem
from apps.rbac.constants import Permission
from apps.rbac.matrix import role_has_permission
from apps.rbac.permissions import HasTenantPermission, verify_tenant_and_branch_access
from apps.subscriptions.services import enforce_limit, get_entitlement
from apps.tenants.models import Branch


def _user_has_permission(request: Request, perm: str) -> bool:
    if getattr(request.user, "is_platform_admin", False):
        return False
    membership = getattr(request, "membership", None)
    if membership is None:
        return False
    return role_has_permission(membership.role, perm)


def _resolve_branch(request: Request, branch_id: str | None = None) -> Branch:
    tenant = getattr(request, "tenant", None) or get_current_tenant()
    if tenant is None:
        raise BusinessRuleError(
            "NO_TENANT_CONTEXT", "Active tenant context required.", status_code=400
        )

    raw_id = (
        branch_id
        or request.query_params.get("branch_id")
        or request.data.get("branch_id")
        or request.data.get("branch")
    )
    if raw_id:
        try:
            uuid.UUID(str(raw_id))
        except ValueError:
            raise BusinessRuleError(
                "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
            ) from None
        branch = Branch.objects.filter(pk=raw_id, tenant=tenant).first()
        if branch is None:
            raise BusinessRuleError(
                "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
            )
        verify_tenant_and_branch_access(
            request.user, branch, tenant=tenant, membership=getattr(request, "membership", None)
        )
        return branch

    # Fallback to user's assigned branch or first active branch
    membership = getattr(request, "membership", None)
    if membership is not None and membership.branches.exists():
        branch = membership.branches.filter(is_active=True).first()
        if branch is not None:
            return branch
    branch = Branch.objects.filter(tenant=tenant, is_active=True).order_by("created_at").first()
    if branch is None:
        raise BusinessRuleError(
            "NO_BRANCH", "No active branch found for this business.", status_code=400
        )
    return branch


def _resolve_item_in_body(tenant: Any, raw_id: Any) -> InventoryItem:
    try:
        uuid.UUID(str(raw_id))
    except (ValueError, TypeError):
        raise BusinessRuleError(
            "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
        ) from None
    item = InventoryItem.objects.filter(pk=raw_id, tenant=tenant).first()
    if item is None:
        raise BusinessRuleError(
            "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
        )
    return item


def _check_inventory_entitlement(tenant: Any) -> None:
    if not bool(get_entitlement(tenant, "inventory", True)):
        raise BusinessRuleError(
            "ENTITLEMENT_LIMIT_REACHED",
            "Inventory is not included in your current plan.",
            status_code=403,
        )


class CostAwareModelViewSet(viewsets.ModelViewSet):
    def get_serializer_context(self) -> dict[str, Any]:
        ctx = super().get_serializer_context()
        ctx["include_costs"] = _user_has_permission(self.request, Permission.INVENTORY_COSTS)
        return ctx


class CostAwareReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    def get_serializer_context(self) -> dict[str, Any]:
        ctx = super().get_serializer_context()
        ctx["include_costs"] = _user_has_permission(self.request, Permission.INVENTORY_COSTS)
        return ctx


class SupplierViewSet(CostAwareModelViewSet):
    serializer_class = SupplierSerializer

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_MANAGE)()]

    def get_queryset(self) -> Any:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if not tenant:
            return Supplier.objects.none()
        return Supplier.objects.filter(tenant=tenant)

    def perform_create(self, serializer: Any) -> None:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if tenant is None:
            raise BusinessRuleError(
                "NO_TENANT_CONTEXT", "Active tenant context required.", status_code=400
            )
        _check_inventory_entitlement(tenant)
        obj = serializer.save(tenant=tenant)
        log_audit_event(
            action="inventory.supplier.create",
            entity_type="Supplier",
            entity_id=str(obj.id),
            actor=self.request.user,
            tenant=tenant,
            after_state={"name": obj.name},
            request=self.request,
        )

    def perform_update(self, serializer: Any) -> None:
        before = {"name": serializer.instance.name, "is_active": serializer.instance.is_active}
        obj = serializer.save()
        log_audit_event(
            action="inventory.supplier.update",
            entity_type="Supplier",
            entity_id=str(obj.id),
            actor=self.request.user,
            tenant=obj.tenant,
            before_state=before,
            after_state={"name": obj.name, "is_active": obj.is_active},
            request=self.request,
        )


class StockLocationViewSet(viewsets.ModelViewSet):
    serializer_class = StockLocationSerializer

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_MANAGE)()]

    def get_queryset(self) -> Any:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if not tenant:
            return StockLocation.objects.none()
        qs = StockLocation.objects.filter(tenant=tenant).select_related("branch")
        branch_id = self.request.query_params.get("branch_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    def perform_create(self, serializer: Any) -> None:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        branch = _resolve_branch(self.request, str(serializer.validated_data["branch"].id))
        obj = serializer.save(tenant=tenant, branch=branch)
        log_audit_event(
            action="inventory.location.create",
            entity_type="StockLocation",
            entity_id=str(obj.id),
            actor=self.request.user,
            tenant=tenant,
            after_state={"name": obj.name, "location_type": obj.location_type},
            request=self.request,
        )


class InventoryItemViewSet(CostAwareModelViewSet):
    serializer_class = InventoryItemSerializer

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_VIEW)()]
        if self.action == "quick_update":
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_COUNT)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_MANAGE)()]

    def get_queryset(self) -> Any:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if not tenant:
            return InventoryItem.objects.none()

        branch_id = self.request.query_params.get("branch_id")
        level_filter = (
            Q(stock_levels__branch_id=branch_id) if branch_id else Q(stock_levels__tenant=tenant)
        )

        qs = (
            InventoryItem.objects.filter(tenant=tenant)
            .prefetch_related("unit_conversions")
            .annotate(
                annotated_quantity=Coalesce(
                    Sum("stock_levels__quantity", filter=level_filter),
                    Value(Decimal("0.000")),
                ),
                annotated_wac=Coalesce(
                    Max("stock_levels__weighted_avg_cost_paise", filter=level_filter),
                    Value(0),
                ),
            )
        )
        category = self.request.query_params.get("category")
        item_type = self.request.query_params.get("item_type")
        search = self.request.query_params.get("search")
        if category:
            qs = qs.filter(category=category)
        if item_type:
            qs = qs.filter(item_type=item_type)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(name_ta__icontains=search))
        return qs.order_by("name")

    def perform_create(self, serializer: Any) -> None:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if tenant is None:
            raise BusinessRuleError(
                "NO_TENANT_CONTEXT", "Active tenant context required.", status_code=400
            )
        _check_inventory_entitlement(tenant)
        current_count = InventoryItem.objects.filter(tenant=tenant, is_active=True).count()
        enforce_limit(tenant, "max_inventory_items", current_count)

        default_supplier = serializer.validated_data.get("default_supplier")
        if default_supplier is not None and default_supplier.tenant_id != tenant.id:
            raise BusinessRuleError(
                "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
            )

        obj = serializer.save(tenant=tenant)
        log_audit_event(
            action="inventory.item.create",
            entity_type="InventoryItem",
            entity_id=str(obj.id),
            actor=self.request.user,
            tenant=tenant,
            after_state={"name": obj.name, "base_unit": obj.base_unit, "item_type": obj.item_type},
            request=self.request,
        )

    def perform_update(self, serializer: Any) -> None:
        before = {
            "name": serializer.instance.name,
            "reorder_level": str(serializer.instance.reorder_level),
            "par_level": str(serializer.instance.par_level),
        }
        obj = serializer.save()
        log_audit_event(
            action="inventory.item.update",
            entity_type="InventoryItem",
            entity_id=str(obj.id),
            actor=self.request.user,
            tenant=obj.tenant,
            before_state=before,
            after_state={
                "name": obj.name,
                "reorder_level": str(obj.reorder_level),
                "par_level": str(obj.par_level),
            },
            request=self.request,
        )

    @action(detail=True, methods=["post"], url_path="quick-update")
    def quick_update(self, request: Request, pk: str | None = None) -> Response:
        item = self.get_object()
        branch = _resolve_branch(request)
        delta_raw = request.data.get("delta_quantity")
        if delta_raw is None:
            raise BusinessRuleError(
                "INVALID_QUANTITY", "delta_quantity is required.", status_code=400
            )
        mv = quick_update_stock(
            branch=branch,
            item=item,
            delta_quantity=Decimal(str(delta_raw)),
            unit_name=request.data.get("unit_name"),
            reason_code=str(request.data.get("reason_code") or ""),
            notes=str(request.data.get("notes") or ""),
            is_opening=bool(request.data.get("is_opening", False)),
            unit_cost_paise=request.data.get("unit_cost_paise"),
            actor=request.user,
            can_approve=_user_has_permission(request, Permission.INVENTORY_APPROVE),
            request=request,
        )
        ser = StockMovementSerializer(
            mv, context={"include_costs": _user_has_permission(request, Permission.INVENTORY_COSTS)}
        )
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="conversions")
    def add_conversion(self, request: Request, pk: str | None = None) -> Response:
        item = self.get_object()
        ser = UnitConversionSerializer(
            data={
                "item": str(item.id),
                "unit_name": request.data.get("unit_name", ""),
                "factor_to_base": request.data.get("factor_to_base"),
            }
        )
        ser.is_valid(raise_exception=True)
        conv = ser.save(tenant=item.tenant, item=item)
        return Response(UnitConversionSerializer(conv).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="paste-preview")
    def paste_preview(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if tenant is None:
            raise BusinessRuleError(
                "NO_TENANT_CONTEXT", "Active tenant context required.", status_code=400
            )
        raw_text = str(request.data.get("raw_text") or "")
        return Response(preview_stock_paste(tenant=tenant, raw_text=raw_text))

    @action(detail=False, methods=["post"], url_path="paste-apply")
    def paste_apply(self, request: Request) -> Response:
        branch = _resolve_branch(request)
        raw_text = str(request.data.get("raw_text") or "")
        result = apply_stock_paste(
            branch=branch,
            raw_text=raw_text,
            actor=request.user,
            request=request,
        )
        return Response(result, status=status.HTTP_201_CREATED)


class GoodsReceiptViewSet(CostAwareReadOnlyViewSet):
    serializer_class = GoodsReceiptSerializer

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_RECEIVE)()]

    def get_queryset(self) -> Any:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if not tenant:
            return GoodsReceipt.objects.none()
        qs = (
            GoodsReceipt.objects.filter(tenant=tenant)
            .select_related("supplier", "branch", "location")
            .prefetch_related("lines__item")
        )
        branch_id = self.request.query_params.get("branch_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    def create(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        _check_inventory_entitlement(tenant)
        branch = _resolve_branch(request)

        supplier = None
        if request.data.get("supplier"):
            try:
                uuid.UUID(str(request.data["supplier"]))
            except ValueError:
                raise BusinessRuleError(
                    "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
                ) from None
            supplier = Supplier.objects.filter(pk=request.data["supplier"], tenant=tenant).first()
            if supplier is None:
                raise BusinessRuleError(
                    "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
                )

        location = None
        if request.data.get("location"):
            location = StockLocation.objects.filter(
                pk=request.data["location"], branch=branch
            ).first()
            if location is None:
                raise BusinessRuleError(
                    "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
                )

        raw_lines = request.data.get("lines") or []
        parsed_lines: list[dict[str, Any]] = []
        for entry in raw_lines:
            item = _resolve_item_in_body(tenant, entry.get("item"))
            parsed_lines.append(
                {
                    "item": item,
                    "quantity": entry.get("quantity"),
                    "unit_name": entry.get("unit_name") or item.base_unit,
                    "unit_cost_paise": entry.get("unit_cost_paise", 0),
                    "line_total_paise": entry.get("line_total_paise"),
                    "batch_number": entry.get("batch_number", ""),
                    "expiry_date": entry.get("expiry_date") or None,
                }
            )

        receipt = create_goods_receipt(
            branch=branch,
            location=location,
            supplier=supplier,
            supplier_invoice_number=str(request.data.get("supplier_invoice_number") or ""),
            notes=str(request.data.get("notes") or ""),
            confirm_duplicate=bool(request.data.get("confirm_duplicate", False)),
            lines_data=parsed_lines,
            actor=request.user,
            request=request,
        )
        ser = self.get_serializer(receipt)
        return Response(ser.data, status=status.HTTP_201_CREATED)


class WastageViewSet(CostAwareReadOnlyViewSet):
    serializer_class = StockMovementSerializer

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_WASTE)()]

    def get_queryset(self) -> Any:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if not tenant:
            return StockMovement.objects.none()
        qs = StockMovement.objects.filter(
            tenant=tenant, movement_type=StockMovementType.WASTE
        ).select_related("item", "location", "actor")
        branch_id = self.request.query_params.get("branch_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    def create(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        _check_inventory_entitlement(tenant)
        branch = _resolve_branch(request)
        item = _resolve_item_in_body(tenant, request.data.get("item"))
        mv = record_wastage(
            branch=branch,
            item=item,
            quantity=Decimal(str(request.data.get("quantity", "0"))),
            unit_name=request.data.get("unit_name"),
            reason_code=str(request.data.get("reason_code") or WasteReason.SPOILED),
            notes=str(request.data.get("notes") or ""),
            actor=request.user,
            request=request,
        )
        return Response(self.get_serializer(mv).data, status=status.HTTP_201_CREATED)


class StockMovementViewSet(CostAwareReadOnlyViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.INVENTORY_VIEW)]

    def get_queryset(self) -> Any:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if not tenant:
            return StockMovement.objects.none()
        qs = StockMovement.objects.filter(tenant=tenant).select_related("item", "location", "actor")
        branch_id = self.request.query_params.get("branch_id")
        item_id = self.request.query_params.get("item_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        if item_id:
            qs = qs.filter(item__id=item_id)
        return qs


class StockCountViewSet(CostAwareReadOnlyViewSet):
    serializer_class = StockCountSerializer

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_VIEW)()]
        if self.action == "approve":
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_APPROVE)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_COUNT)()]

    def get_queryset(self) -> Any:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if not tenant:
            return StockCount.objects.none()
        qs = StockCount.objects.filter(tenant=tenant).prefetch_related("lines__item")
        branch_id = self.request.query_params.get("branch_id")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    def create(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        _check_inventory_entitlement(tenant)
        branch = _resolve_branch(request)
        sc = create_stock_count(
            branch=branch,
            count_type=str(request.data.get("count_type") or "FULL"),
            category_filter=str(request.data.get("category_filter") or ""),
            is_blind=bool(request.data.get("is_blind", False)),
            notes=str(request.data.get("notes") or ""),
            actor=request.user,
        )
        return Response(self.get_serializer(sc).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request: Request, pk: str | None = None) -> Response:
        sc = self.get_object()
        updated = submit_stock_count(
            stock_count=sc,
            counted_lines=request.data.get("lines") or [],
            actor=request.user,
            request=request,
        )
        return Response(self.get_serializer(updated).data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request: Request, pk: str | None = None) -> Response:
        sc = self.get_object()
        updated = approve_stock_count(stock_count=sc, actor=request.user, request=request)
        return Response(self.get_serializer(updated).data)


class RecipeViewSet(CostAwareModelViewSet):
    serializer_class = RecipeSerializer

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_MANAGE)()]

    def get_queryset(self) -> Any:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if not tenant:
            return Recipe.objects.none()
        qs = (
            Recipe.objects.filter(tenant=tenant)
            .select_related("menu_item", "variant", "output_item")
            .prefetch_related("lines__item")
        )
        menu_item_id = self.request.query_params.get("menu_item")
        if menu_item_id:
            qs = qs.filter(menu_item__id=menu_item_id)
        return qs

    @transaction.atomic
    def create(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if tenant is None:
            raise BusinessRuleError(
                "NO_TENANT_CONTEXT", "Active tenant context required.", status_code=400
            )
        _check_inventory_entitlement(tenant)

        menu_item = None
        variant = None
        output_item = None

        if request.data.get("menu_item"):
            try:
                uuid.UUID(str(request.data["menu_item"]))
            except ValueError:
                raise BusinessRuleError(
                    "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
                ) from None
            menu_item = MenuItem.objects.filter(pk=request.data["menu_item"], tenant=tenant).first()
            if menu_item is None:
                raise BusinessRuleError(
                    "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
                )
        if request.data.get("variant"):
            try:
                uuid.UUID(str(request.data["variant"]))
            except ValueError:
                raise BusinessRuleError(
                    "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
                ) from None
            variant = ItemVariant.objects.filter(
                pk=request.data["variant"], item__tenant=tenant
            ).first()
            if variant is None:
                raise BusinessRuleError(
                    "INVALID_REFERENCE", "Invalid reference identifier.", status_code=400
                )
        if request.data.get("output_item"):
            output_item = _resolve_item_in_body(tenant, request.data["output_item"])

        raw_lines = request.data.get("lines") or []
        resolved_lines: list[tuple[InventoryItem, Decimal, Decimal]] = []
        for entry in raw_lines:
            ing = _resolve_item_in_body(tenant, entry.get("item"))
            qty = Decimal(str(entry.get("quantity_per_portion", "0")))
            waste_pct = Decimal(str(entry.get("waste_percent", "0")))
            if qty <= Decimal("0"):
                raise BusinessRuleError(
                    "INVALID_QUANTITY",
                    "Recipe ingredient quantity must be positive.",
                    status_code=400,
                )
            resolved_lines.append((ing, qty, waste_pct))

        if output_item is not None:
            validate_recipe_no_cycles(
                tenant=tenant,
                output_item_id=output_item.id,
                ingredient_item_ids=[r[0].id for r in resolved_lines],
            )

        yield_portions = Decimal(str(request.data.get("yield_portions", "1")))
        recipe = Recipe.objects.create(
            tenant=tenant,
            menu_item=menu_item,
            variant=variant,
            output_item=output_item,
            yield_portions=yield_portions,
            preparation_instructions=str(request.data.get("preparation_instructions") or ""),
        )
        for ing, qty, waste_pct in resolved_lines:
            RecipeLine.objects.create(
                tenant=tenant,
                recipe=recipe,
                item=ing,
                quantity_per_portion=qty,
                waste_percent=waste_pct,
            )

        log_audit_event(
            action="inventory.recipe.create",
            entity_type="Recipe",
            entity_id=str(recipe.id),
            actor=request.user,
            tenant=tenant,
            after_state={"version": recipe.version, "line_count": len(resolved_lines)},
            request=request,
        )
        return Response(self.get_serializer(recipe).data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def partial_update(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        recipe = self.get_object()
        before = {"version": recipe.version, "yield_portions": str(recipe.yield_portions)}
        if "yield_portions" in request.data:
            recipe.yield_portions = Decimal(str(request.data["yield_portions"]))
        if "preparation_instructions" in request.data:
            recipe.preparation_instructions = str(request.data["preparation_instructions"])
        if "lines" in request.data:
            raw_lines = request.data["lines"] or []
            resolved_lines: list[tuple[InventoryItem, Decimal, Decimal]] = []
            for entry in raw_lines:
                ing = _resolve_item_in_body(recipe.tenant, entry.get("item"))
                qty = Decimal(str(entry.get("quantity_per_portion", "0")))
                waste_pct = Decimal(str(entry.get("waste_percent", "0")))
                resolved_lines.append((ing, qty, waste_pct))
            if recipe.output_item_id:
                validate_recipe_no_cycles(
                    tenant=recipe.tenant,
                    output_item_id=recipe.output_item_id,
                    ingredient_item_ids=[r[0].id for r in resolved_lines],
                )
            recipe.lines.all().delete()
            for ing, qty, waste_pct in resolved_lines:
                RecipeLine.objects.create(
                    tenant=recipe.tenant,
                    recipe=recipe,
                    item=ing,
                    quantity_per_portion=qty,
                    waste_percent=waste_pct,
                )
        recipe.version += 1
        recipe.save()
        log_audit_event(
            action="inventory.recipe.update",
            entity_type="Recipe",
            entity_id=str(recipe.id),
            actor=request.user,
            tenant=recipe.tenant,
            before_state=before,
            after_state={"version": recipe.version, "yield_portions": str(recipe.yield_portions)},
            request=request,
        )
        return Response(self.get_serializer(recipe).data)


class PurchaseOrderViewSet(CostAwareModelViewSet):
    serializer_class = PurchaseOrderSerializer

    def get_permissions(self) -> list[Any]:
        if self.action in ("list", "retrieve"):
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_MANAGE)()]

    def get_queryset(self) -> Any:
        tenant = getattr(self.request, "tenant", None) or get_current_tenant()
        if not tenant:
            return PurchaseOrder.objects.none()
        return (
            PurchaseOrder.objects.filter(tenant=tenant)
            .select_related("supplier")
            .prefetch_related("lines__item")
        )


class InventorySettingsView(APIView):
    def get_permissions(self) -> list[Any]:
        if self.request.method == "GET":
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_VIEW)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_MANAGE)()]

    def get(self, request: Request) -> Response:
        branch = _resolve_branch(request)
        settings_obj = get_or_create_branch_settings(branch)
        get_or_create_default_location(branch)
        ser = InventorySettingsSerializer(
            settings_obj,
            context={"include_costs": _user_has_permission(request, Permission.INVENTORY_COSTS)},
        )
        return Response(ser.data)

    def patch(self, request: Request) -> Response:
        branch = _resolve_branch(request)
        settings_obj = get_or_create_branch_settings(branch)
        before = {"mode": settings_obj.mode, "auto_sold_out": settings_obj.auto_sold_out}

        requested_mode = request.data.get("mode")
        if requested_mode == InventoryMode.ADVANCED and not bool(
            get_entitlement(branch.tenant, "inventory_advanced", False)
        ):
            raise BusinessRuleError(
                "ENTITLEMENT_LIMIT_REACHED",
                "Advanced inventory mode requires a higher subscription plan.",
                status_code=403,
            )

        ser = InventorySettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True,
            context={"include_costs": _user_has_permission(request, Permission.INVENTORY_COSTS)},
        )
        ser.is_valid(raise_exception=True)
        updated = ser.save()
        log_audit_event(
            action="inventory.settings.update",
            entity_type="InventorySettings",
            entity_id=str(updated.id),
            actor=request.user,
            tenant=branch.tenant,
            before_state=before,
            after_state={"mode": updated.mode, "auto_sold_out": updated.auto_sold_out},
            request=request,
        )
        return Response(ser.data)


class InventoryAlertsView(APIView):
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.INVENTORY_VIEW)]

    def get(self, request: Request) -> Response:
        branch = _resolve_branch(request)
        data = compute_branch_alerts(
            branch,
            include_costs=_user_has_permission(request, Permission.INVENTORY_COSTS),
        )
        return Response(data)


class StockHealthView(APIView):
    def get_permissions(self) -> list[Any]:
        if self.request.method == "POST":
            return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_APPROVE)()]
        return [IsAuthenticated(), HasTenantPermission(Permission.INVENTORY_VIEW)()]

    def get(self, request: Request) -> Response:
        branch = _resolve_branch(request)
        failed = OrderLineStockDeduction.objects.filter(
            branch=branch, status=DeductionStatus.FAILED
        ).select_related("order", "order_line")
        ser = OrderLineStockDeductionSerializer(failed, many=True)
        alerts = compute_branch_alerts(
            branch, include_costs=_user_has_permission(request, Permission.INVENTORY_COSTS)
        )
        return Response(
            {
                "failed_deductions": ser.data,
                "summary": alerts["summary"],
            }
        )

    def post(self, request: Request) -> Response:
        branch = _resolve_branch(request)
        deduction_id = request.data.get("deduction_id")
        if not deduction_id:
            raise Http404("Deduction record not found.")
        deduction = OrderLineStockDeduction.objects.filter(
            pk=str(deduction_id), branch=branch
        ).first()
        if deduction is None:
            raise Http404("Deduction record not found.")
        updated = deduct_order_line(deduction.order_line_id, actor=request.user)
        return Response(OrderLineStockDeductionSerializer(updated).data)


class InventoryReportsView(APIView):
    permission_classes = [IsAuthenticated, HasTenantPermission(Permission.INVENTORY_VIEW)]

    def get(self, request: Request, report_type: str) -> Response | HttpResponse:
        branch = _resolve_branch(request)
        include_costs = _user_has_permission(request, Permission.INVENTORY_COSTS)
        export_csv = (
            request.query_params.get("format") == "csv"
            or request.query_params.get("export") == "csv"
        )
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if report_type == "stock-on-hand":
            levels = (
                StockLevel.objects.filter(branch=branch)
                .select_related("item", "location")
                .order_by("item__name")
            )
            rows_data: list[dict[str, Any]] = []
            total_val = 0
            for lvl in levels:
                val = round_paise(lvl.quantity * Decimal(lvl.weighted_avg_cost_paise))
                total_val += val
                entry: dict[str, Any] = {
                    "item_id": str(lvl.item_id),
                    "item_name": lvl.item.name,
                    "location": lvl.location.name,
                    "quantity": str(lvl.quantity),
                    "base_unit": lvl.item.base_unit,
                }
                if include_costs:
                    entry["weighted_avg_cost_paise"] = lvl.weighted_avg_cost_paise
                    entry["stock_value_paise"] = val
                rows_data.append(entry)

            if export_csv:
                headers = ["Item", "Location", "Quantity", "Unit"]
                if include_costs:
                    headers.extend(["Unit Cost (Paise)", "Value (Paise)"])
                csv_rows = [
                    [r["item_name"], r["location"], r["quantity"], r["base_unit"]]
                    + (
                        [r["weighted_avg_cost_paise"], r["stock_value_paise"]]
                        if include_costs
                        else []
                    )
                    for r in rows_data
                ]
                resp = HttpResponse(render_csv_string(headers, csv_rows), content_type="text/csv")
                resp["Content-Disposition"] = 'attachment; filename="stock-on-hand.csv"'
                return resp

            payload: dict[str, Any] = {"rows": rows_data}
            if include_costs:
                payload["total_value_paise"] = total_val
            return Response(payload)

        if report_type == "movements":
            qs = StockMovement.objects.filter(branch=branch).select_related(
                "item", "location", "actor"
            )
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)
            item_id = request.query_params.get("item_id")
            if item_id:
                qs = qs.filter(item_id=item_id)
            ser = StockMovementSerializer(
                qs[:500], many=True, context={"include_costs": include_costs}
            )
            if export_csv:
                headers = ["Seq", "Date", "Item", "Type", "Quantity", "Unit", "Reason"]
                if include_costs:
                    headers.append("Value (Paise)")
                csv_rows = [
                    [
                        r["sequence_number"],
                        r["created_at"],
                        r["item_name"],
                        r["movement_type"],
                        r["quantity"],
                        r["base_unit"],
                        r["reason_code"],
                    ]
                    + ([r["value_paise"]] if include_costs else [])
                    for r in ser.data
                ]
                resp = HttpResponse(render_csv_string(headers, csv_rows), content_type="text/csv")
                resp["Content-Disposition"] = 'attachment; filename="stock-movements.csv"'
                return resp
            return Response({"rows": ser.data})

        if report_type == "low-stock":
            alerts = compute_branch_alerts(branch, include_costs=include_costs)
            if export_csv:
                headers = ["Item", "Quantity", "Unit", "Reorder Level", "Days Left"]
                csv_rows = [
                    [
                        r["name"],
                        r["quantity"],
                        r["base_unit"],
                        r["reorder_level"],
                        r["days_of_stock_left"] or "",
                    ]
                    for r in alerts["low_stock"]
                ]
                resp = HttpResponse(render_csv_string(headers, csv_rows), content_type="text/csv")
                resp["Content-Disposition"] = 'attachment; filename="low-stock.csv"'
                return resp
            return Response(alerts)

        if report_type == "wastage":
            qs = StockMovement.objects.filter(branch=branch, movement_type=StockMovementType.WASTE)
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)
            by_reason_rows: list[dict[str, Any]] = []
            for row in qs.values("reason_code").annotate(
                total_qty=Sum("quantity"),
                total_val=Sum("value_paise"),
            ):
                entry = {
                    "reason_code": row["reason_code"] or "OTHER",
                    "total_quantity": str(abs(row["total_qty"] or Decimal("0.000"))),
                }
                if include_costs:
                    entry["total_value_paise"] = abs(int(row["total_val"] or 0))
                by_reason_rows.append(entry)
            if export_csv:
                headers = ["Reason", "Quantity"] + (["Value (Paise)"] if include_costs else [])
                csv_rows = [
                    [r["reason_code"], r["total_quantity"]]
                    + ([r["total_value_paise"]] if include_costs else [])
                    for r in by_reason_rows
                ]
                resp = HttpResponse(render_csv_string(headers, csv_rows), content_type="text/csv")
                resp["Content-Disposition"] = 'attachment; filename="wastage-by-reason.csv"'
                return resp
            return Response({"by_reason": by_reason_rows})

        if report_type == "usage":
            qs = StockMovement.objects.filter(
                branch=branch,
                movement_type__in=[
                    StockMovementType.SALE_USAGE,
                    StockMovementType.PRODUCTION_USAGE,
                    StockMovementType.PACKAGING_USAGE,
                ],
            )
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)
            daily_rows: list[dict[str, Any]] = []
            for row in (
                qs.annotate(day=TruncDate("created_at"))
                .values("day", "item__name", "item__base_unit")
                .annotate(total_qty=Sum("quantity"), total_val=Sum("value_paise"))
                .order_by("-day", "item__name")
            ):
                entry = {
                    "date": row["day"].isoformat() if row["day"] else "",
                    "item_name": row["item__name"],
                    "base_unit": row["item__base_unit"],
                    "quantity_used": str(abs(row["total_qty"] or Decimal("0.000"))),
                }
                if include_costs:
                    entry["value_paise"] = abs(int(row["total_val"] or 0))
                daily_rows.append(entry)
            if export_csv:
                headers = ["Date", "Item", "Quantity Used", "Unit"] + (
                    ["Value (Paise)"] if include_costs else []
                )
                csv_rows = [
                    [r["date"], r["item_name"], r["quantity_used"], r["base_unit"]]
                    + ([r["value_paise"]] if include_costs else [])
                    for r in daily_rows
                ]
                resp = HttpResponse(render_csv_string(headers, csv_rows), content_type="text/csv")
                resp["Content-Disposition"] = 'attachment; filename="usage-by-day.csv"'
                return resp
            return Response({"rows": daily_rows})

        raise Http404("Unknown inventory report type.")
