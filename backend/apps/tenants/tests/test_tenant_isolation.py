import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.core.context import reset_current_tenant, set_current_tenant
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Subscription
from apps.tenants.models import Branch, Tenant

User = get_user_model()


@pytest.fixture
def two_tenants_fixture():
    # Tenant A
    tenant_a = Tenant.objects.create(name="Tenant Alpha", slug="alpha", status=Tenant.Status.ACTIVE)
    Subscription.objects.create(tenant=tenant_a, status=SubscriptionStatus.ACTIVE)
    branch_a1 = Branch.unscoped.create(tenant=tenant_a, name="Alpha Branch 1")
    branch_a2 = Branch.unscoped.create(tenant=tenant_a, name="Alpha Branch 2")
    user_a = User.objects.create_user(
        email="owner@alpha.com", password="Password123!", full_name="Alpha Owner"
    )
    _ = Membership.objects.create(user=user_a, tenant=tenant_a, role=Role.OWNER, is_active=True)

    # Tenant B
    tenant_b = Tenant.objects.create(name="Tenant Beta", slug="beta", status=Tenant.Status.ACTIVE)
    Subscription.objects.create(tenant=tenant_b, status=SubscriptionStatus.ACTIVE)
    branch_b1 = Branch.unscoped.create(tenant=tenant_b, name="Beta Branch 1")
    branch_b2 = Branch.unscoped.create(tenant=tenant_b, name="Beta Branch 2")
    user_b = User.objects.create_user(
        email="owner@beta.com", password="Password123!", full_name="Beta Owner"
    )
    _ = Membership.objects.create(user=user_b, tenant=tenant_b, role=Role.OWNER, is_active=True)

    # Branch Manager for Branch A1 only
    user_mgr_a1 = User.objects.create_user(
        email="mgr1@alpha.com", password="Password123!", full_name="Alpha Mgr 1"
    )
    m_mgr_a1 = Membership.objects.create(
        user=user_mgr_a1, tenant=tenant_a, role=Role.BRANCH_MANAGER, is_active=True
    )
    m_mgr_a1.branches.add(branch_a1)

    return {
        "tenant_a": tenant_a,
        "branch_a1": branch_a1,
        "branch_a2": branch_a2,
        "user_a": user_a,
        "tenant_b": tenant_b,
        "branch_b1": branch_b1,
        "branch_b2": branch_b2,
        "user_b": user_b,
        "user_mgr_a1": user_mgr_a1,
    }


