import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
from apps.venues.models import DiningTable, Section, ServiceArea

User = get_user_model()


@pytest.fixture
def entitlements_fixture():
    # Plan with limits
    pro_plan = Plan.objects.create(
        name="Pro Restaurant Plan",
        slug="pro-restaurant",
        price_paise=499900,
        entitlements={
            "max_branches": 2,
            "max_service_areas": 4,
            "max_tables": 10,
            "floor_editor": True,
            "table_merge": True,
            "courses": True,
        },
    )

    # Tenant Alpha on Pro Plan
    tenant_a = Tenant.objects.create(
        name="Alpha Dine", slug="alpha-dine", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant_a, plan=pro_plan, status=SubscriptionStatus.ACTIVE)
    branch_a1 = Branch.unscoped.create(tenant=tenant_a, name="Alpha Main")

    owner_a = User.objects.create_user(
        email="owner@alphadine.com", password="Password123!", full_name="Alpha Owner"
    )
    Membership.objects.create(user=owner_a, tenant=tenant_a, role=Role.OWNER, is_active=True)

    waiter_a = User.objects.create_user(
        email="waiter@alphadine.com", password="Password123!", full_name="Alpha Waiter"
    )
    Membership.objects.create(user=waiter_a, tenant=tenant_a, role=Role.WAITER, is_active=True)

    # Tenant Beta on default trial
    tenant_b = Tenant.objects.create(
        name="Beta Dine", slug="beta-dine", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant_b, plan=None, status=SubscriptionStatus.TRIAL)
    branch_b1 = Branch.unscoped.create(tenant=tenant_b, name="Beta Main")

    owner_b = User.objects.create_user(
        email="owner@betadine.com", password="Password123!", full_name="Beta Owner"
    )
    Membership.objects.create(user=owner_b, tenant=tenant_b, role=Role.OWNER, is_active=True)

    return {
        "tenant_a": tenant_a,
        "branch_a1": branch_a1,
        "owner_a": owner_a,
        "waiter_a": waiter_a,
        "pro_plan": pro_plan,
        "tenant_b": tenant_b,
        "branch_b1": branch_b1,
        "owner_b": owner_b,
    }


def make_client(user, tenant):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id) if tenant else "",
    )
    return client


@pytest.mark.django_db
def test_entitlements_endpoint_returns_plan_and_usage(entitlements_fixture):
    fixture = entitlements_fixture
    client = make_client(fixture["owner_a"], fixture["tenant_a"])

    res = client.get("/api/v1/entitlements/")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["plan_name"] == "Pro Restaurant Plan"
    assert res.data["status"] == "ACTIVE"
    assert res.data["limits"]["max_branches"]["limit"] == 2
    assert res.data["limits"]["max_branches"]["current"] == 1
    assert res.data["limits"]["max_branches"]["remaining"] == 1
    assert res.data["limits"]["max_tables"]["limit"] == 10
    assert res.data["limits"]["max_tables"]["current"] == 0
    assert res.data["limits"]["max_tables"]["remaining"] == 10
    assert res.data["limits"]["floor_editor"]["enabled"] is True
    assert res.data["limits"]["table_merge"]["enabled"] is True
    assert res.data["limits"]["courses"]["enabled"] is True


@pytest.mark.django_db
def test_entitlements_updates_when_tables_created(entitlements_fixture):
    fixture = entitlements_fixture
    tenant = fixture["tenant_a"]
    branch = fixture["branch_a1"]

    area = ServiceArea.unscoped.create(tenant=tenant, branch=branch, name="Ground Area")
    section = Section.unscoped.create(
        tenant=tenant, branch=branch, service_area=area, name="Main Dining"
    )

    # Create 3 tables
    for i in range(1, 4):
        DiningTable.unscoped.create(
            tenant=tenant,
            branch=branch,
            section=section,
            label=f"T{i}",
            label_prefix="T",
            label_number=i,
        )

    client = make_client(fixture["waiter_a"], tenant)
    res = client.get("/api/v1/entitlements/")
    assert res.status_code == status.HTTP_200_OK

    assert res.data["limits"]["max_service_areas"]["current"] == 1
    assert res.data["limits"]["max_service_areas"]["remaining"] == 3
    assert res.data["limits"]["max_tables"]["current"] == 3
    assert res.data["limits"]["max_tables"]["remaining"] == 7
    assert res.data["usage"]["tables"] == 3


@pytest.mark.django_db
def test_entitlements_isolation_between_tenants(entitlements_fixture):
    fixture = entitlements_fixture

    client_a = make_client(fixture["owner_a"], fixture["tenant_a"])
    client_b = make_client(fixture["owner_b"], fixture["tenant_b"])

    res_a = client_a.get("/api/v1/entitlements/")
    res_b = client_b.get("/api/v1/entitlements/")

    assert res_a.data["plan_name"] == "Pro Restaurant Plan"
    assert res_b.data["plan_name"] == "Free Trial"
    assert res_b.data["status"] == "TRIAL"
    assert res_b.data["limits"]["max_branches"]["limit"] == 1
    assert res_b.data["limits"]["floor_editor"]["enabled"] is False


@pytest.mark.django_db
def test_entitlements_clamped_remaining_and_over_limit(entitlements_fixture):
    """Verify that when usage exceeds plan limits, remaining is clamped to >= 0 and over_limit is True."""
    fixture = entitlements_fixture
    tenant = fixture["tenant_a"]

    # Pro plan limit for max_branches is 2. Currently tenant has 1 branch (Alpha Main).
    # Create 2 more branches so current branch count becomes 3 (> limit of 2).
    Branch.unscoped.create(tenant=tenant, name="Alpha Branch 2")
    Branch.unscoped.create(tenant=tenant, name="Alpha Branch 3")

    client = make_client(fixture["owner_a"], tenant)
    res = client.get("/api/v1/entitlements/")
    assert res.status_code == status.HTTP_200_OK

    branch_info = res.data["limits"]["max_branches"]
    assert branch_info["limit"] == 2
    assert branch_info["current"] == 3
    assert branch_info["remaining"] == 0  # Clamped, never negative
    assert branch_info["over_limit"] is True

