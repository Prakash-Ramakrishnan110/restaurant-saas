import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Subscription
from apps.tenants.models import Branch, Tenant

User = get_user_model()


@pytest.fixture
def branch_test_setup():
    tenant = Tenant.objects.create(name="Branch Co", slug="branch-co", status=Tenant.Status.ACTIVE)
    Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.ACTIVE)
    owner = User.objects.create_user(
        email="owner@branchco.com", password="Password123!", full_name="Branch Owner"
    )
    membership = Membership.objects.create(
        user=owner, tenant=tenant, role=Role.OWNER, is_active=True
    )
    return {"tenant": tenant, "owner": owner, "membership": membership}


@pytest.mark.django_db
def test_branch_crud_lifecycle(branch_test_setup):
    client = APIClient()
    token = str(RefreshToken.for_user(branch_test_setup["owner"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(branch_test_setup["tenant"].id),
    )

    # 1. Create branch
    create_resp = client.post(
        "/api/v1/branches/",
        {
            "name": "Central Plaza Outlet",
            "address": "MG Road, Bengaluru",
            "phone": "+91 98888 77777",
            "operating_hours": {"mon-sun": "10:00-23:00"},
        },
        format="json",
    )
    assert create_resp.status_code == status.HTTP_201_CREATED
    branch_id = create_resp.data["id"]
    assert create_resp.data["name"] == "Central Plaza Outlet"

    # 2. Retrieve branch
    get_resp = client.get(f"/api/v1/branches/{branch_id}/")
    assert get_resp.status_code == status.HTTP_200_OK
    assert get_resp.data["id"] == branch_id

    # 3. Update branch
    patch_resp = client.patch(
        f"/api/v1/branches/{branch_id}/",
        {"name": "Central Plaza Flagship", "phone": "+91 99999 88888"},
        format="json",
    )
    assert patch_resp.status_code == status.HTTP_200_OK
    assert patch_resp.data["name"] == "Central Plaza Flagship"

    # 4. List branches with filter
    list_resp = client.get("/api/v1/branches/?is_active=true")
    assert list_resp.status_code == status.HTTP_200_OK
    assert list_resp.data["count"] == 1

    # 5. Delete (deactivate) branch
    delete_resp = client.delete(f"/api/v1/branches/{branch_id}/")
    assert delete_resp.status_code == status.HTTP_200_OK

    branch = Branch.unscoped.get(id=branch_id)
    assert branch.is_active is False
