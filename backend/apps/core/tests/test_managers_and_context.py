import pytest

from apps.core.context import get_current_tenant, reset_current_tenant, set_current_tenant
from apps.tenants.models import Branch, Tenant


@pytest.mark.django_db
def test_tenant_contextvar():
    assert get_current_tenant() is None

    tenant = Tenant.objects.create(name="Cafe Delight", slug="cafe-delight")
    token = set_current_tenant(tenant)
    assert get_current_tenant() == tenant

    reset_current_tenant(token)
    assert get_current_tenant() is None


@pytest.mark.django_db
def test_tenant_manager_fails_closed_without_context():
    tenant1 = Tenant.objects.create(name="Tenant 1", slug="tenant-1")
    Branch.unscoped.create(tenant=tenant1, name="Branch 1")

    # Context is None -> objects.all() MUST fail closed (empty)
    token = set_current_tenant(None)
    try:
        assert Branch.objects.count() == 0
        assert list(Branch.objects.all()) == []
    finally:
        reset_current_tenant(token)


@pytest.mark.django_db
def test_tenant_manager_filters_by_context():
    tenant1 = Tenant.objects.create(name="Tenant 1", slug="tenant-1")
    tenant2 = Tenant.objects.create(name="Tenant 2", slug="tenant-2")

    b1 = Branch.unscoped.create(tenant=tenant1, name="Branch 1")
    b2 = Branch.unscoped.create(tenant=tenant2, name="Branch 2")

    # When context is tenant1
    token1 = set_current_tenant(tenant1)
    try:
        branches = list(Branch.objects.all())
        assert len(branches) == 1
        assert branches[0] == b1
    finally:
        reset_current_tenant(token1)

    # When context is tenant2
    token2 = set_current_tenant(tenant2)
    try:
        branches = list(Branch.objects.all())
        assert len(branches) == 1
        assert branches[0] == b2
    finally:
        reset_current_tenant(token2)


@pytest.mark.django_db
def test_unscoped_manager_returns_all():
    tenant1 = Tenant.objects.create(name="Tenant 1", slug="tenant-1")
    tenant2 = Tenant.objects.create(name="Tenant 2", slug="tenant-2")

    Branch.unscoped.create(tenant=tenant1, name="Branch 1")
    Branch.unscoped.create(tenant=tenant2, name="Branch 2")

    assert Branch.unscoped.count() == 2


@pytest.mark.django_db
def test_tenant_manager_create_auto_assigns_tenant():
    tenant = Tenant.objects.create(name="Tenant Auto", slug="tenant-auto")
    token = set_current_tenant(tenant)
    try:
        branch = Branch.objects.create(name="Auto Branch")
        assert branch.tenant == tenant
    finally:
        reset_current_tenant(token)


@pytest.mark.django_db
def test_tenant_manager_create_raises_without_context():
    token = set_current_tenant(None)
    try:
        with pytest.raises(
            ValueError, match="Cannot create tenant-owned record without an active tenant context"
        ):
            Branch.objects.create(name="Orphan Branch")
    finally:
        reset_current_tenant(token)
