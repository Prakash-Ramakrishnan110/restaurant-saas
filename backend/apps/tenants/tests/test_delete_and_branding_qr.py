from typing import Any

import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.audit.models import AuditLog
from apps.core.context import set_current_tenant
from apps.subscriptions.models import Plan, Subscription, SubscriptionStatus
from apps.tenants.models import Branch, Tenant
from apps.tenants.services import create_tenant_with_defaults
from apps.venues.constants import AreaType, QRTargetType
from apps.venues.models import DiningTable, QRCode, Section, ServiceArea


def _auth_client(user: User, tenant: Tenant | None = None) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    headers: dict[str, Any] = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
    if tenant is not None:
        headers["HTTP_X_TENANT_ID"] = str(tenant.id)
    client.credentials(**headers)
    return client


def _make_tenant(name: str, slug: str, email: str) -> tuple[Tenant, User, Membership, Branch]:
    tenant, owner, membership = create_tenant_with_defaults(
        name=name,
        slug=slug,
        owner_email=email,
        owner_full_name=f"{name} Owner",
    )
    owner.must_change_password = False
    owner.save(update_fields=["must_change_password"])
    set_current_tenant(tenant)
    branch = Branch.unscoped.filter(tenant=tenant).first()
    if branch is None:
        branch = Branch.objects.create(tenant=tenant, name="Main Branch")
    if not Subscription.objects.filter(tenant=tenant).exists():
        plan, _ = Plan.objects.get_or_create(
            slug="pro-test",
            defaults={"name": "Pro Test", "price_paise": 99900, "is_active": True},
        )
        Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    return tenant, owner, membership, branch


@pytest.mark.django_db
def test_platform_admin_delete_tenant_cascades_and_preserves_audit_logs() -> None:
    admin = User.objects.create_user(
        email="del_admin@servemyfood.com",
        password="AdminPassword123!",
        full_name="Delete Admin",
        is_platform_admin=True,
        is_active=True,
    )
    tenant, owner, _, branch = _make_tenant(
        "Disposable Bistro", "disposable-bistro", "owner@disposable.com"
    )
    set_current_tenant(tenant)
    area = ServiceArea.objects.create(
        tenant=tenant, branch=branch, name="Main Hall", area_type=AreaType.DINING
    )
    section = Section.objects.create(tenant=tenant, branch=branch, service_area=area, name="Indoor")
    table = DiningTable.objects.create(
        tenant=tenant, branch=branch, section=section, label="T1", capacity=4
    )
    QRCode.objects.create(
        tenant=tenant,
        branch=branch,
        target_type=QRTargetType.TABLE,
        table=table,
        public_token="tok-disposable-123456",
    )

    # Non-admin forbidden
    owner_client = _auth_client(owner, tenant)
    res_forbidden = owner_client.delete(f"/api/v1/tenants/{tenant.id}/")
    assert res_forbidden.status_code == status.HTTP_403_FORBIDDEN

    # Platform admin deletes tenant cleanly
    admin_client = _auth_client(admin)
    res = admin_client.delete(f"/api/v1/tenants/{tenant.id}/")
    assert res.status_code == status.HTTP_204_NO_CONTENT
    assert not Tenant.objects.filter(id=tenant.id).exists()
    assert AuditLog.objects.filter(action="tenant.delete", entity_id=str(tenant.id)).exists()


@pytest.mark.django_db
def test_branch_permanent_delete_and_only_branch_guard() -> None:
    tenant, owner, _, branch1 = _make_tenant(
        "Multi Branch Cafe", "multi-branch-cafe", "owner@multibranch.com"
    )
    client = _auth_client(owner, tenant)

    # Cannot permanently delete the only branch
    res_only = client.delete(f"/api/v1/branches/{branch1.id}/?permanent=true")
    assert res_only.status_code == status.HTTP_400_BAD_REQUEST

    # Create a second branch with area/section/table/QR and permanently delete it
    branch2 = Branch.objects.create(tenant=tenant, name="Second Outlet")
    set_current_tenant(tenant)
    area = ServiceArea.objects.create(
        tenant=tenant, branch=branch2, name="Patio", area_type=AreaType.DINING
    )
    section = Section.objects.create(tenant=tenant, branch=branch2, service_area=area, name="Deck")
    table = DiningTable.objects.create(
        tenant=tenant, branch=branch2, section=section, label="P1", capacity=4
    )
    QRCode.objects.create(
        tenant=tenant,
        branch=branch2,
        target_type=QRTargetType.TABLE,
        table=table,
        public_token="tok-branch2-123456",
    )

    res_del = client.delete(f"/api/v1/branches/{branch2.id}/?permanent=true")
    assert res_del.status_code == status.HTTP_204_NO_CONTENT
    assert not Branch.unscoped.filter(id=branch2.id).exists()


