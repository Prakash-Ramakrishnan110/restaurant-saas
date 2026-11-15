import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant

User = get_user_model()


@pytest.mark.django_db
def test_reports_range_and_today_validation_and_branch_filter():
    plan = Plan.objects.create(
        name="Report Plan",
        slug="report-plan",
        price_paise=1000,
        entitlements={"max_branches": 2},
    )
    tenant = Tenant.objects.create(
        name="Report Cafe", slug="report-cafe", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    branch = Branch.unscoped.create(tenant=tenant, name="Main", is_active=True)
    owner = User.objects.create_user(email="owner@reportcafe.com", password="Password123!")
    Membership.objects.create(user=owner, tenant=tenant, role=Role.OWNER, is_active=True)

    c = APIClient()
    c.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(owner).access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    assert c.get(f"/api/v1/reports/today/?branch_id={branch.id}").status_code == 200
    assert c.get("/api/v1/reports/range/?start_date=bad-date").status_code == 400
    assert c.get("/api/v1/reports/range/?end_date=bad-date").status_code == 400
    assert (
        c.get("/api/v1/reports/range/?start_date=2026-11-10&end_date=2026-11-01").status_code == 400
    )
    assert (
        c.get(
            f"/api/v1/reports/range/?start_date=2026-11-01&end_date=2026-11-05&branch_id={branch.id}"
        ).status_code
        == 200
    )
