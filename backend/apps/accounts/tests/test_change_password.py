import logging

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.audit.models import AuditLog
from apps.core.context import set_current_tenant
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
from apps.venues.models import DiningTable, Section, ServiceArea
from apps.venues.services import apply_preset

User = get_user_model()


@pytest.fixture
def auth_user_fixture():
    cache.clear()
    set_current_tenant(None)
    plan = Plan.objects.create(
        slug="auth-test-plan",
        name="Auth Test Plan",
        price_paise=99900,
        entitlements={
            "max_branches": 5,
            "max_service_areas": 5,
            "max_tables": 50,
            "floor_editor": True,
            "table_merge": True,
            "courses": True,
        },
    )
    tenant = Tenant.objects.create(
        name="Auth Test Tenant", slug="auth-test", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    branch = Branch.unscoped.create(tenant=tenant, name="Auth Branch")
    apply_preset(branch, Branch.VenueProfile.CASUAL_DINING)
    area = ServiceArea.unscoped.create(tenant=tenant, branch=branch, name="Main Floor")
    sec = Section.unscoped.create(
        tenant=tenant, branch=branch, service_area=area, name="Main Section"
    )
    table = DiningTable.unscoped.create(
        tenant=tenant, branch=branch, section=sec, label="T1", capacity=4
    )
    user = User.objects.create_user(
        email="testuser@authtest.com",
        password="InitialPassword123!",
        full_name="Auth User",
        must_change_password=True,
    )
    Membership.objects.create(user=user, tenant=tenant, role=Role.OWNER, is_active=True)
    set_current_tenant(None)

    return {"tenant": tenant, "branch": branch, "table": table, "user": user}


@pytest.mark.django_db
def test_change_password_wrong_current_password(auth_user_fixture):
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
            "current_password": "WrongPassword!",
            "new_password": "FreshSecurePassword2026!",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "current_password" in response.data["error"]["details"]


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
            "current_password": "InitialPassword123!",
            "new_password": "123",  # Common / too short
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "new_password" in response.data["error"]["details"]


@pytest.mark.django_db
def test_change_password_success_clears_flag_and_sets_cookie(auth_user_fixture):
    user = auth_user_fixture["user"]
    tenant = auth_user_fixture["tenant"]
    assert user.must_change_password is True

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
            "current_password": "InitialPassword123!",
            "new_password": "FreshSecurePassword2026!",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK
    # Body must return access token and must NOT return refresh token
    assert "access" in response.data
    assert "refresh" not in response.data
    assert "refresh_token" not in response.data
    assert response.data["message"] == "Password changed successfully."

    # Refresh token must be set in httpOnly cookie
    cookie_name = settings.REFRESH_COOKIE_NAME
    assert cookie_name in response.cookies
    assert response.cookies[cookie_name]["httponly"] is True
    assert len(response.cookies[cookie_name].value) > 20

    # User in DB updated and must_change_password flag cleared
    user.refresh_from_db()
    assert user.check_password("FreshSecurePassword2026!")
    assert user.must_change_password is False


@pytest.mark.django_db
def test_change_password_blacklists_other_sessions_refresh_tokens(auth_user_fixture):
    user = auth_user_fixture["user"]
    tenant = auth_user_fixture["tenant"]

    # Simulate two active sessions with RefreshTokens issued in the database
    session_1_refresh = RefreshToken.for_user(user)
    session_2_refresh = RefreshToken.for_user(user)

    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {session_1_refresh.access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    response = client.post(
        "/api/v1/auth/change-password/",
        {
            "current_password": "InitialPassword123!",
            "new_password": "FreshSecurePassword2026!",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK

    # Both prior refresh tokens must now be blacklisted and rejected on /api/v1/auth/refresh/
    for old_refresh in (session_1_refresh, session_2_refresh):
        other_client = APIClient()
        other_client.cookies[settings.REFRESH_COOKIE_NAME] = str(old_refresh)
        res_refresh = other_client.post(
            "/api/v1/auth/refresh/",
            HTTP_ORIGIN="http://localhost:5173",
        )
        assert res_refresh.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_change_password_writes_audit_log(auth_user_fixture):
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
            "current_password": "InitialPassword123!",
            "new_password": "FreshSecurePassword2026!",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_200_OK

    audit_entry = AuditLog.objects.filter(
        action="auth.password_change", entity_id=str(user.id)
    ).first()
    assert audit_entry is not None
    assert audit_entry.actor_id == user.id
    assert "FreshSecurePassword2026!" not in str(audit_entry.before_state)
    assert "FreshSecurePassword2026!" not in str(audit_entry.after_state)


@pytest.mark.django_db
def test_change_password_rate_limiting(auth_user_fixture):
    user = auth_user_fixture["user"]
    tenant = auth_user_fixture["tenant"]
    cache.clear()

    from typing import Any, cast

    rf_dict = cast(dict[str, Any], settings.REST_FRAMEWORK)
    rates = dict(cast(dict[str, str], rf_dict["DEFAULT_THROTTLE_RATES"]))
    rates["change_password"] = "2/minute"
    rf_settings = dict(rf_dict, DEFAULT_THROTTLE_RATES=rates)

    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    with override_settings(REST_FRAMEWORK=rf_settings):
        for _ in range(2):
            res = client.post(
                "/api/v1/auth/change-password/",
                {"current_password": "WrongPassword!", "new_password": "ValidPassword2026!"},
                format="json",
            )
            assert res.status_code == status.HTTP_400_BAD_REQUEST

        res_throttled = client.post(
            "/api/v1/auth/change-password/",
            {"current_password": "WrongPassword!", "new_password": "ValidPassword2026!"},
            format="json",
        )
        assert res_throttled.status_code == status.HTTP_429_TOO_MANY_REQUESTS
        assert res_throttled.data["error"]["code"] == "RATE_LIMITED"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "blocked_endpoint",
    [
        "/api/v1/branches/",
        "/api/v1/tables/",
        "/api/v1/staff/",
    ],
)
def test_must_change_password_gate_blocks_branches_tables_and_staff_endpoints(
    auth_user_fixture, blocked_endpoint
):
    """While must_change_password is True, branches, tables, and staff endpoints return 403 PASSWORD_CHANGE_REQUIRED."""
    user = auth_user_fixture["user"]
    tenant = auth_user_fixture["tenant"]
    assert user.must_change_password is True

    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    # Blocked endpoint returns 403 PASSWORD_CHANGE_REQUIRED
    res_blocked = client.get(blocked_endpoint)
    assert res_blocked.status_code == status.HTTP_403_FORBIDDEN
    assert res_blocked.json()["error"]["code"] == "PASSWORD_CHANGE_REQUIRED"

    # Allowed endpoints: auth/me, auth/refresh, auth/change-password, auth/logout
    res_me = client.get("/api/v1/auth/me/")
    assert res_me.status_code == status.HTTP_200_OK
    assert res_me.data["user"]["must_change_password"] is True


@pytest.mark.django_db
def test_temporary_password_never_in_audit_log_app_logs_or_later_get(auth_user_fixture, caplog):
    owner = auth_user_fixture["user"]
    owner.must_change_password = False
    owner.save(update_fields=["must_change_password"])
    tenant = auth_user_fixture["tenant"]
    branch = auth_user_fixture["branch"]

    client = APIClient()
    token = str(RefreshToken.for_user(owner).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    with caplog.at_level(logging.DEBUG):
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
    assert len(temp_pass) >= 12
    staff_id = response.data["id"]

    # 1. Must NOT appear in captured application logs
    assert temp_pass not in caplog.text

    # 2. Must NOT appear in any AuditLog row (before_state or after_state)
    audit_rows = AuditLog.objects.filter(tenant=tenant)
    assert audit_rows.exists()
    for row in audit_rows:
        assert temp_pass not in str(row.before_state)
        assert temp_pass not in str(row.after_state)

    # 3. Must NOT appear in later GET /api/v1/staff/{id}/ or GET /api/v1/staff/
    res_detail = client.get(f"/api/v1/staff/{staff_id}/")
    assert res_detail.status_code == status.HTTP_200_OK
    assert "temporary_password" not in res_detail.data
    assert temp_pass not in str(res_detail.content)

    res_list = client.get("/api/v1/staff/")
    assert res_list.status_code == status.HTTP_200_OK
    assert temp_pass not in str(res_list.content)
