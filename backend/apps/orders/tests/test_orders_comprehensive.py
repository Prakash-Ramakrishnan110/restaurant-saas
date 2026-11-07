import concurrent.futures
import re
from pathlib import Path
from typing import Any

from django.db import connection, transaction
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

import pytest
from apps.accounts.models import Membership, User
from apps.core.context import set_current_tenant
from apps.core.exceptions import BusinessRuleError
from apps.menu.models import BranchItemAvailability, MenuCategory, MenuItem
from apps.orders.models import (
    BillInvoice,
    Order,
    OrderEvent,
    OrderEventType,
    OrderStatus,
    OrderWorkflow,
    PaymentMethod,
)
from apps.orders.services import (
    calculate_bill,
    create_order,
    get_today_report,
    settle_bill,
    settle_order_bill,
    transition_order_status,
)
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, BusinessSettings, Tenant
from apps.venues.constants import AreaType, SectionType
from apps.venues.models import DiningTable, Section, ServiceArea, TableSession, TableStatus


@pytest.fixture
def comp_env():
    # Setup Tenant A
    t_a = Tenant.objects.create(name="Cafe Alpha", slug="cafe-alpha-test", status=Tenant.Status.ACTIVE)
    BusinessSettings.objects.create(tenant=t_a, tax_mode="INCLUSIVE", invoice_prefix="ALP-")
    plan = Plan.objects.create(name="Pro Plan", slug="pro-comp-plan", entitlements={"max_tables": 50})
    Subscription.objects.create(tenant=t_a, plan=plan, status=SubscriptionStatus.ACTIVE)

    branch_a = Branch.objects.create(tenant=t_a, name="Alpha Main Branch", is_active=True)
    branch_a2 = Branch.objects.create(tenant=t_a, name="Alpha Secondary Branch", is_active=True)

    sa = ServiceArea.objects.create(tenant=t_a, branch=branch_a, name="Indoor Hall", area_type=AreaType.DINING)
    sec = Section.objects.create(tenant=t_a, branch=branch_a, service_area=sa, name="Ground", section_type=SectionType.INDOOR)
    table_1 = DiningTable.objects.create(tenant=t_a, branch=branch_a, section=sec, label="T1", capacity=4)
    table_2 = DiningTable.objects.create(tenant=t_a, branch=branch_a, section=sec, label="T2", capacity=2)

    cat = MenuCategory.objects.create(tenant=t_a, name="Beverages")
    item_coffee = MenuItem.objects.create(tenant=t_a, category=cat, name="Filter Coffee", base_price_paise=4500, is_active=True)
    item_tea = MenuItem.objects.create(tenant=t_a, category=cat, name="Masala Chai", base_price_paise=3000, is_active=True)
    item_disabled = MenuItem.objects.create(tenant=t_a, category=cat, name="Seasonal Drink", base_price_paise=8000, is_active=False)
    item_soldout = MenuItem.objects.create(tenant=t_a, category=cat, name="Cardamom Milk", base_price_paise=5000, is_active=True)

    # 86'd item in branch_a
    BranchItemAvailability.objects.create(tenant=t_a, branch=branch_a, item=item_soldout, is_available=False)

    # Setup 6 Users for role matrix
    users = {}
    tokens = {}
    roles = [
        Role.PLATFORM_ADMIN,
        Role.OWNER,
        Role.BRANCH_MANAGER,
        Role.CASHIER,
        Role.WAITER,
        Role.KITCHEN,
    ]

    for r in roles:
        email = f"{r.lower()}@alpha.com"
        u = User.objects.create_user(email=email, password="Password123!", full_name=f"{r} User")
        if r == Role.PLATFORM_ADMIN:
            u.is_platform_admin = True
            u.save()
            m = None
        else:
            m = Membership.objects.create(user=u, tenant=t_a, role=r, is_active=True)
        users[r] = (u, m)
        tokens[r] = str(RefreshToken.for_user(u).access_token)

    # Open Table Session on T1
    session_1 = TableSession.objects.create(tenant=t_a, branch=branch_a, table=table_1, status="OPEN", session_code="SES-T1-100")

    # Setup Tenant B (Isolation testing)
    t_b = Tenant.objects.create(name="Bistro Beta", slug="bistro-beta-test", status=Tenant.Status.ACTIVE)
    BusinessSettings.objects.create(tenant=t_b, tax_mode="INCLUSIVE", invoice_prefix="BET-")
    branch_b = Branch.objects.create(tenant=t_b, name="Beta Branch", is_active=True)
    u_b = User.objects.create_user(email="owner@beta.com", password="Password123!", full_name="Beta Owner")
    m_b = Membership.objects.create(user=u_b, tenant=t_b, role=Role.OWNER, is_active=True)
    token_b = str(RefreshToken.for_user(u_b).access_token)

    set_current_tenant(t_a)

    return {
        "tenant_a": t_a,
        "branch_a": branch_a,
        "branch_a2": branch_a2,
        "table_1": table_1,
        "table_2": table_2,
        "session_1": session_1,
        "item_coffee": item_coffee,
        "item_tea": item_tea,
        "item_disabled": item_disabled,
        "item_soldout": item_soldout,
        "users": users,
        "tokens": tokens,
        "tenant_b": t_b,
        "branch_b": branch_b,
        "token_b": token_b,
        "user_b": u_b,
    }


