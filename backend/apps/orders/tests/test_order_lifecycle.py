import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import OrderStatus, PaymentMethod
from apps.orders.services import calculate_bill, create_order, settle_bill, transfer_table_session
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, BusinessSettings, Tenant
from apps.venues.models import (
    AreaType,
    DiningTable,
    Section,
    SectionType,
    ServiceArea,
    TableSession,
    TableStatus,
)


@pytest.fixture
def orders_env():
    # Tenant A (Spice Garden)
    t_a = Tenant.objects.create(
        name="Spice Garden", slug="spice-garden-test", status=Tenant.Status.ACTIVE
    )
    BusinessSettings.objects.create(tenant=t_a, tax_mode="EXCLUSIVE")
    plan = Plan.objects.create(name="Pro", slug="pro-test", entitlements={"max_tables": 50})
    Subscription.objects.create(tenant=t_a, plan=plan, status=SubscriptionStatus.ACTIVE)
    b_a = Branch.objects.create(tenant=t_a, name="Indiranagar Branch", is_active=True)

    sa = ServiceArea.objects.create(
        tenant=t_a, branch=b_a, name="Dining Hall", area_type=AreaType.DINING
    )
    sec = Section.objects.create(
        tenant=t_a, branch=b_a, service_area=sa, name="AC Section", section_type=SectionType.INDOOR
    )
    table_1 = DiningTable.objects.create(
        tenant=t_a, branch=b_a, section=sec, label="T1", capacity=4
    )
    table_2 = DiningTable.objects.create(
        tenant=t_a, branch=b_a, section=sec, label="T2", capacity=4
    )

    u_owner = User.objects.create_user(
        email="owner@spice.com", password="Password123!", full_name="Owner Spice"
    )
    m_owner = Membership.objects.create(user=u_owner, tenant=t_a, role=Role.OWNER, is_active=True)

    u_waiter = User.objects.create_user(
        email="waiter@spice.com", password="Password123!", full_name="Waiter Spice"
    )
    m_waiter = Membership.objects.create(
        user=u_waiter, tenant=t_a, role=Role.WAITER, is_active=True
    )

    cat = MenuCategory.objects.create(tenant=t_a, name="Curries")
    item_curry = MenuItem.objects.create(
        tenant=t_a, category=cat, name="Butter Chicken", base_price_paise=35000, is_active=True
    )
    item_naan = MenuItem.objects.create(
        tenant=t_a, category=cat, name="Butter Naan", base_price_paise=5000, is_active=True
    )
    item_soldout = MenuItem.objects.create(
        tenant=t_a, category=cat, name="Seasonal Halwa", base_price_paise=15000, is_active=False
    )

    # Active Table Session on T1
    session = TableSession.objects.create(
        tenant=t_a, branch=b_a, table=table_1, status="OPEN", session_code="SES-T1-001"
    )

    # Tenant B for isolation test
    t_b = Tenant.objects.create(
        name="Other Tenant", slug="other-tenant-test", status=Tenant.Status.ACTIVE
    )
    Branch.objects.create(tenant=t_b, name="Other Branch", is_active=True)
    u_b = User.objects.create_user(
        email="user@other.com", password="Password123!", full_name="User B"
    )
    Membership.objects.create(user=u_b, tenant=t_b, role=Role.OWNER, is_active=True)

    from apps.core.context import set_current_tenant

    set_current_tenant(t_a)

    return {
        "tenant_a": t_a,
        "branch_a": b_a,
        "table_1": table_1,
        "table_2": table_2,
        "session": session,
        "owner": u_owner,
        "waiter": u_waiter,
        "m_owner": m_owner,
        "m_waiter": m_waiter,
        "item_curry": item_curry,
        "item_naan": item_naan,
        "item_soldout": item_soldout,
        "tenant_b": t_b,
        "user_b": u_b,
    }


@pytest.mark.django_db
def test_create_order_authoritative_pricing(orders_env):
    """Verifies orders use server-side database price in paise, never trusting client."""
    env = orders_env
    order = create_order(
        branch=env["branch_a"],
        table_session=env["session"],
        user_membership=env["m_waiter"],
        items_data=[
            {"menu_item_id": env["item_curry"].id, "quantity": 2, "course": "MAIN"},
            {"menu_item_id": env["item_naan"].id, "quantity": 3, "course": "MAIN"},
        ],
    )
    assert order.status == OrderStatus.PLACED
    assert order.items.count() == 2

    curry_item = order.items.get(menu_item=env["item_curry"])
    assert curry_item.unit_price_paise == 35000
    assert curry_item.subtotal_paise == 70000

    naan_item = order.items.get(menu_item=env["item_naan"])
    assert naan_item.unit_price_paise == 5000
    assert naan_item.subtotal_paise == 15000

    assert order.total_paise == 85000
    assert env["table_1"].status == TableStatus.OCCUPIED


