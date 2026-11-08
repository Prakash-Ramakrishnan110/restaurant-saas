from datetime import timedelta

from django.http import Http404
from django.utils import timezone
from django.utils.text import slugify
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

from apps.accounts.models import Membership
from apps.core.context import get_current_tenant
from apps.core.pagination import StandardResultsSetPagination
from apps.rbac.constants import Permission, Role
from apps.rbac.permissions import (
    HasTenantPermission,
    IsOwnerOrBranchManager,
    IsPlatformAdmin,
    verify_tenant_and_branch_access,
)
from apps.tenants.models import Branch, BusinessSettings, Tenant
from apps.tenants.serializers import (
    BranchCreateUpdateSerializer,
    BranchSerializer,
    BusinessLogoResponseSerializer,
    BusinessProfileSerializer,
    OnboardingStatusSerializer,
    PlatformCustomerCreateSerializer,
    TenantCreateSerializer,
    TenantDetailSerializer,
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
        return Response(TenantDetailSerializer(tenant).data)

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    @action(detail=True, methods=["post"], url_path="reset-owner-password")
    def reset_owner_password(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None
        reason = request.data.get("reason", "").strip() or "Operator initiated password reset"
        owners = reset_owner_passwords(tenant, actor=request.user, request=request)
        from apps.audit.models import AuditLog

        AuditLog.objects.create(
            tenant=tenant,
            actor=request.user,
            action="tenant.reset_password",
            entity_type="Tenant",
            entity_id=str(tenant.id),
            after_state={"owners_count": len(owners), "reason": reason},
        )
        temp_pwd = owners[0]["temporary_password"] if owners else ""
        owner_email = owners[0]["email"] if owners else ""
        return Response(
            {"owners": owners, "temporary_password": temp_pwd, "owner_email": owner_email}
        )

    @action(detail=True, methods=["post"])
    def suspend(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None

        reason = request.data.get("reason", "").strip() or "Administrative suspension"
        updated_tenant = suspend_tenant(tenant, actor=request.user, request=request)
        from apps.audit.models import AuditLog

        AuditLog.objects.create(
            tenant=tenant,
            actor=request.user,
            action="tenant.suspend",
            entity_type="Tenant",
            entity_id=str(tenant.id),
            after_state={"status": Tenant.Status.SUSPENDED, "reason": reason},
        )
        return Response(TenantSerializer(updated_tenant).data)

    @action(detail=True, methods=["post"])
    def activate(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None

        reason = request.data.get("reason", "").strip() or "Administrative reactivation"
        updated_tenant = activate_tenant(tenant, actor=request.user, request=request)
        from apps.audit.models import AuditLog

        AuditLog.objects.create(
            tenant=tenant,
            actor=request.user,
            action="tenant.reactivate",
            entity_type="Tenant",
            entity_id=str(tenant.id),
            after_state={"status": Tenant.Status.ACTIVE, "reason": reason},
        )
        return Response(TenantSerializer(updated_tenant).data)

    @action(detail=True, methods=["post"], url_path="extend-trial")
    def extend_trial(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None

        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response(
                {"reason": ["A reason is mandatory for extending trial."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            days = int(request.data.get("days", 14))
        except (ValueError, TypeError):
            days = 14

        from apps.subscriptions.models import Subscription, SubscriptionStatus

        sub = getattr(tenant, "subscription", None)
        if not sub:
            sub = Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.TRIAL)
        now = timezone.now()
        current_end = sub.ends_at if (sub.ends_at and sub.ends_at > now) else now
        sub.ends_at = current_end + timedelta(days=days)
        sub.status = SubscriptionStatus.TRIAL
        sub.save(update_fields=["ends_at", "status", "updated_at"])

        from apps.audit.models import AuditLog

        AuditLog.objects.create(
            tenant=tenant,
            actor=request.user,
            action="tenant.extend_trial",
            entity_type="Tenant",
            entity_id=str(tenant.id),
            after_state={"days": days, "new_ends_at": sub.ends_at.isoformat(), "reason": reason},
        )
        return Response(TenantDetailSerializer(tenant).data)

    @action(detail=True, methods=["post"], url_path="change-plan")
    def change_plan(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None

        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response(
                {"reason": ["A reason is mandatory for changing plan."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        plan_slug = request.data.get("plan_slug", "").strip().lower()
        if plan_slug not in ("starter", "professional", "business", "enterprise"):
            return Response(
                {"plan_slug": ["Must be starter, professional, business, or enterprise."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from apps.subscriptions.models import Plan, Subscription, SubscriptionStatus

        plan_defaults = {
            "starter": {
                "name": "Starter Plan",
                "price_paise": 149900,
                "entitlements": {"max_tables": 10, "max_branches": 1},
            },
            "professional": {
                "name": "Professional Plan",
                "price_paise": 499900,
                "entitlements": {"max_tables": 50, "max_branches": 5},
            },
            "business": {
                "name": "Business Plan",
                "price_paise": 999900,
                "entitlements": {"max_tables": 150, "max_branches": 15},
            },
            "enterprise": {
                "name": "Enterprise Plan",
                "price_paise": 2499900,
                "entitlements": {"max_tables": None, "max_branches": None},
            },
        }
        plan, _ = Plan.objects.get_or_create(slug=plan_slug, defaults=plan_defaults[plan_slug])
        sub = getattr(tenant, "subscription", None)
        if not sub:
            sub = Subscription.objects.create(
                tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE
            )
        else:
            sub.plan = plan
            sub.save(update_fields=["plan", "updated_at"])

        from apps.audit.models import AuditLog

        AuditLog.objects.create(
            tenant=tenant,
            actor=request.user,
            action="tenant.change_plan",
            entity_type="Tenant",
            entity_id=str(tenant.id),
            after_state={"plan_slug": plan_slug, "plan_name": plan.name, "reason": reason},
        )
        return Response(TenantDetailSerializer(tenant).data)

    @action(detail=True, methods=["post"], url_path="notes")
    def add_note(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Tenant not found.")
        try:
            tenant = Tenant.objects.get(pk=pk)
        except Tenant.DoesNotExist:
            raise Http404("Tenant not found.") from None

        note = request.data.get("note", "").strip()
        if not note:
            return Response(
                {"note": ["Note content cannot be empty."]}, status=status.HTTP_400_BAD_REQUEST
            )
        reason = request.data.get("reason", "Operator Note").strip()
        from apps.audit.models import AuditLog

        AuditLog.objects.create(
            tenant=tenant,
            actor=request.user,
            action="tenant.add_note",
            entity_type="Tenant",
            entity_id=str(tenant.id),
            after_state={"note": note, "reason": reason, "author": getattr(request.user, "email", "system")},
        )
        return Response({"message": "Note added successfully."}, status=status.HTTP_201_CREATED)


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


class PlatformCustomerCreateView(APIView):
    """POST /api/v1/platform/customers/

    Platform Admin New Customer provisioning wizard.
    Creates Tenant, starting branches, business settings, trial subscription,
    initial venue presets, and owner user with a single-use temporary password.
    """

    permission_classes = [IsPlatformAdmin]

    @extend_schema(
        request=PlatformCustomerCreateSerializer,
        responses={201: OpenApiTypes.OBJECT},
    )
    def post(self, request: Request) -> Response:
        import secrets

        from django.contrib.auth import get_user_model

        from apps.audit.models import AuditLog
        from apps.subscriptions.models import Plan, Subscription, SubscriptionStatus
        from apps.venues.models import (
            BranchCapabilities,
            DiningTable,
            Section,
            ServiceArea,
            TokenCounter,
        )

        User = get_user_model()

        serializer = PlatformCustomerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        name = vd["name"].strip()
        slug = slugify(name)
        base_slug = slug
        counter = 1
        while Tenant.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        business_type = vd["business_type"]
        city = vd.get("city", "").strip()
        language = vd.get("language", "en")
        owner_name = vd["owner_name"].strip()
        owner_phone = vd.get("owner_phone", "").strip()
        owner_email = vd["owner_email"].strip().lower()
        plan_slug = vd.get("plan_slug", "starter")
        trial_days = vd.get("trial_days", 14)
        outlets_count = vd.get("outlets_count", 1)
        outlet_names = vd.get("outlet_names", [])

        plan_defaults = {
            "starter": {
                "name": "Starter Plan",
                "price_paise": 149900,
                "entitlements": {"max_tables": 10, "max_branches": 1},
            },
            "professional": {
                "name": "Professional Plan",
                "price_paise": 499900,
                "entitlements": {"max_tables": 50, "max_branches": 5},
            },
            "business": {
                "name": "Business Plan",
                "price_paise": 999900,
                "entitlements": {"max_tables": 150, "max_branches": 15},
            },
            "enterprise": {
                "name": "Enterprise Plan",
                "price_paise": 2499900,
                "entitlements": {"max_tables": None, "max_branches": None},
            },
        }
        plan, _ = Plan.objects.get_or_create(
            slug=plan_slug, defaults=plan_defaults.get(plan_slug, plan_defaults["starter"])
        )

        # 1. Tenant
        tenant = Tenant.objects.create(
            name=name,
            slug=slug,
            business_type=business_type,
            status=Tenant.Status.ACTIVE,
            email=owner_email,
            phone=owner_phone,
            address=city,
            timezone="Asia/Kolkata",
            currency="INR",
        )

        # 2. Business Settings
        doc_lang = (
            BusinessSettings.DocumentLanguage.EN_TA
            if language == "ta"
            else BusinessSettings.DocumentLanguage.EN
        )
        BusinessSettings.objects.create(
            tenant=tenant,
            legal_name=name,
            registered_address=city,
            document_language=doc_lang,
            tax_mode=BusinessSettings.TaxMode.INCLUSIVE,
            invoice_prefix="INV-",
        )

        # 3. Branches
        if outlet_names and len(outlet_names) > 0:
            branch_names = [n.strip() for n in outlet_names if n.strip()]
        elif outlets_count <= 1:
            branch_names = [f"{name} Main"]
        else:
            branch_names = [f"{name} Outlet {i + 1}" for i in range(outlets_count)]

        venue_profile_map = {
            Tenant.BusinessType.TEA_SHOP: Branch.VenueProfile.QUICK_SERVICE,
            Tenant.BusinessType.BAKERY: Branch.VenueProfile.QUICK_SERVICE,
            Tenant.BusinessType.FOOD_COURT: Branch.VenueProfile.FOOD_COURT,
            Tenant.BusinessType.CAFE: Branch.VenueProfile.CAFE,
            Tenant.BusinessType.FINE_DINING: Branch.VenueProfile.FINE_DINING,
            Tenant.BusinessType.HOTEL: Branch.VenueProfile.HOTEL_RESTAURANT,
            Tenant.BusinessType.RESTAURANT: Branch.VenueProfile.CASUAL_DINING,
        }
        venue_prof = venue_profile_map.get(business_type, Branch.VenueProfile.CASUAL_DINING)

        created_branches = []
        for b_name in branch_names:
            br = Branch.objects.create(
                tenant=tenant,
                name=b_name,
                venue_profile=venue_prof,
                address=city,
                phone=owner_phone,
                is_active=True,
            )
            created_branches.append(br)

        first_branch = created_branches[0]
        # 4. Venue Layout Presets
        is_counter = business_type in (
            Tenant.BusinessType.TEA_SHOP,
            Tenant.BusinessType.BAKERY,
            Tenant.BusinessType.FOOD_COURT,
        )
        if is_counter:
            BranchCapabilities.objects.create(
                tenant=tenant,
                branch=first_branch,
                uses_tables=False,
                uses_token_numbers=True,
                allows_takeaway=True,
                payment_timing="PAY_FIRST",
            )
            area = ServiceArea.objects.create(
                tenant=tenant,
                branch=first_branch,
                name="Main Counter",
                area_type="COUNTER",
                sort_order=1,
            )
            TokenCounter.objects.create(
                tenant=tenant,
                branch=first_branch,
                service_area=area,
                service_date=timezone.now().date(),
                last_number=0,
            )
        elif business_type == Tenant.BusinessType.HOTEL:
            BranchCapabilities.objects.create(
                tenant=tenant,
                branch=first_branch,
                uses_tables=True,
                allows_room_service=True,
                allows_room_charge=True,
            )
            area1 = ServiceArea.objects.create(
                tenant=tenant,
                branch=first_branch,
                name="Ground Floor Dining",
                area_type="MAIN_DINING",
                sort_order=1,
            )
            sec1 = Section.objects.create(
                tenant=tenant,
                branch=first_branch,
                service_area=area1,
                name="Restaurant Hall",
                section_type="INDOOR",
                sort_order=1,
            )
            for t_no in range(1, 6):
                DiningTable.objects.create(
                    tenant=tenant,
                    branch=first_branch,
                    section=sec1,
                    label=f"T{t_no}",
                    capacity=4,
                )
            ServiceArea.objects.create(
                tenant=tenant,
                branch=first_branch,
                name="Room Service",
                area_type="ROOM_SERVICE",
                sort_order=2,
            )
        else:
            BranchCapabilities.objects.create(
                tenant=tenant,
                branch=first_branch,
                uses_tables=True,
            )
            area = ServiceArea.objects.create(
                tenant=tenant,
                branch=first_branch,
                name="Main Dining",
                area_type="MAIN_DINING",
                sort_order=1,
            )
            sec = Section.objects.create(
                tenant=tenant,
                branch=first_branch,
                service_area=area,
                name="Indoor Hall",
                section_type="INDOOR",
                sort_order=1,
            )
            for t_no in range(1, 6):
                DiningTable.objects.create(
                    tenant=tenant,
                    branch=first_branch,
                    section=sec,
                    label=f"T{t_no}",
                    capacity=4,
                )

        # 5. Trial Subscription
        now = timezone.now()
        Subscription.objects.create(
            tenant=tenant,
            plan=plan,
            status=SubscriptionStatus.TRIAL,
            starts_at=now,
            ends_at=now + timedelta(days=trial_days),
        )

        # 6. Single-use Owner Temporary Password
        chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%"
        temp_password = "".join(secrets.choice(chars) for _ in range(12))

        owner_user, _ = User.objects.get_or_create(
            email=owner_email,
            defaults={"full_name": owner_name, "is_active": True, "phone": owner_phone},
        )
        owner_user.set_password(temp_password)
        owner_user.must_change_password = True
        owner_user.save()

        membership, _ = Membership.objects.get_or_create(
            user=owner_user,
            tenant=tenant,
            defaults={"role": Role.OWNER, "is_active": True},
        )
        membership.branches.set(created_branches)

        # 7. Audit Log (Never log temporary password!)
        AuditLog.objects.create(
            tenant=tenant,
            actor=request.user,
            action="tenant.provision_customer",
            entity_type="Tenant",
            entity_id=str(tenant.id),
            after_state={
                "name": name,
                "business_type": business_type,
                "plan": plan.slug,
                "owner_email": owner_email,
                "trial_days": trial_days,
                "outlets_count": len(created_branches),
            },
        )

        welcome_note = (
            f"Welcome to ServeMyFood!\n\n"
            f"Your restaurant '{name}' is ready on the {plan.name}.\n"
            f"Login URL: http://localhost:5173/login\n"
            f"Email: {owner_email}\n"
            f"Temporary Password: {temp_password}\n\n"
            f"Please sign in and set your new password on first login."
        )

        return Response(
            {
                "tenant_id": str(tenant.id),
                "name": tenant.name,
                "owner_email": owner_email,
                "temporary_password": temp_password,
                "welcome_note": welcome_note,
            },
            status=status.HTTP_201_CREATED,
        )


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

        from apps.subscriptions.models import Subscription, SubscriptionStatus

        plan_counts: dict[str, int] = {}
        mrr_paise = 0
        for sub in Subscription.objects.select_related("plan").all():
            plan_name = sub.plan.name if sub.plan else "Unknown"
            plan_counts[plan_name] = plan_counts.get(plan_name, 0) + 1
            if sub.status == SubscriptionStatus.ACTIVE and sub.plan:
                mrr_paise += sub.plan.price_paise

        return Response(
            {
                "total_tenants": total_tenants,
                "active_tenants": active_tenants,
                "suspended_tenants": suspended_tenants,
                "new_this_week": new_this_week,
                "plan_distribution": plan_counts,
                "mrr_paise": mrr_paise,
                "api_health": "HEALTHY",
            }
        )
