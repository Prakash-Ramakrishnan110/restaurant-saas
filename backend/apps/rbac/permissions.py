from typing import Any

from django.http import Http404
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.core.context import get_current_tenant
from apps.rbac.constants import Permission, Role
from apps.rbac.matrix import role_has_permission
from apps.subscriptions.services import is_tenant_allowed


def verify_tenant_and_branch_access(
    user: Any,
    obj: Any,
    tenant: Any | None = None,
    membership: Any | None = None,
) -> bool:
    """Verify that an object belongs to the user's active tenant and permitted branch scope.

    CRITICAL SECURITY GUARANTEE:
    If the object belongs to another tenant or outside the branch scope,
    raises Http404 (NEVER 403) to prevent entity existence disclosure.
    """
    if getattr(user, "is_platform_admin", False):
        return True

    active_tenant = tenant or get_current_tenant()
    if active_tenant is None:
        raise Http404("Resource not found.")

    # 1. Tenant boundary check
    obj_tenant_id = getattr(obj, "tenant_id", None)
    if obj_tenant_id is not None and str(obj_tenant_id) != str(active_tenant.id):
        raise Http404("Resource not found.")

    # 2. Branch scope check
    if membership is None:
        membership = (
            user.memberships.filter(
                tenant=active_tenant,
                is_active=True,
            )
            .prefetch_related("branches")
            .first()
        )

    if not membership:
        raise Http404("Resource not found.")

    from apps.tenants.models import Branch

    # If membership has no branch restrictions, user has tenant-wide access
    allowed_branch_ids = {
        str(bid)
        for bid in Branch.unscoped.filter(memberships=membership).values_list("id", flat=True)
    }
    if not allowed_branch_ids:
        return True

    # If the object is a Branch itself
    if isinstance(obj, Branch) or obj.__class__.__name__ == "Branch":
        if str(obj.id) not in allowed_branch_ids:
            raise Http404("Resource not found.")
        return True

    # If the object has a branch foreign key
    obj_branch_id = getattr(obj, "branch_id", None)
    if obj_branch_id is not None and str(obj_branch_id) not in allowed_branch_ids:
        raise Http404("Resource not found.")

    return True


class BaseTenantPermission(BasePermission):
    """Base class for evaluating tenant permissions, subscription standing, and branch scopes."""

    required_permission: str | None = None

    def has_permission(self, request: Request, view: APIView) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False

        if getattr(user, "must_change_password", False):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                detail="You must change your temporary password before accessing this resource.",
                code="PASSWORD_CHANGE_REQUIRED",
            )

        # Platform Admin bypass for platform endpoints
        if getattr(user, "is_platform_admin", False):
            if self.required_permission in (
                Permission.PLATFORM_ADMIN,
                Permission.TENANT_MANAGE,
            ):
                return True

        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if tenant is None:
            return False

        # Verify tenant is active
        from apps.tenants.models import Tenant

        if tenant.status != Tenant.Status.ACTIVE:
            return False

        # Verify subscription standing
        if not is_tenant_allowed(tenant):
            return False

        # Verify active membership
        membership = getattr(request, "membership", None)
        if membership is None:
            membership = user.memberships.filter(
                tenant=tenant,
                is_active=True,
            ).first()
            request.membership = membership  # type: ignore[attr-defined]

        if not membership:
            return False

        if not self.required_permission:
            return True

        # Check role permission matrix
        return role_has_permission(membership.role, self.required_permission)

    def has_object_permission(self, request: Request, view: APIView, obj: Any) -> bool:
        # Raises Http404 on cross-tenant / unauthorized branch access
        return verify_tenant_and_branch_access(
            user=request.user,
            obj=obj,
            tenant=getattr(request, "tenant", None) or get_current_tenant(),
            membership=getattr(request, "membership", None),
        )


def HasTenantPermission(permission_code: str) -> type[BaseTenantPermission]:
    """Factory creating a DRF Permission class requiring a specific tenant permission code."""

    class DynamicTenantPermission(BaseTenantPermission):
        required_permission = permission_code

    DynamicTenantPermission.__name__ = f"HasTenantPermission_{permission_code.replace('.', '_')}"
    return DynamicTenantPermission


class ActionPermission(BaseTenantPermission):
    """Evaluates required_permissions dict on the view keyed by action name."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        action = getattr(view, "action", None)
        req_perms = getattr(view, "required_permissions", {})
        if action and action in req_perms:
            self.required_permission = req_perms[action]
        else:
            self.required_permission = getattr(view, "default_permission", None)
        return super().has_permission(request, view)


class IsPlatformAdmin(BasePermission):
    """Allows access only to platform administrators."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "is_platform_admin", False)
        )


class IsOwnerOrBranchManager(BaseTenantPermission):
    """Allows access only to active tenant members with OWNER or BRANCH_MANAGER roles."""

    def has_permission(self, request: Request, view: APIView) -> bool:
        if not super().has_permission(request, view):
            return False
        membership = getattr(request, "membership", None)
        return bool(membership and membership.role in (Role.OWNER, Role.BRANCH_MANAGER))
