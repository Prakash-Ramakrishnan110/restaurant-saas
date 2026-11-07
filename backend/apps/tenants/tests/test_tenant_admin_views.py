import uuid

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.tenants.models import Branch
from apps.tenants.services import create_tenant_with_defaults


@pytest.fixture
def admin_setup():
    admin = User.objects.create_user(
        email="platformadmin@example.com",
        password="AdminPassword123!",
        full_name="Platform Admin",
        is_platform_admin=True,
        is_active=True,
    )
    tenant, owner, membership = create_tenant_with_defaults(
        name="View Coverage Tenant",
        slug="coverage-tenant",
        owner_email="covowner@example.com",
        owner_full_name="Cov Owner",
    )
    branch = Branch.objects.create(
        tenant=tenant,
        name="Coverage Main Branch",
        phone="+919888877777",
    )
    client = APIClient()
    token = str(RefreshToken.for_user(admin).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return {"admin": admin, "tenant": tenant, "owner": owner, "branch": branch, "client": client}


@pytest.mark.django_db
def test_tenant_viewset_list_and_filter(admin_setup):
    client = admin_setup["client"]
    res = client.get("/api/v1/tenants/")
    assert res.status_code == 200
    assert "results" in res.data

    res_filtered = client.get("/api/v1/tenants/?status=ACTIVE")
    assert res_filtered.status_code == 200


@pytest.mark.django_db
def test_tenant_viewset_retrieve_and_404(admin_setup):
    client = admin_setup["client"]
    tenant = admin_setup["tenant"]
    res = client.get(f"/api/v1/tenants/{tenant.id}/")
    assert res.status_code == 200
    assert res.data["id"] == str(tenant.id)

    res_404 = client.get(f"/api/v1/tenants/{uuid.uuid4()}/")
    assert res_404.status_code == 404


@pytest.mark.django_db
def test_tenant_viewset_suspend_and_activate(admin_setup):
    client = admin_setup["client"]
    tenant = admin_setup["tenant"]

    # Suspend
    res = client.post(f"/api/v1/tenants/{tenant.id}/suspend/")
    assert res.status_code == 200
    assert res.data["status"] == "SUSPENDED"

    # Activate
    res = client.post(f"/api/v1/tenants/{tenant.id}/activate/")
    assert res.status_code == 200
    assert res.data["status"] == "ACTIVE"

    # 404 on nonexistent
    random_id = uuid.uuid4()
    assert client.post(f"/api/v1/tenants/{random_id}/suspend/").status_code == 404
    assert client.post(f"/api/v1/tenants/{random_id}/activate/").status_code == 404


@pytest.mark.django_db
def test_tenant_viewset_reset_owner_password(admin_setup):
    client = admin_setup["client"]
    tenant = admin_setup["tenant"]
    res = client.post(f"/api/v1/tenants/{tenant.id}/reset-owner-password/")
    assert res.status_code == 200
    assert len(res.data["owners"]) >= 1

    random_id = uuid.uuid4()
    assert client.post(f"/api/v1/tenants/{random_id}/reset-owner-password/").status_code == 404


@pytest.mark.django_db
def test_branch_viewset_crud_and_404(admin_setup):
    tenant = admin_setup["tenant"]
    owner = admin_setup["owner"]
    owner.must_change_password = False
    owner.save(update_fields=["must_change_password"])
    branch = admin_setup["branch"]
    client = APIClient()
    token = str(RefreshToken.for_user(owner).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    # Retrieve branch
    res = client.get(f"/api/v1/branches/{branch.id}/")
    assert res.status_code == 200
    assert res.data["id"] == str(branch.id)

    # Update branch
    res = client.patch(f"/api/v1/branches/{branch.id}/", {"phone": "+919999999999"})
    assert res.status_code == 200
    assert res.data["phone"] == "+919999999999"

    # Nonexistent branch 404
    random_id = uuid.uuid4()
    assert client.get(f"/api/v1/branches/{random_id}/").status_code == 404
    assert client.patch(f"/api/v1/branches/{random_id}/", {"phone": "123"}).status_code == 404
    assert client.delete(f"/api/v1/branches/{random_id}/").status_code == 404

    # Delete branch
    res_del = client.delete(f"/api/v1/branches/{branch.id}/")
    assert res_del.status_code == 200


@pytest.mark.django_db
def test_platform_summary_view(admin_setup):
    admin_client = admin_setup["client"]
    res = admin_client.get("/api/v1/platform/summary/")
    assert res.status_code == 200
    assert "total_tenants" in res.data
    assert "active_tenants" in res.data
    assert "plan_distribution" in res.data

    # Non-platform admin forbidden
    owner = admin_setup["owner"]
    owner_client = APIClient()
    owner_token = str(RefreshToken.for_user(owner).access_token)
    owner_client.credentials(HTTP_AUTHORIZATION=f"Bearer {owner_token}")
    res_forbid = owner_client.get("/api/v1/platform/summary/")
    assert res_forbid.status_code == 403
