import json
import uuid
from typing import Any

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import log_audit_event
from apps.core.exceptions import BusinessRuleError
from apps.menu.models import (
    BranchItemAvailability,
    ItemOptionGroup,
    ItemVariant,
    MenuCategory,
    MenuItem,
    OptionGroup,
)
from apps.menu.serializers import (
    BranchItemAvailabilitySerializer,
    ItemVariantSerializer,
    MenuCategorySerializer,
    MenuItemSerializer,
    OptionGroupSerializer,
)
from apps.menu.services import (
    bulk_create_menu_items,
    delete_menu_image,
    process_and_store_menu_image,
    sync_item_base_price,
)
from apps.rbac.constants import Permission
from apps.rbac.permissions import ActionPermission
from apps.subscriptions.services import enforce_limit


class MenuCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = MenuCategorySerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.MENU_VIEW,
        "retrieve": Permission.MENU_VIEW,
        "create": Permission.MENU_MANAGE,
        "update": Permission.MENU_MANAGE,
        "partial_update": Permission.MENU_MANAGE,
        "destroy": Permission.MENU_MANAGE,
        "reorder": Permission.MENU_MANAGE,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return MenuCategory.objects.none()
        return MenuCategory.objects.filter(tenant=tenant).prefetch_related("items")

    def perform_create(self, serializer):
        tenant = self.request.tenant
        cat = serializer.save(tenant=tenant)
        log_audit_event(
            action="menu.category.create",
            entity_type="MenuCategory",
            entity_id=str(cat.id),
            actor=self.request.user,
            tenant=tenant,
            after_state={"name": cat.name},
        )

    def perform_update(self, serializer):
        tenant = self.request.tenant
        cat = serializer.save()
        log_audit_event(
            action="menu.category.update",
            entity_type="MenuCategory",
            entity_id=str(cat.id),
            actor=self.request.user,
            tenant=tenant,
            after_state={"name": cat.name, "is_active": cat.is_active},
        )

    def perform_destroy(self, instance):
        if instance.items.exists():
            raise BusinessRuleError(
                "CATEGORY_NOT_EMPTY",
                "Cannot delete a category containing menu items. Reassign or delete the items first.",
                status_code=400,
            )
        tenant = self.request.tenant
        cat_id = str(instance.id)
        cat_name = instance.name
        instance.delete()
        log_audit_event(
            action="menu.category.delete",
            entity_type="MenuCategory",
            entity_id=cat_id,
            actor=self.request.user,
            tenant=tenant,
            before_state={"name": cat_name},
        )

    @action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        tenant = request.tenant
        orders = request.data.get("orders", [])  # list of {id: uuid, sort_order: int}
        if isinstance(orders, str):
            try:
                orders = json.loads(orders)
            except Exception:
                orders = []
        for item in orders:
            if isinstance(item, dict) and item.get("id"):
                MenuCategory.objects.filter(tenant=tenant, id=str(item["id"])).update(
                    sort_order=int(item.get("sort_order", 0))
                )
        return Response({"status": "success", "message": "Categories reordered successfully."})


class MenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.MENU_VIEW,
        "retrieve": Permission.MENU_VIEW,
        "create": Permission.MENU_MANAGE,
        "update": Permission.MENU_MANAGE,
        "partial_update": Permission.MENU_MANAGE,
        "destroy": Permission.MENU_MANAGE,
        "variants": Permission.MENU_MANAGE,
        "option_groups": Permission.MENU_MANAGE,
        "reorder": Permission.MENU_MANAGE,
        "bulk_create": Permission.MENU_MANAGE,
        "upload_image": Permission.MENU_MANAGE,
        "delete_image": Permission.MENU_MANAGE,
        "image": Permission.MENU_MANAGE,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return MenuItem.objects.none()

        qs = (
            MenuItem.objects.filter(tenant=tenant)
            .select_related("category")
            .prefetch_related(
                "variants", "item_option_groups__group__options", "branch_availabilities"
            )
        )

        category_id = self.request.query_params.get("category")
        if category_id:
            try:
                qs = qs.filter(category_id=uuid.UUID(category_id))
            except (ValueError, TypeError):
                pass

        food_type = self.request.query_params.get("food_type")
        if food_type:
            qs = qs.filter(food_type=food_type)

        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("true", "1"))

        is_bestseller = self.request.query_params.get("is_bestseller")
        if is_bestseller is not None:
            qs = qs.filter(is_bestseller=is_bestseller.lower() in ("true", "1"))

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(name__icontains=search)

        return qs

    def get_serializer_context(self):
        context = super().get_serializer_context()
        branch_id = self.request.query_params.get("branch")
        if branch_id:
            context["branch_id"] = branch_id
        return context

    def perform_create(self, serializer):
        tenant = self.request.tenant
        current_count = MenuItem.objects.filter(tenant=tenant).count()
        enforce_limit(tenant, "max_menu_items", current_count)

        item = serializer.save(tenant=tenant)
        log_audit_event(
            action="menu.item.create",
            entity_type="MenuItem",
            entity_id=str(item.id),
            actor=self.request.user,
            tenant=tenant,
            after_state={
                "name": item.name,
                "base_price_paise": item.base_price_paise,
                "category": item.category.name,
            },
        )

    def perform_update(self, serializer):
        tenant = self.request.tenant
        old_item = self.get_object()
        old_price = old_item.base_price_paise

        item = serializer.save()
        details: dict[str, Any] = {"name": item.name, "is_active": item.is_active}
        if old_price != item.base_price_paise:
            details["old_price_paise"] = old_price
            details["new_price_paise"] = item.base_price_paise

        log_audit_event(
            action="menu.item.update",
            entity_type="MenuItem",
            entity_id=str(item.id),
            actor=self.request.user,
            tenant=tenant,
            after_state=details,
        )

    def perform_destroy(self, instance):
        tenant = self.request.tenant
        item_id = str(instance.id)
        item_name = instance.name
        delete_menu_image(instance, user=self.request.user)
        instance.delete()
        log_audit_event(
            action="menu.item.delete",
            entity_type="MenuItem",
            entity_id=item_id,
            actor=self.request.user,
            tenant=tenant,
            before_state={"name": item_name},
        )

    @action(detail=True, methods=["put"], url_path="variants")
    def variants(self, request, pk=None):
        item = self.get_object()
        variants_data = request.data.get("variants", [])
        if isinstance(variants_data, str):
            try:
                variants_data = json.loads(variants_data)
            except Exception:
                variants_data = []

        # Validate exactly one default if list is non-empty
        default_count = sum(
            1 for v in variants_data if isinstance(v, dict) and v.get("is_default", False)
        )
        if variants_data and default_count > 1:
            raise BusinessRuleError(
                "MULTIPLE_DEFAULT_VARIANTS",
                "Only one variant can be marked as default.",
                status_code=400,
            )

        # Replace variants
        item.variants.all().delete()
        created_variants = []
        for idx, v in enumerate(variants_data):
            if not isinstance(v, dict):
                continue
            var = ItemVariant.objects.create(
                item=item,
                name=v.get("name", "").strip(),
                name_ta=v.get("name_ta", "").strip(),
                price_paise=v.get("price_paise", 0),
                is_default=bool(v.get("is_default", False) or (idx == 0 and default_count == 0)),
                sort_order=v.get("sort_order", idx),
            )
            created_variants.append(var)

        # Synchronize base price
        sync_item_base_price(item)

        log_audit_event(
            action="menu.item.variants_update",
            entity_type="MenuItem",
            entity_id=str(item.id),
            actor=request.user,
            tenant=request.tenant,
            after_state={"variant_count": len(created_variants)},
        )

        return Response(ItemVariantSerializer(created_variants, many=True).data)

    @action(detail=True, methods=["put"], url_path="option-groups")
    def option_groups(self, request, pk=None):
        item = self.get_object()
        group_ids = request.data.get("group_ids", [])  # list of UUIDs
        if isinstance(group_ids, str):
            try:
                group_ids = json.loads(group_ids)
            except Exception:
                group_ids = []

        # Validate all groups belong to tenant
        groups = OptionGroup.objects.filter(tenant=request.tenant, id__in=group_ids)
        if len(groups) != len(group_ids):
            raise BusinessRuleError(
                "INVALID_OPTION_GROUPS",
                "One or more option groups do not exist or belong to another venue.",
                status_code=400,
            )

        item.item_option_groups.all().delete()
        for idx, grp in enumerate(groups):
            ItemOptionGroup.objects.create(item=item, group=grp, sort_order=idx)

        log_audit_event(
            action="menu.item.option_groups_update",
            entity_type="MenuItem",
            entity_id=str(item.id),
            actor=request.user,
            tenant=request.tenant,
            after_state={"group_count": len(groups)},
        )

        return Response({"status": "success", "message": "Option groups updated."})

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        items_data = request.data.get("items", [])
        if isinstance(items_data, str):
            try:
                items_data = json.loads(items_data)
            except Exception:
                items_data = []
        if not items_data:
            raise BusinessRuleError(
                "EMPTY_PAYLOAD", "No items provided for bulk creation.", status_code=400
            )

        created = bulk_create_menu_items(
            tenant=request.tenant,
            items_data=items_data,
            user=request.user,
        )
        return Response(
            {
                "status": "success",
                "created_count": len(created),
                "items": MenuItemSerializer(created, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["post", "delete"],
        url_path="image",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def image(self, request, pk=None):
        item = self.get_object()
        if request.method.lower() == "delete":
            delete_menu_image(item, user=request.user)
            return Response({"status": "success", "message": "Image removed."})

        file_obj = request.FILES.get("image")
        if not file_obj:
            raise BusinessRuleError(
                "NO_FILE_PROVIDED",
                "Please provide an image file in the 'image' field.",
                status_code=400,
            )

        focus_x = float(request.data.get("focus_x", 0.5))
        focus_y = float(request.data.get("focus_y", 0.5))

        res = process_and_store_menu_image(
            tenant=request.tenant,
            item=item,
            file_obj=file_obj,
            focus_x=focus_x,
            focus_y=focus_y,
            user=request.user,
        )
        return Response(res, status=status.HTTP_200_OK)


class OptionGroupViewSet(viewsets.ModelViewSet):
    serializer_class = OptionGroupSerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.MENU_VIEW,
        "retrieve": Permission.MENU_VIEW,
        "create": Permission.MENU_MANAGE,
        "update": Permission.MENU_MANAGE,
        "partial_update": Permission.MENU_MANAGE,
        "destroy": Permission.MENU_MANAGE,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return OptionGroup.objects.none()
        return OptionGroup.objects.filter(tenant=tenant).prefetch_related("options")

    def perform_create(self, serializer):
        tenant = self.request.tenant
        group = serializer.save(tenant=tenant)
        log_audit_event(
            action="menu.option_group.create",
            entity_type="OptionGroup",
            entity_id=str(group.id),
            actor=self.request.user,
            tenant=tenant,
            after_state={"name": group.name},
        )

    def perform_destroy(self, instance):
        tenant = self.request.tenant
        grp_id = str(instance.id)
        instance.delete()
        log_audit_event(
            action="menu.option_group.delete",
            entity_type="OptionGroup",
            entity_id=grp_id,
            actor=self.request.user,
            tenant=tenant,
        )


class BranchItemAvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = BranchItemAvailabilitySerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "list": Permission.MENU_VIEW,
        "retrieve": Permission.MENU_VIEW,
        "create": Permission.MENU_AVAILABILITY,
        "update": Permission.MENU_AVAILABILITY,
        "partial_update": Permission.MENU_AVAILABILITY,
        "destroy": Permission.MENU_AVAILABILITY,
        "toggle": Permission.MENU_AVAILABILITY,
        "bulk_toggle": Permission.MENU_AVAILABILITY,
    }

    def get_queryset(self):
        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            return BranchItemAvailability.objects.none()
        qs = BranchItemAvailability.objects.filter(tenant=tenant).select_related(
            "branch", "item", "item__category"
        )
        branch_id = self.request.query_params.get("branch")
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return qs

    @action(detail=False, methods=["post"], url_path="toggle")
    def toggle(self, request):
        tenant = request.tenant
        branch_id = request.data.get("branch")
        item_id = request.data.get("item")
        is_available = request.data.get("is_available", True)

        if not branch_id or not item_id:
            raise BusinessRuleError(
                "INVALID_PAYLOAD", "Branch and Item IDs are required.", status_code=400
            )

        record, created = BranchItemAvailability.objects.update_or_create(
            tenant=tenant,
            branch_id=branch_id,
            item_id=item_id,
            defaults={
                "is_available": is_available,
                "updated_by": request.user,
            },
        )

        log_audit_event(
            action="menu.availability.toggle",
            entity_type="MenuItem",
            entity_id=str(item_id),
            actor=request.user,
            tenant=tenant,
            after_state={"branch_id": str(branch_id), "is_available": is_available},
        )

        return Response(BranchItemAvailabilitySerializer(record).data)

    @action(detail=False, methods=["post"], url_path="bulk-toggle")
    def bulk_toggle(self, request):
        tenant = request.tenant
        branch_id = request.data.get("branch")
        item_ids = request.data.get("item_ids", [])
        is_available = request.data.get("is_available", True)

        if not branch_id or not item_ids:
            raise BusinessRuleError(
                "INVALID_PAYLOAD", "Branch and item_ids are required.", status_code=400
            )

        for item_id in item_ids:
            BranchItemAvailability.objects.update_or_create(
                tenant=tenant,
                branch_id=branch_id,
                item_id=item_id,
                defaults={"is_available": is_available, "updated_by": request.user},
            )

        log_audit_event(
            action="menu.availability.bulk_toggle",
            entity_type="Branch",
            entity_id=str(branch_id),
            actor=request.user,
            tenant=tenant,
            after_state={"item_count": len(item_ids), "is_available": is_available},
        )

        return Response(
            {"status": "success", "updated_count": len(item_ids), "is_available": is_available}
        )


class FullMenuView(APIView):
    """Constant query-count read-only active menu endpoint for customer QR and staff ordering."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: serializers.DictField()})
    def get(self, request):
        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"categories": []})

        branch_id = request.query_params.get("branch")

        # 1. Fetch categories
        categories = list(
            MenuCategory.objects.filter(tenant=tenant, is_active=True).order_by(
                "sort_order", "name"
            )
        )
        cat_ids = [c.id for c in categories]

        # 2. Fetch items with variants & option groups in constant queries
        items = list(
            MenuItem.objects.filter(tenant=tenant, category_id__in=cat_ids, is_active=True)
            .select_related("category")
            .prefetch_related(
                "variants",
                "item_option_groups__group__options",
                "branch_availabilities",
            )
            .order_by("sort_order", "name")
        )

        # Build items by category mapping
        items_by_cat: dict[Any, list[dict]] = {c.id: [] for c in categories}
        for it in items:
            is_avail = True
            if branch_id:
                avail_rec = next(
                    (
                        b
                        for b in it.branch_availabilities.all()
                        if str(b.branch_id) == str(branch_id)
                    ),
                    None,
                )
                if avail_rec:
                    is_avail = avail_rec.is_available

            items_by_cat[it.category_id].append(
                {
                    "id": str(it.id),
                    "name": it.name,
                    "name_ta": it.name_ta,
                    "description": it.description,
                    "description_ta": it.description_ta,
                    "base_price_paise": it.base_price_paise,
                    "food_type": it.food_type,
                    "prep_minutes": it.prep_minutes,
                    "is_bestseller": it.is_bestseller,
                    "image_card": it.image_card,
                    "image_thumb": it.image_thumb,
                    "is_available": is_avail,
                    "variants": [
                        {
                            "id": str(v.id),
                            "name": v.name,
                            "name_ta": v.name_ta,
                            "price_paise": v.price_paise,
                            "is_default": v.is_default,
                        }
                        for v in it.variants.all()
                    ],
                    "option_groups": [
                        {
                            "id": str(link.group.id),
                            "name": link.group.name,
                            "name_ta": link.group.name_ta,
                            "min_select": link.group.min_select,
                            "max_select": link.group.max_select,
                            "options": [
                                {
                                    "id": str(o.id),
                                    "name": o.name,
                                    "name_ta": o.name_ta,
                                    "price_delta_paise": o.price_delta_paise,
                                    "is_default": o.is_default,
                                }
                                for o in link.group.options.filter(is_active=True)
                            ],
                        }
                        for link in it.item_option_groups.all()
                        if link.group.is_active
                    ],
                }
            )

        data = [
            {
                "id": str(c.id),
                "name": c.name,
                "name_ta": c.name_ta,
                "items": items_by_cat.get(c.id, []),
            }
            for c in categories
        ]

        return Response({"categories": data})
