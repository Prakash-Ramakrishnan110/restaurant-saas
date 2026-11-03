import pytest

from apps.core.context import set_current_tenant
from apps.subscriptions.models import Plan
from apps.subscriptions.services import EntitlementLimitReached, enforce_limit
from apps.venues.services import bulk_create_tables, update_capabilities


@pytest.mark.django_db
def test_starter_plan_entitlement_enforcement(venue_test_setup):
    tenant = venue_test_setup["tenant_a"]
    branch = venue_test_setup["branch_a1"]
    sec = venue_test_setup["sec_a1"]
    set_current_tenant(tenant)

    # Assign Starter plan
    starter_plan = Plan.objects.create(
        slug="starter-test",
        name="Starter",
        price_paise=99900,
        entitlements={
            "max_branches": 1,
            "max_service_areas": 1,
            "max_tables": 15,
            "floor_editor": False,
            "table_merge": False,
            "courses": False,
        },
    )
    tenant.subscription.plan = starter_plan
    tenant.subscription.save()

    # 1. Courses feature disabled on Starter plan
    with pytest.raises(EntitlementLimitReached):
        enforce_limit(tenant, "courses")

    with pytest.raises(EntitlementLimitReached):
        update_capabilities(branch, {"uses_courses": True})

    # 2. Table merge disabled on Starter plan
    with pytest.raises(EntitlementLimitReached):
        enforce_limit(tenant, "table_merge")

    # 3. Tables limit: currently 2 tables exist. Creating 14 more exceeds 15 max.
    with pytest.raises(EntitlementLimitReached):
        bulk_create_tables(section=sec, count=14)