@pytest.mark.django_db
def test_create_order_rejects_sold_out_item(orders_env):
    """Verifies that 86'd / unavailable items are strictly rejected with a validation error."""
    env = orders_env
    with pytest.raises(Exception) as excinfo:
        create_order(
            branch=env["branch_a"],
            table_session=env["session"],
            user_membership=env["m_waiter"],
            items_data=[
                {"menu_item_id": env["item_soldout"].id, "quantity": 1},
            ],
        )
    assert "sold out" in str(excinfo.value).lower()


@pytest.mark.django_db
def test_bill_calculation_and_pure_sum(orders_env):
    """Verifies bill calculation is authoritative sum of lines without tax pending accountant."""
    env = orders_env
    create_order(
        branch=env["branch_a"],
        table_session=env["session"],
        user_membership=env["m_waiter"],
        items_data=[
            {"menu_item_id": env["item_curry"].id, "quantity": 1},  # 35000
            {"menu_item_id": env["item_naan"].id, "quantity": 2},  # 10000
        ],
    )
    bill = calculate_bill(env["session"])
    assert bill["subtotal_paise"] == 45000
    assert bill["total_paise"] == 45000
    assert "tax" not in str(bill).lower()


@pytest.mark.django_db
def test_bill_settlement_and_table_turnover(orders_env):
    """Verifies settling a bill marks session CLOSED, creates invoice, and sets table AVAILABLE."""
    env = orders_env
    create_order(
        branch=env["branch_a"],
        table_session=env["session"],
        user_membership=env["m_waiter"],
        items_data=[
            {"menu_item_id": env["item_curry"].id, "quantity": 1},
        ],
    )
    invoice = settle_bill(
        table_session=env["session"],
        payment_method=PaymentMethod.CASH,
        amount_tendered_paise=40000,
        user_membership=env["m_owner"],
    )
    assert invoice.is_settled is True
    assert invoice.total_paise == 35000  # pure sum of lines, zero tax
    assert invoice.change_due_paise == 5000
    assert env["session"].status == "CLOSED"

    env["table_1"].refresh_from_db()
    assert env["table_1"].status == TableStatus.AVAILABLE


@pytest.mark.django_db
def test_table_transfer(orders_env):
    """Verifies moving an active dining session moves order anchor seamlessly to new table."""
    env = orders_env
    create_order(
        branch=env["branch_a"],
        table_session=env["session"],
        user_membership=env["m_waiter"],
        items_data=[{"menu_item_id": env["item_curry"].id, "quantity": 1}],
    )
    transferred_session = transfer_table_session(env["session"], env["table_2"])
    assert transferred_session.table is not None and transferred_session.table.label == "T2"

    env["table_1"].refresh_from_db()
    env["table_2"].refresh_from_db()
    assert env["table_1"].status == TableStatus.AVAILABLE
    assert env["table_2"].status == TableStatus.OCCUPIED


@pytest.mark.django_db
def test_kds_bump_action(orders_env):
    """Verifies kitchen bump transitions from PLACED -> PREPARING -> READY -> SERVED."""
    env = orders_env
    order = create_order(
        branch=env["branch_a"],
        table_session=env["session"],
        user_membership=env["m_waiter"],
        items_data=[{"menu_item_id": env["item_curry"].id, "quantity": 1}],
    )

    client = APIClient()
    token = str(RefreshToken.for_user(env["owner"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token}", HTTP_X_TENANT_ID=str(env["tenant_a"].id)
    )

    # Bump 1: PLACED -> PREPARING
    res1 = client.post(f"/api/v1/orders/kds/{order.id}/bump/")
    assert res1.status_code == 200
    assert res1.data["status"] == "PREPARING"

    # Bump 2: PREPARING -> READY
    res2 = client.post(f"/api/v1/orders/kds/{order.id}/bump/")
    assert res2.status_code == 200
    assert res2.data["status"] == "READY"

    # Bump 3: READY -> SERVED
    res3 = client.post(f"/api/v1/orders/kds/{order.id}/bump/")
    assert res3.status_code == 200
    assert res3.data["status"] == "SERVED"


@pytest.mark.django_db
def test_tenant_isolation_on_orders(orders_env):
    """Verifies Tenant B cannot query or bump orders belonging to Tenant A."""
    env = orders_env
    order_a = create_order(
        branch=env["branch_a"],
        table_session=env["session"],
        user_membership=env["m_waiter"],
        items_data=[{"menu_item_id": env["item_curry"].id, "quantity": 1}],
    )

    client = APIClient()
    token_b = str(RefreshToken.for_user(env["user_b"]).access_token)
    client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {token_b}", HTTP_X_TENANT_ID=str(env["tenant_b"].id)
    )

    # Tenant B tries to view Tenant A's orders
    res = client.get("/api/v1/orders/")
    assert res.status_code == 200
    assert len(res.data["results"] if "results" in res.data else res.data) == 0

    # Tenant B tries to bump Tenant A's order -> 404
    bump_res = client.post(f"/api/v1/orders/kds/{order_a.id}/bump/")
    assert bump_res.status_code == 404
