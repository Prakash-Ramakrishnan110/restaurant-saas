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
