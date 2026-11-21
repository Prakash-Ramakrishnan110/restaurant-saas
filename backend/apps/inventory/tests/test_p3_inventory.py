from __future__ import annotations

import pathlib
import re
import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.core.context import set_current_tenant
from apps.inventory.constants import (
    BaseUnit,
    DeductionStatus,
    InventoryCategory,
    InventoryItemType,
    InventoryMode,
    PackagingMode,
    StockCountStatus,
    StockMovementType,
    WasteReason,
)
from apps.inventory.models import (
    InventoryItem,
    OrderLineStockDeduction,
    Recipe,
    RecipeLine,
    StockLevel,
    StockMovement,
    Supplier,
    UnitConversion,
)
from apps.inventory.services import (
    cancel_order_line_deduction,
    deduct_order_line,
    deduct_takeaway_packaging,
    get_or_create_default_location,
    post_stock_movement,
    rebuild_and_compare_stock_levels,
    round_paise,
    sanitize_csv_cell,
)
from apps.menu.models import ItemVariant, MenuCategory, MenuItem
from apps.orders.models import Order, OrderItem, OrderStatus, OrderWorkflow
from apps.subscriptions.models import Plan, Subscription, SubscriptionStatus
from apps.tenants.models import Branch, Tenant
from apps.tenants.services import create_tenant_with_defaults


def _client_for(user: User, tenant: Tenant) -> APIClient:
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )
    return client


@pytest.fixture
def inv_env() -> dict[str, Any]:
    tenant, owner, _ = create_tenant_with_defaults(
        name="Spice Vault Test",
        slug="spice-vault-test",
        owner_email="owner@spicevault.test",
        owner_full_name="Vault Owner",
    )
    owner.must_change_password = False
    owner.save(update_fields=["must_change_password"])
    set_current_tenant(tenant)
    branch = Branch.objects.create(tenant=tenant, name="Main Branch")
    plan = Plan.objects.create(
        name="Standard Test Plan",
        slug="standard-inv-test",
        price_paise=199900,
        entitlements={
            "inventory": True,
            "max_inventory_items": 500,
            "inventory_advanced": False,
        },
    )
    Subscription.objects.filter(tenant=tenant).delete()
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)

    roles: dict[str, APIClient] = {"OWNER": _client_for(owner, tenant)}
    for role in ["BRANCH_MANAGER", "INVENTORY_MANAGER", "KITCHEN", "CASHIER", "WAITER"]:
        u = User.objects.create_user(
            email=f"{role.lower()}@spicevault.test",
            password="Password123!",
            full_name=f"{role} User",
            is_active=True,
        )
        u.must_change_password = False
        u.save(update_fields=["must_change_password"])
        m = Membership.objects.create(tenant=tenant, user=u, role=role, is_active=True)
        m.branches.add(branch)
        roles[role] = _client_for(u, tenant)

    return {
        "tenant": tenant,
        "branch": branch,
        "owner": owner,
        "plan": plan,
        "clients": roles,
    }


@pytest.mark.django_db
def test_stock_movement_is_strictly_append_only_model_and_queryset(inv_env: dict[str, Any]) -> None:
    tenant = inv_env["tenant"]
    branch = inv_env["branch"]
    item = InventoryItem.unscoped.create(
        tenant=tenant, name="Paneer Block", base_unit=BaseUnit.GRAM
    )
    mv = post_stock_movement(
        branch=branch,
        item=item,
        movement_type=StockMovementType.OPENING,
        quantity=Decimal("1000.000"),
        unit_cost_paise=40,
    )

    with pytest.raises(PermissionError):
        mv.notes = "tampered"
        mv.save()

    with pytest.raises(PermissionError):
        mv.delete()

    with pytest.raises(PermissionError):
        StockMovement.unscoped.filter(pk=mv.pk).update(notes="tampered")

    with pytest.raises(PermissionError):
        StockMovement.unscoped.filter(pk=mv.pk).delete()