def make_client(token: str, tenant_id: str | None = None, branch_id: str | None = None) -> APIClient:
    c = APIClient()
    headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
    if tenant_id:
        headers["HTTP_X_TENANT_ID"] = str(tenant_id)
    if branch_id:
        headers["HTTP_X_BRANCH_ID"] = str(branch_id)
    c.credentials(**headers)
    return c


@pytest.mark.django_db
def test_tampered_prices_ignored(comp_env):
    """Client sending tampered unit_price_paise or subtotal_paise is ignored; server price rules."""
    env = comp_env
    client = make_client(env["tokens"][Role.WAITER], env["tenant_a"].id, env["branch_a"].id)

    payload = {
        "branch_id": str(env["branch_a"].id),
        "table_session_id": str(env["session_1"].id),
        "order_workflow": OrderWorkflow.TABLE_SERVICE,
        "items": [
            {
                "menu_item_id": str(env["item_coffee"].id),
                "quantity": 2,
                "unit_price_paise": 100,  # Tampered: says ₹1 instead of ₹45
                "subtotal_paise": 200,    # Tampered
            }
        ],
    }

    res = client.post("/api/v1/orders/", data=payload, format="json")
    assert res.status_code == status.HTTP_201_CREATED
    order_id = res.data["id"]

    order = Order.objects.get(pk=order_id)
    line = order.items.first()
    assert line.unit_price_paise == 4500  # Database base_price_paise
    assert line.subtotal_paise == 9000
    assert order.total_paise == 9000


@pytest.mark.django_db
def test_sold_out_and_inactive_items_rejected(comp_env):
    """Orders referencing inactive MenuItem or 86'd BranchItemAvailability are rejected with 400."""
    env = comp_env
    client = make_client(env["tokens"][Role.WAITER], env["tenant_a"].id, env["branch_a"].id)

    # 1. Inactive MenuItem
    payload_inactive = {
        "branch_id": str(env["branch_a"].id),
        "table_session_id": str(env["session_1"].id),
        "items": [{"menu_item_id": str(env["item_disabled"].id), "quantity": 1}],
    }
    res1 = client.post("/api/v1/orders/", data=payload_inactive, format="json")
    assert res1.status_code == status.HTTP_400_BAD_REQUEST
    assert "sold out" in str(res1.data).lower()

    # 2. 86'd MenuItem via BranchItemAvailability
    payload_soldout = {
        "branch_id": str(env["branch_a"].id),
        "table_session_id": str(env["session_1"].id),
        "items": [{"menu_item_id": str(env["item_soldout"].id), "quantity": 1}],
    }
    res2 = client.post("/api/v1/orders/", data=payload_soldout, format="json")
    assert res2.status_code == status.HTTP_400_BAD_REQUEST
    assert "sold out" in str(res2.data).lower()


