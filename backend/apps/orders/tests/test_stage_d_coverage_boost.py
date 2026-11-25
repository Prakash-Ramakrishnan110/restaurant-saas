import uuid
from datetime import timedelta
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.core.context import set_current_tenant
from apps.menu.constants import FoodType
from apps.menu.models import (
    BranchItemAvailability,
    ItemVariant,
    MenuCategory,
    MenuItem,
    Option,
    OptionGroup,
)
from apps.orders.models import OrderFeedback, OrderPaymentStatus, OrderSource, OrderStatus
from apps.orders.services import create_order
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
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


def _auth_client(user: Any, tenant: Tenant) -> APIClient:
    c = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {token}", HTTP_X_TENANT_ID=str(tenant.id))
    return c


@pytest.fixture
def stage_d_cov_env(db: Any) -> dict[str, Any]:
    plan = Plan.objects.create(
        name="Cov Orders Plan",
        slug="cov-orders-plan",
        price_paise=199900,
        entitlements={"max_branches": 5, "max_tables": 50},
    )
    tenant = Tenant.objects.create(
        name="Kaveri Boost", slug="kaveri-boost", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    set_current_tenant(tenant)

    branch = Branch.unscoped.create(tenant=tenant, name="Main", is_active=True)
    caps = BranchCapabilities.objects.create(
        tenant=tenant,
        branch=branch,
        allows_qr_ordering=True,
        allows_service_requests=True,
        qr_ordering_mode=QROrderingMode.ORDER_DIRECT,
        qr_session_policy=QRSessionPolicy.CUSTOMER_CAN_OPEN,
        payment_timing=PaymentTiming.PAY_LATER,
    )
    area = ServiceArea.unscoped.create(
        tenant=tenant, branch=branch, name="Hall", area_type=AreaType.DINING
    )
    sec = Section.unscoped.create(tenant=tenant, branch=branch, service_area=area, name="S1")
    table = DiningTable.unscoped.create(
        tenant=tenant, branch=branch, section=sec, label="T9", capacity=4
    )
    session = TableSession.unscoped.create(
        tenant=tenant, branch=branch, table=table, status=SessionStatus.OPEN
    )
    qr = QRCode.unscoped.create(
        tenant=tenant,
        branch=branch,
        table=table,
        target_type="TABLE",
        public_token=f"tok-dcov-{uuid.uuid4().hex[:8]}",
        is_active=True,
    )

    cat = MenuCategory.objects.create(tenant=tenant, name="Tiffin")
    item_ok = MenuItem.objects.create(
        tenant=tenant, category=cat, name="Idli", base_price_paise=5000, food_type=FoodType.VEG
    )
    variant = ItemVariant.objects.create(item=item_ok, name="Large", price_paise=7000)
    ogroup = OptionGroup.objects.create(tenant=tenant, name="Extras")
    option = Option.objects.create(group=ogroup, name="Ghee", price_delta_paise=2000)

    item_off = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="SoldOut Vada",
        base_price_paise=4000,
        food_type=FoodType.VEG,
    )
    BranchItemAvailability.objects.create(
        tenant=tenant, branch=branch, item=item_off, is_available=False
    )

    owner = User.objects.create_user(email="owner@dcov.test", password="Password123!")
    Membership.objects.create(tenant=tenant, user=owner, role=Role.OWNER, is_active=True)

    cashier = User.objects.create_user(email="cashier@dcov.test", password="Password123!")
    Membership.objects.create(tenant=tenant, user=cashier, role=Role.CASHIER, is_active=True)

    return {
        "tenant": tenant,
        "branch": branch,
        "caps": caps,
        "table": table,
        "session": session,
        "qr": qr,
        "item_ok": item_ok,
        "item_off": item_off,
        "variant": variant,
        "option": option,
        "owner": owner,
        "cashier": cashier,
    }


@pytest.mark.django_db
def test_public_reorder_preview_and_service_requests(stage_d_cov_env: dict[str, Any]) -> None:
    f = stage_d_cov_env
    qr: QRCode = f["qr"]
    anon = APIClient()

    # Reorder preview empty items -> 400
    assert (
        anon.post(
            f"/api/v1/public/qr/{qr.public_token}/reorder-preview/", {"items": []}, format="json"
        ).status_code
        == 400
    )

    # Reorder preview with valid, changed-price, missing variant, and sold-out items
    res = anon.post(
        f"/api/v1/public/qr/{qr.public_token}/reorder-preview/",
        {
            "items": [
                {
                    "menu_item_id": str(f["item_ok"].id),
                    "variant_id": str(f["variant"].id),
                    "option_ids": [str(f["option"].id)],
                    "quantity": 2,
                    "previous_unit_price_paise": 5000,
                },
                {
                    "menu_item_id": str(f["item_ok"].id),
                    "variant_id": str(uuid.uuid4()),
                    "quantity": 1,
                },
                {
                    "menu_item_id": str(f["item_off"].id),
                    "quantity": 1,
                },
            ]
        },
        format="json",
    )
    assert res.status_code == 200
    assert res.data["has_changes"] is True
    assert res.data["items"][0]["price_changed"] is True
    assert res.data["items"][0]["current_unit_price_paise"] == 9000
    assert res.data["items"][1]["reason"] == "VARIANT_UNAVAILABLE"
    assert res.data["items"][2]["reason"] == "SOLD_OUT_OR_REMOVED"

    # Service request GET + POST lifecycle & error paths
    srv_url = f"/api/v1/public/qr/{qr.public_token}/service-requests/"
    assert anon.get(srv_url).status_code == 200
    assert anon.post(srv_url, {"request_type": "INVALID"}, format="json").status_code == 400

    assert anon.post(srv_url, {"request_type": "WATER"}, format="json").status_code == 201
    # Duplicate open request of same type -> 400 REQUEST_ALREADY_OPEN
    assert anon.post(srv_url, {"request_type": "WATER"}, format="json").status_code == 400

    # Rate limit after 3 requests per 10 mins
    assert anon.post(srv_url, {"request_type": "BILL"}, format="json").status_code == 201
    assert anon.post(srv_url, {"request_type": "CUTLERY"}, format="json").status_code == 201
    assert anon.post(srv_url, {"request_type": "CALL_WAITER"}, format="json").status_code == 429

    listed = anon.get(srv_url)
    assert listed.status_code == 200 and len(listed.data) == 3

    # Disabled service requests -> 403
    f["caps"].allows_service_requests = False
    f["caps"].save(update_fields=["allows_service_requests"])
    assert anon.post(srv_url, {"request_type": "WATER"}, format="json").status_code == 403