@pytest.mark.django_db
def test_stock_level_equals_sum_of_movements_and_rebuild_command(inv_env: dict[str, Any]) -> None:
    tenant = inv_env["tenant"]
    branch = inv_env["branch"]
    item = InventoryItem.unscoped.create(tenant=tenant, name="Milk", base_unit=BaseUnit.MILLILITER)
    post_stock_movement(
        branch=branch,
        item=item,
        movement_type=StockMovementType.OPENING,
        quantity=Decimal("2000.000"),
        unit_cost_paise=6,
    )
    post_stock_movement(
        branch=branch,
        item=item,
        movement_type=StockMovementType.WASTE,
        quantity=Decimal("-250.000"),
        reason_code=WasteReason.SPOILED,
    )

    res = rebuild_and_compare_stock_levels(tenant=tenant, apply=False)
    assert res["mismatch_count"] == 0

    # Artificially corrupt cached StockLevel and verify rebuild repairs it
    lvl = StockLevel.unscoped.get(branch=branch, item=item)
    lvl.quantity = Decimal("999.000")
    lvl.save(update_fields=["quantity"])

    res_drift = rebuild_and_compare_stock_levels(tenant=tenant, apply=False)
    assert res_drift["mismatch_count"] == 1

    call_command("rebuild_stock_levels", "--apply")
    lvl.refresh_from_db()
    assert lvl.quantity == Decimal("1750.000")


def test_decimal_rounding_half_up_and_csv_injection() -> None:
    assert round_paise(Decimal("12.5")) == 13
    assert round_paise(Decimal("12.499")) == 12
    assert round_paise(Decimal("100.5")) == 101
    assert sanitize_csv_cell("=SUM(A1:A2)") == "'=SUM(A1:A2)"
    assert sanitize_csv_cell("+cmd") == "'+cmd"
    assert sanitize_csv_cell("-100") == "'-100"
    assert sanitize_csv_cell("@evil") == "'@evil"
    assert sanitize_csv_cell("Paneer") == "Paneer"


@pytest.mark.django_db
def test_weighted_average_cost_and_unit_conversion_and_duplicate_invoice(
    inv_env: dict[str, Any],
) -> None:
    tenant = inv_env["tenant"]
    branch = inv_env["branch"]
    owner_client = inv_env["clients"]["OWNER"]

    supplier = Supplier.unscoped.create(tenant=tenant, name="Kaveri Dairy")
    item = InventoryItem.unscoped.create(
        tenant=tenant, name="Ghee", base_unit=BaseUnit.GRAM, reorder_level=Decimal("500.000")
    )
    UnitConversion.unscoped.create(
        tenant=tenant, item=item, unit_name="tin", factor_to_base=Decimal("5000.000000")
    )

    # First receipt: 1 kg (1000g) at 50000 paise -> 50 paise/g
    r1 = owner_client.post(
        "/api/v1/inventory/receipts/",
        {
            "branch_id": str(branch.id),
            "supplier": str(supplier.id),
            "supplier_invoice_number": "INV-1001",
            "lines": [
                {"item": str(item.id), "quantity": "1", "unit_name": "kg", "unit_cost_paise": 50000}
            ],
        },
        format="json",
    )
    assert r1.status_code == status.HTTP_201_CREATED

    # Duplicate invoice blocked with 409 unless confirmed
    r_dup = owner_client.post(
        "/api/v1/inventory/receipts/",
        {
            "branch_id": str(branch.id),
            "supplier": str(supplier.id),
            "supplier_invoice_number": "INV-1001",
            "lines": [
                {"item": str(item.id), "quantity": "1", "unit_name": "kg", "unit_cost_paise": 70000}
            ],
        },
        format="json",
    )
    assert r_dup.status_code == status.HTTP_409_CONFLICT

    # Confirmed second receipt: 1 kg (1000g) at 70000 paise -> WAC = (50000+70000)/2000 = 60 paise/g
    r2 = owner_client.post(
        "/api/v1/inventory/receipts/",
        {
            "branch_id": str(branch.id),
            "supplier": str(supplier.id),
            "supplier_invoice_number": "INV-1001",
            "confirm_duplicate": True,
            "lines": [
                {"item": str(item.id), "quantity": "1", "unit_name": "kg", "unit_cost_paise": 70000}
            ],
        },
        format="json",
    )
    assert r2.status_code == status.HTTP_201_CREATED
    lvl = StockLevel.unscoped.get(branch=branch, item=item)
    assert lvl.quantity == Decimal("2000.000")
    assert lvl.weighted_avg_cost_paise == 60


