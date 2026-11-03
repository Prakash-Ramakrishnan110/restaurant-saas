import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.core.context import set_current_tenant
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, BusinessSettings, Tenant
from apps.venues.constants import TableStatus
from apps.venues.models import DiningTable, Section, ServiceArea
from apps.venues.services import apply_preset

User = get_user_model()


@pytest.fixture
def venue_test_setup():
    set_current_tenant(None)

    # Plan with generous limits
    plan = Plan.objects.create(
        slug="pro-test",
        name="Pro Test Plan",
        price_paise=299900,
        entitlements={
            "max_branches": 5,
            "max_service_areas": 5,
            "max_tables": 50,
            "floor_editor": True,
            "table_merge": True,
            "courses": True,
        },
    )

    # Tenant Alpha
    tenant_a = Tenant.objects.create(
        name="Alpha Dining",
        slug="alpha-dining",
        status=Tenant.Status.ACTIVE,
        business_type=Tenant.BusinessType.RESTAURANT,
    )
    BusinessSettings.objects.create(tenant=tenant_a, invoice_prefix="ALP-")
    Subscription.objects.create(
        tenant=tenant_a,
        plan=plan,
        status=SubscriptionStatus.ACTIVE,
    )
    branch_a1 = Branch.unscoped.create(
        tenant=tenant_a,
        name="Alpha Indiranagar",
        venue_profile=Branch.VenueProfile.CASUAL_DINING,
    )
    apply_preset(branch_a1, Branch.VenueProfile.CASUAL_DINING)

    branch_a2 = Branch.unscoped.create(
        tenant=tenant_a,
        name="Alpha Koramangala",
        venue_profile=Branch.VenueProfile.CAFE,
    )
    apply_preset(branch_a2, Branch.VenueProfile.CAFE)

    # Users for Tenant Alpha
    owner_a = User.objects.create_user(
        email="owner@alpha.com", password="Password123!", full_name="Alpha Owner"
    )
    Membership.objects.create(user=owner_a, tenant=tenant_a, role=Role.OWNER, is_active=True)

    manager_a1 = User.objects.create_user(
        email="mgr1@alpha.com", password="Password123!", full_name="Alpha Manager 1"
    )
    m_mgr_a1 = Membership.objects.create(
        user=manager_a1, tenant=tenant_a, role=Role.BRANCH_MANAGER, is_active=True
    )
    m_mgr_a1.branches.add(branch_a1)

    waiter_a1 = User.objects.create_user(
        email="waiter1@alpha.com", password="Password123!", full_name="Alpha Waiter 1"
    )
    m_waiter_a1 = Membership.objects.create(
        user=waiter_a1, tenant=tenant_a, role=Role.WAITER, is_active=True
    )
    m_waiter_a1.branches.add(branch_a1)

    # Hierarchy under Branch A1
    set_current_tenant(tenant_a)
    area_a1 = ServiceArea.objects.create(
        tenant=tenant_a,
        branch=branch_a1,
        name="Main Dining",
    )
    sec_a1 = Section.objects.create(
        tenant=tenant_a,
        branch=branch_a1,
        service_area=area_a1,
        name="AC Section",
    )
    table_a1_1 = DiningTable.objects.create(
        tenant=tenant_a,
        branch=branch_a1,
        section=sec_a1,
        label="T1",
        capacity=4,
        status=TableStatus.AVAILABLE,
    )
    table_a1_2 = DiningTable.objects.create(
        tenant=tenant_a,
        branch=branch_a1,
        section=sec_a1,
        label="T2",
        capacity=4,
        status=TableStatus.AVAILABLE,
    )

    # Tenant Beta
    tenant_b = Tenant.objects.create(
        name="Beta Foods",
        slug="beta-foods",
        status=Tenant.Status.ACTIVE,
        business_type=Tenant.BusinessType.TEA_SHOP,
    )
    Subscription.objects.create(
        tenant=tenant_b,
        plan=plan,
        status=SubscriptionStatus.ACTIVE,
    )
    branch_b1 = Branch.unscoped.create(
        tenant=tenant_b,
        name="Beta Outlet 1",
        venue_profile=Branch.VenueProfile.QUICK_SERVICE,
    )
    apply_preset(branch_b1, Branch.VenueProfile.QUICK_SERVICE)
    owner_b = User.objects.create_user(
        email="owner@beta.com", password="Password123!", full_name="Beta Owner"
    )
    Membership.objects.create(user=owner_b, tenant=tenant_b, role=Role.OWNER, is_active=True)

    set_current_tenant(tenant_b)
    area_b1 = ServiceArea.objects.create(
        tenant=tenant_b,
        branch=branch_b1,
        name="Counter Area",
    )
    sec_b1 = Section.objects.create(
        tenant=tenant_b,
        branch=branch_b1,
        service_area=area_b1,
        name="Express Line",
    )
    table_b1_1 = DiningTable.objects.create(
        tenant=tenant_b,
        branch=branch_b1,
        section=sec_b1,
        label="B1",
        capacity=2,
    )

    set_current_tenant(None)

    return {
        "plan": plan,
        "tenant_a": tenant_a,
        "branch_a1": branch_a1,
        "branch_a2": branch_a2,
        "area_a1": area_a1,
        "sec_a1": sec_a1,
        "table_a1_1": table_a1_1,
        "table_a1_2": table_a1_2,
        "owner_a": owner_a,
        "manager_a1": manager_a1,
        "waiter_a1": waiter_a1,
        "tenant_b": tenant_b,
        "branch_b1": branch_b1,
        "owner_b": owner_b,
        "area_b1": area_b1,
        "sec_b1": sec_b1,
        "table_b1_1": table_b1_1,
    }


def make_client(user, tenant):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    return client
