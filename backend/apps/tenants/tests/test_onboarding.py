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
from apps.venues.constants import AreaType, QRTargetType, TableStatus
from apps.venues.models import DiningTable, ServiceArea
from apps.venues.services import apply_preset, generate_qr_code

User = get_user_model()


@pytest.fixture
def onboarding_setup():
    tenant = Tenant.objects.create(
        name="Dosa Corner",
        slug="dosa-corner",
        business_type=Tenant.BusinessType.TEA_SHOP,
        email="contact@dosacorner.com",
        phone="+91 99999 88888",
        address="123 Food St, Chennai",
        timezone="Asia/Kolkata",
        status=Tenant.Status.ACTIVE,
    )
    Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.ACTIVE)
    owner = User.objects.create_user(
        email="owner@dosacorner.com", password="Password123!", full_name="Dosa Owner"
    )
    membership = Membership.objects.create(
        user=owner, tenant=tenant, role=Role.OWNER, is_active=True
    )
    return {"tenant": tenant, "owner": owner, "membership": membership}


@pytest.mark.django_db
def test_onboarding_status_unauthenticated():
    client = APIClient()
    response = client.get("/api/v1/onboarding/status/")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_onboarding_status_progression(onboarding_setup):
    tenant = onboarding_setup["tenant"]
    owner = onboarding_setup["owner"]
    client = APIClient()
    token = str(RefreshToken.for_user(owner).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    # Initial state: only business_profile is complete
    resp = client.get("/api/v1/onboarding/status/")
    assert resp.status_code == status.HTTP_200_OK
    data = resp.data
    assert data["is_complete"] is False
    assert data["steps"]["business_profile"] is True
    assert data["steps"]["first_branch"] is False
    assert data["next_step"] == "first_branch"
    assert data["details"]["suggested_venue_profile"] == Branch.VenueProfile.QUICK_SERVICE

    # Step 2: Add branch with preset
    branch = Branch.objects.create(
        tenant=tenant,
        name="Main Branch",
        venue_profile=Branch.VenueProfile.QUICK_SERVICE,
        is_active=True,
    )
    apply_preset(branch, Branch.VenueProfile.QUICK_SERVICE)

    resp2 = client.get("/api/v1/onboarding/status/")
    assert resp2.data["steps"]["first_branch"] is True
    assert resp2.data["steps"]["venue_profile_chosen"] is True
    assert resp2.data["steps"]["service_areas"] is False
    assert resp2.data["next_step"] == "service_areas"

    # Step 3: Add service area
    sa = ServiceArea.objects.create(
        tenant=tenant,
        branch=branch,
        name="Counter 1",
        area_type=AreaType.TAKEAWAY,
    )
    resp3 = client.get("/api/v1/onboarding/status/")
    assert resp3.data["steps"]["service_areas"] is True
    # For quick_service (uses_tables=False), having a takeaway area counts for tables_or_counters
    assert resp3.data["steps"]["tables_or_counters"] is True
    assert resp3.data["steps"]["qr_codes"] is False
    assert resp3.data["next_step"] == "qr_codes"

    # Step 4: Add Section, Table & QR Code
    from apps.venues.models import Section

    sec = Section.objects.create(
        tenant=tenant,
        branch=branch,
        service_area=sa,
        name="Main Counter Area",
    )
    table = DiningTable.objects.create(
        tenant=tenant,
        branch=branch,
        section=sec,
        label="C1",
        status=TableStatus.AVAILABLE,
    )
    generate_qr_code(branch=branch, target_type=QRTargetType.TABLE, table=table)

    resp4 = client.get("/api/v1/onboarding/status/")
    assert resp4.data["steps"]["qr_codes"] is True
    assert resp4.data["steps"]["staff_invited"] is False
    assert resp4.data["next_step"] == "staff_invited"

    # Step 5: Invite Staff
    staff_user = User.objects.create_user(
        email="cashier@dosacorner.com", password="Password123!", full_name="Cashier 1"
    )
    Membership.objects.create(
        user=staff_user,
        tenant=tenant,
        role=Role.CASHIER,
        is_active=True,
    )

    resp5 = client.get("/api/v1/onboarding/status/")
    assert resp5.data["steps"]["staff_invited"] is True
    assert resp5.data["is_complete"] is True
    assert resp5.data["next_step"] is None


@pytest.mark.django_db
def test_onboarding_status_tenant_isolation(onboarding_setup):
    tenant_a = onboarding_setup["tenant"]

    # Tenant B
    tenant_b = Tenant.objects.create(
        name="Burger Joint",
        slug="burger-joint",
        business_type=Tenant.BusinessType.RESTAURANT,
        status=Tenant.Status.ACTIVE,
    )
    Subscription.objects.create(tenant=tenant_b, status=SubscriptionStatus.ACTIVE)
    owner_b = User.objects.create_user(
        email="owner@burgerjoint.com", password="Password123!", full_name="Burger Owner"
    )
    Membership.objects.create(user=owner_b, tenant=tenant_b, role=Role.OWNER, is_active=True)

    client_b = APIClient()
    token_b = str(RefreshToken.for_user(owner_b).access_token)
    client_b.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_b}",
        HTTP_X_TENANT_ID=str(tenant_b.id),
    )

    resp_b = client_b.get("/api/v1/onboarding/status/")
    assert resp_b.status_code == status.HTTP_200_OK
    assert resp_b.data["details"]["tenant_id"] == str(tenant_b.id)
    assert resp_b.data["details"]["tenant_name"] == "Burger Joint"
    assert resp_b.data["steps"]["first_branch"] is False

    # Attempt cross-tenant spoofing: user_b trying to view tenant_a
    client_b.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_b}",
        HTTP_X_TENANT_ID=str(tenant_a.id),
    )
    resp_spoof = client_b.get("/api/v1/onboarding/status/")
    assert resp_spoof.status_code == status.HTTP_403_FORBIDDEN
