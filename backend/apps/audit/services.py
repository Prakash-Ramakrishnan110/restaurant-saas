from typing import Any

from django.http import HttpRequest

from apps.audit.models import AuditLog


def get_client_ip(request: HttpRequest) -> str | None:
    """Extract client IP address respecting reverse proxies."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_audit_event(
    action: str,
    entity_type: str,
    entity_id: str,
    actor: Any | None = None,
    tenant: Any | None = None,
    before_state: dict[str, Any] | None = None,
    after_state: dict[str, Any] | None = None,
    request: HttpRequest | None = None,
) -> AuditLog:
    """Record an immutable audit log entry."""
    ip_address = None
    user_agent = ""

    if request is not None:
        ip_address = get_client_ip(request)
        user_agent = request.META.get("HTTP_USER_AGENT", "")
        if actor is None and getattr(request, "user", None) and request.user.is_authenticated:
            actor = request.user
        if tenant is None:
            tenant = getattr(request, "tenant", None)

    return AuditLog.objects.create(
        tenant=tenant,
        actor=actor,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        before_state=before_state,
        after_state=after_state,
        ip_address=ip_address,
        user_agent=user_agent,
    )
