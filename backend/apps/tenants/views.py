from django.http import Http404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.core.context import get_current_tenant
from apps.core.pagination import StandardResultsSetPagination
from apps.rbac.constants import Permission
from apps.rbac.permissions import (
    HasTenantPermission,
    IsPlatformAdmin,
    verify_tenant_and_branch_access,
)
from apps.tenants.models import Branch, Tenant
from apps.tenants.serializers import (
    BranchCreateUpdateSerializer,
    BranchSerializer,
    OnboardingStatusSerializer,
    TenantCreateSerializer,
    TenantSerializer,
)
from apps.tenants.services import (
    activate_tenant,
    create_branch,
    create_tenant_with_defaults,
    delete_branch,
    get_onboarding_status,
    suspend_tenant,
    update_branch,
)


class TenantViewSet(ViewSet):
    """Platform administrator endpoints to manage tenants and provisioning."""

    permission_classes = [IsPlatformAdmin]
    pagination_class = StandardResultsSetPagination

    def list(self, request: Request) -> Response:
        queryset = (
            Tenant.objects.all()
            .select_related("business_settings", "subscription")
            .order_by("-created_at")
        )
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = TenantSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def create(self, request: Request) -> Response:
        serializer = TenantCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        tenant, _, _ = create_tenant_with_defaults(
            name=serializer.validated_data["name"],
            slug=serializer.validated_data.get("slug"),
            business_type=serializer.validated_data.get(
                "business_type", Tenant.BusinessType.RESTAURANT
            ),
            email=serializer.validated_data.get("email", ""),
            phone=serializer.validated_data.get("phone", ""),
            address=serializer.validated_data.get("address", ""),
            timezone=serializer.validated_data.get("timezone", "Asia/Kolkata"),
            currency=serializer.validated_data.get("currency", "INR"),
            owner_email=serializer.validated_data["owner_email"],
            owner_full_name=serializer.validated_data["owner_full_name"],
            owner_password=serializer.validated_data.get("owner_password", ""),
            actor=request.user,
            request=request,
        )

        return Response(TenantSerializer(tenant).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.select_related("business_settings", "subscription").get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None
        return Response(TenantSerializer(tenant).data)

    @action(detail=True, methods=["post"])
    def suspend(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None

        updated_tenant = suspend_tenant(tenant, actor=request.user, request=request)
        return Response(TenantSerializer(updated_tenant).data)

    @action(detail=True, methods=["post"])
    def activate(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None

        updated_tenant = activate_tenant(tenant, actor=request.user, request=request)
        return Response(TenantSerializer(updated_tenant).data)


class BranchViewSet(ViewSet):
    """Branch management endpoints scoped to the active tenant."""

    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasTenantPermission(Permission.BRANCH_VIEW)()]
        return [HasTenantPermission(Permission.BRANCH_MANAGE)()]

    def list(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not tenant:
            return Response(
                {
                    "error": {
                        "code": "NO_TENANT_CONTEXT",
                        "message": "Active tenant context required.",
                        "details": {},
                    }
                },
                status=400,
            )

        queryset = Branch.objects.filter(tenant=tenant).order_by("name")

        # Branch scope restriction: Branch Manager only views assigned branches
        user_membership = getattr(request, "membership", None)
        if user_membership and user_membership.branches.exists():
            queryset = queryset.filter(id__in=user_membership.branches.values_list("id", flat=True))

        is_active = request.query_params.get("is_active")
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() in ("true", "1"))

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = BranchSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def create(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not tenant:
            return Response(
                {
                    "error": {
                        "code": "NO_TENANT_CONTEXT",
                        "message": "Active tenant context required.",
                        "details": {},
                    }
                },
                status=400,
            )

        serializer = BranchCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        branch = create_branch(
            tenant=tenant,
            name=serializer.validated_data["name"],
            address=serializer.validated_data.get("address", ""),
            phone=serializer.validated_data.get("phone", ""),
            venue_profile=serializer.validated_data.get("venue_profile") or None,
            operating_hours=serializer.validated_data.get("operating_hours", {}),
            actor=request.user,
            request=request,
        )

        return Response(BranchSerializer(branch).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Branch not found.")
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        try:
            # Query unscoped/direct to let object verification handle 404 security
            branch = Branch.unscoped.get(pk=pk)
        except Branch.DoesNotExist:
            raise Http404("Branch not found.") from None

        verify_tenant_and_branch_access(
            user=request.user,
            obj=branch,
            tenant=tenant,
            membership=getattr(request, "membership", None),
        )

        return Response(BranchSerializer(branch).data)

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Branch not found.")
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        try:
            branch = Branch.unscoped.get(pk=pk)
        except Branch.DoesNotExist:
            raise Http404("Branch not found.") from None

        verify_tenant_and_branch_access(
            user=request.user,
            obj=branch,
            tenant=tenant,
            membership=getattr(request, "membership", None),
        )

        serializer = BranchCreateUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        updated_branch = update_branch(
            branch=branch,
            actor=request.user,
            request=request,
            **serializer.validated_data,
        )

        return Response(BranchSerializer(updated_branch).data)

    def destroy(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Branch not found.")
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        try:
            branch = Branch.unscoped.get(pk=pk)
        except Branch.DoesNotExist:
            raise Http404("Branch not found.") from None

        verify_tenant_and_branch_access(
            user=request.user,
            obj=branch,
            tenant=tenant,
            membership=getattr(request, "membership", None),
        )

        delete_branch(branch, actor=request.user, request=request)
        return Response({"message": "Branch deactivated successfully."}, status=status.HTTP_200_OK)


class OnboardingStatusView(APIView):
    """Retrieve onboarding checklist and completion status for active tenant."""

    permission_classes = [HasTenantPermission(Permission.BRANCH_VIEW)]

    @extend_schema(
        responses={200: OnboardingStatusSerializer},
        summary="Get tenant onboarding status",
        description="Returns completion checklist for tenant onboarding wizard.",
    )
    def get(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not tenant:
            return Response(
                {
                    "error": {
                        "code": "NO_TENANT_CONTEXT",
                        "message": "Active tenant context required.",
                        "details": {},
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        status_data = get_onboarding_status(tenant)
        serializer = OnboardingStatusSerializer(status_data)
        return Response(serializer.data, status=status.HTTP_200_OK)
