import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.audit.models import AuditLog
from apps.rbac.constants import Role
from apps.tenants.models import Branch, Tenant

User = get_user_model()


@pytest.fixture
def auth_user_fixture():
    tenant = Tenant.objects.create(
        name="Auth Test Tenant", slug="auth-test", status=Tenant.Status.ACTIVE
    )
    branch = Branch.unscoped.create(tenant=tenant, name="Auth Branch")
    user = User.objects.create_user(
        email="testuser@authtest.com",
        password="InitialPassword123!",
        full_name="Auth User",
    )
    Membership.objects.create(user=user, tenant=tenant, role=Role.OWNER, is_active=True)

    return {"tenant": tenant, "branch": branch, "user": user}


@pytest.mark.django_db
def test_change_password_success(auth_user_fixture):
    user = auth_user_fixture["user"]
    tenant = auth_user_fixture["tenant"]

    client = APIClient()
    refresh_old = RefreshToken.for_user(user)
    token_old = str(refresh_old.access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_old}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    response = client.post(
        "/api/v1/auth/change-password/",
        {
            "old_password": "InitialPassword123!",
            "new_password": "FreshSecurePassword2026!",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    assert "access_token" in response.data
    assert response.data["message"] == "Password changed successfully."

    # User in DB updated
    user.refresh_from_db()
    assert user.check_password("FreshSecurePassword2026!")
    assert not user.must_change_password

    # Audit log recorded
    assert AuditLog.objects.filter(action="auth.password_change", entity_id=str(user.id)).exists()

    # Prior refresh token revoked / blacklisted
    refresh_client = APIClient()
    res_refresh = refresh_client.post(
        "/api/v1/auth/refresh/",
        {"refresh": str(refresh_old)},
        format="json",
    )
    assert res_refresh.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_change_password_wrong_old_password(auth_user_fixture):
    user = auth_user_fixture["user"]
    tenant = auth_user_fixture["tenant"]

    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    response = client.post(
        "/api/v1/auth/change-password/",
        {
            "old_password": "WrongPassword!",
            "new_password": "FreshSecurePassword2026!",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "old_password" in response.data["error"]["details"]


@pytest.mark.django_db
def test_change_password_weak_new_password(auth_user_fixture):
    user = auth_user_fixture["user"]
    tenant = auth_user_fixture["tenant"]

    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    response = client.post(
        "/api/v1/auth/change-password/",
        {
            "old_password": "InitialPassword123!",
            "new_password": "123",  # Common / too short
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "new_password" in response.data["error"]["details"]


@pytest.mark.django_db
def test_staff_creation_temporary_password_and_must_change_flow(auth_user_fixture):
    owner = auth_user_fixture["user"]
    tenant = auth_user_fixture["tenant"]
    branch = auth_user_fixture["branch"]

    client = APIClient()
    token = str(RefreshToken.for_user(owner).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    # 1. Create staff without specifying password
    response = client.post(
        "/api/v1/staff/",
        {
            "email": "waiter.temp@authtest.com",
            "full_name": "Temporary Waiter",
            "role": Role.WAITER,
            "branch_ids": [str(branch.id)],
        },
        format="json",
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert "temporary_password" in response.data
    temp_pass = response.data["temporary_password"]
    staff_id = response.data["id"]

    # 2. Staff user in DB has must_change_password = True
    staff_user = User.objects.get(email="waiter.temp@authtest.com")
    assert staff_user.must_change_password is True
    assert staff_user.check_password(temp_pass)

    # 3. GET /staff/{id}/ does NOT leak temporary password
    res_get = client.get(f"/api/v1/staff/{staff_id}/")
    assert res_get.status_code == status.HTTP_200_OK
    assert "temporary_password" not in res_get.data

    # 4. Staff logs in with temporary password
    staff_client = APIClient()
    res_login = staff_client.post(
        "/api/v1/auth/login/",
        {"email": "waiter.temp@authtest.com", "password": temp_pass},
        format="json",
    )
    assert res_login.status_code == status.HTTP_200_OK
    staff_access = res_login.data["access"]
    assert res_login.data["user"]["must_change_password"] is True

    # 5. /auth/me/ exposes must_change_password = True
    staff_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {staff_access}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    res_me = staff_client.get("/api/v1/auth/me/")
    assert res_me.status_code == status.HTTP_200_OK
    assert res_me.data["user"]["must_change_password"] is True

    # 6. Staff changes password
    res_change = staff_client.post(
        "/api/v1/auth/change-password/",
        {
            "old_password": temp_pass,
            "new_password": "NewPermanentPassword2026!",
        },
        format="json",
    )
    assert res_change.status_code == status.HTTP_200_OK
    new_staff_token = res_change.data["access_token"]

    # 7. /auth/me/ now shows must_change_password = False
    staff_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {new_staff_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    res_me2 = staff_client.get("/api/v1/auth/me/")
    assert res_me2.status_code == status.HTTP_200_OK
    assert res_me2.data["user"]["must_change_password"] is False