@pytest.mark.django_db
def test_branding_save_auto_generates_qr_codes_for_tables() -> None:
    tenant, owner, _, branch = _make_tenant(
        "Auto QR Kitchen", "auto-qr-kitchen", "owner@autoqr.com"
    )
    set_current_tenant(tenant)
    area = ServiceArea.objects.create(
        tenant=tenant, branch=branch, name="Dining", area_type=AreaType.DINING
    )
    section = Section.objects.create(tenant=tenant, branch=branch, service_area=area, name="Hall")
    t1 = DiningTable.objects.create(
        tenant=tenant, branch=branch, section=section, label="T1", capacity=4
    )
    t2 = DiningTable.objects.create(
        tenant=tenant, branch=branch, section=section, label="T2", capacity=4
    )

    client = _auth_client(owner, tenant)
    res = client.patch(
        "/api/v1/business/",
        {"display_name": "Auto QR Kitchen", "brand_primary_color": "#FF6A00"},
        format="json",
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.data["qr_codes_generated"] == 2
    assert QRCode.unscoped.filter(tenant=tenant, table__in=[t1, t2], is_active=True).count() == 2

    # Saving again should generate 0 new QR codes
    res2 = client.patch("/api/v1/business/", {"display_name": "Auto QR Kitchen"}, format="json")
    assert res2.status_code == status.HTTP_200_OK
    assert res2.data["qr_codes_generated"] == 0


@pytest.mark.django_db
def test_staff_permanent_delete_and_guards() -> None:
    tenant, owner, owner_membership, branch = _make_tenant(
        "Staff Delete Diner", "staff-delete-diner", "owner@staffdel.com"
    )
    waiter_user = User.objects.create_user(
        email="waiter@staffdel.com",
        password="Password123!",
        full_name="Waiter One",
        is_active=True,
    )
    waiter_membership = Membership.objects.create(
        tenant=tenant, user=waiter_user, role="WAITER", is_active=True
    )
    waiter_membership.branches.add(branch)

    client = _auth_client(owner, tenant)

    # Cannot delete yourself
    res_self = client.delete(f"/api/v1/staff/{owner_membership.id}/?permanent=true")
    assert res_self.status_code == status.HTTP_400_BAD_REQUEST

    # Permanently delete waiter
    res_del = client.delete(f"/api/v1/staff/{waiter_membership.id}/?permanent=true")
    assert res_del.status_code == status.HTTP_204_NO_CONTENT
    assert not Membership.objects.filter(id=waiter_membership.id).exists()


@pytest.mark.django_db
def test_plan_delete_blocks_in_use_and_deletes_unused() -> None:
    admin = User.objects.create_user(
        email="plan_admin@servemyfood.com",
        password="AdminPassword123!",
        full_name="Plan Admin",
        is_platform_admin=True,
        is_active=True,
    )
    tenant, _, _, _ = _make_tenant("Plan Sub Cafe", "plan-sub-cafe", "owner@plansub.com")
    in_use_plan = Plan.objects.create(
        name="In Use Plan", slug="in-use-plan", price_paise=99900, is_active=True
    )
    Subscription.objects.filter(tenant=tenant).delete()
    Subscription.objects.create(tenant=tenant, plan=in_use_plan, status=SubscriptionStatus.ACTIVE)
    unused_plan = Plan.objects.create(
        name="Unused Plan", slug="unused-plan", price_paise=49900, is_active=True
    )

    admin_client = _auth_client(admin)
    res_blocked = admin_client.delete(f"/api/v1/plans/{in_use_plan.id}/")
    assert res_blocked.status_code == status.HTTP_400_BAD_REQUEST

    res_ok = admin_client.delete(f"/api/v1/plans/{unused_plan.id}/")
    assert res_ok.status_code == status.HTTP_204_NO_CONTENT
    assert not Plan.objects.filter(id=unused_plan.id).exists()


@pytest.mark.django_db
def test_table_delete_removes_table_and_qr_code() -> None:
    tenant, owner, _, branch = _make_tenant(
        "Table Delete Bistro", "table-delete-bistro", "owner@tabledel.com"
    )
    set_current_tenant(tenant)
    area = ServiceArea.objects.create(
        tenant=tenant, branch=branch, name="Main", area_type=AreaType.DINING
    )
    section = Section.objects.create(tenant=tenant, branch=branch, service_area=area, name="Hall")
    table = DiningTable.objects.create(
        tenant=tenant, branch=branch, section=section, label="T9", capacity=4
    )
    QRCode.objects.create(
        tenant=tenant,
        branch=branch,
        target_type=QRTargetType.TABLE,
        table=table,
        public_token="tok-tabledel-123456",
    )

    client = _auth_client(owner, tenant)
    res = client.delete(f"/api/v1/tables/{table.id}/")
    assert res.status_code == status.HTTP_204_NO_CONTENT
    assert not DiningTable.unscoped.filter(id=table.id).exists()
    assert not QRCode.unscoped.filter(public_token="tok-tabledel-123456").exists()
