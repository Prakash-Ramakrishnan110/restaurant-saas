import pytest
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.tenants.models import Tenant
from apps.tenants.services import create_tenant_with_defaults
from apps.venues.models import DiningTable, TokenCounter


@pytest.fixture
def platform_env():
    admin = User.objects.create_user(
        email="platform_boss@servemyfood.com",
        password="SuperSecretAdminPass123!",
        full_name="Platform Boss",
        is_platform_admin=True,
        is_active=True,
    )
    tenant, owner, _ = create_tenant_with_defaults(
        name="Anand Sweets",
        slug="anand-sweets",
        owner_email="anand@example.com",
        owner_full_name="Anand Kumar",
    )
    admin_client = APIClient()
    admin_token = str(RefreshToken.for_user(admin).access_token)
    admin_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    owner_client = APIClient()
    owner_token = str(RefreshToken.for_user(owner).access_token)
    owner_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {owner_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    return {
        "admin": admin,
        "tenant": tenant,
        "owner": owner,
        "admin_client": admin_client,
        "owner_client": owner_client,
    }


@pytest.mark.django_db
def test_platform_customer_provision_wizard_tea_shop(platform_env):
    """POST /api/v1/platform/customers/ provisions tea shop with counters and tokens (no tables)."""
    client = platform_env["admin_client"]
    payload = {
        "name": "Chai & Bun Corner",
        "business_type": "TEA_SHOP",
        "city": "Madurai",
        "language": "ta",
        "owner_name": "Muthu Vel",
        "owner_phone": "+919876543210",
        "owner_email": "muthu@chaiandbun.com",
        "plan_slug": "starter",
        "trial_days": 21,
        "outlets_count": 1,
        "outlet_names": ["Madurai Town Hall"],
    }
    res = client.post("/api/v1/platform/customers/", payload)
    assert res.status_code == status.HTTP_201_CREATED
    data = res.data
    assert "tenant_id" in data
    assert data["name"] == "Chai & Bun Corner"
    assert data["owner_email"] == "muthu@chaiandbun.com"
    assert len(data["temporary_password"]) >= 10
    assert "welcome_note" in data
    assert data["temporary_password"] in data["welcome_note"]

    # Verify database setup
    t = Tenant.objects.get(id=data["tenant_id"])
    assert t.business_type == "TEA_SHOP"
    assert t.address == "Madurai"
    assert t.business_settings.document_language == "EN_TA"
    assert t.subscription.status == "TRIAL"
    assert t.subscription.plan is not None
    assert t.subscription.plan.slug == "starter"

    # Counter venue verification: TokenCounter exists, 0 tables
    assert TokenCounter.unscoped.filter(tenant=t).count() >= 1
    assert DiningTable.unscoped.filter(tenant=t).count() == 0

    # Ensure password is NOT logged in AuditLog
    logs = AuditLog.objects.filter(entity_type="Tenant", entity_id=str(t.id))
    assert logs.count() >= 1
    for log in logs:
        assert data["temporary_password"] not in str(log.after_state)


@pytest.mark.django_db
def test_platform_customer_provision_wizard_restaurant(platform_env):
    """POST /api/v1/platform/customers/ provisions full restaurant with tables."""
    client = platform_env["admin_client"]
    payload = {
        "name": "Kaveri Grand Fine Dine",
        "business_type": "FINE_DINING",
        "city": "Bengaluru",
        "language": "en",
        "owner_name": "Chef Raghavan",
        "owner_email": "raghavan@kaverigrand.com",
        "plan_slug": "professional",
        "trial_days": 14,
        "outlets_count": 2,
        "outlet_names": ["Indiranagar Outlet", "Koramangala Outlet"],
    }
    res = client.post("/api/v1/platform/customers/", payload)
    assert res.status_code == status.HTTP_201_CREATED
    t_id = res.data["tenant_id"]
    t = Tenant.objects.get(id=t_id)
    assert t.subscription.plan is not None
    assert t.subscription.plan.slug == "professional"
    assert DiningTable.unscoped.filter(tenant=t).count() >= 5


@pytest.mark.django_db
def test_tenant_actions_audit_trail_and_reasons(platform_env):
    """Actions on tenant: suspend, reactivate, extend trial, change plan, reset pwd, add note."""
    client = platform_env["admin_client"]
    t = platform_env["tenant"]

    # 1. Suspend with reason
    res_susp = client.post(
        f"/api/v1/tenants/{t.id}/suspend/", {"reason": "Non-payment notice period expired"}
    )
    assert res_susp.status_code == status.HTTP_200_OK
    assert res_susp.data["status"] == "SUSPENDED"

    # 2. Reactivate with reason
    res_act = client.post(
        f"/api/v1/tenants/{t.id}/activate/", {"reason": "Payment verified via bank transfer"}
    )
    assert res_act.status_code == status.HTTP_200_OK
    assert res_act.data["status"] == "ACTIVE"

    # 3. Extend trial (requires reason)
    res_ext_fail = client.post(f"/api/v1/tenants/{t.id}/extend-trial/", {"days": 10})
    assert res_ext_fail.status_code == status.HTTP_400_BAD_REQUEST

    res_ext = client.post(
        f"/api/v1/tenants/{t.id}/extend-trial/",
        {"days": 14, "reason": "Pilot requested extra testing"},
    )
    assert res_ext.status_code == status.HTTP_200_OK
    assert res_ext.data["subscription"]["status"] == "TRIAL"

    # 4. Change plan (Starter, Professional, Business, Enterprise)
    res_plan_fail = client.post(
        f"/api/v1/tenants/{t.id}/change-plan/", {"plan_slug": "ultra-growth", "reason": "testing"}
    )
    assert res_plan_fail.status_code == status.HTTP_400_BAD_REQUEST

    res_plan = client.post(
        f"/api/v1/tenants/{t.id}/change-plan/",
        {"plan_slug": "business", "reason": "Upgraded to 15 branches"},
    )
    assert res_plan.status_code == status.HTTP_200_OK
    assert res_plan.data["subscription"]["plan_slug"] == "business"

    # 5. Reset owner password
    res_pwd = client.post(
        f"/api/v1/tenants/{t.id}/reset-owner-password/", {"reason": "Owner locked out of account"}
    )
    assert res_pwd.status_code == status.HTTP_200_OK
    assert len(res_pwd.data["temporary_password"]) >= 8

    # 6. Add internal operator note
    res_note = client.post(
        f"/api/v1/tenants/{t.id}/notes/",
        {"note": "Customer onboarding call completed. Very satisfied.", "reason": "Follow-up"},
    )
    assert res_note.status_code == status.HTTP_201_CREATED

    # 7. Retrieve full customer detail
    res_detail = client.get(f"/api/v1/tenants/{t.id}/")
    assert res_detail.status_code == status.HTTP_200_OK
    detail = res_detail.data
    assert "subscription" in detail
    assert "branches" in detail
    assert "owner" in detail
    assert "notes" in detail
    assert len(detail["notes"]) >= 1
    assert "Customer onboarding call completed" in detail["notes"][0]["note"]
    assert "recent_activity" in detail
    assert len(detail["recent_activity"]) >= 5


@pytest.mark.django_db
def test_platform_admin_forbidden_on_orders_and_invoices(platform_env):
    """Platform Admin cannot access tenant-level operational orders, invoices, or sessions."""
    admin_client = platform_env["admin_client"]
    t = platform_env["tenant"]

    headers = {"HTTP_X_TENANT_ID": str(t.id)}

    res_orders = admin_client.get("/api/v1/orders/", **headers)
    assert res_orders.status_code == status.HTTP_403_FORBIDDEN

    res_invoices = admin_client.get("/api/v1/invoices/", **headers)
    assert res_invoices.status_code == status.HTTP_403_FORBIDDEN

    res_sessions = admin_client.get("/api/v1/table-sessions/", **headers)
    assert res_sessions.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_non_platform_admin_forbidden_on_customer_endpoints(platform_env):
    """Restaurant owner cannot call platform admin endpoints."""
    owner_client = platform_env["owner_client"]
    t = platform_env["tenant"]

    res_prov = owner_client.post("/api/v1/platform/customers/", {"name": "Hacker Bistro"})
    assert res_prov.status_code == status.HTTP_403_FORBIDDEN

    res_ext = owner_client.post(
        f"/api/v1/tenants/{t.id}/extend-trial/", {"days": 30, "reason": "Self-extension"}
    )
    assert res_ext.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_platform_customer_provision_wizard_hotel(platform_env):
    """POST /api/v1/platform/customers/ provisions hotel with room features and floors."""
    from apps.tenants.models import Branch

    client = platform_env["admin_client"]
    payload = {
        "name": "Grand Kaveri Hotel & Suites",
        "business_type": "HOTEL",
        "city": "Chennai",
        "language": "en",
        "owner_name": "General Manager",
        "owner_email": "gm@grandkaverihotel.com",
        "plan_slug": "enterprise",
        "trial_days": 30,
        "outlets_count": 3,
        "outlet_names": ["Lobby Cafe", "Rooftop Restaurant", "Banquet"],
    }
    res = client.post("/api/v1/platform/customers/", payload)
    assert res.status_code == status.HTTP_201_CREATED
    t_id = res.data["tenant_id"]
    t = Tenant.objects.get(id=t_id)
    assert t.business_type == "HOTEL"
    assert t.subscription.plan and t.subscription.plan.slug == "enterprise"
    assert Branch.unscoped.filter(tenant=t).count() == 3


@pytest.mark.django_db
def test_tenant_actions_validation_and_not_found(platform_env):
    """Validates reason requirements, invalid slugs, and 404 handling on tenant actions."""
    client = platform_env["admin_client"]
    t = platform_env["tenant"]
    fake_id = "00000000-0000-0000-0000-000000000000"

    # Actions strictly requiring reason
    assert (
        client.post(f"/api/v1/tenants/{t.id}/extend-trial/", {"days": 7}).status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        client.post(f"/api/v1/tenants/{t.id}/change-plan/", {"plan_slug": "starter"}).status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        client.post(
            f"/api/v1/tenants/{t.id}/change-plan/", {"plan_slug": "invalid", "reason": "Test"}
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        client.post(f"/api/v1/tenants/{t.id}/notes/", {}).status_code == status.HTTP_400_BAD_REQUEST
    )

    # 404 checks
    assert (
        client.post(f"/api/v1/tenants/{fake_id}/suspend/", {"reason": "X"}).status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert (
        client.post(f"/api/v1/tenants/{fake_id}/activate/", {"reason": "X"}).status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert (
        client.post(f"/api/v1/tenants/{fake_id}/extend-trial/", {"reason": "X"}).status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert (
        client.post(
            f"/api/v1/tenants/{fake_id}/change-plan/", {"reason": "X", "plan_slug": "starter"}
        ).status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert (
        client.post(f"/api/v1/tenants/{fake_id}/reset-owner-password/", {"reason": "X"}).status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert (
        client.post(f"/api/v1/tenants/{fake_id}/notes/", {"note": "X"}).status_code
        == status.HTTP_404_NOT_FOUND
    )

    # Platform Customer Create validation
    res_bad = client.post("/api/v1/platform/customers/", {"name": ""})
    assert res_bad.status_code == status.HTTP_400_BAD_REQUEST
