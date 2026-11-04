import uuid
from typing import Any, cast

import pytest
from django.http import Http404, HttpResponse
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from apps.accounts.models import Membership, User
from apps.accounts.staff_service import create_staff_member
from apps.core.context import reset_current_tenant, set_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.core.middleware import TenantContextMiddleware
from apps.rbac.constants import Permission, Role
from apps.rbac.permissions import (
    BaseTenantPermission,
    HasTenantPermission,
    IsPlatformAdmin,
    verify_tenant_and_branch_access,
)
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Subscription
from apps.tenants.models import Branch, Tenant


@pytest.fixture
def boost_setup():
    tenant = Tenant.objects.create(
        name="Boost Tenant", slug="boost-tenant", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.ACTIVE)
    owner = User.objects.create_user(
        email="boostowner@example.com", password="Password123!", full_name="Boost Owner"
    )
    owner_mem = Membership.objects.create(
        user=owner, tenant=tenant, role=Role.OWNER, is_active=True
    )
    branch = Branch.objects.create(tenant=tenant, name="Boost Branch")
    return {"tenant": tenant, "owner": owner, "owner_mem": owner_mem, "branch": branch}


@pytest.mark.django_db
def test_rbac_permissions_edge_cases(boost_setup):
    tenant = boost_setup["tenant"]
    owner = boost_setup["owner"]
    branch = boost_setup["branch"]
    dummy_view = APIView()

    # 1. Platform admin bypass in verify_tenant_and_branch_access
    admin = User.objects.create_user(
        email="adminboost@example.com",
        password="Password123!",
        full_name="Admin",
        is_platform_admin=True,
    )
    assert verify_tenant_and_branch_access(admin, branch) is True

    # 2. active_tenant is None raises Http404
    with pytest.raises(Http404):
        verify_tenant_and_branch_access(owner, branch, tenant=None)

    # 3. membership is None and user has no membership -> Http404
    rando = User.objects.create_user(
        email="rando@example.com", password="Password123!", full_name="Rando"
    )
    with pytest.raises(Http404):
        verify_tenant_and_branch_access(rando, branch, tenant=tenant)

    # 4. HasTenantPermission with must_change_password
    owner.must_change_password = True
    factory = APIRequestFactory()
    req = cast(Any, factory.get("/api/v1/branches/"))
    req.user = owner
    perm_class = HasTenantPermission(Permission.BRANCH_VIEW)
    perm = perm_class()
    with pytest.raises(PermissionDenied):
        perm.has_permission(req, dummy_view)
    owner.must_change_password = False

    # 5. HasTenantPermission with platform admin
    req_admin = cast(Any, factory.get("/api/v1/tenants/"))
    req_admin.user = admin
    perm_platform_class = HasTenantPermission(Permission.PLATFORM_ADMIN)
    perm_platform = perm_platform_class()
    assert perm_platform.has_permission(req_admin, dummy_view) is True

    # 6. HasTenantPermission with inactive tenant status
    tenant.status = Tenant.Status.SUSPENDED
    tenant.save()
    req.tenant = tenant
    assert perm.has_permission(req, dummy_view) is False

    # 7. HasTenantPermission with disallowed subscription
    tenant.status = Tenant.Status.ACTIVE
    tenant.save()
    sub = tenant.subscription
    sub.status = SubscriptionStatus.SUSPENDED
    sub.save()
    assert perm.has_permission(req, dummy_view) is False

    # Restore subscription
    sub.status = SubscriptionStatus.ACTIVE
    sub.save()

    # 8. HasTenantPermission without explicit membership on request
    req.membership = None
    assert perm.has_permission(req, dummy_view) is True

    # 9. HasTenantPermission with non-member user
    req_rando = cast(Any, factory.get("/api/v1/branches/"))
    req_rando.user = rando
    req_rando.tenant = tenant
    assert perm.has_permission(req_rando, dummy_view) is False

    # 10. Unauthenticated user
    req_anon = cast(Any, factory.get("/api/v1/branches/"))
    req_anon.user = None
    assert perm.has_permission(req_anon, dummy_view) is False

    # 11. Empty required_permission returns True
    base_perm = BaseTenantPermission()
    base_perm.required_permission = ""
    assert base_perm.has_permission(req, dummy_view) is True

    # 12. IsPlatformAdmin checks
    pa_perm = IsPlatformAdmin()
    assert pa_perm.has_permission(req_admin, dummy_view) is True
    assert pa_perm.has_permission(req, dummy_view) is False

    # 13. Branch scoping in verify_tenant_and_branch_access
    branch2 = Branch.objects.create(tenant=tenant, name="Branch 2")
    user_bm = User.objects.create_user(
        email="scopedbm@example.com", password="Password123!", full_name="Scoped BM"
    )
    mem_bm = Membership.objects.create(
        user=user_bm, tenant=tenant, role=Role.BRANCH_MANAGER, is_active=True
    )
    mem_bm.branches.add(branch)

    # Scoped user accessing allowed branch -> True
    assert (
        verify_tenant_and_branch_access(user_bm, branch, tenant=tenant, membership=mem_bm) is True
    )

    # Scoped user accessing disallowed branch -> 404
    with pytest.raises(Http404):
        verify_tenant_and_branch_access(user_bm, branch2, tenant=tenant, membership=mem_bm)

    # Scoped user accessing dummy object with branch_id
    class DummyItem:
        def __init__(self, t_id: Any, b_id: Any):
            self.tenant_id = t_id
            self.branch_id = b_id

    allowed_item = DummyItem(tenant.id, branch.id)
    disallowed_item = DummyItem(tenant.id, branch2.id)
    assert (
        verify_tenant_and_branch_access(user_bm, allowed_item, tenant=tenant, membership=mem_bm)
        is True
    )
    with pytest.raises(Http404):
        verify_tenant_and_branch_access(user_bm, disallowed_item, tenant=tenant, membership=mem_bm)

    # 14. has_object_permission on BaseTenantPermission
    req.user = owner
    req.tenant = tenant
    req.membership = boost_setup["owner_mem"]
    assert perm.has_object_permission(req, dummy_view, branch) is True


