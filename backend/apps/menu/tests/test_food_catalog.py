from typing import Any

import pytest
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.core.context import set_current_tenant
from apps.menu.models import FoodCatalogItem, MenuCategory, MenuItem
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Tenant


@pytest.fixture
def catalog_env(db: Any) -> dict[str, Any]:
    tenant = Tenant.objects.create(name="Catalog Test Kitchen", slug="catalog-test-kitchen")
    plan = Plan.objects.create(
        name="Pro Catalog",
        slug="pro-catalog-test",
        price_paise=199900,
        entitlements={"max_menu_items": 500},
    )
    Subscription.objects.create(
        tenant=tenant,
        plan=plan,
        status=SubscriptionStatus.ACTIVE,
    )
    set_current_tenant(tenant)
    owner = User.objects.create_user(
        email="owner@catalog.test",
        password="Password123!",
        full_name="Catalog Owner",
    )
    Membership.objects.create(
        tenant=tenant,
        user=owner,
        role=Role.OWNER,
        is_active=True,
    )
    token = str(RefreshToken.for_user(owner).access_token)
    client = APIClient()
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    return {"tenant": tenant, "client": client}


@pytest.mark.django_db
def test_seed_food_catalog_and_api_add_to_menu(catalog_env: dict[str, Any]) -> None:
    call_command("seed_food_catalog")
    count = FoodCatalogItem.objects.count()
    assert count >= 2600

    # Re-running is idempotent
    call_command("seed_food_catalog")
    assert FoodCatalogItem.objects.count() == count

    client: APIClient = catalog_env["client"]
    tenant: Tenant = catalog_env["tenant"]

    res = client.get("/api/v1/menu/catalog/?q=Idli&food_type=VEG")
    assert res.status_code == 200
    data = res.json()
    assert data["count"] >= 1
    first = next((row for row in data["results"] if row["name"] == "Idli"), data["results"][0])
    assert isinstance(first["image_card"], str)
    assert isinstance(first["image_thumb"], str)

    add_res = client.post(
        f"/api/v1/menu/catalog/{first['id']}/add-to-menu/",
        {"base_price_paise": 4500},
        format="json",
    )
    assert add_res.status_code == 201
    created = add_res.json()
    assert created["name"] == first["name"]
    assert created["base_price_paise"] == 4500
    assert created["image_card"] == first["image_card"]
    assert MenuCategory.objects.filter(tenant=tenant, name=first["main_category"]).exists()
    assert MenuItem.objects.filter(tenant=tenant, name=first["name"]).count() == 1

    # Adding the same item again returns existing 200 without duplicating
    dup_res = client.post(
        f"/api/v1/menu/catalog/{first['id']}/add-to-menu/",
        {"base_price_paise": 5000},
        format="json",
    )
    assert dup_res.status_code == 200
    assert MenuItem.objects.filter(tenant=tenant, name=first["name"]).count() == 1
