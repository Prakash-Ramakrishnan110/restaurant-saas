from typing import Any

from django.conf import settings
from django.http import Http404
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.accounts.models import Membership, User
from apps.accounts.serializers import (
    AuthMeResponseSerializer,
    ChangePasswordSerializer,
    LoginRequestSerializer,
    LoginResponseSerializer,
    MembershipSummarySerializer,
    StaffCreateSerializer,
    StaffDetailSerializer,
    StaffUpdateSerializer,
    UserSerializer,
)
from apps.accounts.services import (
    authenticate_and_login_user,
    logout_user,
    refresh_user_tokens,
)
from apps.accounts.staff_service import (
    assert_target_in_actor_scope,
    create_staff_member,
    reset_staff_password,
    update_staff_member,
)
from apps.accounts.throttling import (
    ChangePasswordRateThrottle,
    LoginEmailRateThrottle,
    LoginIPRateThrottle,
)
from apps.core.context import get_current_tenant
from apps.core.pagination import StandardResultsSetPagination
from apps.rbac.constants import Permission
from apps.rbac.matrix import get_permissions_for_role
from apps.rbac.permissions import HasTenantPermission, verify_tenant_and_branch_access


class LoginView(APIView):
    """Authenticates credentials, sets rotating httpOnly refresh cookie, and returns access token."""

    permission_classes = [AllowAny]
    throttle_classes = [LoginIPRateThrottle, LoginEmailRateThrottle]

    @extend_schema(
        request=LoginRequestSerializer,
        responses={
            200: LoginResponseSerializer,
            400: OpenApiResponse(description="Validation error"),
            401: OpenApiResponse(description="Invalid credentials or account inactive"),
            429: OpenApiResponse(description="Rate limit exceeded"),
        },
    )
    def post(self, request: Request) -> Response:
        serializer = LoginRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, refresh = authenticate_and_login_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            request=request,
        )

        memberships = (
            user.memberships.filter(is_active=True)
            .select_related("tenant")
            .prefetch_related("branches")
        )
        active_tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not active_tenant and memberships.count() == 1:
            active_tenant = memberships.first().tenant

        response = Response(
            {
                "access": str(refresh.access_token),
                "user": UserSerializer(user).data,
                "active_tenant_id": active_tenant.id if active_tenant else None,
                "memberships": MembershipSummarySerializer(memberships, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

        # Set secure httpOnly cookie for refresh token
        response.set_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            value=str(refresh),
            max_age=int(settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path=settings.COOKIE_PATH,
        )
        return response


def validate_cookie_origin(request: Request) -> bool:
    """Verifies that Origin/Referer matches allowed origins on cookie-authenticated requests."""
    origin = request.headers.get("Origin") or request.META.get("HTTP_ORIGIN")
    if not origin:
        referer = request.headers.get("Referer") or request.META.get("HTTP_REFERER")
        if referer:
            from urllib.parse import urlparse

            parsed = urlparse(referer)
            origin = f"{parsed.scheme}://{parsed.netloc}"

    if not origin:
        return True

    allowed = set(getattr(settings, "CORS_ALLOWED_ORIGINS", []))
    allowed.update(getattr(settings, "CSRF_TRUSTED_ORIGINS", []))
    try:
        host = request.get_host()
        allowed.add(f"http://{host}")
        allowed.add(f"https://{host}")
    except Exception:
        pass

    return origin in allowed


class RefreshTokenView(APIView):
    """Refreshes access token and rotates the httpOnly refresh cookie."""

    permission_classes = [AllowAny]

    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(description="Token refreshed successfully"),
            401: OpenApiResponse(description="Invalid or expired refresh token"),
            403: OpenApiResponse(description="Invalid request origin"),
        },
    )
    def post(self, request: Request) -> Response:
        cookie_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if cookie_token and not validate_cookie_origin(request):
            return Response(
                {
                    "error": {
                        "code": "INVALID_ORIGIN",
                        "message": "Origin not allowed for cookie authentication.",
                        "details": {},
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh_token = cookie_token or request.data.get("refresh")
        if not refresh_token:
            return Response(
                {
                    "error": {
                        "code": "MISSING_TOKEN",
                        "message": "Refresh token is missing.",
                        "details": {},
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_access, new_refresh = refresh_user_tokens(refresh_token)

        response = Response({"access": new_access}, status=status.HTTP_200_OK)
        response.set_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            value=new_refresh,
            max_age=int(settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path=settings.COOKIE_PATH,
        )
        return response


class OptionalJWTAuthentication(JWTAuthentication):
    """Permissive JWT authenticator for logout where an expired access token must not block the request."""

    def authenticate(self, request: Any) -> tuple[Any, Any] | None:
        try:
            return super().authenticate(request)
        except Exception:
            return None


class OptionalJWTScheme(OpenApiAuthenticationExtension):
    target_class = "apps.accounts.views.OptionalJWTAuthentication"
    name = "optionalJwtAuth"

    def get_security_definition(self, auto_schema: Any) -> dict[str, Any]:
        return {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
        }


class LogoutView(APIView):
    """Blacklists refresh token, clears refresh cookie, and records audit trail."""

    authentication_classes = [OptionalJWTAuthentication]
    permission_classes = [AllowAny]

    @extend_schema(
        request=None,
        responses={204: OpenApiResponse(description="Logged out successfully")},
        summary="User logout",
        description="Blacklists refresh token, deletes refresh cookie, returns 204.",
    )
    def post(self, request: Request) -> Response:
        cookie_token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if cookie_token and not validate_cookie_origin(request):
            return Response(
                {
                    "error": {
                        "code": "INVALID_ORIGIN",
                        "message": "Origin not allowed for cookie authentication.",
                        "details": {},
                    }
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh_token = cookie_token or request.data.get("refresh")
        try:
            logout_user(refresh_token, user=request.user, request=request)
        except Exception:
            pass

        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.delete_cookie(
            settings.REFRESH_COOKIE_NAME,
            path=settings.COOKIE_PATH,
            samesite=settings.COOKIE_SAMESITE,
        )
        response.delete_cookie(
            settings.REFRESH_COOKIE_NAME,
            path="/",
            samesite=settings.COOKIE_SAMESITE,
        )
        return response


class AuthMeView(APIView):
    """Returns profile of the authenticated user, all memberships, and permissions for active tenant."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: AuthMeResponseSerializer})
    def get(self, request: Request) -> Response:
        user = request.user
        assert user.is_authenticated
        memberships = (
            user.memberships.filter(is_active=True)
            .select_related("tenant")
            .prefetch_related("branches")
        )

        active_tenant = getattr(request, "tenant", None) or get_current_tenant()
        active_role = None
        permissions: list[str] = []

        if getattr(user, "is_platform_admin", False):
            active_role = "PLATFORM_ADMIN"
            permissions = sorted(get_permissions_for_role(active_role))
        elif active_tenant:
            current_mem = memberships.filter(tenant=active_tenant).first()
            if current_mem:
                active_role = current_mem.role
                permissions = sorted(get_permissions_for_role(active_role))

        return Response(
            {
                "user": UserSerializer(user).data,
                "memberships": MembershipSummarySerializer(memberships, many=True).data,
                "active_tenant_id": active_tenant.id if active_tenant else None,
                "active_role": active_role,
                "permissions": permissions,
            }
        )


class ChangePasswordView(APIView):
    """Authenticated endpoint to change password, revoke prior sessions, and issue fresh access token."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ChangePasswordRateThrottle]

    @extend_schema(
        request=ChangePasswordSerializer,
        responses={200: OpenApiResponse(description="Password changed successfully")},
    )
    def post(self, request: Request) -> Response:
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        assert isinstance(user, User)
        new_password = serializer.validated_data["new_password"]
        user.set_password(new_password)
        user.must_change_password = False
        user.save()

        # Audit event
        from apps.audit.services import log_audit_event

        log_audit_event(
            action="auth.password_change",
            entity_type="User",
            entity_id=str(user.id),
            actor=user,
            request=request,
        )

        # Invalidate all outstanding tokens for this user
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )
        from rest_framework_simplejwt.tokens import RefreshToken

        for tok in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=tok)

        # Issue fresh token pair (access in JSON body, refresh in httpOnly cookie only)
        fresh_refresh = RefreshToken.for_user(user)
        fresh_access = str(fresh_refresh.access_token)

        response = Response(
            {
                "access": fresh_access,
                "message": "Password changed successfully.",
            },
            status=status.HTTP_200_OK,
        )
        response.set_cookie(
            key=settings.REFRESH_COOKIE_NAME,
            value=str(fresh_refresh),
            max_age=int(settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
            httponly=True,
            secure=settings.COOKIE_SECURE,
            samesite=settings.COOKIE_SAMESITE,
            path=settings.COOKIE_PATH,
        )
        return response


class StaffViewSet(ViewSet):
    """Staff management endpoints scoped to the active tenant."""

    serializer_class = StaffDetailSerializer
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return [HasTenantPermission(Permission.STAFF_VIEW)()]
        return [HasTenantPermission(Permission.STAFF_MANAGE)()]

    def list(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not tenant:
            return Response(
                {
                    "error": {
                        "code": "NO_TENANT_CONTEXT",
                        "message": "Tenant context required.",
                        "details": {},
                    }
                },
                status=400,
            )

        queryset = (
            Membership.objects.filter(tenant=tenant)
            .select_related("user")
            .prefetch_related("branches")
            .order_by("-created_at")
        )

        role = request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)

        is_active = request.query_params.get("is_active")
        if is_active is not None:
            if is_active.lower() == "true":
                queryset = queryset.filter(is_active=True)
            elif is_active.lower() == "false":
                queryset = queryset.filter(is_active=False)

        branch_id = request.query_params.get("branch") or request.query_params.get("branch_id")
        if branch_id:
            queryset = queryset.filter(branches__id=branch_id).distinct()

        # Branch Manager can only see staff assigned to overlapping branches
        user_membership = getattr(request, "membership", None)
        if user_membership and user_membership.branches.exists():
            branch_ids = user_membership.branches.values_list("id", flat=True)
            queryset = queryset.filter(branches__id__in=branch_ids).distinct()

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = StaffDetailSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def create(self, request: Request) -> Response:
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not tenant:
            return Response(
                {
                    "error": {
                        "code": "NO_TENANT_CONTEXT",
                        "message": "Tenant context required.",
                        "details": {},
                    }
                },
                status=400,
            )

        serializer = StaffCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_membership = getattr(request, "membership", None)
        caller_role = (
            "PLATFORM_ADMIN"
            if getattr(request.user, "is_platform_admin", False)
            else (user_membership.role if user_membership else "STAFF")
        )

        membership, temp_password = create_staff_member(
            tenant=tenant,
            actor=request.user,
            actor_role=caller_role,
            email=serializer.validated_data["email"],
            full_name=serializer.validated_data["full_name"],
            role=serializer.validated_data["role"],
            phone=serializer.validated_data.get("phone", ""),
            password=serializer.validated_data.get("password", ""),
            branch_ids=serializer.validated_data.get("branch_ids"),
            is_active=serializer.validated_data.get("is_active", True),
            request=request,
            actor_membership=user_membership,
        )

        response_data = StaffDetailSerializer(membership).data
        if temp_password:
            response_data["temporary_password"] = temp_password
        return Response(response_data, status=status.HTTP_201_CREATED)

    def retrieve(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Staff member not found.")
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        try:
            membership = (
                Membership.objects.select_related("user", "tenant")
                .prefetch_related("branches")
                .get(pk=pk, tenant=tenant)
            )
        except Membership.DoesNotExist:
            raise Http404("Staff member not found.") from None

        verify_tenant_and_branch_access(
            request.user, membership, tenant=tenant, membership=getattr(request, "membership", None)
        )
        assert_target_in_actor_scope(getattr(request, "membership", None), membership)
        return Response(StaffDetailSerializer(membership).data)

    def partial_update(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Staff member not found.")
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        try:
            membership = (
                Membership.objects.select_related("user", "tenant")
                .prefetch_related("branches")
                .get(pk=pk, tenant=tenant)
            )
        except Membership.DoesNotExist:
            raise Http404("Staff member not found.") from None

        verify_tenant_and_branch_access(
            request.user, membership, tenant=tenant, membership=getattr(request, "membership", None)
        )

        serializer = StaffUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        user_membership = getattr(request, "membership", None)
        caller_role = (
            "PLATFORM_ADMIN"
            if getattr(request.user, "is_platform_admin", False)
            else (user_membership.role if user_membership else "STAFF")
        )

        updated_membership = update_staff_member(
            membership=membership,
            actor=request.user,
            actor_role=caller_role,
            role=serializer.validated_data.get("role"),
            branch_ids=serializer.validated_data.get("branch_ids"),
            is_active=serializer.validated_data.get("is_active"),
            request=request,
            actor_membership=user_membership,
        )

        return Response(StaffDetailSerializer(updated_membership).data)

    @extend_schema(request=None, responses={200: OpenApiTypes.OBJECT})
    def reset_password(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Staff member not found.")
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        try:
            membership = Membership.objects.select_related("user", "tenant").get(
                pk=pk, tenant=tenant
            )
        except Membership.DoesNotExist:
            raise Http404("Staff member not found.") from None

        user_membership = getattr(request, "membership", None)
        caller_role = (
            "PLATFORM_ADMIN"
            if getattr(request.user, "is_platform_admin", False)
            else (user_membership.role if user_membership else "STAFF")
        )
        temp_password = reset_staff_password(
            membership=membership,
            actor=request.user,
            actor_role=caller_role,
            request=request,
            actor_membership=user_membership,
        )
        return Response({"id": str(membership.id), "temporary_password": temp_password})

    def destroy(self, request: Request, pk: str | None = None) -> Response:
        if not pk:
            raise Http404("Staff member not found.")
        tenant = getattr(request, "tenant", None) or get_current_tenant()
        try:
            membership = Membership.objects.select_related("user", "tenant").get(
                pk=pk, tenant=tenant
            )
        except Membership.DoesNotExist:
            raise Http404("Staff member not found.") from None

        verify_tenant_and_branch_access(
            request.user, membership, tenant=tenant, membership=getattr(request, "membership", None)
        )

        user_membership = getattr(request, "membership", None)
        caller_role = (
            "PLATFORM_ADMIN"
            if getattr(request.user, "is_platform_admin", False)
            else (user_membership.role if user_membership else "STAFF")
        )

        update_staff_member(
            membership=membership,
            actor=request.user,
            actor_role=caller_role,
            is_active=False,
            request=request,
            actor_membership=user_membership,
        )

        return Response(
            {"message": "Staff member deactivated successfully."}, status=status.HTTP_200_OK
        )
