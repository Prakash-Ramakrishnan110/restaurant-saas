from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.core.context import set_current_tenant
from apps.inventory.constants import (
    IngredientCategory,
    PurchaseOrderStatus,
    StockTransactionType,
    UnitOfMeasure,
    WastageReason,
)
from apps.inventory.models import (
    Ingredient,
    Recipe,
    RecipeItem,
    StockTransaction,
    Supplier,
)
from apps.inventory.services import (
    deplete_stock_for_order,
)
from apps.menu.constants import FoodType
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import Order, OrderItem, OrderStatus, OrderWorkflow
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant

User = get_user_model()


@pytest.fixture
def inventory_env():
    tenant = Tenant.objects.create(
        name="Spice Garden", slug="spice-garden", status=Tenant.Status.ACTIVE
    )
    set_current_tenant(tenant)
    plan = Plan.objects.create(name="Pro", slug="pro", entitlements={})
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    branch = Branch.objects.create(tenant=tenant, name="Main Outlet")

    user = User.objects.create_user(
        email="inventory@spicegarden.com", password="Password123!", full_name="Inventory Lead"
    )
    membership = Membership.objects.create(
        user=user, tenant=tenant, role=Role.INVENTORY_MANAGER, is_active=True
    )

    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    client.defaults["HTTP_X_TENANT_ID"] = str(tenant.id)

    # Create Menu Category & Items
    cat = MenuCategory.objects.create(tenant=tenant, name="Main Course")
    biryani = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Chicken Biryani",
        base_price_paise=28000,
        food_type=FoodType.NON_VEG,
    )

    return {
        "tenant": tenant,
        "branch": branch,
        "user": user,
        "membership": membership,
        "client": client,
        "biryani": biryani,
    }


@pytest.mark.django_db
def test_supplier_crud(inventory_env):
    client = inventory_env["client"]
    tenant = inventory_env["tenant"]

    res = client.post(
        "/api/v1/inventory/suppliers/",
        {
            "name": "Metro Cash & Carry",
            "contact_person": "Ramesh Kumar",
            "phone": "9876543210",
            "email": "metro@supplies.com",
            "address": "Koyambedu Wholesale Market, Chennai",
            "gstin": "33AAAAA0000A1Z5",
        },
        format="json",
    )
    assert res.status_code == 201
    supplier_id = res.data["id"]

    supplier = Supplier.objects.get(id=supplier_id, tenant=tenant)
    assert supplier.name == "Metro Cash & Carry"
    assert supplier.contact_person == "Ramesh Kumar"

    # List
    list_res = client.get("/api/v1/inventory/suppliers/")
    assert list_res.status_code == 200
    assert len(list_res.data["results"]) == 1


@pytest.mark.django_db
def test_ingredient_crud_and_stock_adjustment(inventory_env):
    client = inventory_env["client"]
    tenant = inventory_env["tenant"]

    # 1. Create Basmati Rice
    res = client.post(
        "/api/v1/inventory/ingredients/",
        {
            "name": "Basmati Rice",
            "name_ta": "பாசுமதி அரிசி",
            "sku": "RIC-BAS-01",
            "category": IngredientCategory.DRY_GOODS,
            "unit": UnitOfMeasure.KG,
            "cost_paise": 12000,  # ₹120.00 / kg
            "current_stock": "50.000",
            "min_threshold": "10.000",
        },
        format="json",
    )
    assert res.status_code == 201
    ing_id = res.data["id"]

    rice = Ingredient.objects.get(id=ing_id, tenant=tenant)
    assert rice.cost_paise == 12000
    assert rice.current_stock == Decimal("50.000")
    assert rice.is_low_stock is False
    assert rice.stock_value_paise == 50 * 12000

    # 2. Adjust Stock down to 8 kg (below threshold)
    adj_res = client.post(
        f"/api/v1/inventory/ingredients/{ing_id}/adjust-stock/",
        {"new_stock": "8.000", "notes": "End of week cycle count"},
        format="json",
    )
    assert adj_res.status_code == 200
    assert adj_res.data["current_stock"] == "8.000"
    assert adj_res.data["is_low_stock"] is True

    # 3. Check Audit StockTransaction
    tx = StockTransaction.objects.filter(ingredient=rice).latest("created_at")
    assert tx.transaction_type == StockTransactionType.MANUAL_ADJUSTMENT
    assert tx.quantity_change == Decimal("-42.000")
    assert tx.balance_after == Decimal("8.000")


@pytest.mark.django_db
def test_recipe_formulation_and_cost_calculation(inventory_env):
    client = inventory_env["client"]
    tenant = inventory_env["tenant"]
    biryani = inventory_env["biryani"]

    # Create Ingredients
    rice = Ingredient.objects.create(
        tenant=tenant,
        name="Basmati Rice",
        unit=UnitOfMeasure.KG,
        cost_paise=10000,  # ₹100/kg
        current_stock=Decimal("100.000"),
    )
    chicken = Ingredient.objects.create(
        tenant=tenant,
        name="Fresh Chicken",
        unit=UnitOfMeasure.KG,
        cost_paise=22000,  # ₹220/kg
        current_stock=Decimal("50.000"),
    )

    # Create Recipe for Biryani: 0.200 kg Rice + 0.250 kg Chicken for 1 serving
    res = client.post(
        "/api/v1/inventory/recipes/",
        {
            "menu_item": str(biryani.id),
            "yield_servings": "1.00",
            "preparation_instructions": "Dum cooking for 45 minutes",
            "items": [
                {"ingredient": str(rice.id), "quantity": "0.200"},
                {"ingredient": str(chicken.id), "quantity": "0.250"},
            ],
        },
        format="json",
    )
    assert res.status_code == 201
    recipe_id = res.data["id"]

    recipe = Recipe.objects.get(id=recipe_id, tenant=tenant)
    assert recipe.items.count() == 2
    # Expected cost: 0.200 * 10000 (2000p) + 0.250 * 22000 (5500p) = 7500 paise (₹75.00)
    assert recipe.total_cost_paise == 7500


