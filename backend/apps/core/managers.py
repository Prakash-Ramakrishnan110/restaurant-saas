from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.db import models

from apps.core.context import get_current_tenant

if TYPE_CHECKING:
    pass


class TenantQuerySet(models.QuerySet):
    """QuerySet that enforces tenant boundary automatically."""

    def filter_by_current_tenant(self) -> TenantQuerySet:
        tenant = get_current_tenant()
        if tenant is None:
            return self.none()
        return self.filter(tenant=tenant)


class TenantManager(models.Manager.from_queryset(TenantQuerySet)):  # type: ignore[misc]
    """Default fail-closed manager for all tenant-scoped models.

    If no tenant context is active, returns an empty queryset (fails closed).
    Never leaks cross-tenant records.
    """

    def get_queryset(self) -> TenantQuerySet:
        tenant = get_current_tenant()
        if tenant is None:
            # Fails closed
            return super().get_queryset().none()
        return super().get_queryset().filter(tenant=tenant)

    def create(self, *args: Any, **kwargs: Any) -> Any:
        if "tenant" not in kwargs and "tenant_id" not in kwargs:
            tenant = get_current_tenant()
            if tenant is None:
                raise ValueError(
                    "Cannot create tenant-owned record without an active tenant context."
                )
            kwargs["tenant"] = tenant
        return super().create(*args, **kwargs)


class UnscopedTenantManager(models.Manager):
    """Explicit manager for platform-level operations, migrations, and system maintenance.

    Bypasses request-scoped tenant isolation. Must only be used with explicit authorization.
    """

    use_in_migrations = True
