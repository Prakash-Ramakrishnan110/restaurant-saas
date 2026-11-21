from typing import Any

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.core.context import set_current_tenant
from apps.menu.constants import FoodType
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import ShiftStatus
from apps.orders.services import create_order, settle_bill
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
from apps.venues.constants import AreaType, SectionType, TableStatus
from apps.venues.models import DiningTable, Section, ServiceArea, TableSession


@pytest.fixture
def stage_b_env(db: Any) -> dict[str, Any]:
    tenant = Tenant.objects.create(
        name="Stage B Bistro",
        slug="stage-b-bistro",
        status=Tenant.Status.ACTIVE,
    )
    plan = Plan.objects.create(
        name="Pro Plan",
        slug="pro-stage-b",
        price_paise=299900,
        entitlements={"max_branches": 5, "max_tables": 50, "table_merge": True},
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    set_current_tenant(tenant)
    branch = Branch.objects.create(tenant=tenant, name="Main Branch")
    area = ServiceArea.objects.create(
        tenant=tenant, branch=branch, name="Main Hall", area_type=AreaType.DINING
    )
    sec = Section.objects.create(
        tenant=tenant,
        branch=branch,
        service_area=area,
        name="Ground",
        section_type=SectionType.INDOOR,
    )
    t1 = DiningTable.objects.create(
        tenant=tenant, branch=branch, section=sec, label="T1", capacity=4
    )
    t2 = DiningTable.objects.create(
        tenant=tenant, branch=branch, section=sec, label="T2", capacity=4
    )
    t3 = DiningTable.objects.create(
        tenant=tenant, branch=branch, section=sec, label="T3", capacity=4
    )

    cat = MenuCategory.objects.create(tenant=tenant, name="Mains")
    dish1 = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Paneer Butter Masala",
        base_price_paise=30000,
        food_type=FoodType.VEG,
    )
    dish2 = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Garlic Naan",
        base_price_paise=10000,
        food_type=FoodType.VEG,
    )

    clients: dict[str, APIClient] = {}
    memberships: dict[str, Membership] = {}
    for role in (Role.OWNER, Role.BRANCH_MANAGER, Role.CASHIER, Role.WAITER):
        u = User.objects.create_user(
            email=f"{role.lower()}@stageb.test",
            password="Password123!",
            full_name=f"StageB {role}",
        )
        m = Membership.objects.create(user=u, tenant=tenant, role=role, is_active=True)
        m.branches.add(branch)
        memberships[role] = m
        c = APIClient()
        tok = str(RefreshToken.for_user(u).access_token)
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}", HTTP_X_TENANT_ID=str(tenant.id))
        clients[role] = c

    return {
        "tenant": tenant,
        "branch": branch,
        "t1": t1,
        "t2": t2,
        "t3": t3,
        "dish1": dish1,
        "dish2": dish2,
        "clients": clients,
        "memberships": memberships,
    }


@pytest.mark.django_db
def test_shift_blind_count_movements_variance_reason_and_lock(stage_b_env: dict[str, Any]) -> None:
    cashier = stage_b_env["clients"][Role.CASHIER]
    branch = stage_b_env["branch"]

    # 1. Open/fetch current shift -> expected_cash_paise and cash_variance_paise must be hidden (None)
    cur_res = cashier.get(f"/api/v1/orders/shifts/current/?branch_id={branch.id}")
    assert cur_res.status_code == 200
    shift_id = cur_res.data["id"]
    assert cur_res.data["status"] == ShiftStatus.OPEN
    assert cur_res.data["is_locked"] is False
    assert cur_res.data["expected_cash_paise"] is None
    assert cur_res.data["cash_variance_paise"] is None

    # 2. Record FLOAT_IN, CASH_DROP, and PETTY_CASH_OUT
    mv_in = cashier.post(
        f"/api/v1/orders/shifts/{shift_id}/cash-movements/",
        {"movement_type": "FLOAT_IN", "amount_paise": 50000, "reason": "Morning float top-up"},
        format="json",
    )
    assert mv_in.status_code == 201

    mv_drop = cashier.post(
        f"/api/v1/orders/shifts/{shift_id}/cash-movements/",
        {"movement_type": "CASH_DROP", "amount_paise": 30000, "reason": "Safe drop #1"},
        format="json",
    )
    assert mv_drop.status_code == 201

    mv_petty = cashier.post(
        f"/api/v1/orders/shifts/{shift_id}/cash-movements/",
        {"movement_type": "PETTY_CASH_OUT", "amount_paise": 10000, "reason": "Ice purchase"},
        format="json",
    )
    assert mv_petty.status_code == 201

    # Expected cash = 200000 (opening) + 50000 (in) - 40000 (out) = 210000 paise.
    # 3. Closing with large variance (150000 vs 210000 -> -60000 > 10000 threshold) without reason fails
    fail_close = cashier.post(
        f"/api/v1/orders/shifts/{shift_id}/close/",
        {"actual_cash_paise": 150000},
        format="json",
    )
    assert fail_close.status_code == 400
    assert fail_close.data["error"]["code"] == "VARIANCE_REASON_REQUIRED"

    # 4. Closing with compulsory reason code succeeds, reveals expected & variance, and locks shift
    ok_close = cashier.post(
        f"/api/v1/orders/shifts/{shift_id}/close/",
        {
            "actual_cash_paise": 150000,
            "variance_reason_code": "CHANGE_ERROR",
            "denominations_snapshot": {"500": 3},
            "notes": "Verified drawer count",
        },
        format="json",
    )
    assert ok_close.status_code == 200
    assert ok_close.data["status"] == ShiftStatus.CLOSED
    assert ok_close.data["is_locked"] is True
    assert ok_close.data["expected_cash_paise"] == 210000
    assert ok_close.data["cash_variance_paise"] == -60000
    assert ok_close.data["variance_reason_code"] == "CHANGE_ERROR"

    # 5. Attempting backdated cash movement or re-closing locked shift fails with SHIFT_LOCKED
    locked_mv = cashier.post(
        f"/api/v1/orders/shifts/{shift_id}/cash-movements/",
        {"movement_type": "CASH_DROP", "amount_paise": 5000, "reason": "Late drop"},
        format="json",
    )
    assert locked_mv.status_code == 400
    assert locked_mv.data["error"]["code"] == "SHIFT_LOCKED"

    locked_close = cashier.post(
        f"/api/v1/orders/shifts/{shift_id}/close/",
        {"actual_cash_paise": 210000},
        format="json",
    )
    assert locked_close.status_code == 400
    assert locked_close.data["error"]["code"] == "SHIFT_LOCKED"

    assert cashier.get(f"/api/v1/orders/shifts/?branch_id={branch.id}").status_code == 200


