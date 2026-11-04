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
        update_capabilities(branch, {"supports_courses": True})

    # 2. Table merge disabled on Starter plan
    with pytest.raises(EntitlementLimitReached):
        enforce_limit(tenant, "table_merge")

    # 3. Tables limit: currently 2 tables exist. Creating 14 more exceeds 15 max.
    with pytest.raises(EntitlementLimitReached):
        bulk_create_tables(section=sec, count=14)


@pytest.mark.django_db
def test_api_entitlement_enforcement_for_service_areas_and_tables(venue_test_setup):
    from apps.venues.tests.conftest import make_client

    tenant = venue_test_setup["tenant_a"]
    owner = venue_test_setup["owner_a"]
    branch = venue_test_setup["branch_a1"]
    sec = venue_test_setup["sec_a1"]

    starter_plan = Plan.objects.create(
        slug="starter-api-test",
        name="Starter Plan",
        price_paise=99900,
        entitlements={
            "max_branches": 1,
            "max_service_areas": 1,
            "max_tables": 3,
            "floor_editor": False,
            "table_merge": False,
            "courses": False,
        },
    )
    tenant.subscription.plan = starter_plan
    tenant.subscription.save()

    client = make_client(owner, tenant)

    # 1. Tenant already has 1 service area. Attempting to create 2nd via API must fail (403 PLAN_LIMIT_EXCEEDED)
    res_area = client.post(
        "/api/v1/service-areas/",
        {
            "branch": str(branch.id),
            "name": "Second Area",
            "area_type": "DINING",
        },
    )
    assert res_area.status_code == 403
    assert res_area.data["error"]["code"] == "ENTITLEMENT_LIMIT_REACHED"

    # 2. Table limit is 3. Tenant has 2 tables (table_a1_1, table_a1_2).
    # Creating 1 table succeeds (total 3).
    res_t1 = client.post(
        "/api/v1/tables/",
        {
            "branch": str(branch.id),
            "section": str(sec.id),
            "label": "T3",
            "capacity": 4,
        },
    )
    assert res_t1.status_code == 201

    # Creating 4th table exceeds limit 3 -> fails with 403 ENTITLEMENT_LIMIT_REACHED
    res_t2 = client.post(
        "/api/v1/tables/",
        {
            "branch": str(branch.id),
            "section": str(sec.id),
            "label": "T4",
            "capacity": 4,
        },
    )
    assert res_t2.status_code == 403
    assert res_t2.data["error"]["code"] == "ENTITLEMENT_LIMIT_REACHED"


@pytest.mark.django_db
def test_plan_upgrade_unlocks_limits(venue_test_setup):
    from apps.venues.tests.conftest import make_client

    tenant = venue_test_setup["tenant_a"]
    owner = venue_test_setup["owner_a"]
    branch = venue_test_setup["branch_a1"]

    starter_plan = Plan.objects.create(
        slug="starter-upgrade-test",
        name="Starter",
        price_paise=99900,
        entitlements={"max_branches": 1, "max_service_areas": 1, "max_tables": 3},
    )
    tenant.subscription.plan = starter_plan
    tenant.subscription.save()

    client = make_client(owner, tenant)

    # Cannot create 2nd area
    res_area1 = client.post(
        "/api/v1/service-areas/",
        {"branch": str(branch.id), "name": "Patio", "area_type": "OUTDOOR"},
    )
    assert res_area1.status_code == 403

    # Upgrade to Business Plan
    business_plan = Plan.objects.create(
        slug="business-upgrade-test",
        name="Business",
        price_paise=799900,
        entitlements={"max_branches": 10, "max_service_areas": 10, "max_tables": 200},
    )
    tenant.subscription.plan = business_plan
    tenant.subscription.save()

    # Now creating 2nd area succeeds
    res_area2 = client.post(
        "/api/v1/service-areas/",
        {"branch": str(branch.id), "name": "Patio", "area_type": "OUTDOOR"},
    )
    assert res_area2.status_code == 201
