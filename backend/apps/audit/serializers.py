from typing import Any

from rest_framework import serializers

from apps.audit.models import AuditLog


def sanitize_audit_dict(data: Any) -> Any:
    if not isinstance(data, dict):
        return data
    sensitive_keys = {"password", "token", "secret", "refresh_token", "key", "authorization"}
    cleaned = {}
    for k, v in data.items():
        if any(sk in k.lower() for sk in sensitive_keys):
            cleaned[k] = "[REDACTED]"
        elif isinstance(v, dict):
            cleaned[k] = sanitize_audit_dict(v)
        else:
            cleaned[k] = v
    return cleaned


class AuditLogSerializer(serializers.ModelSerializer[AuditLog]):
    actor_name = serializers.SerializerMethodField()
    actor_email = serializers.SerializerMethodField()
    before_state = serializers.SerializerMethodField()
    after_state = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "action",
            "entity_type",
            "entity_id",
            "before_state",
            "after_state",
            "ip_address",
            "timestamp",
            "actor_name",
            "actor_email",
        ]

    def get_actor_name(self, obj: AuditLog) -> str:
        return obj.actor.full_name if obj.actor else "System"

    def get_actor_email(self, obj: AuditLog) -> str:
        return obj.actor.email if obj.actor else ""

    def get_before_state(self, obj: AuditLog) -> Any:
        return sanitize_audit_dict(obj.before_state)

    def get_after_state(self, obj: AuditLog) -> Any:
        return sanitize_audit_dict(obj.after_state)