@pytest.mark.django_db
def test_partial_refunds_immutability_cumulative_limit_threshold_and_reports(
    stage_b_env: dict[str, Any],
) -> None:
    owner = stage_b_env["clients"][Role.OWNER]
    cashier = stage_b_env["clients"][Role.CASHIER]
    branch = stage_b_env["branch"]
    t1 = stage_b_env["t1"]
    dish1 = stage_b_env["dish1"]  # 30000 paise
    dish2 = stage_b_env["dish2"]  # 10000 paise

    # Open shift so CASH refund also logs REFUND_CASH_OUT movement
    cashier.get(f"/api/v1/orders/shifts/current/?branch_id={branch.id}")

    session = TableSession.objects.create(
        tenant=branch.tenant, branch=branch, table=t1, status="OPEN", guest_count=2
    )
    create_order(
        branch=branch,
        items_data=[
            {"menu_item_id": dish1.id, "quantity": 2},  # 60000
            {"menu_item_id": dish2.id, "quantity": 2},  # 20000
        ],
        user_membership=stage_b_env["memberships"][Role.WAITER],
        table_session=session,
    )
    invoice = settle_bill(
        table_session=session,
        payment_method="CASH",
        amount_tendered_paise=80000,
        user_membership=stage_b_env["memberships"][Role.CASHIER],
    )
    assert invoice.total_paise == 80000

    # 1. Cashier issues ₹200.00 (20000 paise <= 50000 threshold) refund
    r1 = cashier.post(
        f"/api/v1/orders/invoices/{invoice.id}/refunds/",
        {
            "amount_paise": 20000,
            "reason_code": "QUALITY_ISSUE",
            "restock_action": "WASTE",
            "notes": "Naan burnt",
        },
        format="json",
    )
    assert r1.status_code == 201
    assert r1.data["amount_paise"] == 20000
    assert r1.data["refund_number"].startswith("RFD-")

    # Verify BillInvoice.total_paise is NEVER mutated
    invoice.refresh_from_db()
    assert invoice.total_paise == 80000
    assert invoice.refunded_paise == 20000
    assert invoice.net_total_paise == 60000

    # 2. Cashier attempting ₹550.00 (55000 paise > 50000 threshold) refund is blocked with 403
    r_cashier_big = cashier.post(
        f"/api/v1/orders/invoices/{invoice.id}/refunds/",
        {"amount_paise": 55000, "reason_code": "ITEM_RETURNED"},
        format="json",
    )
    assert r_cashier_big.status_code == 403
    assert r_cashier_big.data["error"]["code"] == "MANAGER_APPROVAL_REQUIRED"

    # 3. Owner approves ₹550.00 (55000 paise) refund -> cumulative 75000 paise
    r2 = owner.post(
        f"/api/v1/orders/invoices/{invoice.id}/refunds/",
        {"amount_paise": 55000, "reason_code": "ITEM_RETURNED", "restock_action": "RESTOCK"},
        format="json",
    )
    assert r2.status_code == 201

    # 4. Refund exceeding remaining 5000 paise fails with 400 REFUND_EXCEEDS_TOTAL
    r_exceed = owner.post(
        f"/api/v1/orders/invoices/{invoice.id}/refunds/",
        {"amount_paise": 10000, "reason_code": "OVERCHARGED"},
        format="json",
    )
    assert r_exceed.status_code == 400
    assert r_exceed.data["error"]["code"] == "REFUND_EXCEEDS_TOTAL"

    # List refunds
    list_res = owner.get(f"/api/v1/orders/invoices/{invoice.id}/refunds/")
    assert list_res.status_code == 200
    assert len(list_res.data) == 2

    # 5. Today & Range reports show gross_sales_paise, refunds_paise, net_sales_paise
    today_rpt = owner.get(f"/api/v1/reports/today/?branch_id={branch.id}")
    assert today_rpt.status_code == 200
    assert today_rpt.data["gross_sales_paise"] == 80000
    assert today_rpt.data["refunds_paise"] == 75000
    assert today_rpt.data["net_sales_paise"] == 5000

    range_rpt = owner.get(f"/api/v1/reports/range/?branch_id={branch.id}")
    assert range_rpt.status_code == 200
    assert range_rpt.data["gross_sales_paise"] == 80000
    assert range_rpt.data["refunds_paise"] == 75000
    assert range_rpt.data["net_sales_paise"] == 5000


