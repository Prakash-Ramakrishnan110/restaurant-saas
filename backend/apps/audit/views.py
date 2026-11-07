from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.rbac.constants import Permission, Role
from apps.rbac.permissions import ActionPermission


class AuditLogListView(generics.ListAPIView):
    """List audit log records for the tenant, with sensitive fields redacted."""

    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, ActionPermission]
    required_permissions = {
        "GET": Permission.AUDIT_VIEW,
    }

    def get_queryset(self):
        user = self.request.user
        if getattr(user, "role", None) == Role.PLATFORM_ADMIN:
            qs = AuditLog.objects.all()
            tenant_id = self.request.query_params.get("tenant_id")
            if tenant_id:
                qs = qs.filter(tenant_id=tenant_id)
        else:
            tenant = getattr(user, "tenant", None)
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
