import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.menu.constants import FoodType
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import OrderPaymentStatus, OrderSource, OrderStatus, OrderWorkflow
from apps.orders.services import (
    create_order,
    settle_bill,
    settle_order_bill,
    transition_order_status,
)
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, BusinessSettings, Tenant
from apps.venues.constants import (
    AreaType,
    PaymentTiming,
    QROrderingMode,
    QRSessionPolicy,
    SessionStatus,
)
from apps.venues.models import (
    BranchCapabilities,
    DiningTable,
    QRCode,
    Section,
    ServiceArea,
    TableSession,
)

User = get_user_model()


def _auth_client(user, tenant=None):
    c = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
    if tenant is not None:
        headers["HTTP_X_TENANT_ID"] = str(tenant.id)
    c.credentials(**headers)
    return c


@pytest.fixture
def stage1_fixture():
    plan = Plan.objects.create(
        name="Stage 1 Plan",
        slug="stage1-plan",
        price_paise=299900,
        entitlements={"max_branches": 5, "max_tables": 50},
    )
    tenant = Tenant.objects.create(
        name="Saravana Cafe", slug="saravana-stage1", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    BusinessSettings.objects.create(
        tenant=tenant, legal_name="Saravana Cafe", brand_primary_color="#FF6A00"
    )
    branch = Branch.unscoped.create(tenant=tenant, name="T. Nagar", is_active=True)
    BranchCapabilities.objects.create(
        tenant=tenant,
        branch=branch,
        allows_qr_ordering=True,
        qr_ordering_mode=QROrderingMode.ORDER_DIRECT,
        qr_session_policy=QRSessionPolicy.CUSTOMER_CAN_OPEN,
        payment_timing=PaymentTiming.PAY_LATER,
    )
    dining_area = ServiceArea.unscoped.create(
        tenant=tenant, branch=branch, name="Main Hall", area_type=AreaType.DINING
    )
    section = Section.unscoped.create(
        tenant=tenant, branch=branch, service_area=dining_area, name="Ground"
    )
    table = DiningTable.unscoped.create(
        tenant=tenant, branch=branch, section=section, label="T1", capacity=4
    )
    qr_counter = QRCode.unscoped.create(
        tenant=tenant,
        branch=branch,
        target_type="COUNTER",
        public_token=f"tok-s1-cnt-{uuid.uuid4().hex[:10]}",
        is_active=True,
    )

    cat = MenuCategory.objects.create(tenant=tenant, name="Tiffin")
    items = [
        MenuItem.objects.create(
            tenant=tenant,
            category=cat,
            name=f"Dish {i}",
            base_price_paise=8000 + i * 500,
            food_type=FoodType.VEG,
            is_active=True,
        )
        for i in range(4)
    ]

    # Foreign tenant + branch
    other_tenant = Tenant.objects.create(
        name="Other Cafe", slug="other-stage1", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=other_tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    other_branch = Branch.unscoped.create(tenant=other_tenant, name="Other Branch", is_active=True)
    other_area = ServiceArea.unscoped.create(
        tenant=other_tenant, branch=other_branch, name="Hall", area_type=AreaType.DINING
    )
    other_sec = Section.unscoped.create(
        tenant=other_tenant, branch=other_branch, service_area=other_area, name="S1"
    )
    other_table = DiningTable.unscoped.create(
        tenant=other_tenant, branch=other_branch, section=other_sec, label="O1", capacity=2
    )
    other_session = TableSession.unscoped.create(
        tenant=other_tenant, branch=other_branch, table=other_table, status=SessionStatus.OPEN
    )
    other_cat = MenuCategory.objects.create(tenant=other_tenant, name="Other Cat")
    other_item = MenuItem.objects.create(
        tenant=other_tenant, category=other_cat, name="Other Dish", base_price_paise=10000
    )

    # All 6 tenant roles + platform admin
    role_users = {}
    for idx, (role, _) in enumerate(Role.CHOICES):
        u = User.objects.create_user(
            email=f"role_{idx}_{role.lower()}@saravana.com",
            password="Password123!",
            full_name=f"Staff {role}",
        )
        Membership.objects.create(user=u, tenant=tenant, role=role, is_active=True)
        role_users[role] = u

    p_admin = User.objects.create_user(
        email="padmin@fusion.in", password="Password123!", is_platform_admin=True
    )

    return {
        "tenant": tenant,
        "branch": branch,
        "table": table,
        "qr_counter": qr_counter,
        "items": items,
        "other_tenant": other_tenant,
        "other_branch": other_branch,
        "other_session": other_session,
        "other_item": other_item,
        "role_users": role_users,
        "platform_admin": p_admin,
    }


@pytest.mark.django_db
def test_receipt_gated_until_payment_and_role_matrix(stage1_fixture):
    f = stage1_fixture
    session = TableSession.unscoped.create(
        tenant=f["tenant"], branch=f["branch"], table=f["table"], status=SessionStatus.OPEN
    )
    order = create_order(
        branch=f["branch"],
        items_data=[{"menu_item_id": str(f["items"][0].id), "quantity": 2, "notes": "Extra hot"}],
        table_session=session,
        notes="[PARCEL] Guest phone 9876543210",
        source=OrderSource.QR,
        initial_status=OrderStatus.PLACED,
        payment_status=OrderPaymentStatus.UNPAID,
        tracking_token=f"trk-s1-{uuid.uuid4().hex[:12]}",
        guest_label="Customer Priya",
    )

    anon = APIClient()
    # Tracker shows show_bill=False and pickup_code=None while unpaid & PLACED
    tr_unpaid = anon.get(f"/api/v1/public/orders/{order.tracking_token}/")
    assert tr_unpaid.status_code == status.HTTP_200_OK
    assert tr_unpaid.data["show_bill"] is False
    assert tr_unpaid.data["pickup_code"] is None

    # Receipt endpoint MUST block with 403 BILL_NOT_PAID for anonymous and all 6 roles
    receipt_url = f"/api/v1/public/orders/{order.tracking_token}/receipt/"
    res_unpaid = anon.get(receipt_url)
    assert res_unpaid.status_code == status.HTTP_403_FORBIDDEN
    assert res_unpaid.data["error"]["code"] == "BILL_NOT_PAID"

    for role, u in f["role_users"].items():
        r_role = _auth_client(u, f["tenant"]).get(receipt_url)
        assert r_role.status_code == status.HTTP_403_FORBIDDEN, f"Failed for role {role}"

    # Transition to READY -> pickup_code unlocks for [PARCEL] order, receipt still blocked
    cashier_m = Membership.objects.get(user=f["role_users"][Role.CASHIER], tenant=f["tenant"])
    transition_order_status(order, OrderStatus.PREPARING, user_membership=cashier_m)
    transition_order_status(order, OrderStatus.READY, user_membership=cashier_m)
    tr_ready = anon.get(f"/api/v1/public/orders/{order.tracking_token}/")
    assert tr_ready.status_code == status.HTTP_200_OK
    assert tr_ready.data["pickup_code"] is not None
    assert len(tr_ready.data["pickup_code"]) == 4
    assert tr_ready.data["show_bill"] is False

    # Even when SERVED, still unpaid -> 403
    transition_order_status(order, OrderStatus.SERVED, user_membership=cashier_m)
    assert anon.get(receipt_url).status_code == status.HTTP_403_FORBIDDEN

    # Cashier settles bill -> show_bill=True & receipt 200 with DEMO notice, no PII/notes/tax
    invoice = settle_bill(session, payment_method="UPI", user_membership=cashier_m)
    tr_paid = anon.get(f"/api/v1/public/orders/{order.tracking_token}/")
    assert tr_paid.status_code == status.HTTP_200_OK
    assert tr_paid.data["show_bill"] is True

    res_paid = anon.get(receipt_url)
    assert res_paid.status_code == status.HTTP_200_OK
    assert res_paid.data["demo_notice"] == "DEMO RECEIPT - NOT A TAX INVOICE"
    assert res_paid.data["invoice_number"] == invoice.invoice_number
    assert res_paid.data["payment_method"] == "UPI"
    assert res_paid.data["total_paise"] == 16000
    assert isinstance(res_paid.data["total_paise"], int)

    # Verify zero tax keys, zero staff names, zero customer PII, zero notes
    serialized_str = str(res_paid.data)
    assert "Priya" not in serialized_str
    assert "9876543210" not in serialized_str
    assert "Staff CASHIER" not in serialized_str
    assert "Extra hot" not in serialized_str
    assert "cgst" not in serialized_str.lower()
    assert "sgst" not in serialized_str.lower()

    # All 6 roles + platform_admin get 200 on valid paid receipt URL
    for role, u in f["role_users"].items():
        r_ok = _auth_client(u, f["tenant"]).get(receipt_url)
        assert r_ok.status_code == status.HTTP_200_OK, f"Failed paid receipt for {role}"
    assert _auth_client(f["platform_admin"]).get(receipt_url).status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_counter_pickup_code_and_pay_first_settlement(stage1_fixture):
    f = stage1_fixture
    counter_order = create_order(
        branch=f["branch"],
        items_data=[{"menu_item_id": str(f["items"][0].id), "quantity": 1}],
        token_number=42,
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        source=OrderSource.QR,
        initial_status=OrderStatus.AWAITING_PAYMENT,
        payment_status=OrderPaymentStatus.UNPAID,
        tracking_token=f"trk-cnt-{uuid.uuid4().hex[:12]}",
    )

    anon = APIClient()
    # Unpaid PAY_FIRST counter order
    assert (
        anon.get(f"/api/v1/public/orders/{counter_order.tracking_token}/receipt/").status_code
        == status.HTTP_403_FORBIDDEN
    )

    # Settle counter order (PAY_FIRST): payment_status becomes PAID, status -> PLACED
    cashier_m = Membership.objects.get(user=f["role_users"][Role.CASHIER], tenant=f["tenant"])
    settle_order_bill(counter_order, payment_method="CASH", user_membership=cashier_m)
    counter_order.refresh_from_db()
    assert counter_order.payment_status == OrderPaymentStatus.PAID
    assert counter_order.status == OrderStatus.PLACED

    # Receipt is now accessible immediately after PAY_FIRST payment
    res = anon.get(f"/api/v1/public/orders/{counter_order.tracking_token}/receipt/")
    assert res.status_code == status.HTTP_200_OK
    assert res.data["demo_notice"] == "DEMO RECEIPT - NOT A TAX INVOICE"

    # Pickup code still hidden until READY
    tr1 = anon.get(f"/api/v1/public/orders/{counter_order.tracking_token}/")
    assert tr1.data["pickup_code"] is None

    transition_order_status(counter_order, OrderStatus.PREPARING, user_membership=cashier_m)
    transition_order_status(counter_order, OrderStatus.READY, user_membership=cashier_m)
    tr2 = anon.get(f"/api/v1/public/orders/{counter_order.tracking_token}/")
    assert tr2.data["pickup_code"] is not None
    assert tr2.data["order_workflow"] == OrderWorkflow.COUNTER_TOKEN


@pytest.mark.django_db
def test_receipt_isolation_generic_404_and_query_counts(stage1_fixture):
    f = stage1_fixture
    anon = APIClient()

    # Invalid, oversized (>64 chars), random UUID -> identical generic 404
    r_bad = anon.get("/api/v1/public/orders/does-not-exist/receipt/")
    r_uuid = anon.get(f"/api/v1/public/orders/{uuid.uuid4()}/receipt/")
    r_long = anon.get(f"/api/v1/public/orders/{'a' * 80}/receipt/")
    assert r_bad.status_code == 404
    assert r_uuid.status_code == 404
    assert r_long.status_code == 404

    # Foreign restaurant order: suspended tenant -> 404 on receipt
    other_order = create_order(
        branch=f["other_branch"],
        items_data=[{"menu_item_id": str(f["other_item"].id), "quantity": 1}],
        table_session=f["other_session"],
        source=OrderSource.QR,
        initial_status=OrderStatus.COMPLETED,
        payment_status=OrderPaymentStatus.PAID,
        tracking_token=f"trk-other-{uuid.uuid4().hex[:12]}",
    )
    f["other_tenant"].status = Tenant.Status.SUSPENDED
    f["other_tenant"].save()
    assert (
        anon.get(f"/api/v1/public/orders/{other_order.tracking_token}/receipt/").status_code == 404
    )
    f["other_tenant"].status = Tenant.Status.ACTIVE
    f["other_tenant"].save()

    # Expired (>12h completed) -> 404
    other_order.completed_at = timezone.now() - timedelta(hours=13)
    other_order.save()
    assert (
        anon.get(f"/api/v1/public/orders/{other_order.tracking_token}/receipt/").status_code == 404
    )

    # Query count test (O(1) queries regardless of item count)
    session = TableSession.unscoped.create(
        tenant=f["tenant"], branch=f["branch"], table=f["table"], status=SessionStatus.OPEN
    )
    multi_order = create_order(
        branch=f["branch"],
        items_data=[{"menu_item_id": str(it.id), "quantity": 1} for it in f["items"]],
        table_session=session,
        source=OrderSource.QR,
        initial_status=OrderStatus.PLACED,
        payment_status=OrderPaymentStatus.PAID,
        tracking_token=f"trk-qcnt-{uuid.uuid4().hex[:12]}",
    )
    with CaptureQueriesContext(connection) as ctx_track:
        r_tr = anon.get(f"/api/v1/public/orders/{multi_order.tracking_token}/")
        assert r_tr.status_code == 200
    assert len(ctx_track) <= 5

    with CaptureQueriesContext(connection) as ctx_rcpt:
        r_rcpt = anon.get(f"/api/v1/public/orders/{multi_order.tracking_token}/receipt/")
        assert r_rcpt.status_code == 200
    assert len(ctx_rcpt) <= 5
