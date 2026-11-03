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
from apps.venues.models import DiningTable, Section, ServiceArea

User = get_user_model()


@pytest.fixture
def natural_sort_fixture():
    tenant = Tenant.objects.create(
        name="Sort Test Dine", slug="sort-dine", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, status=SubscriptionStatus.ACTIVE)
    branch = Branch.unscoped.create(tenant=tenant, name="Sort Branch")

    area = ServiceArea.unscoped.create(tenant=tenant, branch=branch, name="Main Area")
    section = Section.unscoped.create(
        tenant=tenant, branch=branch, service_area=area, name="Main Section", sort_order=0
    )

    user = User.objects.create_user(
        email="sorter@sort.com", password="Password123!", full_name="Sorter"
    )
    Membership.objects.create(user=user, tenant=tenant, role=Role.OWNER, is_active=True)

    return {
        "tenant": tenant,
        "branch": branch,
        "area": area,
        "section": section,
        "user": user,
    }


@pytest.mark.django_db
def test_dining_table_natural_sort_order(natural_sort_fixture):
    fixture = natural_sort_fixture
    tenant = fixture["tenant"]
    branch = fixture["branch"]
    section = fixture["section"]

    ctx_token = set_current_tenant(tenant)
    try:
        # Insert out of order: T10, T2, Room 1201, T1, Room 301, T11
        test_labels = ["T10", "T2", "Room 1201", "T1", "Room 301", "T11"]
        for label in test_labels:
            DiningTable.objects.create(
                tenant=tenant,
                branch=branch,
                section=section,
                label=label,
            )

        # Query tables in default ordering
        ordered_tables = list(DiningTable.objects.filter(section=section))
        ordered_labels = [t.label for t in ordered_tables]

        # "Room" comes before "T" alphabetically, then 301 before 1201, then T1, T2, T10, T11
        expected_order = ["Room 301", "Room 1201", "T1", "T2", "T10", "T11"]
        assert ordered_labels == expected_order
    finally:
        reset_current_tenant(ctx_token)

    # Also test via API list endpoint
    client = APIClient()
    token = str(RefreshToken.for_user(fixture["user"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    res = client.get(f"/api/v1/tables/?branch_id={branch.id}")
    assert res.status_code == status.HTTP_200_OK
    api_labels = [t["label"] for t in res.data["results"]]
    assert api_labels == expected_order