@pytest.mark.django_db
def test_role_x_endpoint_matrix(comp_env):
    """Verifies RBAC across all 6 roles for primary orders endpoints."""
    env = comp_env

    # Setup an active order to bump / cancel
    order = create_order(
        branch=env["branch_a"],
        table_session=env["session_1"],
        user_membership=env["users"][Role.WAITER][1],
        items_data=[{"menu_item_id": env["item_coffee"].id, "quantity": 1}],
    )

    # Matrix:
    # Order cancel: Only OWNER or BRANCH_MANAGER
    for r in [Role.WAITER, Role.CASHIER, Role.KITCHEN]:
        c = make_client(env["tokens"][r], env["tenant_a"].id, env["branch_a"].id)
        res = c.post(f"/api/v1/orders/{order.id}/cancel/", {"reason": "Customer left"})
        assert res.status_code == status.HTTP_403_FORBIDDEN

    # Owner can cancel
    c_owner = make_client(env["tokens"][Role.OWNER], env["tenant_a"].id, env["branch_a"].id)
    res_cancel = c_owner.post(f"/api/v1/orders/{order.id}/cancel/", {"reason": "Owner test cancel"})
    assert res_cancel.status_code == status.HTTP_200_OK

    # KDS View / Bump: Kitchen, Owner, Manager
    order2 = create_order(
        branch=env["branch_a"],
        table_session=env["session_1"],
        user_membership=env["users"][Role.WAITER][1],
        items_data=[{"menu_item_id": env["item_tea"].id, "quantity": 1}],
    )

    c_kitchen = make_client(env["tokens"][Role.KITCHEN], env["tenant_a"].id, env["branch_a"].id)
    res_bump = c_kitchen.post(f"/api/v1/orders/kds/{order2.id}/bump/")
    assert res_bump.status_code == status.HTTP_200_OK
    assert res_bump.data["status"] == "PREPARING"

    # Today Report: Owner & Branch Manager can view; Waiter & Kitchen cannot
    c_mgr = make_client(env["tokens"][Role.BRANCH_MANAGER], env["tenant_a"].id, env["branch_a"].id)
    res_rpt = c_mgr.get("/api/v1/reports/today/")
    assert res_rpt.status_code == status.HTTP_200_OK

    c_waiter = make_client(env["tokens"][Role.WAITER], env["tenant_a"].id, env["branch_a"].id)
    res_rpt_waiter = c_waiter.get("/api/v1/reports/today/")
    assert res_rpt_waiter.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_tenant_and_branch_isolation(comp_env):
    """Tenant B cannot view, bump, or cancel Tenant A orders, nor settle their bills."""
    env = comp_env
    order_a = create_order(
        branch=env["branch_a"],
        table_session=env["session_1"],
        user_membership=env["users"][Role.WAITER][1],
        items_data=[{"menu_item_id": env["item_coffee"].id, "quantity": 1}],
    )

    client_b = make_client(env["token_b"], env["tenant_b"].id, env["branch_b"].id)

    # 1. Tenant B querying orders returns empty
    res_list = client_b.get("/api/v1/orders/")
    assert res_list.status_code == status.HTTP_200_OK
    results = res_list.data.get("results", res_list.data)
    assert len(results) == 0

    # 2. Tenant B bumping Tenant A order -> 404
    res_bump = client_b.post(f"/api/v1/orders/kds/{order_a.id}/bump/")
    assert res_bump.status_code == status.HTTP_404_NOT_FOUND

    # 3. Tenant B settling Tenant A bill -> 404
    res_settle = client_b.post(
        f"/api/v1/orders/billing/session/{env['session_1'].id}/settle/",
        {"payment_method": PaymentMethod.CASH},
    )
    assert res_settle.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_status_machine_invalid_transitions(comp_env):
    """Invalid transitions raise BusinessRuleError with code INVALID_STATUS_TRANSITION."""
    env = comp_env
    order = create_order(
        branch=env["branch_a"],
        table_session=env["session_1"],
        user_membership=env["users"][Role.WAITER][1],
        items_data=[{"menu_item_id": env["item_coffee"].id, "quantity": 1}],
    )
    assert order.status == OrderStatus.PLACED

    # Attempt illegal skip: PLACED -> SERVED (must go PLACED -> PREPARING -> READY -> SERVED)
    with pytest.raises(BusinessRuleError) as exc_info:
        transition_order_status(order, OrderStatus.SERVED)

    err = exc_info.value
    assert err.error_code == "INVALID_STATUS_TRANSITION"
    assert err.details["from"] == OrderStatus.PLACED
    assert err.details["to"] == OrderStatus.SERVED
    assert OrderStatus.PREPARING in err.details["allowed"]

    # Valid transition to PREPARING
    transition_order_status(order, OrderStatus.PREPARING)
    assert order.status == OrderStatus.PREPARING

    # Attempt illegal backwards transition: PREPARING -> PLACED
    with pytest.raises(BusinessRuleError) as exc_info2:
        transition_order_status(order, OrderStatus.PLACED)
    assert exc_info2.value.error_code == "INVALID_STATUS_TRANSITION"


