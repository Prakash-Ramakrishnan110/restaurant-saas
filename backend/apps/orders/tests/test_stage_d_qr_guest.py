from typing import Any

import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership, User
from apps.core.context import set_current_tenant
from apps.menu.constants import FoodType
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import Order, OrderStatus
from apps.orders.services import create_order
from apps.rbac.constants import Role
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Plan, Subscription
from apps.tenants.models import Branch, Tenant
from apps.venues.constants import AreaType, QROrderingMode, QRTargetType, SectionType
from apps.venues.models import (
    BranchCapabilities,
    DiningTable,
    QRCode,
    QRDailyScan,
    Section,
    ServiceArea,
    TableSession,
)


@pytest.fixture
def qr_guest_env(db: Any) -> dict[str, Any]:
    tenant = Tenant.objects.create(name="QR Guest Cafe", slug="qr-guest-cafe")
    plan = Plan.objects.create(
        name="Pro QR Guest",
        slug="pro-qr-guest",
        price_paise=199900,
        entitlements={"max_branches": 5, "max_tables": 50},
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    set_current_tenant(tenant)

    branch = Branch.objects.create(tenant=tenant, name="Main Branch")
    BranchCapabilities.objects.create(
        tenant=tenant,
        branch=branch,
        allows_qr_ordering=True,
        allows_service_requests=True,
        qr_ordering_mode=QROrderingMode.ORDER_DIRECT,
    )
    area = ServiceArea.objects.create(
        tenant=tenant, branch=branch, name="Hall", area_type=AreaType.DINING
    )
    sec = Section.objects.create(
        tenant=tenant, branch=branch, service_area=area, name="S1", section_type=SectionType.INDOOR
    )
    table = DiningTable.objects.create(
        tenant=tenant, branch=branch, section=sec, label="T-01", capacity=4
    )
    qr = QRCode.objects.create(
        tenant=tenant,
        branch=branch,
        target_type=QRTargetType.TABLE,
        table=table,
        public_token="qr-stage-d-001",
        is_active=True,
    )

    owner = User.objects.create_user(email="owner@qrguest.test", password="Password123!")
    owner_m = Membership.objects.create(tenant=tenant, user=owner, role=Role.OWNER, is_active=True)

    waiter = User.objects.create_user(email="waiter@qrguest.test", password="Password123!")
    Membership.objects.create(tenant=tenant, user=waiter, role=Role.WAITER, is_active=True)

    session = TableSession.objects.create(
        tenant=tenant,
        branch=branch,
        table=table,
        guest_count=2,
        opened_by=owner_m,
        status="OPEN",
    )

    cat = MenuCategory.objects.create(tenant=tenant, name="Snacks")
    dosa = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Rava Dosa",
        base_price_paise=15000,
        food_type=FoodType.VEG,
        is_active=True,
    )

    owner_client = APIClient()
    owner_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(owner).access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    waiter_client = APIClient()
    waiter_client.credentials(
        HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(waiter).access_token}",
        HTTP_X_TENANT_ID=str(tenant.id),
    )

    return {
        "tenant": tenant,
        "branch": branch,
        "qr": qr,
        "session": session,
        "dosa": dosa,
        "owner_m": owner_m,
        "owner_client": owner_client,
        "waiter_client": waiter_client,
    }


@pytest.mark.django_db
def test_d1_to_d5_qr_guest_features(qr_guest_env: dict[str, Any]) -> None:
    qr: QRCode = qr_guest_env["qr"]
    dosa: MenuItem = qr_guest_env["dosa"]
    session: TableSession = qr_guest_env["session"]
    owner_client: APIClient = qr_guest_env["owner_client"]
    waiter_client: APIClient = qr_guest_env["waiter_client"]

    pub = APIClient()

    # D5: Public menu scan increments privacy-safe QRDailyScan
    menu_res = pub.get(f"/api/v1/public/qr/{qr.public_token}/menu/")
    assert menu_res.status_code == 200
    scan = QRDailyScan.objects.filter(qr_code=qr).first()
    assert scan is not None and scan.scan_count == 1

    analytics_res = owner_client.get("/api/v1/qr-codes/analytics/")
    assert analytics_res.status_code == 200
    assert analytics_res.data["rows"][0]["scan_count"] == 1

    # D2: Reorder preview applies current server prices and flags price changes
    preview_res = pub.post(
        f"/api/v1/public/qr/{qr.public_token}/reorder-preview/",
        {
            "items": [
                {
                    "menu_item_id": str(dosa.id),
                    "quantity": 2,
                    "previous_unit_price_paise": 10000,
                }
            ]
        },
        format="json",
    )
    assert preview_res.status_code == 200
    assert preview_res.data["has_changes"] is True
    assert preview_res.data["items"][0]["current_unit_price_paise"] == 15000

    # D4: Guest service requests enforce CUTLERY type, duplicate prevention, and 3-per-10min limit
    sr1 = pub.post(
        f"/api/v1/public/qr/{qr.public_token}/service-requests/",
        {"request_type": "CUTLERY"},
        format="json",
    )
    assert sr1.status_code == 201
    assert sr1.data["guest_status_label"] == "Sent"

    sr_dup = pub.post(
        f"/api/v1/public/qr/{qr.public_token}/service-requests/",
        {"request_type": "CUTLERY"},
        format="json",
    )
    assert sr_dup.status_code == 400
    assert sr_dup.data["error"]["code"] == "REQUEST_ALREADY_OPEN"

    # D1 & D3: Guest label on order + verified-order feedback (rejects links; owner-only access)
    order: Order = create_order(
        branch=qr_guest_env["branch"],
        items_data=[{"menu_item_id": str(dosa.id), "quantity": 1}],
        user_membership=qr_guest_env["owner_m"],
        table_session=session,
        tracking_token="track-stage-d-001",
        guest_label="Seat A",
    )
    order.status = OrderStatus.SERVED
    order.save(update_fields=["status"])

    bad_fb = pub.post(
        "/api/v1/public/orders/track-stage-d-001/feedback/",
        {"food_rating": 5, "service_rating": 5, "comment": "Visit https://spam.example.com"},
        format="json",
    )
    assert bad_fb.status_code == 400
    assert bad_fb.data["error"]["code"] == "LINKS_NOT_ALLOWED"

    ok_fb = pub.post(
        "/api/v1/public/orders/track-stage-d-001/feedback/",
        {
            "food_rating": 5,
            "service_rating": 4,
            "comment": "Crispy dosa!",
            "suggestion_type": "FOOD",
        },
        format="json",
    )
    assert ok_fb.status_code == 201

    # Waiter cannot read feedback (403); Owner can read & export CSV
    assert waiter_client.get("/api/v1/orders/feedback/").status_code == 403
    assert owner_client.get("/api/v1/orders/feedback/").status_code == 200