@pytest.mark.django_db
def test_recipe_scaling_variant_waste_cycle_rejection_and_deduction_idempotency(
    inv_env: dict[str, Any],
) -> None:
    tenant = inv_env["tenant"]
    branch = inv_env["branch"]
    owner_client = inv_env["clients"]["OWNER"]

    chicken = InventoryItem.unscoped.create(tenant=tenant, name="Chicken", base_unit=BaseUnit.GRAM)
    prep_a = InventoryItem.unscoped.create(
        tenant=tenant, name="Prep A", item_type=InventoryItemType.PREPARED, base_unit=BaseUnit.GRAM
    )
    prep_b = InventoryItem.unscoped.create(
        tenant=tenant, name="Prep B", item_type=InventoryItemType.PREPARED, base_unit=BaseUnit.GRAM
    )

    # Opening 5000g chicken
    post_stock_movement(
        branch=branch,
        item=chicken,
        movement_type=StockMovementType.OPENING,
        quantity=Decimal("5000.000"),
        unit_cost_paise=40,
    )

    # Self-cycle rejected
    r_self = owner_client.post(
        "/api/v1/inventory/recipes/",
        {
            "output_item": str(prep_a.id),
            "yield_portions": "1",
            "lines": [{"item": str(prep_a.id), "quantity_per_portion": "100"}],
        },
        format="json",
    )
    assert r_self.status_code == status.HTTP_400_BAD_REQUEST

    # Transitive cycle Prep A -> Prep B -> Prep A rejected
    r_ab = owner_client.post(
        "/api/v1/inventory/recipes/",
        {
            "output_item": str(prep_a.id),
            "yield_portions": "1",
            "lines": [{"item": str(prep_b.id), "quantity_per_portion": "100"}],
        },
        format="json",
    )
    assert r_ab.status_code == status.HTTP_201_CREATED
    r_ba = owner_client.post(
        "/api/v1/inventory/recipes/",
        {
            "output_item": str(prep_b.id),
            "yield_portions": "1",
            "lines": [{"item": str(prep_a.id), "quantity_per_portion": "100"}],
        },
        format="json",
    )
    assert r_ba.status_code == status.HTTP_400_BAD_REQUEST

    # Menu item with variant + 10% waste
    cat = MenuCategory.objects.create(tenant=tenant, name="Mains")
    dish = MenuItem.objects.create(
        tenant=tenant, category=cat, name="Chicken Curry", base_price_paise=30000
    )
    large = ItemVariant.objects.create(item=dish, name="Large", price_paise=45000)

    r_var = owner_client.post(
        "/api/v1/inventory/recipes/",
        {
            "menu_item": str(dish.id),
            "variant": str(large.id),
            "yield_portions": "1",
            "lines": [
                {"item": str(chicken.id), "quantity_per_portion": "200", "waste_percent": "10"}
            ],
        },
        format="json",
    )
    assert r_var.status_code == status.HTTP_201_CREATED

    order = Order.objects.create(
        tenant=tenant,
        branch=branch,
        order_workflow=OrderWorkflow.TABLE_SERVICE,
        status=OrderStatus.PREPARING,
    )
    line = OrderItem.objects.create(
        order=order,
        menu_item=dish,
        item_name=dish.name,
        variant_name="Large",
        quantity=2,
        unit_price_paise=45000,
        subtotal_paise=90000,
    )

    # First deduction: 2 * 200g * 1.10 = 440g
    d1 = deduct_order_line(line.id)
    assert d1 is not None and d1.status == DeductionStatus.COMPLETED
    # Idempotency: second call deducts nothing
    d2 = deduct_order_line(line.id)
    assert d2 is not None and d2.id == d1.id

    lvl = StockLevel.unscoped.get(branch=branch, item=chicken)
    assert lvl.quantity == Decimal("4560.000")

    # Cancel before preparing -> no waste; cancel after preparing -> WASTE movement
    cancel_order_line_deduction(line.id, was_preparing=False)
    lvl.refresh_from_db()
    assert lvl.quantity == Decimal("4560.000")

    cancel_order_line_deduction(line.id, was_preparing=True)
    lvl.refresh_from_db()
    assert lvl.quantity == Decimal("4120.000")
    assert StockMovement.unscoped.filter(
        branch=branch,
        movement_type=StockMovementType.WASTE,
        reason_code=WasteReason.CANCELLED_AFTER_COOKING,
    ).exists()