@pytest.mark.django_db
def test_purchase_order_receiving_and_cost_averaging(inventory_env):
    client = inventory_env["client"]
    tenant = inventory_env["tenant"]

    supplier = Supplier.objects.create(tenant=tenant, name="Fresh Farms Ltd")
    milk = Ingredient.objects.create(
        tenant=tenant,
        name="Full Cream Milk",
        unit=UnitOfMeasure.LITER,
        cost_paise=6000,  # ₹60.00 / L
        current_stock=Decimal("20.000"),
    )

    # Create Draft PO: 30 Liters @ ₹65.00 (6500 paise)
    res = client.post(
        "/api/v1/inventory/purchases/",
        {
            "order_number": "PO-2026-001",
            "supplier": str(supplier.id),
            "invoice_number": "INV-FF-8891",
            "items": [
                {
                    "ingredient": str(milk.id),
                    "quantity": "30.000",
                    "unit_price_paise": 6500,
                    "batch_number": "BATCH-NOV-01",
                }
            ],
        },
        format="json",
    )
    assert res.status_code == 201
    po_id = res.data["id"]
    assert res.data["total_cost_paise"] == 30 * 6500

    # Receive PO
    rec_res = client.post(f"/api/v1/inventory/purchases/{po_id}/receive/")
    assert rec_res.status_code == 200
    assert rec_res.data["status"] == PurchaseOrderStatus.RECEIVED

    milk.refresh_from_db()
    # 20L + 30L = 50L
    assert milk.current_stock == Decimal("50.000")
    # Weighted average: (20 * 6000 + 30 * 6500) / 50 = (120000 + 195000) / 50 = 315000 / 50 = 6300 paise
    assert milk.cost_paise == 6300


@pytest.mark.django_db
def test_wastage_logging(inventory_env):
    client = inventory_env["client"]
    tenant = inventory_env["tenant"]

    paneer = Ingredient.objects.create(
        tenant=tenant,
        name="Fresh Paneer",
        unit=UnitOfMeasure.KG,
        cost_paise=35000,  # ₹350.00 / kg
        current_stock=Decimal("10.000"),
    )

    # Log 2.5 kg expired paneer
    res = client.post(
        "/api/v1/inventory/wastage/",
        {
            "ingredient": str(paneer.id),
            "quantity": "2.500",
            "reason": WastageReason.EXPIRED,
            "notes": "Power outage in chiller",
        },
        format="json",
    )
    assert res.status_code == 201
    # Cost loss: 2.5 * 35000 = 87500 paise (₹875.00)
    assert res.data["cost_loss_paise"] == 87500

    paneer.refresh_from_db()
    assert paneer.current_stock == Decimal("7.500")


@pytest.mark.django_db
def test_recipe_depletion_on_order(inventory_env):
    tenant = inventory_env["tenant"]
    branch = inventory_env["branch"]
    biryani = inventory_env["biryani"]

    rice = Ingredient.objects.create(
        tenant=tenant,
        name="Basmati Rice",
        unit=UnitOfMeasure.KG,
        cost_paise=10000,
        current_stock=Decimal("50.000"),
    )
    recipe = Recipe.objects.create(tenant=tenant, menu_item=biryani, yield_servings=Decimal("1.00"))
    RecipeItem.objects.create(
        tenant=tenant, recipe=recipe, ingredient=rice, quantity=Decimal("0.200")
    )

    # Create Order for 3 Biryanis
    order = Order.objects.create(
        tenant=tenant,
        branch=branch,
        order_number="ORD-001",
        order_workflow=OrderWorkflow.TABLE_SERVICE,
        status=OrderStatus.PLACED,
    )
    OrderItem.objects.create(
        order=order,
        menu_item=biryani,
        item_name=biryani.name,
        quantity=3,
        unit_price_paise=biryani.base_price_paise,
        subtotal_paise=biryani.base_price_paise * 3,
    )

    # Deplete stock
    depleted = deplete_stock_for_order(order)
    assert depleted == 1

    rice.refresh_from_db()
    # 50.000 - (3 * 0.200) = 49.400 kg
    assert rice.current_stock == Decimal("49.400")


@pytest.mark.django_db
def test_low_stock_alerts_and_variance_report(inventory_env):
    client = inventory_env["client"]
    tenant = inventory_env["tenant"]

    # Low stock item
    onion = Ingredient.objects.create(
        tenant=tenant,
        name="Red Onions",
        category=IngredientCategory.VEGETABLE,
        unit=UnitOfMeasure.KG,
        cost_paise=4000,
        current_stock=Decimal("3.000"),
        min_threshold=Decimal("15.000"),
    )

    # 1. Low stock alerts
    alert_res = client.get("/api/v1/inventory/reports/low-stock/")
    assert alert_res.status_code == 200
    assert len(alert_res.data) >= 1
    item = next(a for a in alert_res.data if a["ingredient_id"] == str(onion.id))
    assert item["deficit"] == 12.0

    # 2. Variance report
    report_res = client.get("/api/v1/inventory/reports/variance/")
    assert report_res.status_code == 200
    assert "total_food_sales_paise" in report_res.data
    assert "food_cost_percentage" in report_res.data
    assert "ingredients_breakdown" in report_res.data
