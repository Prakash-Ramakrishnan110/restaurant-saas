import pytest
from django.contrib.auth import get_user_model
from django.http import Http404

from apps.accounts.models import Membership
from apps.rbac.constants import Permission, Role
from apps.rbac.matrix import get_permissions_for_role, role_has_permission
from apps.rbac.permissions import verify_tenant_and_branch_access
from apps.tenants.models import Branch, Tenant

User = get_user_model()


def test_rbac_matrix_integrity():
    # Owner should have full operational permissions
    owner_perms = get_permissions_for_role(Role.OWNER)
    assert Permission.STAFF_MANAGE in owner_perms
    assert Permission.BRANCH_MANAGE in owner_perms
    assert Permission.ORDER_CREATE in owner_perms
    assert Permission.INVOICE_REFUND in owner_perms

    # Branch Manager has staff and order permissions, but NOT branch.manage
    bm_perms = get_permissions_for_role(Role.BRANCH_MANAGER)
    assert Permission.STAFF_MANAGE in bm_perms
    assert Permission.BRANCH_VIEW in bm_perms
    assert Permission.BRANCH_MANAGE not in bm_perms

    # Cashier cannot manage staff or branches
    cashier_perms = get_permissions_for_role(Role.CASHIER)
    assert Permission.ORDER_CREATE in cashier_perms
    assert Permission.STAFF_MANAGE not in cashier_perms
    assert Permission.BRANCH_MANAGE not in cashier_perms

    # Waiter cannot manage staff
    waiter_perms = get_permissions_for_role(Role.WAITER)
    assert Permission.ORDER_CREATE in waiter_perms
    assert Permission.STAFF_MANAGE not in waiter_perms


def test_role_has_permission_helper():
    assert role_has_permission(Role.OWNER, Permission.STAFF_MANAGE) is True
    assert role_has_permission(Role.CASHIER, Permission.STAFF_MANAGE) is False
    assert role_has_permission("INVALID_ROLE", Permission.STAFF_MANAGE) is False


@pytest.mark.django_db
def test_verify_tenant_and_branch_access_404_on_cross_tenant():
    tenant1 = Tenant.objects.create(name="T1", slug="t1")
    tenant2 = Tenant.objects.create(name="T2", slug="t2")

    user1 = User.objects.create(email="user1@t1.com")
    membership1 = Membership.objects.create(user=user1, tenant=tenant1, role=Role.OWNER)

    # Branch belonging to Tenant 2
    b2 = Branch.unscoped.create(tenant=tenant2, name="T2 Branch")

    # MUST raise Http404 (not 403) to prevent entity existence disclosure
    with pytest.raises(Http404):
        verify_tenant_and_branch_access(user=user1, obj=b2, tenant=tenant1, membership=membership1)


@pytest.mark.django_db
def test_verify_tenant_and_branch_access_branch_scope():
    tenant = Tenant.objects.create(name="T", slug="t")
    b1 = Branch.unscoped.create(tenant=tenant, name="Branch 1")
    b2 = Branch.unscoped.create(tenant=tenant, name="Branch 2")

    user = User.objects.create(email="mgr@t.com")
    membership = Membership.objects.create(user=user, tenant=tenant, role=Role.BRANCH_MANAGER)
    # Manager assigned only to Branch 1
    membership.branches.add(b1)

    # Accessing Branch 1 should succeed
    assert (
        verify_tenant_and_branch_access(user=user, obj=b1, tenant=tenant, membership=membership)
        is True
    )

    # Accessing Branch 2 MUST raise Http404
    with pytest.raises(Http404):
        verify_tenant_and_branch_access(user=user, obj=b2, tenant=tenant, membership=membership)


@pytest.mark.django_db
def test_rbac_permissions_edge_cases():
    from typing import Any, cast
    from rest_framework.exceptions import PermissionDenied
    from rest_framework.test import APIRequestFactory
    from rest_framework.views import APIView
    from apps.rbac.permissions import BaseTenantPermission, HasTenantPermission, IsPlatformAdmin
    from apps.subscriptions.constants import SubscriptionStatus
    from apps.subscriptions.models import Subscription

    tenant = Tenant.objects.create(name="Boost Tenant", slug="boost-tenant", status=Tenant.Status.ACTIVE)
    Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.ACTIVE)
    owner = User.objects.create_user(email="boostowner@example.com", password="Password123!", full_name="Boost Owner")
    owner_mem = Membership.objects.create(user=owner, tenant=tenant, role=Role.OWNER, is_active=True)
    branch = Branch.objects.create(tenant=tenant, name="Boost Branch")
    dummy_view = APIView()

    # 1. Platform admin bypass in verify_tenant_and_branch_access
    admin = User.objects.create_user(email="adminboost@example.com", password="Password123!", full_name="Admin", is_platform_admin=True)
    assert verify_tenant_and_branch_access(admin, branch) is True

    # 2. active_tenant is None raises Http404
    with pytest.raises(Http404):
        verify_tenant_and_branch_access(owner, branch, tenant=None)

    # 3. membership is None and user has no membership -> Http404
    rando = User.objects.create_user(email="rando@example.com", password="Password123!", full_name="Rando")
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
    user_bm = User.objects.create_user(email="scopedbm@example.com", password="Password123!", full_name="Scoped BM")
    mem_bm = Membership.objects.create(user=user_bm, tenant=tenant, role=Role.BRANCH_MANAGER, is_active=True)
    mem_bm.branches.add(branch)

    # Scoped user accessing allowed branch -> True
    assert verify_tenant_and_branch_access(user_bm, branch, tenant=tenant, membership=mem_bm) is True

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
    assert verify_tenant_and_branch_access(user_bm, allowed_item, tenant=tenant, membership=mem_bm) is True
    with pytest.raises(Http404):
        verify_tenant_and_branch_access(user_bm, disallowed_item, tenant=tenant, membership=mem_bm)

    # 14. has_object_permission on BaseTenantPermission
    req.user = owner
    req.tenant = tenant
    req.membership = owner_mem
    assert perm.has_object_permission(req, dummy_view, branch) is True