@pytest.mark.django_db
def test_twenty_orders_exact_deduction_and_takeaway_packaging_and_negative_stock(
    inv_env: dict[str, Any],
) -> None:
    tenant = inv_env["tenant"]
    branch = inv_env["branch"]

    flour = InventoryItem.unscoped.create(tenant=tenant, name="Flour", base_unit=BaseUnit.GRAM)
    box = InventoryItem.unscoped.create(
        tenant=tenant,
        name="Takeaway Box",
        item_type=InventoryItemType.PACKAGING,
        base_unit=BaseUnit.PIECE,
        packaging_mode=PackagingMode.PER_ORDER,
        packaging_quantity=Decimal("1.000"),
    )
    post_stock_movement(
        branch=branch,
        item=flour,
        movement_type=StockMovementType.OPENING,
        quantity=Decimal("1000.000"),
        unit_cost_paise=5,
    )
    post_stock_movement(
        branch=branch,
        item=box,
        movement_type=StockMovementType.OPENING,
        quantity=Decimal("10.000"),
        unit_cost_paise=300,
    )

    cat = MenuCategory.objects.create(tenant=tenant, name="Breads")
    naan = MenuItem.objects.create(tenant=tenant, category=cat, name="Naan", base_price_paise=6000)
    rec = Recipe.unscoped.create(tenant=tenant, menu_item=naan, yield_portions=Decimal("1.000"))
    RecipeLine.unscoped.create(
        tenant=tenant, recipe=rec, item=flour, quantity_per_portion=Decimal("100.000")
    )

    for _ in range(20):
        o = Order.objects.create(
            tenant=tenant,
            branch=branch,
            order_workflow=OrderWorkflow.COUNTER_TOKEN,
            status=OrderStatus.PREPARING,
        )
        oi = OrderItem.objects.create(
            order=o,
            menu_item=naan,
            item_name=naan.name,
            quantity=1,
            unit_price_paise=6000,
            subtotal_paise=6000,
        )
        deduct_order_line(oi.id)
        deduct_takeaway_packaging(o.id)

    # 1000 - 20*100 = -1000 (negative stock allowed and flagged)
    flour_lvl = StockLevel.unscoped.get(branch=branch, item=flour)
    box_lvl = StockLevel.unscoped.get(branch=branch, item=box)
    assert flour_lvl.quantity == Decimal("-1000.000")
    assert box_lvl.quantity == Decimal("-10.000")

    alerts_res = inv_env["clients"]["OWNER"].get(f"/api/v1/inventory/alerts/?branch_id={branch.id}")
    assert alerts_res.status_code == status.HTTP_200_OK
    assert alerts_res.data["summary"]["negative_stock_count"] >= 2


