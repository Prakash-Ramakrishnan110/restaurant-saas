import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.audit.models import AuditLog
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Subscription
from apps.tenants.models import Tenant

User = get_user_model()


@pytest.fixture
def auth_setup():
    tenant = Tenant.objects.create(
        name="Auth Tenant", slug="auth-tenant", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.ACTIVE)
    user = User.objects.create_user(
        email="owner@authtenant.com", password="SecretPassword123!", full_name="Owner User"
    )
    membership = Membership.objects.create(
        user=user, tenant=tenant, role=Role.OWNER, is_active=True
    )
    return {"tenant": tenant, "user": user, "membership": membership}


@pytest.mark.django_db
def test_login_success(auth_setup):
    client = APIClient()
    response = client.post(
        "/api/v1/auth/login/",
        {"email": "owner@authtenant.com", "password": "SecretPassword123!"},
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    assert "access" in response.data
    assert response.data["user"]["email"] == "owner@authtenant.com"
    assert str(response.data["active_tenant_id"]) == str(auth_setup["tenant"].id)

    # Verify refresh token cookie
    cookie = response.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert cookie is not None
    assert cookie["httponly"] is True
    assert cookie.value != ""

    # Verify AuditLog recorded login success
    assert AuditLog.objects.filter(
        action="auth.login.success", entity_id=str(auth_setup["user"].id)
    ).exists()


@pytest.mark.django_db
def test_login_failure_invalid_password(auth_setup):
    client = APIClient()
    response = client.post(
        "/api/v1/auth/login/",
        {"email": "owner@authtenant.com", "password": "WrongPassword!"},
        format="json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["error"]["message"] == "Invalid email or password."

    # Verify AuditLog recorded failure
    assert AuditLog.objects.filter(
        action="auth.login.failure", entity_id=str(auth_setup["user"].id)
    ).exists()


@pytest.mark.django_db
def test_login_failure_nonexistent_email():
    client = APIClient()
    response = client.post(
        "/api/v1/auth/login/",
        {"email": "ghost@unknown.com", "password": "RandomPassword!"},
        format="json",
    )
    # Generic error to prevent enumeration
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.data["error"]["message"] == "Invalid email or password."

    # Verify AuditLog recorded failure
    assert AuditLog.objects.filter(
        action="auth.login.failure", entity_id="ghost@unknown.com"
    ).exists()


@pytest.mark.django_db
def test_login_blocked_for_suspended_tenant(auth_setup):
    tenant = auth_setup["tenant"]
    tenant.status = Tenant.Status.SUSPENDED
    tenant.save()

    client = APIClient()
    response = client.post(
        "/api/v1/auth/login/",
        {"email": "owner@authtenant.com", "password": "SecretPassword123!"},
        format="json",
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "suspended" in response.data["error"]["message"].lower()


@pytest.mark.django_db
def test_token_refresh_rotates_and_blacklists(auth_setup):
    client = APIClient()
    login_resp = client.post(
        "/api/v1/auth/login/",
        {"email": "owner@authtenant.com", "password": "SecretPassword123!"},
        format="json",
    )
    old_refresh = login_resp.cookies[settings.REFRESH_COOKIE_NAME].value

    # Refresh token
    client.cookies[settings.REFRESH_COOKIE_NAME] = old_refresh
    refresh_resp = client.post("/api/v1/auth/refresh/")
    assert refresh_resp.status_code == status.HTTP_200_OK
    assert "access" in refresh_resp.data

    new_refresh = refresh_resp.cookies[settings.REFRESH_COOKIE_NAME].value
    assert new_refresh != old_refresh

    # Trying to use the old refresh token again must fail (it has been blacklisted)
    client.cookies[settings.REFRESH_COOKIE_NAME] = old_refresh
    second_refresh = client.post("/api/v1/auth/refresh/")
    assert second_refresh.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_logout_blacklists_token(auth_setup):
    client = APIClient()
    login_resp = client.post(
        "/api/v1/auth/login/",
        {"email": "owner@authtenant.com", "password": "SecretPassword123!"},
        format="json",
    )
    access = login_resp.data["access"]
    refresh = login_resp.cookies[settings.REFRESH_COOKIE_NAME].value

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    client.cookies[settings.REFRESH_COOKIE_NAME] = refresh
    logout_resp = client.post("/api/v1/auth/logout/")
    assert logout_resp.status_code == status.HTTP_204_NO_CONTENT

    # Refresh cookie is deleted
    assert logout_resp.cookies[settings.REFRESH_COOKIE_NAME].value == ""

    # Refreshing with the blacklisted token must now fail
    client.cookies[settings.REFRESH_COOKIE_NAME] = refresh
    assert client.post("/api/v1/auth/refresh/").status_code == status.HTTP_401_UNAUTHORIZED

    # AuditLog recorded logout
    assert AuditLog.objects.filter(action="auth.logout").exists()


@pytest.mark.django_db
def test_logout_with_expired_access_token(auth_setup):
    from datetime import timedelta

    from rest_framework_simplejwt.tokens import AccessToken

    client = APIClient()
    login_resp = client.post(
        "/api/v1/auth/login/",
        {"email": "owner@authtenant.com", "password": "SecretPassword123!"},
        format="json",
    )
    refresh = login_resp.cookies[settings.REFRESH_COOKIE_NAME].value

    # Create an artificially expired access token
    user = auth_setup["user"]
    token = AccessToken.for_user(user)
    # Set expiration to past
    token.set_exp(lifetime=-timedelta(minutes=10))
    expired_access = str(token)

    # Pass expired access token and valid refresh cookie
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {expired_access}")
    client.cookies[settings.REFRESH_COOKIE_NAME] = refresh

    logout_resp = client.post("/api/v1/auth/logout/")
    assert logout_resp.status_code == status.HTTP_204_NO_CONTENT
    assert logout_resp.cookies[settings.REFRESH_COOKIE_NAME].value == ""

    # Refresh token was blacklisted despite expired access token
    client.credentials()
    client.cookies[settings.REFRESH_COOKIE_NAME] = refresh
    assert client.post("/api/v1/auth/refresh/").status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_logout_without_cookie_or_token(auth_setup):
    client = APIClient()
    # No credentials, no cookies
    logout_resp = client.post("/api/v1/auth/logout/")
    assert logout_resp.status_code == status.HTTP_204_NO_CONTENT
    # Cookie is still deleted / cleared
    assert logout_resp.cookies[settings.REFRESH_COOKIE_NAME].value == ""


@pytest.mark.django_db
def test_auth_me_endpoint(auth_setup):
    client = APIClient()
    login_resp = client.post(
        "/api/v1/auth/login/",
        {"email": "owner@authtenant.com", "password": "SecretPassword123!"},
        format="json",
    )
    access = login_resp.data["access"]

    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {access}",
        HTTP_X_TENANT_ID=str(auth_setup["tenant"].id),
    )
    response = client.get("/api/v1/auth/me/")
    assert response.status_code == status.HTTP_200_OK
    assert response.data["user"]["email"] == "owner@authtenant.com"
    assert response.data["active_role"] == Role.OWNER
    assert "staff.manage" in response.data["permissions"]
    assert "branch.manage" in response.data["permissions"]


@pytest.mark.django_db
def test_refresh_rejects_untrusted_origin(auth_setup):
    client = APIClient()
    login_resp = client.post(
        "/api/v1/auth/login/",
        {"email": "owner@authtenant.com", "password": "SecretPassword123!"},
        format="json",
    )
    refresh = login_resp.cookies[settings.REFRESH_COOKIE_NAME].value
    client.cookies[settings.REFRESH_COOKIE_NAME] = refresh

    # Valid origin passes
    resp_valid = client.post("/api/v1/auth/refresh/", HTTP_ORIGIN="http://localhost:5173")
    assert resp_valid.status_code == status.HTTP_200_OK

    # Untrusted origin receives 403 INVALID_ORIGIN
    new_refresh = resp_valid.cookies[settings.REFRESH_COOKIE_NAME].value
    client.cookies[settings.REFRESH_COOKIE_NAME] = new_refresh
    resp_invalid = client.post(
        "/api/v1/auth/refresh/", HTTP_ORIGIN="https://evil-untrusted-site.com"
    )
    assert resp_invalid.status_code == status.HTTP_403_FORBIDDEN
    assert resp_invalid.data["error"]["code"] == "INVALID_ORIGIN"