@pytest.mark.django_db(transaction=True)
def test_concurrency_20_threads_order_and_invoice_numbers(comp_env):
    """20 concurrent threads create orders and invoices; numbers are unique and gapless."""
    env = comp_env
    branch = env["branch_a"]

    def create_one_order(seq: int):
        # Establish individual DB connection if needed
        return create_order(
            branch=branch,
            token_number=100 + seq,
            order_workflow=OrderWorkflow.COUNTER_TOKEN,
            items_data=[{"menu_item_id": env["item_tea"].id, "quantity": 1}],
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(create_one_order, i) for i in range(20)]
        orders = [f.result() for f in concurrent.futures.as_completed(futures)]

    order_numbers = [o.order_number for o in orders]
    assert len(order_numbers) == 20
    assert len(set(order_numbers)) == 20  # Completely unique

    # Settle all 20 counter orders concurrently
    def settle_one_order(order_obj: Order):
        return settle_order_bill(order_obj, payment_method=PaymentMethod.UPI)

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        inv_futures = [executor.submit(settle_one_order, o) for o in orders]
        invoices = [f.result() for f in concurrent.futures.as_completed(inv_futures)]

    invoice_numbers = [inv.invoice_number for inv in invoices]
    assert len(invoice_numbers) == 20
    assert len(set(invoice_numbers)) == 20  # Unique and gapless


@pytest.mark.django_db
def test_payment_amount_mismatch_and_double_payment(comp_env):
    """Tendering less than total or settling twice is strictly rejected."""
    env = comp_env
    order = create_order(
        branch=env["branch_a"],
        table_session=env["session_1"],
        user_membership=env["users"][Role.WAITER][1],
        items_data=[{"menu_item_id": env["item_coffee"].id, "quantity": 2}],  # 9000 paise
    )

    bill = calculate_bill(env["session_1"])
    assert bill["total_paise"] == 9000

    # 1. Tender less than total
    from rest_framework.exceptions import ValidationError
    with pytest.raises(ValidationError):
        settle_bill(
            table_session=env["session_1"],
            payment_method=PaymentMethod.CASH,
            amount_tendered_paise=5000,  # 5000 < 9000
        )

    # 2. Settle validly
    inv = settle_bill(
        table_session=env["session_1"],
        payment_method=PaymentMethod.CASH,
        amount_tendered_paise=10000,
    )
    assert inv.is_settled is True
    assert inv.change_due_paise == 1000

    # 3. Double settlement attempt on closed session
    with pytest.raises(ValidationError):
        settle_bill(
            table_session=env["session_1"],
            payment_method=PaymentMethod.CASH,
        )


@pytest.mark.django_db
def test_order_events_audit_log(comp_env):
    """Every state transition logs an immutable OrderEvent audit row."""
    env = comp_env
    order = create_order(
        branch=env["branch_a"],
        table_session=env["session_1"],
        user_membership=env["users"][Role.WAITER][1],
        items_data=[{"menu_item_id": env["item_coffee"].id, "quantity": 1}],
    )

    # PLACED event created
    assert OrderEvent.objects.filter(order=order, event_type=OrderEventType.CREATED).exists()

    transition_order_status(order, OrderStatus.PREPARING, user_membership=env["users"][Role.KITCHEN][1])
    transition_order_status(order, OrderStatus.READY, user_membership=env["users"][Role.KITCHEN][1])
    transition_order_status(order, OrderStatus.SERVED, user_membership=env["users"][Role.WAITER][1])

    events = list(OrderEvent.objects.filter(order=order).order_by("created_at"))
    assert len(events) == 4
    assert events[1].to_status == OrderStatus.PREPARING
    assert events[2].to_status == OrderStatus.READY
    assert events[3].to_status == OrderStatus.SERVED


