import uuid
from collections.abc import Callable
from typing import Any, cast

from django.http import HttpRequest, HttpResponse
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.core.context import reset_current_tenant, set_current_tenant

PASSWORD_CHANGE_EXEMPT_PATHS = frozenset(
    {
        "/api/v1/auth/me",
        "/api/v1/auth/change-password",
        "/api/v1/auth/logout",
        "/api/v1/auth/refresh",
        "/health",
        "/api/schema",
    }
)
PASSWORD_CHANGE_EXEMPT_PREFIXES = ("/api/docs", "/static/")


def is_password_change_exempt(path: str) -> bool:
    """Routes a user with a temporary password may still call."""
    return path.rstrip("/") in PASSWORD_CHANGE_EXEMPT_PATHS or path.startswith(
        PASSWORD_CHANGE_EXEMPT_PREFIXES
    )


class TenantContextMiddleware:
    """Middleware to set and reset request-scoped tenant context.

    Authenticates JWT token early if present, extracts and validates the
    `X-Tenant-ID` header against the authenticated user's active memberships,
    and sets the request-scoped context variable. Never trusts the header alone.
    Guarantees fail-closed isolation and cleanup in finally block.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response
        self._jwt_auth = JWTAuthentication()

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # 1. Early JWT authentication if not already authenticated by session
        if not getattr(request.user, "is_authenticated", False):
            try:
                auth_res = self._jwt_auth.authenticate(cast(Any, request))
                if auth_res is not None:
                    user, jwt_token = auth_res
                    request.user = user  # type: ignore[assignment]
                    request.auth = jwt_token  # type: ignore[attr-defined]
            except Exception:
                # Invalid token will be handled by DRF permission/auth classes
                pass

        # 1b. Enforce must_change_password gate for authenticated users (single, global place)
        if (
            getattr(request.user, "is_authenticated", False)
            and getattr(request.user, "must_change_password", False)
            and not is_password_change_exempt(request.path)
        ):
            from django.http import JsonResponse

            return JsonResponse(
                {
                    "error": {
                        "code": "PASSWORD_CHANGE_REQUIRED",
                        "message": "You must change your temporary password before accessing this resource.",
                        "details": {},
                    }
                },
                status=403,
            )

        # 2. Resolve active tenant and enforce per-request subscription/status standing
        tenant = self._resolve_tenant(request)
        request.tenant = tenant  # type: ignore[attr-defined]

        if getattr(request, "tenant_is_suspended", False):
            if not request.path.startswith(("/api/v1/auth/logout", "/health")):
                from django.http import JsonResponse

                return JsonResponse(
                    {
                        "error": {
                            "code": "TENANT_SUSPENDED",
                            "message": "Tenant is suspended or subscription is inactive.",
                            "details": {},
                        }
                    },
                    status=403,
                )

        # 3. Set contextvar and ensure reset in finally
        ctx_token = set_current_tenant(tenant)
        try:
            return self.get_response(request)
        finally:
            reset_current_tenant(ctx_token)

    def _resolve_tenant(self, request: HttpRequest) -> Any | None:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None

        header_tenant_id = request.headers.get("X-Tenant-ID") or request.META.get(
            "HTTP_X_TENANT_ID"
        )

        # Validate UUID format if provided
        target_uuid: uuid.UUID | None = None
        if header_tenant_id:
            try:
                target_uuid = uuid.UUID(str(header_tenant_id).strip())
            except (ValueError, AttributeError):
                # Malformed header -> reject tenant resolution
                return None

        from apps.subscriptions.services import is_tenant_allowed
        from apps.tenants.models import Tenant

        # Platform Admin can access any active tenant if requested
        if getattr(user, "is_platform_admin", False):
            if target_uuid:
                return Tenant.objects.filter(id=target_uuid, status=Tenant.Status.ACTIVE).first()
            return None

        # Standard Tenant User: MUST validate against active memberships
        user_memberships = user.memberships.filter(is_active=True).select_related(
            "tenant", "tenant__subscription"
        )

        if target_uuid:
            # Check target tenant membership
            membership = user_memberships.filter(tenant_id=target_uuid).first()
            if membership:
                # Per-request enforcement: check if tenant is active & subscription allowed
                if membership.tenant.status != Tenant.Status.ACTIVE or not is_tenant_allowed(
                    membership.tenant
                ):
                    request.tenant_is_suspended = True  # type: ignore[attr-defined]
                    return None
                request.membership = membership  # type: ignore[attr-defined]
                return membership.tenant
            # Header provided does not belong to user -> Reject (Spoofing defense)
            return None

        # Header not provided: If user has exactly one active membership, auto-select it
        if user_memberships.count() == 1:
            membership = user_memberships.first()
            if membership:
                if membership.tenant.status != Tenant.Status.ACTIVE or not is_tenant_allowed(
                    membership.tenant
                ):
                    request.tenant_is_suspended = True  # type: ignore[attr-defined]
                    return None
                request.membership = membership  # type: ignore[attr-defined]
                return membership.tenant

        return None