@pytest.mark.django_db
def test_split_bill_equal_shares_exact_paise_item_split_move_merge_and_transfer(
    stage_b_env: dict[str, Any],
) -> None:
    owner = stage_b_env["clients"][Role.OWNER]
    branch = stage_b_env["branch"]
    t1 = stage_b_env["t1"]
    t2 = stage_b_env["t2"]
    t3 = stage_b_env["t3"]
    dish2 = stage_b_env["dish2"]  # 10000 paise (₹100.00)

    t1.status = TableStatus.OCCUPIED
    t1.save(update_fields=["status"])
    t2.status = TableStatus.OCCUPIED
    t2.save(update_fields=["status"])

    s1 = TableSession.objects.create(
        tenant=branch.tenant, branch=branch, table=t1, status="OPEN", guest_count=3
    )
    s2 = TableSession.objects.create(
        tenant=branch.tenant, branch=branch, table=t2, status="OPEN", guest_count=2
    )

    ord1 = create_order(
        branch=branch,
        items_data=[
            {"menu_item_id": dish2.id, "quantity": 1},  # 10000
            {"menu_item_id": stage_b_env["dish1"].id, "quantity": 1},  # 30000
        ],
        user_membership=stage_b_env["memberships"][Role.WAITER],
        table_session=s1,
    )
    item_ids = [str(it.id) for it in ord1.items.all()]

    # 1. Equal 3-way split of 40000 paise -> [13334, 13333, 13333], sum == 40000
    eq_res = owner.post(
        f"/api/v1/orders/billing/session/{s1.id}/split-preview/",
        {"mode": "EQUAL", "shares": 3},
        format="json",
    )
    assert eq_res.status_code == 200
    splits = eq_res.data["splits"]
    assert [s["amount_paise"] for s in splits] == [13334, 13333, 13333]
    assert sum(s["amount_paise"] for s in splits) == 40000

    # 2. Item split preview
    it_res = owner.post(
        f"/api/v1/orders/billing/session/{s1.id}/split-preview/",
        {"mode": "ITEMS", "item_ids": [item_ids[0]]},
        format="json",
    )
    assert it_res.status_code == 200
    assert it_res.data["selected_paise"] + it_res.data["remaining_paise"] == 40000

    # 3. Move 1 item from s1 (T1) to s2 (T2)
    mv_res = owner.post(
        f"/api/v1/orders/billing/session/{s1.id}/move-items/",
        {"target_session_id": str(s2.id), "item_ids": [item_ids[0]]},
        format="json",
    )
    assert mv_res.status_code == 200
    assert mv_res.data["moved_count"] == 1

    # 4. Merge remaining s1 orders into s2 -> s1 becomes CLOSED and T1 becomes AVAILABLE
    merge_res = owner.post(
        f"/api/v1/orders/billing/session/{s1.id}/merge/",
        {"target_session_id": str(s2.id)},
        format="json",
    )
    assert merge_res.status_code == 200
    s1.refresh_from_db()
    t1.refresh_from_db()
    assert s1.status == "CLOSED"
    assert t1.status == TableStatus.AVAILABLE

    # 5. Transfer s2 from T2 to T3 via /api/v1/sessions/<id>/transfer/
    tr_res = owner.post(
        f"/api/v1/sessions/{s2.id}/transfer/",
        {"new_table_id": str(t3.id)},
        format="json",
    )
    assert tr_res.status_code == 200
    t2.refresh_from_db()
    t3.refresh_from_db()
    assert t2.status == TableStatus.AVAILABLE
    assert t3.status == TableStatus.OCCUPIED