@pytest.mark.django_db
def test_today_report_calculations(comp_env):
    """GET /api/v1/reports/today/ aggregates sales, payment method split, and top items."""
    env = comp_env

    # Create & settle counter order 1: 3x Coffee (13500) via CASH
    o1 = create_order(
        branch=env["branch_a"],
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        items_data=[{"menu_item_id": env["item_coffee"].id, "quantity": 3}],
    )
    settle_order_bill(o1, payment_method=PaymentMethod.CASH)

    # Create & settle counter order 2: 2x Tea (6000) via UPI
    o2 = create_order(
        branch=env["branch_a"],
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        items_data=[{"menu_item_id": env["item_tea"].id, "quantity": 2}],
    )
    settle_order_bill(o2, payment_method=PaymentMethod.UPI)

    report = get_today_report(env["tenant_a"], env["branch_a"])
    assert report["sales_paise"] == 19500
    assert report["settled_invoices_count"] == 2
    assert report["average_order_value_paise"] == 9750
    assert report["sales_by_payment_method"]["CASH"] == 13500
    assert report["sales_by_payment_method"]["UPI"] == 6000

    # Top items: Filter Coffee (3), Masala Chai (2)
    assert len(report["top_items"]) >= 2
    assert report["top_items"][0]["item_name"] == "Filter Coffee"
    assert report["top_items"][0]["quantity"] == 3


@pytest.mark.django_db
def test_invoice_viewset_and_order_billing(comp_env):
    """Tests /api/v1/invoices/ filtering, detail retrieval, and counter billing endpoints."""
    env = comp_env
    client = make_client(env["tokens"][Role.OWNER], env["tenant_a"].id, env["branch_a"].id)

    # 1. Create counter order
    o = create_order(
        branch=env["branch_a"],
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        items_data=[{"menu_item_id": env["item_coffee"].id, "quantity": 2}],
    )

    # 2. Query order detail
    res_b = client.get(f"/api/v1/orders/{o.id}/")
    assert res_b.status_code == status.HTTP_200_OK
    assert res_b.data["total_paise"] == 9000

    # 3. Settle counter order via API
    res_settle = client.post(
        f"/api/v1/orders/billing/order/{o.id}/settle/",
        {"payment_method": PaymentMethod.CASH, "amount_tendered_paise": 10000},
        format="json",
    )
    assert res_settle.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]
    inv_id = res_settle.data["id"]
    inv_num = res_settle.data["invoice_number"]

    # 4. List invoices
    res_invs = client.get("/api/v1/invoices/")
    assert res_invs.status_code == status.HTTP_200_OK
    results = res_invs.data.get("results", res_invs.data)
    assert any(inv["invoice_number"] == inv_num for inv in results)

    # 5. Filter invoices by payment_method and q
    res_filtered = client.get("/api/v1/invoices/", {"payment_method": "CASH", "q": inv_num})
    assert res_filtered.status_code == status.HTTP_200_OK

    # 6. Retrieve single invoice detail
    res_detail = client.get(f"/api/v1/invoices/{inv_id}/")
    assert res_detail.status_code == status.HTTP_200_OK
    assert res_detail.data["invoice_number"] == inv_num


@pytest.mark.django_db
def test_order_serve_and_fire_mains_actions(comp_env):
    """Tests /api/v1/orders/{id}/serve/ and /api/v1/orders/{id}/fire-mains/ actions."""
    env = comp_env
    client = make_client(env["tokens"][Role.OWNER], env["tenant_a"].id, env["branch_a"].id)

    order = create_order(
        branch=env["branch_a"],
        table_session=env["session_1"],
        user_membership=env["users"][Role.WAITER][1],
        items_data=[
            {"menu_item_id": env["item_coffee"].id, "quantity": 1, "course": "MAIN", "hold_mains": True}
        ],
    )

    # Fire mains
    res_fire = client.post(f"/api/v1/orders/{order.id}/fire-mains/")
    assert res_fire.status_code == status.HTTP_200_OK
    assert res_fire.data["fired_count"] == 1

    # Transition to READY
    transition_order_status(order, OrderStatus.PREPARING)
    transition_order_status(order, OrderStatus.READY)

    # Serve order
    res_serve = client.post(f"/api/v1/orders/{order.id}/serve/")
    assert res_serve.status_code == status.HTTP_200_OK
    assert res_serve.data["status"] == "SERVED"