@pytest.mark.django_db
def test_tenant_a_cannot_list_tenant_b_branches(two_tenants_fixture):
    client = APIClient()
    token_a = str(RefreshToken.for_user(two_tenants_fixture["user_a"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_a}",
        HTTP_X_TENANT_ID=str(two_tenants_fixture["tenant_a"].id),
    )

    response = client.get("/api/v1/branches/")
    assert response.status_code == status.HTTP_200_OK

    returned_names = [b["name"] for b in response.data["results"]]
    assert "Alpha Branch 1" in returned_names
    assert "Alpha Branch 2" in returned_names
    assert "Beta Branch 1" not in returned_names
    assert "Beta Branch 2" not in returned_names


@pytest.mark.django_db
def test_tenant_a_cannot_read_tenant_b_branch(two_tenants_fixture):
    """Expect 404 (not 403) when Tenant A accesses Tenant B's branch to prevent existence leak."""
    client = APIClient()
    token_a = str(RefreshToken.for_user(two_tenants_fixture["user_a"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_a}",
        HTTP_X_TENANT_ID=str(two_tenants_fixture["tenant_a"].id),
    )

    branch_b_id = two_tenants_fixture["branch_b1"].id
    response = client.get(f"/api/v1/branches/{branch_b_id}/")
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_tenant_a_cannot_update_tenant_b_branch(two_tenants_fixture):
    client = APIClient()
    token_a = str(RefreshToken.for_user(two_tenants_fixture["user_a"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_a}",
        HTTP_X_TENANT_ID=str(two_tenants_fixture["tenant_a"].id),
    )

    branch_b_id = two_tenants_fixture["branch_b1"].id
    response = client.patch(
        f"/api/v1/branches/{branch_b_id}/", {"name": "Hacked Branch"}, format="json"
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND

    # Verify no modification took place
    two_tenants_fixture["branch_b1"].refresh_from_db()
    assert two_tenants_fixture["branch_b1"].name == "Beta Branch 1"


@pytest.mark.django_db
def test_tenant_a_cannot_delete_tenant_b_branch(two_tenants_fixture):
    client = APIClient()
    token_a = str(RefreshToken.for_user(two_tenants_fixture["user_a"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_a}",
        HTTP_X_TENANT_ID=str(two_tenants_fixture["tenant_a"].id),
    )

    branch_b_id = two_tenants_fixture["branch_b1"].id
    response = client.delete(f"/api/v1/branches/{branch_b_id}/")
    assert response.status_code == status.HTTP_404_NOT_FOUND

    two_tenants_fixture["branch_b1"].refresh_from_db()
    assert two_tenants_fixture["branch_b1"].is_active is True


@pytest.mark.django_db
def test_x_tenant_id_spoofing_is_rejected(two_tenants_fixture):
    """Proves that a user from Tenant A cannot spoof X-Tenant-ID with Tenant B's ID."""
    client = APIClient()
    token_a = str(RefreshToken.for_user(two_tenants_fixture["user_a"]).access_token)

    # Spoof header: send Tenant B's UUID with Tenant A's token
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_a}",
        HTTP_X_TENANT_ID=str(two_tenants_fixture["tenant_b"].id),
    )

    # The middleware rejects the spoofed tenant ID, leaving tenant context unset.
    # Therefore, the protected endpoint rejects access.
    response = client.get("/api/v1/branches/")
    assert response.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_query_without_tenant_context_fails_closed(two_tenants_fixture):
    """Proves that a query without tenant context returns nothing."""
    token = set_current_tenant(None)
    try:
        assert Branch.objects.count() == 0
        assert list(Branch.objects.all()) == []
    finally:
        reset_current_tenant(token)


@pytest.mark.django_db
def test_branch_scope_isolation_manager_cannot_access_other_branch(two_tenants_fixture):
    """Branch manager of branch A1 cannot access branch A2 (returns 404)."""
    client = APIClient()
    token_mgr = str(RefreshToken.for_user(two_tenants_fixture["user_mgr_a1"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_mgr}",
        HTTP_X_TENANT_ID=str(two_tenants_fixture["tenant_a"].id),
    )

    # Manager A1 accessing Branch A1 -> Success
    branch_a1_id = two_tenants_fixture["branch_a1"].id
    resp1 = client.get(f"/api/v1/branches/{branch_a1_id}/")
    assert resp1.status_code == status.HTTP_200_OK
    assert resp1.data["name"] == "Alpha Branch 1"

    # Manager A1 accessing Branch A2 -> 404 Not Found
    branch_a2_id = two_tenants_fixture["branch_a2"].id
    resp2 = client.get(f"/api/v1/branches/{branch_a2_id}/")
    assert resp2.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_platform_admin_tenant_lifecycle():
    admin_user = User.objects.create_superuser(
        email="platform@admin.com",
        password="SuperPassword123!",
        full_name="Platform Admin",
    )
    client = APIClient()
    token = str(RefreshToken.for_user(admin_user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    # 1. Create tenant via platform admin
    create_resp = client.post(
        "/api/v1/tenants/",
        {
            "name": "New Bistro",
            "slug": "new-bistro",
            "owner_email": "owner@newbistro.com",
            "owner_full_name": "Bistro Owner",
            "owner_password": "BistroPassword123!",
        },
        format="json",
    )
    assert create_resp.status_code == status.HTTP_201_CREATED
    tenant_id = create_resp.data["id"]

    # Verify created defaults: business_settings & subscription status
    assert create_resp.data["business_settings"]["tax_mode"] == "INCLUSIVE"
    assert create_resp.data["subscription_status"] == "TRIAL"

    # 2. Suspend tenant
    suspend_resp = client.post(f"/api/v1/tenants/{tenant_id}/suspend/")
    assert suspend_resp.status_code == status.HTTP_200_OK
    assert suspend_resp.data["status"] == "SUSPENDED"

    # 3. Activate tenant
    activate_resp = client.post(f"/api/v1/tenants/{tenant_id}/activate/")
    assert activate_resp.status_code == status.HTTP_200_OK
    assert activate_resp.data["status"] == "ACTIVE"


@pytest.mark.django_db
def test_tenant_a_cannot_access_tenant_b_staff(two_tenants_fixture):
    """Staff isolation: Tenant A cannot list, retrieve, update or delete Tenant B staff (404)."""
    client = APIClient()
    token_a = str(RefreshToken.for_user(two_tenants_fixture["user_a"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_a}",
        HTTP_X_TENANT_ID=str(two_tenants_fixture["tenant_a"].id),
    )

    membership_b = two_tenants_fixture["user_b"].memberships.first()

    # 1. Retrieve Tenant B staff member -> 404
    resp_get = client.get(f"/api/v1/staff/{membership_b.id}/")
    assert resp_get.status_code == status.HTTP_404_NOT_FOUND

    # 2. Update Tenant B staff member -> 404
    resp_patch = client.patch(
        f"/api/v1/staff/{membership_b.id}/", {"role": Role.CASHIER}, format="json"
    )
    assert resp_patch.status_code == status.HTTP_404_NOT_FOUND

    # 3. Delete/deactivate Tenant B staff member -> 404
    resp_del = client.delete(f"/api/v1/staff/{membership_b.id}/")
    assert resp_del.status_code == status.HTTP_404_NOT_FOUND

    # 4. List staff -> returns ONLY Tenant A staff
    resp_list = client.get("/api/v1/staff/")
    assert resp_list.status_code == status.HTTP_200_OK
    returned_emails = [item["user"]["email"] for item in resp_list.data["results"]]
    assert "owner@alpha.com" in returned_emails
    assert "owner@beta.com" not in returned_emails


@pytest.mark.django_db
def test_non_platform_users_get_403_on_all_tenant_endpoints(two_tenants_fixture):
    """Privilege test: non-platform users get 403 on all /tenants/ endpoints."""
    client = APIClient()
    token_a = str(RefreshToken.for_user(two_tenants_fixture["user_a"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_a}",
        HTTP_X_TENANT_ID=str(two_tenants_fixture["tenant_a"].id),
    )

    tenant_id = two_tenants_fixture["tenant_a"].id

    # List tenants
    assert client.get("/api/v1/tenants/").status_code == status.HTTP_403_FORBIDDEN

    # Create tenant
    assert (
        client.post("/api/v1/tenants/", {"name": "Hacked"}, format="json").status_code
        == status.HTTP_403_FORBIDDEN
    )

    # Retrieve tenant
    assert client.get(f"/api/v1/tenants/{tenant_id}/").status_code == status.HTTP_403_FORBIDDEN

    # Suspend tenant
    assert (
        client.post(f"/api/v1/tenants/{tenant_id}/suspend/").status_code
        == status.HTTP_403_FORBIDDEN
    )

    # Activate tenant
    assert (
        client.post(f"/api/v1/tenants/{tenant_id}/activate/").status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_token_invalidated_immediately_on_tenant_suspension(two_tenants_fixture):
    """Per-request enforcement: An access token issued before tenant suspension

    must stop working immediately on the next request.
    """
    client = APIClient()
    token_a = str(RefreshToken.for_user(two_tenants_fixture["user_a"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_a}",
        HTTP_X_TENANT_ID=str(two_tenants_fixture["tenant_a"].id),
    )

    # 1. Request succeeds while tenant is active
    assert client.get("/api/v1/branches/").status_code == status.HTTP_200_OK

    # 2. Suspend Tenant A
    tenant_a = two_tenants_fixture["tenant_a"]
    tenant_a.status = Tenant.Status.SUSPENDED
    tenant_a.save()

    # 3. Next request with the SAME token MUST fail immediately
    resp = client.get("/api/v1/branches/")
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert resp.json()["error"]["code"] == "TENANT_SUSPENDED"
