from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.core.context import get_current_tenant
from apps.rbac.constants import Permission, Role
from apps.rbac.matrix import role_has_permission


class AuditLogListView(generics.ListAPIView):
    """List audit log records for the tenant, or platform-wide for platform admin."""

    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        user = request.user
        # Platform administrators have platform-wide audit access
        if (
            getattr(user, "is_platform_admin", False)
            or getattr(user, "role", None) == Role.PLATFORM_ADMIN
        ):
            return

        tenant = getattr(request, "tenant", None) or get_current_tenant()
        if not tenant:
            raise PermissionDenied("Active tenant context is required to view audit logs.")

        membership = getattr(request, "membership", None)
        if not membership:
            membership = user.memberships.filter(tenant=tenant, is_active=True).first()

        if not membership or not role_has_permission(membership.role, Permission.AUDIT_VIEW):
            raise PermissionDenied("You do not have permission to view audit logs.")

    def get_queryset(self):
        user = self.request.user
        if (
            getattr(user, "is_platform_admin", False)
            or getattr(user, "role", None) == Role.PLATFORM_ADMIN
        ):
            qs = AuditLog.objects.all()
            tenant_id = self.request.query_params.get("tenant_id")
            if tenant_id:
                qs = qs.filter(tenant_id=tenant_id)
        else:
            tenant = getattr(self.request, "tenant", None) or getattr(user, "tenant", None)
            if not tenant:
                return AuditLog.objects.none()
            qs = AuditLog.objects.filter(tenant=tenant)

        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        entity_type = self.request.query_params.get("entity_type")
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        actor = self.request.query_params.get("actor")
        if actor:
            qs = qs.filter(actor_id=actor)
        date = self.request.query_params.get("date")
        if date:
            qs = qs.filter(timestamp__date=date)
        return qs.select_related("actor")