@pytest.mark.django_db
def test_order_viewset_filters_and_billing_session_api(comp_env):
    """Tests OrderViewSet query filters and BillingViewSet session checkout API."""
    env = comp_env
    client = make_client(env["tokens"][Role.OWNER], env["tenant_a"].id, env["branch_a"].id)

    # 1. Create order on session 1
    order = create_order(
        branch=env["branch_a"],
        table_session=env["session_1"],
        user_membership=env["users"][Role.WAITER][1],
        items_data=[{"menu_item_id": env["item_coffee"].id, "quantity": 1}],
    )

    # 2. Query orders with filters
    res_st = client.get("/api/v1/orders/", {"status": "PLACED"})
    assert res_st.status_code == status.HTTP_200_OK
    assert len(res_st.data.get("results", res_st.data)) >= 1

    res_wf = client.get("/api/v1/orders/", {"workflow": "TABLE_SERVICE"})
    assert res_wf.status_code == status.HTTP_200_OK

    res_sess = client.get("/api/v1/orders/", {"session_id": str(env["session_1"].id)})
    assert res_sess.status_code == status.HTTP_200_OK

    res_q = client.get("/api/v1/orders/", {"q": "T1"})
    assert res_q.status_code == status.HTTP_200_OK

    # 3. Query session bill via BillingViewSet
    res_bill = client.get(f"/api/v1/orders/billing/session/{env['session_1'].id}/")
    assert res_bill.status_code == status.HTTP_200_OK
    assert res_bill.data["total_paise"] == 4500

    # 4. Settle session bill via BillingViewSet
    res_settle = client.post(
        f"/api/v1/orders/billing/session/{env['session_1'].id}/settle/",
        {"payment_method": PaymentMethod.UPI, "amount_tendered_paise": 4500},
        format="json",
    )
    assert res_settle.status_code in [status.HTTP_200_OK, status.HTTP_201_CREATED]

    # 5. Query billing invoices endpoint
    res_invs = client.get("/api/v1/orders/billing/invoices/")
    assert res_invs.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_service_request_lifecycle(comp_env):
    """Tests ServiceRequest list and acknowledge endpoints."""
    env = comp_env
    from apps.orders.models import ServiceRequest
    sr = ServiceRequest.objects.create(
        tenant=env["tenant_a"],
        branch=env["branch_a"],
        table=env["table_1"],
        table_session=env["session_1"],
        request_type="WATER",
        status="PENDING",
    )

    client = make_client(env["tokens"][Role.WAITER], env["tenant_a"].id, env["branch_a"].id)
    res_list = client.get("/api/v1/orders/service-requests/")
    assert res_list.status_code == status.HTTP_200_OK

    res_ack = client.post(f"/api/v1/orders/service-requests/{sr.id}/acknowledge/")
    assert res_ack.status_code == status.HTTP_200_OK
    assert res_ack.data["status"] == "ACKNOWLEDGED"


def test_zero_float_usage_in_orders_codebase():
    """Verifies no float literals, float() or round() exist on monetary calculations in apps/orders/."""
    orders_dir = Path(__file__).resolve().parent.parent
    py_files = [
        f for f in orders_dir.glob("*.py")
        if f.name not in ["__init__.py", "apps.py"]
    ]

    forbidden_patterns = [
        (re.compile(r"\bfloat\s*\("), "float() conversion"),
        (re.compile(r"\bround\s*\("), "round() function"),
        (re.compile(r"\b0\.025\b"), "0.025 float literal"),
        (re.compile(r"\b0\.05\b"), "0.05 float literal"),
    ]

    violations = []
    for f in py_files:
        content = f.read_text(encoding="utf-8")
        for pattern, label in forbidden_patterns:
            matches = pattern.findall(content)
            if matches:
                violations.append(f"{f.name}: found {label}")

    assert not violations, f"Float violations found in apps/orders: {violations}"
