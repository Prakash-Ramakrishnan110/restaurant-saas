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
from apps.tenants.models import BusinessSettings, Tenant

User = get_user_model()


@pytest.fixture
def business_profile_fixture():
    # Tenant Alpha
    tenant_a = Tenant.objects.create(
        name="Alpha Dining",
        slug="alpha-dining",
        business_type=Tenant.BusinessType.RESTAURANT,
        status=Tenant.Status.ACTIVE,
        email="info@alphadining.com",
        phone="+919876543210",
        timezone="Asia/Kolkata",
    )
    BusinessSettings.objects.create(
        tenant=tenant_a,
        invoice_prefix="ALP-",
        primary_color="#123456",
        tax_mode=BusinessSettings.TaxMode.INCLUSIVE,
    )
    Subscription.objects.create(tenant=tenant_a, status=SubscriptionStatus.ACTIVE)

    owner_a = User.objects.create_user(
        email="owner@alpha.com", password="Password123!", full_name="Alpha Owner"
    )
    Membership.objects.create(user=owner_a, tenant=tenant_a, role=Role.OWNER, is_active=True)

    manager_a = User.objects.create_user(
        email="mgr@alpha.com", password="Password123!", full_name="Alpha Manager"
    )
    Membership.objects.create(
        user=manager_a, tenant=tenant_a, role=Role.BRANCH_MANAGER, is_active=True
    )

    waiter_a = User.objects.create_user(
        email="waiter@alpha.com", password="Password123!", full_name="Alpha Waiter"
    )
    Membership.objects.create(user=waiter_a, tenant=tenant_a, role=Role.WAITER, is_active=True)

    # Tenant Beta
    tenant_b = Tenant.objects.create(
        name="Beta Bakery",
        slug="beta-bakery",
        business_type=Tenant.BusinessType.BAKERY,
        status=Tenant.Status.ACTIVE,
        email="contact@betabakery.com",
        phone="+919123456789",
    )
    BusinessSettings.objects.create(
        tenant=tenant_b,
        invoice_prefix="BET-",
        primary_color="#654321",
        tax_mode=BusinessSettings.TaxMode.EXCLUSIVE,
    )
    Subscription.objects.create(tenant=tenant_b, status=SubscriptionStatus.ACTIVE)

    owner_b = User.objects.create_user(
        email="owner@beta.com", password="Password123!", full_name="Beta Owner"
    )
    Membership.objects.create(user=owner_b, tenant=tenant_b, role=Role.OWNER, is_active=True)

    return {
        "tenant_a": tenant_a,
        "owner_a": owner_a,
        "manager_a": manager_a,
        "waiter_a": waiter_a,
        "tenant_b": tenant_b,
        "owner_b": owner_b,
    }


def make_auth_client(user, tenant):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id) if tenant else "",
    )
    return client


@pytest.mark.django_db
def test_owner_can_get_and_patch_business_profile(business_profile_fixture):
    fixture = business_profile_fixture
    client = make_auth_client(fixture["owner_a"], fixture["tenant_a"])

    # 1. GET business profile
    res_get = client.get("/api/v1/business/")
    assert res_get.status_code == status.HTTP_200_OK
    assert res_get.data["name"] == "Alpha Dining"
    assert res_get.data["business_type"] == "RESTAURANT"
    assert res_get.data["invoice_prefix"] == "ALP-"
    assert res_get.data["primary_color"] == "#123456"

    # 2. PATCH business profile
    patch_data = {
        "name": "Alpha Gourmet Bistro",
        "phone": "+919999988888",
        "invoice_prefix": "AGB-",
        "primary_color": "#FF5733",
        "tax_mode": "EXCLUSIVE",
    }
    res_patch = client.patch("/api/v1/business/", patch_data, format="json")
    assert res_patch.status_code == status.HTTP_200_OK
    assert res_patch.data["name"] == "Alpha Gourmet Bistro"
    assert res_patch.data["phone"] == "+919999988888"
    assert res_patch.data["invoice_prefix"] == "AGB-"
    assert res_patch.data["primary_color"] == "#FF5733"
    assert res_patch.data["tax_mode"] == "EXCLUSIVE"

    # Verify audit log recorded
    log = AuditLog.objects.filter(
        action="business.update", entity_id=str(fixture["tenant_a"].id)
    ).first()
    assert log is not None
    assert log.actor == fixture["owner_a"]
    assert log.before_state["name"] == "Alpha Dining"
    assert log.after_state["name"] == "Alpha Gourmet Bistro"


@pytest.mark.django_db
def test_branch_manager_can_view_but_cannot_patch(business_profile_fixture):
    fixture = business_profile_fixture
    client = make_auth_client(fixture["manager_a"], fixture["tenant_a"])

    # GET allowed (has business.view)
    res_get = client.get("/api/v1/business/")
    assert res_get.status_code == status.HTTP_200_OK
    assert res_get.data["name"] == "Alpha Dining"

    # PATCH forbidden (lacks business.manage)
    res_patch = client.patch("/api/v1/business/", {"name": "Hacked Bistro"}, format="json")
    assert res_patch.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_waiter_cannot_view_or_patch(business_profile_fixture):
    fixture = business_profile_fixture
    client = make_auth_client(fixture["waiter_a"], fixture["tenant_a"])

    res_get = client.get("/api/v1/business/")
    assert res_get.status_code == status.HTTP_403_FORBIDDEN

    res_patch = client.patch("/api/v1/business/", {"name": "Hacked Bistro"}, format="json")
    assert res_patch.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_tenant_isolation_and_spoofed_header_rejected(business_profile_fixture):
    fixture = business_profile_fixture

    # User B logs in and gets their own profile
    client_b = make_auth_client(fixture["owner_b"], fixture["tenant_b"])
    res_b = client_b.get("/api/v1/business/")
    assert res_b.status_code == status.HTTP_200_OK
    assert res_b.data["name"] == "Beta Bakery"
    assert res_b.data["invoice_prefix"] == "BET-"

    # User B tries to spoof X-Tenant-ID header to Tenant A's ID
    token_b = str(RefreshToken.for_user(fixture["owner_b"]).access_token)
    spoof_client = APIClient()
    spoof_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_b}",
        HTTP_X_TENANT_ID=str(fixture["tenant_a"].id),
    )
    # Tenant context middleware / permission checks reject unassociated membership
    res_spoof_get = spoof_client.get("/api/v1/business/")
    assert res_spoof_get.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    res_spoof_patch = spoof_client.patch(
        "/api/v1/business/",
        {"name": "Cross Tenant Deface"},
        format="json",
    )
    assert res_spoof_patch.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    # Confirm Tenant A remains untouched
    fixture["tenant_a"].refresh_from_db()
    assert fixture["tenant_a"].name == "Alpha Dining"
