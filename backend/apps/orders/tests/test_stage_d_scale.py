from decimal import Decimal
from typing import Any

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.core.context import set_current_tenant
from apps.inventory.constants import BaseUnit, InventoryCategory, InventoryItemType
from apps.inventory.models import InventoryItem, StockLevel, Supplier
from apps.inventory.services import post_stock_movement, record_wastage
from apps.menu.constants import FoodType
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import Customer
from apps.orders.services import create_invoice_refund, create_order, settle_bill
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
from apps.venues.constants import AreaType, SectionType
from apps.venues.models import DiningTable, Section, ServiceArea, TableSession


@pytest.fixture
def stage_d_env(db: Any) -> dict[str, Any]:
    tenant = Tenant.objects.create(
        name="Stage D Group",
        slug="stage-d-group",
        status=Tenant.Status.ACTIVE,
    )
    plan = Plan.objects.create(
        name="Enterprise Scale Plan",
        slug="enterprise-stage-d",
        price_paise=499900,
        entitlements={
            "max_branches": 10,
            "max_tables": 100,
            "inventory_core": True,
            "inventory_advanced": True,
        },
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    set_current_tenant(tenant)

    b1 = Branch.objects.create(tenant=tenant, name="Indiranagar Flagship")
    b2 = Branch.objects.create(tenant=tenant, name="Koramangala Express")

    owner = User.objects.create_user(
        email="owner@staged.test", password="Password123!", full_name="Stage D Owner"
    )
    owner_m = Membership.objects.create(tenant=tenant, user=owner, role=Role.OWNER, is_active=True)
    owner_m.branches.add(b1, b2)

    area = ServiceArea.objects.create(
        tenant=tenant, branch=b1, name="Main Dining", area_type=AreaType.DINING
    )
    sec = Section.objects.create(
        tenant=tenant,
        branch=b1,
        service_area=area,
        name="Floor 1",
        section_type=SectionType.INDOOR,
    )
    table = DiningTable.objects.create(
        tenant=tenant, branch=b1, section=sec, label="T-01", capacity=4
    )

    cat = MenuCategory.objects.create(tenant=tenant, name="Signature Mains")
    dish = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Biryani Royal",
        base_price_paise=40000,
        food_type=FoodType.NON_VEG,
        is_active=True,
    )

    supplier = Supplier.objects.create(
        tenant=tenant, name="Deccan Farms", contact_person="Karthik", phone="+919845012345"
    )
    rice = InventoryItem.objects.create(
        tenant=tenant,
        name="Aged Basmati Rice",
        item_type=InventoryItemType.INGREDIENT,
        base_unit=BaseUnit.GRAM,
        category=InventoryCategory.GRAINS_FLOUR,
        reorder_level=Decimal("500.000"),
        par_level=Decimal("1500.000"),
    )

    client = APIClient()
    tok = str(RefreshToken.for_user(owner).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {tok}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    return {
        "tenant": tenant,
        "b1": b1,
        "b2": b2,
        "owner": owner,
        "owner_m": owner_m,
        "table": table,
        "dish": dish,
        "supplier": supplier,
        "rice": rice,
        "client": client,
    }


@pytest.mark.django_db
def test_d1_multi_outlet_report_and_inter_branch_stock_transfers(
    stage_d_env: dict[str, Any],
) -> None:
    client: APIClient = stage_d_env["client"]
    b1: Branch = stage_d_env["b1"]
    b2: Branch = stage_d_env["b2"]
    rice: InventoryItem = stage_d_env["rice"]

    # 1. Seed 1000g rice at 100 paise/g on Branch 1 and 50g wastage on Branch 1
    post_stock_movement(
        branch=b1,
        item=rice,
        movement_type="OPENING",
        quantity=Decimal("1000.000"),
        unit_cost_paise=100,
        reason_code="OPENING",
        actor=stage_d_env["owner"],
    )
    record_wastage(
        branch=b1,
        item=rice,
        quantity=Decimal("50.000"),
        reason_code="SPOILED",
        actor=stage_d_env["owner"],
    )

    # 2. Settle a ₹400.00 invoice on Branch 1 and refund ₹100.00
    sess = TableSession.objects.create(
        tenant=stage_d_env["tenant"],
        branch=b1,
        table=stage_d_env["table"],
        guest_count=2,
        opened_by=stage_d_env["owner_m"],
        status="OPEN",
    )
    create_order(
        branch=b1,
        items_data=[{"menu_item_id": str(stage_d_env["dish"].id), "quantity": 1}],
        user_membership=stage_d_env["owner_m"],
        table_session=sess,
    )
    inv = settle_bill(table_session=sess, user_membership=stage_d_env["owner_m"])
    create_invoice_refund(
        invoice=inv,
        amount_paise=10000,
        reason_code="QUALITY_ISSUE",
        actor_membership=stage_d_env["owner_m"],
    )

    # 3. Verify Consolidated Multi-Outlet Report
    rep_res = client.get("/api/v1/reports/outlets/")
    assert rep_res.status_code == 200
    totals = rep_res.data["totals"]
    assert totals["gross_sales_paise"] == 40000
    assert totals["refunds_paise"] == 10000
    assert totals["net_sales_paise"] == 30000
    assert totals["wastage_paise"] == 5000  # 50g * 100 paise
    assert len(rep_res.data["outlets"]) == 2

    # 4. Create, Dispatch, and Receive an Inter-Branch Stock Transfer (300g from b1 -> b2)
    create_res = client.post(
        "/api/v1/inventory/transfers/",
        {
            "from_branch": str(b1.id),
            "to_branch": str(b2.id),
            "notes": "Evening prep rebalance",
            "lines": [{"item": str(rice.id), "quantity": "300.000"}],
        },
        format="json",
    )
    assert create_res.status_code == 201
    transfer_id = create_res.data["id"]
    assert create_res.data["status"] == "DRAFT"

    disp_res = client.post(f"/api/v1/inventory/transfers/{transfer_id}/dispatch/")
    assert disp_res.status_code == 200
    assert disp_res.data["status"] == "APPROVED"

    b1_level = StockLevel.objects.get(branch=b1, item=rice)
    assert b1_level.quantity == Decimal("650.000")  # 1000 - 50 - 300

    recv_res = client.post(f"/api/v1/inventory/transfers/{transfer_id}/receive/")
    assert recv_res.status_code == 200
    assert recv_res.data["status"] == "COMPLETED"

    b2_level = StockLevel.objects.get(branch=b2, item=rice)
    assert b2_level.quantity == Decimal("300.000")
    assert b2_level.weighted_avg_cost_paise == 100


@pytest.mark.django_db
def test_d2_purchase_orders_auto_draft_and_one_click_goods_receipt(
    stage_d_env: dict[str, Any],
) -> None:
    client: APIClient = stage_d_env["client"]
    b1: Branch = stage_d_env["b1"]
    rice: InventoryItem = stage_d_env["rice"]
    supplier: Supplier = stage_d_env["supplier"]

    # Seed 200g (below reorder_level=500g, par_level=1500g) at WAC 100 paise/g
    post_stock_movement(
        branch=b1,
        item=rice,
        movement_type="OPENING",
        quantity=Decimal("200.000"),
        unit_cost_paise=100,
        reason_code="OPENING",
        actor=stage_d_env["owner"],
    )

    # 1. Auto-draft PO from low stock
    draft_res = client.post(
        f"/api/v1/inventory/purchase-orders/auto-draft-low-stock/?branch_id={b1.id}",
        {"supplier": str(supplier.id)},
        format="json",
    )
    assert draft_res.status_code == 201
    po_id = draft_res.data["id"]
    assert draft_res.data["status"] == "DRAFT"
    assert Decimal(draft_res.data["lines"][0]["quantity_ordered"]) == Decimal("1300.000")

    # 2. Mark PO Sent
    send_res = client.post(f"/api/v1/inventory/purchase-orders/{po_id}/send/")
    assert send_res.status_code == 200
    assert send_res.data["status"] == "SENT"

    # 3. Convert to Goods Receipt with a +25% price jump (125 paise vs 100 paise WAC)
    recv_res = client.post(
        f"/api/v1/inventory/purchase-orders/{po_id}/receive/?branch_id={b1.id}",
        {
            "lines": [
                {
                    "item": str(rice.id),
                    "quantity_received": "1300.000",
                    "unit_cost_paise": 125,
                }
            ]
        },
        format="json",
    )
    assert recv_res.status_code == 200
    assert recv_res.data["purchase_order"]["status"] == "RECEIVED"
    assert len(recv_res.data["price_jump_alerts"]) == 1
    assert recv_res.data["price_jump_alerts"][0]["jump_percent"] == "25.0"

    lvl = StockLevel.objects.get(branch=b1, item=rice)
    assert lvl.quantity == Decimal("1500.000")


@pytest.mark.django_db
def test_d3_guest_loyalty_points_earn_redeem_and_consent_enforcement(
    stage_d_env: dict[str, Any],
) -> None:
    client: APIClient = stage_d_env["client"]
    b1: Branch = stage_d_env["b1"]

    consented_guest = Customer.objects.create(
        tenant=stage_d_env["tenant"],
        name="Priya Raman",
        phone="+919900112233",
        consent_given=True,
        loyalty_points=50,
    )
    no_consent_guest = Customer.objects.create(
        tenant=stage_d_env["tenant"],
        name="Anonymous Diner",
        phone="+919900998877",
        consent_given=False,
        loyalty_points=50,
    )

    # 1. Guest without consent cannot earn/redeem via loyalty endpoint
    bad_consent_res = client.post(
        f"/api/v1/customers/{no_consent_guest.id}/loyalty/",
        {"action": "REDEEM", "points": 10},
        format="json",
    )
    assert bad_consent_res.status_code == 400
    assert bad_consent_res.data["error"]["code"] == "CONSENT_REQUIRED"

    # 2. Cannot redeem more points than available balance
    over_redeem_res = client.post(
        f"/api/v1/customers/{consented_guest.id}/loyalty/",
        {"action": "REDEEM", "points": 999},
        format="json",
    )
    assert over_redeem_res.status_code == 400
    assert over_redeem_res.data["error"]["code"] == "INSUFFICIENT_LOYALTY_POINTS"

    # 3. Settle a ₹400.00 (40000 paise) bill redeeming 40 points (₹40.00 = 4000 paise discount)
    sess = TableSession.objects.create(
        tenant=stage_d_env["tenant"],
        branch=b1,
        table=stage_d_env["table"],
        guest_count=2,
        opened_by=stage_d_env["owner_m"],
        status="OPEN",
    )
    create_order(
        branch=b1,
        items_data=[{"menu_item_id": str(stage_d_env["dish"].id), "quantity": 1}],
        user_membership=stage_d_env["owner_m"],
        table_session=sess,
    )
    settle_res = client.post(
        f"/api/v1/orders/billing/session/{sess.id}/settle/",
        {
            "payment_method": "UPI",
            "customer_id": str(consented_guest.id),
            "redeem_loyalty_points": 40,
        },
        format="json",
    )
    assert settle_res.status_code == 201
    assert settle_res.data["discount_paise"] == 4000
    assert settle_res.data["total_paise"] == 36000

    consented_guest.refresh_from_db()
    # 50 - 40 redeemed + 3 earned (36000 // 10000) = 13 points
    assert consented_guest.loyalty_points == 13
    assert consented_guest.lifetime_points_earned == 3
    assert consented_guest.lifetime_points_redeemed == 40