@pytest.mark.django_db
def test_count_approval_thresholds_cost_omission_and_role_matrix(inv_env: dict[str, Any]) -> None:
    tenant = inv_env["tenant"]
    branch = inv_env["branch"]
    clients = inv_env["clients"]

    item = InventoryItem.unscoped.create(
        tenant=tenant,
        name="Cardamom",
        base_unit=BaseUnit.GRAM,
        category=InventoryCategory.SPICES_MASALA,
    )
    post_stock_movement(
        branch=branch,
        item=item,
        movement_type=StockMovementType.OPENING,
        quantity=Decimal("1000.000"),
        unit_cost_paise=200,
    )

    # WAITER has zero inventory access
    assert (
        clients["WAITER"].get("/api/v1/inventory/items/").status_code == status.HTTP_403_FORBIDDEN
    )
    assert (
        clients["WAITER"].get("/api/v1/inventory/alerts/").status_code == status.HTTP_403_FORBIDDEN
    )

    # KITCHEN can view items, but cost fields are COMPLETELY OMITTED
    k_res = clients["KITCHEN"].get(f"/api/v1/inventory/items/?branch_id={branch.id}")
    assert k_res.status_code == status.HTTP_200_OK
    k_row = k_res.data["results"][0]
    assert "weighted_avg_cost_paise" not in k_row
    assert "stock_value_paise" not in k_row

    # OWNER sees cost fields
    o_res = clients["OWNER"].get(f"/api/v1/inventory/items/?branch_id={branch.id}")
    assert o_res.status_code == status.HTTP_200_OK
    o_row = o_res.data["results"][0]
    assert o_row["weighted_avg_cost_paise"] == 200
    assert o_row["stock_value_paise"] == 200000

    # Threshold check: adjustment > 50000 paise blocked for KITCHEN, allowed for OWNER
    big_adj_k = clients["KITCHEN"].post(
        f"/api/v1/inventory/items/{item.id}/quick-update/",
        {"branch_id": str(branch.id), "delta_quantity": "-500", "reason_code": "SPILL"},
        format="json",
    )
    assert big_adj_k.status_code == status.HTTP_403_FORBIDDEN

    # Stock count workflow: KITCHEN creates blind count & submits; KITCHEN cannot approve; OWNER approves
    c_res = clients["KITCHEN"].post(
        "/api/v1/inventory/counts/",
        {"branch_id": str(branch.id), "count_type": "FULL", "is_blind": True},
        format="json",
    )
    assert c_res.status_code == status.HTTP_201_CREATED
    count_id = c_res.data["id"]
    assert c_res.data["lines"][0]["expected_quantity"] is None

    s_res = clients["KITCHEN"].post(
        f"/api/v1/inventory/counts/{count_id}/submit/",
        {"lines": [{"item_id": str(item.id), "counted_quantity": "900", "reason": "Evaporation"}]},
        format="json",
    )
    assert s_res.status_code == status.HTTP_200_OK
    assert s_res.data["status"] == StockCountStatus.SUBMITTED

    a_k = clients["KITCHEN"].post(f"/api/v1/inventory/counts/{count_id}/approve/")
    assert a_k.status_code == status.HTTP_403_FORBIDDEN

    a_o = clients["OWNER"].post(f"/api/v1/inventory/counts/{count_id}/approve/")
    assert a_o.status_code == status.HTTP_200_OK
    assert a_o.data["status"] == StockCountStatus.APPROVED
    assert StockLevel.unscoped.get(branch=branch, item=item).quantity == Decimal("900.000")

    # Entitlement check: ADVANCED mode blocked when inventory_advanced=False
    adv_res = clients["OWNER"].patch(
        f"/api/v1/inventory/settings/?branch_id={branch.id}",
        {"mode": InventoryMode.ADVANCED},
        format="json",
    )
    assert adv_res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_isolation_query_count_500_items_and_failed_deduction_retry(
    inv_env: dict[str, Any],
) -> None:
    tenant_a = inv_env["tenant"]
    branch_a = inv_env["branch"]
    client_a = inv_env["clients"]["OWNER"]

    tenant_b, owner_b, _ = create_tenant_with_defaults(
        name="Other Kitchen B",
        slug="other-kitchen-b",
        owner_email="owner@otherb.test",
        owner_full_name="Owner B",
    )
    owner_b.must_change_password = False
    owner_b.save(update_fields=["must_change_password"])
    item_b = InventoryItem.unscoped.create(
        tenant=tenant_b, name="Secret B", base_unit=BaseUnit.GRAM
    )

    # Foreign ID in URL -> 404
    assert (
        client_a.get(f"/api/v1/inventory/items/{item_b.id}/").status_code
        == status.HTTP_404_NOT_FOUND
    )
    # Foreign ID in body -> 400 INVALID_REFERENCE identical to random UUID
    res_foreign = client_a.post(
        "/api/v1/inventory/wastage/",
        {
            "branch_id": str(branch_a.id),
            "item": str(item_b.id),
            "quantity": "10",
            "reason_code": "SPOILED",
        },
        format="json",
    )
    res_random = client_a.post(
        "/api/v1/inventory/wastage/",
        {
            "branch_id": str(branch_a.id),
            "item": str(uuid.uuid4()),
            "quantity": "10",
            "reason_code": "SPOILED",
        },
        format="json",
    )
    assert res_foreign.status_code == status.HTTP_400_BAD_REQUEST
    assert res_random.status_code == status.HTTP_400_BAD_REQUEST
    assert res_foreign.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_random.data["error"]["code"] == "INVALID_REFERENCE"

    # 500 items query-count test (constant queries, no N+1)
    loc_a = get_or_create_default_location(branch_a)
    bulk_items = [
        InventoryItem(tenant=tenant_a, name=f"Bulk Item {i:04d}", base_unit=BaseUnit.GRAM)
        for i in range(500)
    ]
    InventoryItem.unscoped.bulk_create(bulk_items)
    StockLevel.unscoped.bulk_create(
        [
            StockLevel(
                tenant=tenant_a,
                branch=branch_a,
                location=loc_a,
                item=it,
                quantity=Decimal("100.000"),
            )
            for it in bulk_items
        ]
    )
    with CaptureQueriesContext(connection) as ctx:
        res_list = client_a.get(f"/api/v1/inventory/items/?branch_id={branch_a.id}")
    assert res_list.status_code == status.HTTP_200_OK
    assert len(ctx) <= 15

    # Failed deduction shows in Stock Health and retry succeeds
    cat = MenuCategory.objects.create(tenant=tenant_a, name="TestCat")
    mi = MenuItem.objects.create(
        tenant=tenant_a, category=cat, name="TestDish", base_price_paise=10000
    )
    o = Order.objects.create(tenant=tenant_a, branch=branch_a, status=OrderStatus.PREPARING)
    oi = OrderItem.objects.create(
        order=o,
        menu_item=mi,
        item_name=mi.name,
        quantity=1,
        unit_price_paise=10000,
        subtotal_paise=10000,
    )
    failed = OrderLineStockDeduction.unscoped.create(
        tenant=tenant_a,
        branch=branch_a,
        order=o,
        order_line=oi,
        status=DeductionStatus.FAILED,
        error_message="Simulated transient error",
        attempts=1,
    )
    health_res = client_a.get(f"/api/v1/inventory/health/?branch_id={branch_a.id}")
    assert health_res.status_code == status.HTTP_200_OK
    assert len(health_res.data["failed_deductions"]) == 1

    retry_res = client_a.post(
        "/api/v1/inventory/health/",
        {"branch_id": str(branch_a.id), "deduction_id": str(failed.id)},
        format="json",
    )
    assert retry_res.status_code == status.HTTP_200_OK
    assert retry_res.data["status"] == DeductionStatus.COMPLETED


