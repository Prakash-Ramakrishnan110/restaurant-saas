from datetime import timedelta

from django.http import Http404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from apps.core.context import get_current_tenant
from apps.core.pagination import StandardResultsSetPagination
from apps.rbac.constants import Permission
from apps.rbac.permissions import (
    HasTenantPermission,
    IsOwnerOrBranchManager,
    IsPlatformAdmin,
    verify_tenant_and_branch_access,
)
from apps.tenants.models import Branch, Tenant
from apps.tenants.serializers import (
    BranchCreateUpdateSerializer,
    BranchSerializer,
    BusinessLogoResponseSerializer,
    BusinessProfileSerializer,
    OnboardingStatusSerializer,
    TenantCreateSerializer,
    TenantSerializer,
)
from apps.tenants.services import (
    activate_tenant,
    create_branch,
    create_tenant_with_defaults,
    delete_branch,
    delete_business_logo,
    get_onboarding_status,
    reset_owner_passwords,
    suspend_tenant,
    update_branch,
    update_business_profile,
    upload_business_logo,
)


class TenantViewSet(ViewSet):
    """Platform administrator endpoints to manage tenants and provisioning."""

    serializer_class = TenantSerializer
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

        tenant, owner_user, _ = create_tenant_with_defaults(
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

        data = dict(TenantSerializer(tenant).data)
        temp_password = getattr(owner_user, "temporary_password", "")
        if temp_password:
            data["owner_temporary_password"] = temp_password
        return Response(data, status=status.HTTP_201_CREATED)

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.select_related("business_settings", "subscription").get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None
        return Response(TenantSerializer(tenant).data)

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=["post"], url_path="reset-owner-password")
    def reset_owner_password(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None
        owners = reset_owner_passwords(tenant, actor=request.user, request=request)
        return Response({"owners": owners})

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

    serializer_class = BranchSerializer
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

    permission_classes = [IsOwnerOrBranchManager]

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


class BusinessProfileView(APIView):
    """View and update business profile and business settings for active tenant."""

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [HasTenantPermission(Permission.BUSINESS_MANAGE)()]
        return [HasTenantPermission(Permission.BUSINESS_VIEW)()]

    @extend_schema(
        responses={200: BusinessProfileSerializer},
        summary="Get active business profile",
        description="Returns profile and settings for the active tenant context.",
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
        from apps.tenants.models import BusinessSettings

        BusinessSettings.unscoped.get_or_create(tenant=tenant)
        serializer = BusinessProfileSerializer(tenant)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        request=BusinessProfileSerializer,
        responses={200: BusinessProfileSerializer},
        summary="Update active business profile",
        description="Update profile and settings for the active tenant context. Audited.",
    )
    def patch(self, request: Request) -> Response:
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
        serializer = BusinessProfileSerializer(tenant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_tenant = update_business_profile(
            tenant=tenant,
            data=serializer.validated_data,
            actor=request.user,
            request=request,
        )
        return Response(BusinessProfileSerializer(updated_tenant).data, status=status.HTTP_200_OK)


class BusinessLogoView(APIView):
    """Upload or delete logo image for the active tenant."""

    serializer_class = BusinessLogoResponseSerializer
    permission_classes = [HasTenantPermission(Permission.BUSINESS_MANAGE)]

    @extend_schema(
        responses={200: BusinessLogoResponseSerializer},
        summary="Upload business logo",
        description="Upload PNG, JPEG, or WebP logo (max 2MB, max 4000x4000). Strips metadata, produces 512px and 128px versions. Audited.",
    )
    def post(self, request: Request) -> Response:
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
        file_obj = request.FILES.get("logo") or request.FILES.get("file")
        if not file_obj:
            return Response(
                {
                    "error": {
                        "code": "NO_FILE_PROVIDED",
                        "message": "No logo file was provided in multipart body.",
                        "details": {},
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = upload_business_logo(
            tenant=tenant,
            file_obj=file_obj,
            actor=request.user,
            request=request,
        )
        response = Response(result, status=status.HTTP_200_OK)
        response["X-Content-Type-Options"] = "nosniff"
        return response

    @extend_schema(
        responses={200: BusinessLogoResponseSerializer},
        summary="Delete business logo",
        description="Delete current business logo and clear logo URLs. Audited.",
    )
    def delete(self, request: Request) -> Response:
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
        delete_business_logo(tenant=tenant, actor=request.user, request=request)
        response = Response({"logo_url": "", "logo_128_url": ""}, status=status.HTTP_200_OK)
        response["X-Content-Type-Options"] = "nosniff"
        return response


class PlatformSummaryView(APIView):
    """GET /api/v1/platform/summary/ (PLATFORM_ADMIN only; aggregated counts only)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: serializers.DictField()})
    def get(self, request: Request) -> Response:
        if not getattr(request.user, "is_platform_admin", False):
            raise PermissionDenied("Only platform administrators can access platform summaries.")

        now = timezone.now()
        week_ago = now - timedelta(days=7)

        total_tenants = Tenant.objects.count()
        active_tenants = Tenant.objects.filter(status=Tenant.Status.ACTIVE).count()
        suspended_tenants = Tenant.objects.filter(status=Tenant.Status.SUSPENDED).count()
        new_this_week = Tenant.objects.filter(created_at__gte=week_ago).count()

        from apps.subscriptions.models import Subscription

        plan_counts: dict[str, int] = {}
        for sub in Subscription.objects.select_related("plan").all():
            plan_name = sub.plan.name if sub.plan else "Unknown"
            plan_counts[plan_name] = plan_counts.get(plan_name, 0) + 1

        return Response(
            {
                "total_tenants": total_tenants,
                "active_tenants": active_tenants,
                "suspended_tenants": suspended_tenants,
                "new_this_week": new_this_week,
                "plan_distribution": plan_counts,
                "api_health": "HEALTHY",
            }
        )
