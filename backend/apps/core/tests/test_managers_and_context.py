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


@pytest.mark.django_db
def test_tenant_managers_filter_by_current_tenant():
    tenant = Tenant.objects.create(name="Boost Tenant", slug="boost-tenant", status=Tenant.Status.ACTIVE)
    Branch.objects.create(tenant=tenant, name="Boost Branch")

    # Without tenant context
    token = set_current_tenant(None)
    try:
        assert Branch.objects.all().filter_by_current_tenant().count() == 0
    finally:
        reset_current_tenant(token)

    # With tenant context
    token = set_current_tenant(tenant)
    try:
        assert Branch.objects.all().filter_by_current_tenant().count() == 1
    finally:
        reset_current_tenant(token)


@pytest.mark.django_db
def test_tenant_middleware_edge_cases():
    from django.http import HttpResponse
    from rest_framework.test import APIRequestFactory

    from apps.accounts.models import Membership, User
    from apps.core.middleware import TenantContextMiddleware
    from apps.rbac.constants import Role
    from apps.subscriptions.constants import SubscriptionStatus
    from apps.subscriptions.models import Subscription

    tenant = Tenant.objects.create(name="Mid Tenant", slug="mid-tenant", status=Tenant.Status.ACTIVE)
    Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.ACTIVE)
    owner = User.objects.create_user(email="midowner@example.com", password="Password123!", full_name="Mid Owner")
    Membership.objects.create(user=owner, tenant=tenant, role=Role.OWNER, is_active=True)
    middleware = TenantContextMiddleware(lambda req: HttpResponse("ok"))
    factory = APIRequestFactory()

    # 1. Malformed X-Tenant-ID header
    req = factory.get("/api/v1/branches/", HTTP_X_TENANT_ID="invalid-uuid")
    req.user = owner
    res = middleware._resolve_tenant(req)
    assert res is None

    # 2. Platform admin with valid X-Tenant-ID
    admin = User.objects.create_user(
        email="adminmid@example.com",
        password="Password123!",
        full_name="Admin Mid",
        is_platform_admin=True,
    )
    req_admin = factory.get("/api/v1/branches/", HTTP_X_TENANT_ID=str(tenant.id))
    req_admin.user = admin
    res_admin = middleware._resolve_tenant(req_admin)
    assert res_admin == tenant

    # 3. User with 1 membership but tenant is suspended
    tenant.status = Tenant.Status.SUSPENDED
    tenant.save()
    req_no_header = factory.get("/api/v1/branches/")
    req_no_header.user = owner
    res_no_hdr = middleware._resolve_tenant(req_no_header)
    assert res_no_hdr is None
    assert getattr(req_no_header, "tenant_is_suspended", False) is True

    # 4. User with multiple memberships and no header provided
    tenant.status = Tenant.Status.ACTIVE
    tenant.save()
    tenant2 = Tenant.objects.create(name="Tenant 2", slug="tenant-2", status=Tenant.Status.ACTIVE)
    Subscription.objects.create(tenant=tenant2, status=SubscriptionStatus.ACTIVE)
    Membership.objects.create(user=owner, tenant=tenant2, role=Role.WAITER, is_active=True)
    req_multi = factory.get("/api/v1/branches/")
    req_multi.user = owner
    res_multi = middleware._resolve_tenant(req_multi)
    assert res_multi is None
