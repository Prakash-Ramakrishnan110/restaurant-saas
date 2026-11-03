from typing import Any

from django.db import models
from django.utils import timezone

from apps.core.models import UUIDModel


class AuditLogQuerySet(models.QuerySet):
    """QuerySet that blocks batch updates and deletions on audit records."""

    def update(self, **kwargs: Any) -> int:
        raise PermissionError("AuditLog records are strictly append-only and cannot be updated.")

    def delete(self) -> tuple[int, dict[str, int]]:
        raise PermissionError("AuditLog records are strictly append-only and cannot be deleted.")


class AuditLogManager(models.Manager.from_queryset(AuditLogQuerySet)):  # type: ignore[misc]
    """Manager enforcing append-only guarantees."""

    pass


class AuditLog(UUIDModel):
    """Immutable, append-only security and operational audit trail."""

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="audit_logs",
        db_index=True,
    )
    actor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_actions",
        db_index=True,
    )
    action = models.CharField(max_length=100, db_index=True)
    entity_type = models.CharField(max_length=100, db_index=True)
    entity_id = models.CharField(max_length=255, db_index=True)
    before_state = models.JSONField(null=True, blank=True)
    after_state = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    objects = AuditLogManager()

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["tenant", "timestamp"]),
            models.Index(fields=["action", "timestamp"]),
            models.Index(fields=["entity_type", "entity_id"]),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        # Enforce append-only: Cannot update existing record
        if not self._state.adding:
            raise PermissionError(
                "AuditLog records are strictly append-only and cannot be updated."
            )
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        raise PermissionError("AuditLog records are strictly append-only and cannot be deleted.")

    def __str__(self) -> str:
        return f"[{self.timestamp.isoformat()}] {self.action} by {self.actor_id or 'System'} on {self.entity_type}:{self.entity_id}"