@pytest.mark.django_db
def test_tenant_managers_filter_by_current_tenant(boost_setup):
    tenant = boost_setup["tenant"]

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
def test_tenant_middleware_edge_cases(boost_setup):
    tenant = boost_setup["tenant"]
    owner = boost_setup["owner"]
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


@pytest.mark.django_db
def test_staff_service_edge_cases(boost_setup):
    tenant = boost_setup["tenant"]
    owner = boost_setup["owner"]
    owner_mem = boost_setup["owner_mem"]
    branch = boost_setup["branch"]

    # 1. Nonexistent branch ID
    with pytest.raises(BusinessRuleError):
        create_staff_member(
            tenant=tenant,
            actor=owner,
            actor_role=Role.OWNER,
            email="staffnonexist@example.com",
            full_name="Staff Nonexist",
            role=Role.WAITER,
            branch_ids=[uuid.uuid4()],
            actor_membership=owner_mem,
        )

    # 2. Inviting user who is platform admin
    admin = User.objects.create_user(
        email="adminstaff@example.com",
        password="Password123!",
        full_name="Admin Staff",
        is_platform_admin=True,
    )
    with pytest.raises(BusinessRuleError):
        create_staff_member(
            tenant=tenant,
            actor=owner,
            actor_role=Role.OWNER,
            email=admin.email,
            full_name="Admin Staff",
            role=Role.WAITER,
            actor_membership=owner_mem,
        )

    # 3. Inviting with explicit password
    mem, pw = create_staff_member(
        tenant=tenant,
        actor=owner,
        actor_role=Role.OWNER,
        email="explicitpw@example.com",
        full_name="Explicit PW",
        role=Role.WAITER,
        password="CustomPassword123!",
        actor_membership=owner_mem,
    )
    assert pw == "CustomPassword123!"

    # 4. Inviting existing member (updating role)
    mem_updated, _ = create_staff_member(
        tenant=tenant,
        actor=owner,
        actor_role=Role.OWNER,
        email="explicitpw@example.com",
        full_name="Explicit PW",
        role=Role.CASHIER,
        actor_membership=owner_mem,
    )
    assert mem_updated.role == Role.CASHIER

    # 5. Branch manager without branch_ids
    token = set_current_tenant(tenant)
    try:
        bm_user = User.objects.create_user(
            email="bm2@example.com", password="Password123!", full_name="BM 2"
        )
        bm_mem = Membership.objects.create(
            user=bm_user, tenant=tenant, role=Role.BRANCH_MANAGER, is_active=True
        )
        bm_mem.branches.add(branch)
        with pytest.raises(BusinessRuleError):
            create_staff_member(
                tenant=tenant,
                actor=bm_user,
                actor_role=Role.BRANCH_MANAGER,
                email="bmstaff@example.com",
                full_name="BM Staff",
                role=Role.WAITER,
                branch_ids=None,
                actor_membership=bm_mem,
            )
    finally:
        reset_current_tenant(token)