@pytest.mark.django_db
def test_public_feedback_and_owner_feedback_inbox_export(stage_d_cov_env: dict[str, Any]) -> None:
    f = stage_d_cov_env
    anon = APIClient()

    order_placed = create_order(
        branch=f["branch"],
        items_data=[{"menu_item_id": str(f["item_ok"].id), "quantity": 1}],
        table_session=f["session"],
        source=OrderSource.QR,
        initial_status=OrderStatus.PLACED,
        payment_status=OrderPaymentStatus.UNPAID,
        tracking_token=f"trk-pl-{uuid.uuid4().hex[:10]}",
    )
    order_served = create_order(
        branch=f["branch"],
        items_data=[{"menu_item_id": str(f["item_ok"].id), "quantity": 1}],
        table_session=f["session"],
        source=OrderSource.QR,
        initial_status=OrderStatus.SERVED,
        payment_status=OrderPaymentStatus.PAID,
        tracking_token=f"trk-sv-{uuid.uuid4().hex[:10]}",
    )

    # Honeypot, 404, ineligible order, invalid rating, link blocked, valid submission, duplicate
    assert (
        anon.post(
            f"/api/v1/public/orders/{order_served.tracking_token}/feedback/",
            {"website": "spam.com"},
            format="json",
        ).status_code
        == 400
    )
    assert (
        anon.post(
            "/api/v1/public/orders/missing-token/feedback/",
            {"food_rating": 5, "service_rating": 5},
            format="json",
        ).status_code
        == 404
    )
    assert (
        anon.post(
            f"/api/v1/public/orders/{order_placed.tracking_token}/feedback/",
            {"food_rating": 5, "service_rating": 5},
            format="json",
        ).status_code
        == 400
    )
    assert (
        anon.post(
            f"/api/v1/public/orders/{order_served.tracking_token}/feedback/",
            {"food_rating": 6, "service_rating": 5},
            format="json",
        ).status_code
        == 400
    )
    assert (
        anon.post(
            f"/api/v1/public/orders/{order_served.tracking_token}/feedback/",
            {"food_rating": 5, "service_rating": 5, "comment": "Visit https://evil.com"},
            format="json",
        ).status_code
        == 400
    )

    ok_fb = anon.post(
        f"/api/v1/public/orders/{order_served.tracking_token}/feedback/",
        {"food_rating": 5, "service_rating": 4, "comment": "=Tasty idli!"},
        format="json",
    )
    assert ok_fb.status_code == status.HTTP_201_CREATED
    assert (
        anon.post(
            f"/api/v1/public/orders/{order_served.tracking_token}/feedback/",
            {"food_rating": 5, "service_rating": 5},
            format="json",
        ).status_code
        == 400
    )

    # Expired window -> 400
    old_order = create_order(
        branch=f["branch"],
        items_data=[{"menu_item_id": str(f["item_ok"].id), "quantity": 1}],
        table_session=f["session"],
        source=OrderSource.QR,
        initial_status=OrderStatus.COMPLETED,
        payment_status=OrderPaymentStatus.PAID,
        tracking_token=f"trk-old-{uuid.uuid4().hex[:10]}",
    )
    old_order.completed_at = timezone.now() - timedelta(hours=30)
    old_order.save(update_fields=["completed_at"])
    assert (
        anon.post(
            f"/api/v1/public/orders/{old_order.tracking_token}/feedback/",
            {"food_rating": 5, "service_rating": 5},
            format="json",
        ).status_code
        == 400
    )

    # Owner feedback inbox + filter + moderate + CSV export (and Cashier 403)
    owner_client = _auth_client(f["owner"], f["tenant"])
    cashier_client = _auth_client(f["cashier"], f["tenant"])

    assert cashier_client.get("/api/v1/orders/feedback/").status_code == 403
    res_list = owner_client.get("/api/v1/orders/feedback/?rating=5&unanswered=true")
    assert res_list.status_code == 200

    fb_id = ok_fb.data["id"]
    res_mod = owner_client.post(
        f"/api/v1/orders/feedback/{fb_id}/moderate/",
        {"is_resolved": True, "is_hidden": False, "owner_note": "Thanked guest"},
        format="json",
    )
    assert res_mod.status_code == 200
    assert OrderFeedback.objects.get(id=fb_id).is_resolved is True

    res_csv = owner_client.get("/api/v1/orders/feedback/export-csv/")
    assert res_csv.status_code == 200
    assert "'=Tasty idli!" in res_csv.content.decode("utf-8")
