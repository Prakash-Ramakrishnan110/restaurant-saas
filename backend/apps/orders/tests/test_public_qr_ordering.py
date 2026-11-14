import uuid
from concurrent.futures import ThreadPoolExecutor
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
from apps.audit.models import AuditLog
from apps.menu.constants import FoodType
from apps.menu.models import (
    BranchItemAvailability,
    ItemOptionGroup,
    ItemVariant,
    MenuCategory,
    MenuItem,
    Option,
    OptionGroup,
)
from apps.orders.models import Order, OrderPaymentStatus, OrderSource, OrderStatus
from apps.orders.services import create_order
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, BusinessSettings, Tenant
from apps.venues.constants import (
    AreaType,
    PaymentTiming,
    QROrderingMode,
    QRSessionPolicy,
    QRTargetType,
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


def auth_client(user, tenant):
    c = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}", HTTP_X_TENANT_ID=str(tenant.id))
    return c


@pytest.fixture
def qr_ordering_fixture():
    plan = Plan.objects.create(
        name="Pro QR Plan",
        slug="pro-qr-plan",
        price_paise=299900,
        entitlements={"max_branches": 5, "max_tables": 50},
    )
    tenant = Tenant.objects.create(
        name="Kaveri Kitchen", slug="kaveri-qr", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    BusinessSettings.objects.create(
        tenant=tenant, legal_name="Kaveri Kitchen", brand_primary_color="#FF6A00"
    )
    branch = Branch.unscoped.create(tenant=tenant, name="Main Branch", is_active=True)
    caps = BranchCapabilities.objects.create(
        tenant=tenant,
        branch=branch,
        allows_qr_ordering=True,
        qr_ordering_mode=QROrderingMode.ORDER_DIRECT,
        qr_session_policy=QRSessionPolicy.CUSTOMER_CAN_OPEN,
        payment_timing=PaymentTiming.PAY_LATER,
    )
    area = ServiceArea.unscoped.create(
        tenant=tenant, branch=branch, name="Main Hall", area_type=AreaType.DINING
    )
    section = Section.unscoped.create(
        tenant=tenant, branch=branch, service_area=area, name="Indoor"
    )
    table = DiningTable.unscoped.create(
        tenant=tenant, branch=branch, section=section, label="T1", capacity=4
    )
    qr_table = QRCode.unscoped.create(
        tenant=tenant,
        branch=branch,
        target_type=QRTargetType.TABLE,
        table=table,
        public_token=f"tok-table-{uuid.uuid4().hex[:12]}",
        is_active=True,
    )
    counter_area = ServiceArea.unscoped.create(
        tenant=tenant, branch=branch, name="Counter 1", area_type=AreaType.COUNTER
    )
    qr_counter = QRCode.unscoped.create(
        tenant=tenant,
        branch=branch,
        target_type=QRTargetType.COUNTER,
        service_area=counter_area,
        public_token=f"tok-counter-{uuid.uuid4().hex[:12]}",
        is_active=True,
    )

    cat = MenuCategory.objects.create(tenant=tenant, name="South Indian", name_ta="தென்னிந்திய")
    dosa = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Masala Dosa",
        name_ta="மசாலா தோசை",
        base_price_paise=12000,
        food_type=FoodType.VEG,
        is_bestseller=True,
        is_active=True,
    )
    var_ghee = ItemVariant.objects.create(
        item=dosa, name="Ghee Roast", name_ta="நெய் ரோஸ்ட்", price_paise=15000, is_default=False
    )
    opt_group = OptionGroup.objects.create(
        tenant=tenant, name="Chutney", name_ta="சட்னி", min_select=1, max_select=2, is_active=True
    )
    opt_extra = Option.objects.create(
        group=opt_group, name="Extra Sambar", name_ta="எக்ஸ்ட்ரா சாம்பார்", price_delta_paise=2000
    )
    ItemOptionGroup.objects.create(item=dosa, group=opt_group)

    hidden_item = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Secret Chef Item",
        base_price_paise=50000,
        is_active=False,
    )
    soldout_item = MenuItem.objects.create(
        tenant=tenant, category=cat, name="Sold Out Vada", base_price_paise=4000, is_active=True
    )
    BranchItemAvailability.objects.create(
        tenant=tenant, branch=branch, item=soldout_item, is_available=False
    )

    # Foreign tenant
    other_tenant = Tenant.objects.create(
        name="Other Spice", slug="other-qr", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=other_tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    other_cat = MenuCategory.objects.create(tenant=other_tenant, name="Foreign")
    foreign_item = MenuItem.objects.create(
        tenant=other_tenant, category=other_cat, name="Foreign Dish", base_price_paise=9900
    )

    # Staff users
    owner = User.objects.create_user(email="owner@kaveriqr.com", password="Password123!")
    Membership.objects.create(user=owner, tenant=tenant, role=Role.OWNER, is_active=True)

    waiter = User.objects.create_user(email="waiter@kaveriqr.com", password="Password123!")
    Membership.objects.create(user=waiter, tenant=tenant, role=Role.WAITER, is_active=True)

    cashier = User.objects.create_user(email="cashier@kaveriqr.com", password="Password123!")
    Membership.objects.create(user=cashier, tenant=tenant, role=Role.CASHIER, is_active=True)

    kitchen = User.objects.create_user(email="kitchen@kaveriqr.com", password="Password123!")
    Membership.objects.create(user=kitchen, tenant=tenant, role=Role.KITCHEN, is_active=True)

    return {
        "tenant": tenant,
        "branch": branch,
        "caps": caps,
        "table": table,
        "qr_table": qr_table,
        "qr_counter": qr_counter,
        "dosa": dosa,
        "var_ghee": var_ghee,
        "opt_extra": opt_extra,
        "hidden_item": hidden_item,
        "soldout_item": soldout_item,
        "foreign_item": foreign_item,
        "owner": owner,
        "waiter": waiter,
        "cashier": cashier,
        "kitchen": kitchen,
        "cat": cat,
    }


@pytest.mark.django_db
def test_public_menu_etag_and_no_hidden_items(qr_ordering_fixture):
    f = qr_ordering_fixture
    client = APIClient()
    url = f"/api/v1/public/qr/{f['qr_table'].public_token}/menu/"

    res = client.get(url)
    assert res.status_code == status.HTTP_200_OK
    assert "ETag" in res
    assert res.data["display_name"] == "Kaveri Kitchen"
    assert res.data["target_label"] == "T1"
    assert res.data["ordering_mode"] == QROrderingMode.ORDER_DIRECT

    item_names = [it["name"] for cat in res.data["categories"] for it in cat["items"]]
    assert "Masala Dosa" in item_names
    assert "Secret Chef Item" not in item_names
    assert "Foreign Dish" not in item_names

    soldout = next(
        it for cat in res.data["categories"] for it in cat["items"] if it["name"] == "Sold Out Vada"
    )
    assert soldout["is_available"] is False

    # 304 on matching ETag
    res_304 = client.get(url, HTTP_IF_NONE_MATCH=res["ETag"])
    assert res_304.status_code == status.HTTP_304_NOT_MODIFIED


@pytest.mark.django_db
def test_public_menu_query_count_200_items(qr_ordering_fixture):
    f = qr_ordering_fixture
    MenuItem.objects.bulk_create(
        [
            MenuItem(
                tenant=f["tenant"],
                category=f["cat"],
                name=f"Bulk Dish {i}",
                base_price_paise=5000 + i,
                is_active=True,
            )
            for i in range(200)
        ]
    )
    client = APIClient()
    with CaptureQueriesContext(connection) as ctx:
        res = client.get(f"/api/v1/public/qr/{f['qr_table'].public_token}/menu/")
    assert res.status_code == status.HTTP_200_OK
    assert len(ctx) <= 15


@pytest.mark.django_db
def test_server_pricing_wins_and_rejects_tampered_or_foreign(qr_ordering_fixture):
    f = qr_ordering_fixture
    client = APIClient()
    url = f"/api/v1/public/qr/{f['qr_table'].public_token}/orders/"

    # Tampered price ignored; Ghee Roast (15000) + Extra Sambar (2000) * 2 = 34000
    res = client.post(
        url,
        data={
            "items": [
                {
                    "menu_item_id": str(f["dosa"].id),
                    "variant_id": str(f["var_ghee"].id),
                    "option_ids": [str(f["opt_extra"].id)],
                    "quantity": 2,
                    "unit_price_paise": 1,
                    "notes": "<script>alert(1)</script> Less spicy",
                }
            ],
            "notes": "Please serve hot",
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="idem-price-1",
    )
    assert res.status_code == status.HTTP_201_CREATED
    assert res.data["total_paise"] == 34000
    assert res.data["status"] == OrderStatus.PLACED

    # Idempotent retry returns exact same order (200)
    res_retry = client.post(
        url,
        data={"items": [{"menu_item_id": str(f["dosa"].id), "quantity": 2}]},
        format="json",
        HTTP_IDEMPOTENCY_KEY="idem-price-1",
    )
    assert res_retry.status_code == status.HTTP_200_OK
    assert res_retry.data["order_number"] == res.data["order_number"]

    # Foreign tenant item == random UUID (400 INVALID_REFERENCE)
    res_foreign = client.post(
        url,
        data={"items": [{"menu_item_id": str(f["foreign_item"].id), "quantity": 1}]},
        format="json",
        HTTP_IDEMPOTENCY_KEY="idem-foreign-1",
    )
    res_random = client.post(
        url,
        data={"items": [{"menu_item_id": str(uuid.uuid4()), "quantity": 1}]},
        format="json",
        HTTP_IDEMPOTENCY_KEY="idem-random-1",
    )
    assert res_foreign.status_code == status.HTTP_400_BAD_REQUEST
    assert res_random.status_code == status.HTTP_400_BAD_REQUEST
    assert res_foreign.data["error"]["code"] == "INVALID_REFERENCE"
    assert res_random.data["error"]["code"] == "INVALID_REFERENCE"

    # Sold-out & inactive items rejected with ITEM_UNAVAILABLE
    res_soldout = client.post(
        url,
        data={"items": [{"menu_item_id": str(f["soldout_item"].id), "quantity": 1}]},
        format="json",
        HTTP_IDEMPOTENCY_KEY="idem-soldout-1",
    )
    assert res_soldout.status_code == status.HTTP_400_BAD_REQUEST
    assert res_soldout.data["error"]["code"] == "ITEM_UNAVAILABLE"
    assert str(f["soldout_item"].id) in res_soldout.data["error"]["details"]["item_ids"]


@pytest.mark.django_db
def test_modes_staff_policy_approval_reject_and_pay_first(qr_ordering_fixture):
    f = qr_ordering_fixture
    client = APIClient()
    url = f"/api/v1/public/qr/{f['qr_table'].public_token}/orders/"

    # DISABLED & BROWSE_ONLY block ordering
    for mode in (QROrderingMode.DISABLED, QROrderingMode.BROWSE_ONLY):
        f["caps"].qr_ordering_mode = mode
        f["caps"].save()
        r = client.post(
            url,
            data={
                "items": [
                    {
                        "menu_item_id": str(f["dosa"].id),
                        "option_ids": [str(f["opt_extra"].id)],
                        "quantity": 1,
                    }
                ]
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=f"idem-{mode}",
        )
        assert r.status_code == status.HTTP_403_FORBIDDEN

    # STAFF_ONLY blocks when no session is open
    f["caps"].qr_ordering_mode = QROrderingMode.ORDER_WITH_APPROVAL
    f["caps"].qr_session_policy = QRSessionPolicy.STAFF_ONLY
    f["caps"].save()
    r_staff_only = client.post(
        url,
        data={
            "items": [
                {
                    "menu_item_id": str(f["dosa"].id),
                    "option_ids": [str(f["opt_extra"].id)],
                    "quantity": 1,
                }
            ]
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="idem-staff-only",
    )
    assert r_staff_only.status_code == status.HTTP_403_FORBIDDEN
    assert r_staff_only.data["error"]["code"] == "STAFF_ACTION_REQUIRED"

    # Switch back to CUSTOMER_CAN_OPEN + ORDER_WITH_APPROVAL
    f["caps"].qr_session_policy = QRSessionPolicy.CUSTOMER_CAN_OPEN
    f["caps"].save()
    r_pending = client.post(
        url,
        data={
            "items": [
                {
                    "menu_item_id": str(f["dosa"].id),
                    "option_ids": [str(f["opt_extra"].id)],
                    "quantity": 1,
                }
            ]
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="idem-approval-1",
    )
    assert r_pending.status_code == status.HTTP_201_CREATED
    assert r_pending.data["status"] == OrderStatus.PENDING_APPROVAL
    order = Order.unscoped.get(order_number=r_pending.data["order_number"])
    assert order.source == OrderSource.QR

    # Role matrix on approve/reject: kitchen denied (403), waiter allowed (200)
    k_client = auth_client(f["kitchen"], f["tenant"])
    assert (
        k_client.post(f"/api/v1/orders/{order.id}/approve/").status_code
        == status.HTTP_403_FORBIDDEN
    )

    w_client = auth_client(f["waiter"], f["tenant"])
    r_app = w_client.post(f"/api/v1/orders/{order.id}/approve/")
    assert r_app.status_code == status.HTTP_200_OK
    assert r_app.data["status"] == OrderStatus.PLACED
    assert AuditLog.objects.filter(action="order.qr_approved", entity_id=str(order.id)).exists()

    # Reject requires reason
    r_pending2 = client.post(
        url,
        data={
            "items": [
                {
                    "menu_item_id": str(f["dosa"].id),
                    "option_ids": [str(f["opt_extra"].id)],
                    "quantity": 1,
                }
            ]
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="idem-reject-1",
    )
    order2 = Order.unscoped.get(order_number=r_pending2.data["order_number"])
    assert (
        w_client.post(f"/api/v1/orders/{order2.id}/reject/", data={}, format="json").status_code
        == 400
    )
    r_rej = w_client.post(
        f"/api/v1/orders/{order2.id}/reject/", data={"reason": "Out of batter"}, format="json"
    )
    assert r_rej.status_code == status.HTTP_200_OK
    assert r_rej.data["status"] == OrderStatus.CANCELLED
    assert r_rej.data["rejected_reason"] == "Out of batter"
    assert AuditLog.objects.filter(action="order.qr_rejected", entity_id=str(order2.id)).exists()

    # Tracker shows rejection reason & no staff data
    track = client.get(f"/api/v1/public/orders/{order2.tracking_token}/")
    assert track.status_code == status.HTTP_200_OK
    assert track.data["rejected_reason"] == "Out of batter"
    assert "placed_by" not in track.data

    # Pay-first counter flow: AWAITING_PAYMENT -> cashier settles -> PLACED & PAID
    f["caps"].qr_ordering_mode = QROrderingMode.ORDER_DIRECT
    f["caps"].payment_timing = PaymentTiming.PAY_FIRST
    f["caps"].save()
    r_pay = client.post(
        f"/api/v1/public/qr/{f['qr_counter'].public_token}/orders/",
        data={
            "items": [
                {
                    "menu_item_id": str(f["dosa"].id),
                    "option_ids": [str(f["opt_extra"].id)],
                    "quantity": 1,
                }
            ]
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="idem-payfirst-1",
    )
    assert r_pay.status_code == status.HTTP_201_CREATED
    assert r_pay.data["status"] == OrderStatus.AWAITING_PAYMENT
    assert r_pay.data["token_number"] is not None
    pay_order = Order.unscoped.get(order_number=r_pay.data["order_number"])

    c_client = auth_client(f["cashier"], f["tenant"])
    r_settle = c_client.post(
        f"/api/v1/orders/billing/order/{pay_order.id}/settle/",
        data={"payment_method": "CASH"},
        format="json",
    )
    assert r_settle.status_code == status.HTTP_201_CREATED
    pay_order.refresh_from_db()
    assert pay_order.status == OrderStatus.PLACED
    assert pay_order.payment_status == OrderPaymentStatus.PAID


@pytest.mark.django_db
def test_abuse_limits_and_12h_tracking_expiry(qr_ordering_fixture):
    f = qr_ordering_fixture
    client = APIClient()
    url = f"/api/v1/public/qr/{f['qr_table'].public_token}/orders/"

    # Quantity > 10 rejected
    assert (
        client.post(
            url,
            data={
                "items": [
                    {
                        "menu_item_id": str(f["dosa"].id),
                        "option_ids": [str(f["opt_extra"].id)],
                        "quantity": 11,
                    }
                ]
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="idem-qty-11",
        ).status_code
        == 400
    )

    # 31 lines rejected
    assert (
        client.post(
            url,
            data={
                "items": [
                    {
                        "menu_item_id": str(f["dosa"].id),
                        "option_ids": [str(f["opt_extra"].id)],
                        "quantity": 1,
                    }
                    for _ in range(31)
                ]
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY="idem-lines-31",
        ).status_code
        == 400
    )

    # Max 3 open QR orders per table session
    for i in range(3):
        r = client.post(
            url,
            data={
                "items": [
                    {
                        "menu_item_id": str(f["dosa"].id),
                        "option_ids": [str(f["opt_extra"].id)],
                        "quantity": 1,
                    }
                ]
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=f"idem-open-{i}",
        )
        assert r.status_code == 201
    r_4th = client.post(
        url,
        data={
            "items": [
                {
                    "menu_item_id": str(f["dosa"].id),
                    "option_ids": [str(f["opt_extra"].id)],
                    "quantity": 1,
                }
            ]
        },
        format="json",
        HTTP_IDEMPOTENCY_KEY="idem-open-4",
    )
    assert r_4th.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert r_4th.data["error"]["code"] == "TOO_MANY_OPEN_ORDERS"

    # Tracking expires 12h after completion
    o = Order.unscoped.filter(source=OrderSource.QR).first()
    assert o is not None
    o.status = OrderStatus.COMPLETED
    o.completed_at = timezone.now() - timedelta(hours=13)
    o.save()
    assert client.get(f"/api/v1/public/orders/{o.tracking_token}/").status_code == 404


@pytest.mark.django_db(transaction=True)
def test_concurrent_orders_unique_order_numbers(qr_ordering_fixture):
    f = qr_ordering_fixture
    session = TableSession.unscoped.create(
        tenant=f["tenant"], branch=f["branch"], table=f["table"], status=SessionStatus.OPEN
    )

    def place_one(idx: int) -> str:
        try:
            ord_obj = create_order(
                branch=f["branch"],
                items_data=[
                    {
                        "menu_item_id": str(f["dosa"].id),
                        "option_ids": [str(f["opt_extra"].id)],
                        "quantity": 1,
                    }
                ],
                table_session=session,
                source=OrderSource.QR,
            )
            return ord_obj.order_number
        finally:
            connection.close()

    with ThreadPoolExecutor(max_workers=6) as pool:
        numbers = list(pool.map(place_one, range(12)))

    assert len(numbers) == 12
    assert len(set(numbers)) == 12
