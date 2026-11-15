import json

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.menu.constants import FoodType
from apps.menu.models import BranchItemAvailability, MenuCategory, MenuItem
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant


@pytest.fixture
def menu_filter_env(db):
    tenant = Tenant.objects.create(
        name="Filter Cafe", slug="filter-cafe", status=Tenant.Status.ACTIVE
    )
    plan = Plan.objects.create(name="Pro", slug="pro-filter", entitlements={"max_menu_items": 100})
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    branch = Branch.objects.create(tenant=tenant, name="Main Branch")

    owner = User.objects.create_user(
        email="owner@filter-cafe.com", password="Password123!", full_name="Owner"
    )
    Membership.objects.create(user=owner, tenant=tenant, role=Role.OWNER, is_active=True)

    cat1 = MenuCategory.objects.create(tenant=tenant, name="Tiffins", sort_order=1)
    cat2 = MenuCategory.objects.create(tenant=tenant, name="Beverages", sort_order=2)

    dosa = MenuItem.objects.create(
        tenant=tenant,
        category=cat1,
        name="Masala Dosa",
        base_price_paise=12000,
        food_type=FoodType.VEG,
        is_active=True,
        is_bestseller=True,
    )
    coffee = MenuItem.objects.create(
        tenant=tenant,
        category=cat2,
        name="Filter Coffee",
        base_price_paise=4500,
        food_type=FoodType.VEG,
        is_active=False,
        is_bestseller=False,
    )
    BranchItemAvailability.objects.create(
        tenant=tenant,
        branch=branch,
        item=dosa,
        is_available=True,
    )

    client = APIClient()
    token = str(RefreshToken.for_user(owner).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}", HTTP_X_TENANT_ID=str(tenant.id))

    return {
        "client": client,
        "branch": branch,
        "cat1": cat1,
        "cat2": cat2,
        "dosa": dosa,
        "coffee": coffee,
    }


def test_category_reorder_json_string_and_invalid_json(menu_filter_env):
    client = menu_filter_env["client"]
    cat1 = menu_filter_env["cat1"]
    cat2 = menu_filter_env["cat2"]

    payload = json.dumps(
        [{"id": str(cat2.id), "sort_order": 0}, {"id": str(cat1.id), "sort_order": 1}]
    )
    resp = client.post("/api/v1/menu/categories/reorder/", {"orders": payload}, format="json")
    assert resp.status_code == 200
    cat2.refresh_from_db()
    assert cat2.sort_order == 0

    bad_resp = client.post(
        "/api/v1/menu/categories/reorder/", {"orders": "{not-valid-json"}, format="json"
    )
    assert bad_resp.status_code == 200


def test_menu_item_queryset_filters(menu_filter_env):
    client = menu_filter_env["client"]
    branch = menu_filter_env["branch"]
    cat1 = menu_filter_env["cat1"]

    r_cat = client.get(f"/api/v1/menu/items/?category={cat1.id}")
    assert r_cat.status_code == 200
    assert len(r_cat.json()["results"]) == 1

    r_bad_cat = client.get("/api/v1/menu/items/?category=not-a-uuid")
    assert r_bad_cat.status_code == 200

    r_food = client.get("/api/v1/menu/items/?food_type=VEG")
    assert r_food.status_code == 200
    assert len(r_food.json()["results"]) == 2

    r_active = client.get("/api/v1/menu/items/?is_active=true")
    assert r_active.status_code == 200
    assert [i["name"] for i in r_active.json()["results"]] == ["Masala Dosa"]

    r_inactive = client.get("/api/v1/menu/items/?is_active=false")
    assert r_inactive.status_code == 200
    assert [i["name"] for i in r_inactive.json()["results"]] == ["Filter Coffee"]

    r_best = client.get("/api/v1/menu/items/?is_bestseller=true")
    assert r_best.status_code == 200
    assert [i["name"] for i in r_best.json()["results"]] == ["Masala Dosa"]

    r_search = client.get("/api/v1/menu/items/?search=Dosa")
    assert r_search.status_code == 200
    assert [i["name"] for i in r_search.json()["results"]] == ["Masala Dosa"]

    r_branch = client.get(f"/api/v1/menu/items/?branch={branch.id}")
    assert r_branch.status_code == 200
    assert len(r_branch.json()["results"]) == 2
