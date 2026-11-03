import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.audit.models import AuditLog
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Subscription
from apps.tenants.models import Branch, Tenant

User = get_user_model()


@pytest.fixture
def staff_fixture():
    tenant = Tenant.objects.create(
        name="Staff Test Tenant", slug="staff-test", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.ACTIVE)

    branch1 = Branch.unscoped.create(tenant=tenant, name="Branch North")
    branch2 = Branch.unscoped.create(tenant=tenant, name="Branch South")

    owner = User.objects.create_user(
        email="owner@stafftest.com", password="Password123!", full_name="Owner"
    )
    _ = Membership.objects.create(user=owner, tenant=tenant, role=Role.OWNER)

    manager = User.objects.create_user(
        email="manager@stafftest.com", password="Password123!", full_name="Manager"
    )
    m_manager = Membership.objects.create(user=manager, tenant=tenant, role=Role.BRANCH_MANAGER)
    m_manager.branches.add(branch1)

    cashier = User.objects.create_user(
        email="cashier@stafftest.com", password="Password123!", full_name="Cashier"
    )
    m_cashier = Membership.objects.create(user=cashier, tenant=tenant, role=Role.CASHIER)
    m_cashier.branches.add(branch1)

    return {
        "tenant": tenant,
        "branch1": branch1,
        "branch2": branch2,
        "owner": owner,
        "manager": manager,
        "cashier": cashier,
    }


@pytest.mark.django_db
def test_owner_can_create_staff(staff_fixture):
    client = APIClient()
    token = str(RefreshToken.for_user(staff_fixture["owner"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(staff_fixture["tenant"].id),
    )

    response = client.post(
        "/api/v1/staff/",
        {
            "email": "newwaiter@stafftest.com",
            "full_name": "New Waiter",
            "role": Role.WAITER,
            "branch_ids": [str(staff_fixture["branch1"].id)],
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data["user"]["email"] == "newwaiter@stafftest.com"
    assert response.data["role"] == Role.WAITER

    # Verify AuditLog created
    assert AuditLog.objects.filter(action="staff.create").exists()


@pytest.mark.django_db
def test_staff_list_and_retrieve(staff_fixture):
    client = APIClient()
    token = str(RefreshToken.for_user(staff_fixture["owner"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(staff_fixture["tenant"].id),
    )

    # List staff
    list_resp = client.get("/api/v1/staff/")
    assert list_resp.status_code == status.HTTP_200_OK
    assert list_resp.data["count"] >= 3

    # Retrieve staff
    cashier_mem = staff_fixture["cashier"].memberships.first()
    get_resp = client.get(f"/api/v1/staff/{cashier_mem.id}/")
    assert get_resp.status_code == status.HTTP_200_OK
    assert get_resp.data["user"]["email"] == "cashier@stafftest.com"


@pytest.mark.django_db
def test_staff_update(staff_fixture):
    client = APIClient()
    token = str(RefreshToken.for_user(staff_fixture["owner"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(staff_fixture["tenant"].id),
    )

    cashier_mem = staff_fixture["cashier"].memberships.first()
    update_resp = client.patch(
        f"/api/v1/staff/{cashier_mem.id}/",
        {"role": Role.KITCHEN},
        format="json",
    )
    assert update_resp.status_code == status.HTTP_200_OK
    assert update_resp.data["role"] == Role.KITCHEN


@pytest.mark.django_db
def test_branch_manager_cannot_create_owner(staff_fixture):
    """Privilege test: manager cannot create an OWNER."""
    client = APIClient()
    token = str(RefreshToken.for_user(staff_fixture["manager"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(staff_fixture["tenant"].id),
    )

    response = client.post(
        "/api/v1/staff/",
        {
            "email": "illegalowner@stafftest.com",
            "full_name": "Illegal Owner",
            "role": Role.OWNER,
            "branch_ids": [str(staff_fixture["branch1"].id)],
        },
        format="json",
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "cannot assign or manage role 'OWNER'" in response.data["error"]["message"]


@pytest.mark.django_db
def test_cashier_cannot_manage_staff(staff_fixture):
    """Privilege test: cashier cannot manage staff."""
    client = APIClient()
    token = str(RefreshToken.for_user(staff_fixture["cashier"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(staff_fixture["tenant"].id),
    )

    response = client.post(
        "/api/v1/staff/",
        {
            "email": "another@stafftest.com",
            "full_name": "Another",
            "role": Role.WAITER,
        },
        format="json",
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_deactivate_staff_member(staff_fixture):
    client = APIClient()
    token = str(RefreshToken.for_user(staff_fixture["owner"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(staff_fixture["tenant"].id),
    )

    manager_membership = staff_fixture["manager"].memberships.first()
    response = client.delete(f"/api/v1/staff/{manager_membership.id}/")
    assert response.status_code == status.HTTP_200_OK

    manager_membership.refresh_from_db()
    assert manager_membership.is_active is False
