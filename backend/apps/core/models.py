import uuid

from django.db import models

from apps.core.managers import TenantManager, UnscopedTenantManager


class UUIDModel(models.Model):
    """Abstract base model that uses UUIDv4 as primary key."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class TimeStampedModel(models.Model):
    """Abstract base model providing self-updating creation and modification timestamps."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class TenantOwnedModel(UUIDModel, TimeStampedModel):
    """Abstract base model for all entities owned by a tenant.

    Enforces tenant FK with PROTECT on delete and auto-filters queries
    through TenantManager to guarantee strict tenant isolation (fail-closed).

    FUTURE POSTGRESQL ROW-LEVEL SECURITY (RLS) UPGRADE:
    While application-level isolation via TenantManager is standard and robust,
    PostgreSQL Row Level Security (RLS) can be enabled by creating a policy:
        CREATE POLICY tenant_isolation_policy ON <table>
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    See docs/adr/0002-shared-db-tenancy.md for full details.
    """

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.PROTECT,
        related_name="%(app_label)s_%(class)s_set",
        db_index=True,
    )

    objects = TenantManager()
    unscoped = UnscopedTenantManager()

    class Meta:
        abstract = True


class BranchOwnedModel(TenantOwnedModel):
    """Abstract base model for entities that belong to a specific branch within a tenant."""

    branch = models.ForeignKey(
        "tenants.Branch",
        on_delete=models.PROTECT,
        related_name="%(app_label)s_%(class)s_set",
        db_index=True,
    )

    class Meta:
        abstract = True