def test_static_scan_no_float_and_no_tax_words_in_inventory_app() -> None:
    inv_dir = pathlib.Path(__file__).resolve().parent.parent
    tax_pattern = re.compile(
        r"\b(gst|gstin|cgst|sgst|igst|vat|tax_rate|tax_paise)\b", re.IGNORECASE
    )
    float_pattern = re.compile(r"\bfloat\s*\(|FloatField")

    for py_file in inv_dir.rglob("*.py"):
        if "migrations" in py_file.parts or "tests" in py_file.parts:
            continue
        content = py_file.read_text(encoding="utf-8")
        assert not float_pattern.search(content), f"Prohibited float usage in {py_file}"
        assert not tax_pattern.search(content), f"Prohibited tax word in {py_file}"


@pytest.mark.django_db
def test_stage_a_endpoints_reports_paste_and_transfers(inv_env: dict[str, Any]) -> None:
    """Exercise Stage A inventory API endpoints, CSV reports, paste preview/apply, and transfers."""
    owner = inv_env["clients"]["OWNER"]
    kitchen = inv_env["clients"]["KITCHEN"]
    branch = inv_env["branch"]

    # 1. Locations, suppliers, and items CRUD
    assert owner.get(f"/api/v1/inventory/locations/?branch_id={branch.id}").status_code == 200
    loc_create = owner.post(
        "/api/v1/inventory/locations/",
        {"branch": str(branch.id), "name": "Bar Store", "location_type": "BAR"},
        format="json",
    )
    assert loc_create.status_code == 201

    sup_res = owner.post(
        "/api/v1/inventory/suppliers/",
        {"name": "Fresh Farms", "phone": "9876543210"},
        format="json",
    )
    assert sup_res.status_code == 201
    sup_id = sup_res.data["id"]

    sup_upd = owner.patch(
        f"/api/v1/inventory/suppliers/{sup_id}/",
        {"phone": "9999999999"},
        format="json",
    )
    assert sup_upd.status_code == 200

    item_res = owner.post(
        "/api/v1/inventory/items/",
        {
            "branch_id": str(branch.id),
            "name": "Green Peas",
            "name_ta": "பட்டாணி",
            "base_unit": BaseUnit.GRAM,
            "category": InventoryCategory.PRODUCE,
            "reorder_level": "500.000",
            "par_level": "2000.000",
            "opening_quantity": "1000.000",
            "opening_unit_cost_paise": 15,
            "default_supplier": sup_id,
        },
        format="json",
    )
    assert item_res.status_code == 201
    item_id = item_res.data["id"]

    assert (
        owner.get(
            f"/api/v1/inventory/items/?branch_id={branch.id}&category=PRODUCE&item_type=INGREDIENT&search=Peas"
        ).status_code
        == 200
    )
    assert (
        owner.patch(
            f"/api/v1/inventory/items/{item_id}/",
            {"reorder_level": "600.000"},
            format="json",
        ).status_code
        == 200
    )

    # Quick update + conversions + spreadsheet paste preview & apply
    conv_res = owner.post(
        f"/api/v1/inventory/items/{item_id}/conversions/",
        {"unit_name": "kg", "factor_to_base": "1000.000"},
        format="json",
    )
    assert conv_res.status_code == 201

    qu_res = owner.post(
        f"/api/v1/inventory/items/{item_id}/quick-update/",
        {"branch_id": str(branch.id), "delta_quantity": "250", "reason_code": "COUNT_ADJUST"},
        format="json",
    )
    assert qu_res.status_code == 201

    paste_preview = owner.post(
        "/api/v1/inventory/items/paste-preview/",
        {
            "raw_text": (
                "name\tqty\tunit\tcost\n"
                "Red Chilli\t500\tg\t100\n"
                "BadQty\tabc\tg\t10\n"
                "BadUnit\t10\tbox\t10\n"
                "BadCost\t10\tkg\t-5\n"
                "ShortRow\t10\n"
            )
        },
        format="json",
    )
    assert paste_preview.status_code == 200
    assert len(paste_preview.data["rows"]) == 1
    assert paste_preview.data["error_count"] == 4

    paste_apply = owner.post(
        "/api/v1/inventory/items/paste-apply/",
        {
            "branch_id": str(branch.id),
            "raw_text": "Red Chilli\t500\tg\t100",
        },
        format="json",
    )
    assert paste_apply.status_code == 201

    # 2. Goods Receipt, Wastage, Movements, PO, Settings, Alerts
    grn_res = owner.post(
        "/api/v1/inventory/receipts/",
        {
            "branch_id": str(branch.id),
            "supplier": sup_id,
            "reference_number": "INV-STAGEA-001",
            "lines": [
                {
                    "item": item_id,
                    "quantity": "1000",
                    "unit_name": BaseUnit.GRAM,
                    "unit_cost_paise": 20,
                }
            ],
        },
        format="json",
    )
    assert grn_res.status_code == 201
    assert owner.get(f"/api/v1/inventory/receipts/?branch_id={branch.id}").status_code == 200

    waste_res = owner.post(
        "/api/v1/inventory/wastage/",
        {
            "branch_id": str(branch.id),
            "item": item_id,
            "quantity": "50",
            "reason_code": "SPOILED",
            "notes": "Damaged",
        },
        format="json",
    )
    assert waste_res.status_code == 201
    assert owner.get(f"/api/v1/inventory/wastage/?branch_id={branch.id}").status_code == 200
    assert (
        owner.get(
            f"/api/v1/inventory/movements/?branch_id={branch.id}&item_id={item_id}"
        ).status_code
        == 200
    )

    po_res = owner.post(
        "/api/v1/inventory/purchase-orders/",
        {
            "branch": str(branch.id),
            "order_number": "PO-STAGEA-001",
            "supplier": sup_id,
            "notes": "Weekly order",
        },
        format="json",
    )
    assert po_res.status_code == 201

    assert owner.get(f"/api/v1/inventory/settings/?branch_id={branch.id}").status_code == 200
    assert (
        owner.patch(
            f"/api/v1/inventory/settings/?branch_id={branch.id}",
            {"auto_sold_out": True},
            format="json",
        ).status_code
        == 200
    )
    assert owner.get(f"/api/v1/inventory/alerts/?branch_id={branch.id}").status_code == 200

    # 3. Recipe create & partial_update + All 5 reports (JSON + CSV, date filters, Kitchen without costs)
    prep_res = owner.post(
        "/api/v1/inventory/items/",
        {
            "branch_id": str(branch.id),
            "name": "Pea Puree",
            "item_type": InventoryItemType.PREPARED,
            "base_unit": BaseUnit.GRAM,
            "category": InventoryCategory.PREPARED,
        },
        format="json",
    )
    assert prep_res.status_code == 201
    prep_id = prep_res.data["id"]

    rec_res = owner.post(
        "/api/v1/inventory/recipes/",
        {
            "output_item": prep_id,
            "yield_portions": "500",
            "preparation_instructions": "Blend peas",
            "lines": [{"item": item_id, "quantity_per_portion": "500", "waste_percent": "2"}],
        },
        format="json",
    )
    assert rec_res.status_code == 201
    rec_id = rec_res.data["id"]

    rec_upd = owner.patch(
        f"/api/v1/inventory/recipes/{rec_id}/",
        {
            "yield_portions": "600",
            "preparation_instructions": "Blend peas finely",
            "lines": [{"item": item_id, "quantity_per_portion": "550", "waste_percent": "3"}],
        },
        format="json",
    )
    assert rec_upd.status_code == 200

    for rpt in ("stock-on-hand", "movements", "low-stock", "wastage", "usage"):
        j_res = owner.get(
            f"/api/v1/inventory/reports/{rpt}/?branch_id={branch.id}&date_from=2020-01-01&date_to=2030-12-31&item_id={item_id}"
        )
        assert j_res.status_code == 200
        c_res = owner.get(f"/api/v1/inventory/reports/{rpt}/?branch_id={branch.id}&export=csv")
        assert c_res.status_code == 200
        k_res = kitchen.get(f"/api/v1/inventory/reports/{rpt}/?branch_id={branch.id}")
        assert k_res.status_code == 200
        kc_res = kitchen.get(f"/api/v1/inventory/reports/{rpt}/?branch_id={branch.id}&export=csv")
        assert kc_res.status_code == 200

    assert owner.get(f"/api/v1/inventory/reports/unknown/?branch_id={branch.id}").status_code == 404
    assert owner.get(f"/api/v1/inventory/counts/?branch_id={branch.id}").status_code == 200
    assert owner.get(f"/api/v1/inventory/recipes/?menu_item={uuid.uuid4()}").status_code == 200
    assert (
        owner.post(
            "/api/v1/inventory/health/",
            {"branch_id": str(branch.id)},
            format="json",
        ).status_code
        == 404
    )
    assert (
        owner.post(
            "/api/v1/inventory/health/",
            {"branch_id": str(branch.id), "deduction_id": str(uuid.uuid4())},
            format="json",
        ).status_code
        == 404
    )

    from django.core.management import call_command

    call_command("rebuild_stock_levels", "--apply")

    # 4. Celery tasks wrapper coverage
    from apps.inventory.tasks import (
        cancel_order_line_deduction_task,
        deduct_order_line_stock_task,
        deduct_takeaway_packaging_task,
    )

    assert deduct_order_line_stock_task(str(uuid.uuid4()), str(inv_env["tenant"].id)) == "SKIPPED"
    assert deduct_takeaway_packaging_task(str(uuid.uuid4()), str(inv_env["tenant"].id)) == 0
    assert (
        cancel_order_line_deduction_task(str(uuid.uuid4()), False, str(inv_env["tenant"].id))
        == "OK"
    )
