import uuid
from typing import Any

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import Membership
from apps.audit.models import AuditLog
from apps.menu.constants import FoodType
from apps.menu.models import MenuCategory, MenuItem
from apps.orders.models import (
    OrderEvent,
    OrderEventType,
    OrderPaymentStatus,
    OrderSource,
    OrderStatus,
    OrderWorkflow,
)
from apps.orders.services import create_order, transition_order_status
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


def _auth_client(user: Any, tenant: Tenant | None = None) -> APIClient:
    c = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    headers: dict[str, str] = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
    if tenant is not None:
        headers["HTTP_X_TENANT_ID"] = str(tenant.id)
    c.credentials(**headers)
    return c


@pytest.fixture
def stage2_fixture(db: Any) -> dict[str, Any]:
    plan = Plan.objects.create(
        name="Stage 2 Plan",
        slug="stage2-plan",
        price_paise=299900,
        entitlements={"max_branches": 5, "max_tables": 50},
    )
    tenant = Tenant.objects.create(
        name="Madras Chai Point", slug="madras-chai-s2", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    BusinessSettings.objects.create(
        tenant=tenant, legal_name="Madras Chai Point", brand_primary_color="#FF6A00"
    )
    branch_a = Branch.unscoped.create(tenant=tenant, name="T. Nagar Counter", is_active=True)
    branch_b = Branch.unscoped.create(tenant=tenant, name="Velachery Counter", is_active=True)
    BranchCapabilities.objects.create(
        tenant=tenant,
        branch=branch_a,
        allows_qr_ordering=True,
        qr_ordering_mode=QROrderingMode.ORDER_DIRECT,
        qr_session_policy=QRSessionPolicy.CUSTOMER_CAN_OPEN,
        payment_timing=PaymentTiming.PAY_LATER,
    )
    qr_a = QRCode.unscoped.create(
        tenant=tenant,
        branch=branch_a,
        target_type="COUNTER",
        public_token=f"tok-tv-a-{uuid.uuid4().hex[:8]}",
        is_active=True,
    )

    area = ServiceArea.unscoped.create(
        tenant=tenant, branch=branch_a, name="Hall", area_type=AreaType.DINING
    )
    sec = Section.unscoped.create(tenant=tenant, branch=branch_a, service_area=area, name="Main")
    tbl = DiningTable.unscoped.create(
        tenant=tenant, branch=branch_a, section=sec, label="T1", capacity=4
    )
    session_a = TableSession.unscoped.create(
        tenant=tenant, branch=branch_a, table=tbl, status=SessionStatus.OPEN
    )

    cat = MenuCategory.objects.create(tenant=tenant, name="Chai & Tiffin")
    item = MenuItem.objects.create(
        tenant=tenant,
        category=cat,
        name="Filter Coffee",
        base_price_paise=4000,
        food_type=FoodType.VEG,
        is_active=True,
    )

    # Foreign restaurant
    other_tenant = Tenant.objects.create(
        name="Other Restaurant", slug="other-s2", status=Tenant.Status.ACTIVE
    )
    Subscription.objects.create(tenant=other_tenant, plan=plan, status=SubscriptionStatus.ACTIVE)
    other_branch = Branch.unscoped.create(tenant=other_tenant, name="Other", is_active=True)
    other_cat = MenuCategory.objects.create(tenant=other_tenant, name="Other Cat")
    other_item = MenuItem.objects.create(
        tenant=other_tenant, category=other_cat, name="Other Tea", base_price_paise=3000
    )

    role_users = {}
    for idx, (role, _) in enumerate(Role.CHOICES):
        u = User.objects.create_user(
            email=f"s2_{idx}_{role.lower()}@madraschai.test",
            password="Password123!",
            full_name=f"Staff {role}",
        )
        Membership.objects.create(user=u, tenant=tenant, role=role, is_active=True)
        role_users[role] = u

    p_admin = User.objects.create_user(
        email="padmin_s2@fusion.in", password="Password123!", is_platform_admin=True
    )

    return {
        "tenant": tenant,
        "branch_a": branch_a,
        "branch_b": branch_b,
        "qr_a": qr_a,
        "session_a": session_a,
        "item": item,
        "other_tenant": other_tenant,
        "other_branch": other_branch,
        "other_item": other_item,
        "role_users": role_users,
        "platform_admin": p_admin,
    }


@pytest.mark.django_db
def test_token_call_role_matrix_isolation_and_audit(stage2_fixture: dict[str, Any]) -> None:
    f = stage2_fixture
    order = create_order(
        branch=f["branch_a"],
        items_data=[{"menu_item_id": str(f["item"].id), "quantity": 1}],
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        source=OrderSource.STAFF,
        initial_status=OrderStatus.PLACED,
        payment_status=OrderPaymentStatus.PAID,
    )
    assert order.token_number == 1

    order2 = create_order(
        branch=f["branch_a"],
        items_data=[{"menu_item_id": str(f["item"].id), "quantity": 2}],
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        source=OrderSource.STAFF,
        initial_status=OrderStatus.PREPARING,
    )
    assert order2.token_number == 2

    url = f"/api/v1/orders/{order.id}/call/"

    # Unauthenticated -> 401
    assert APIClient().post(url, {}, format="json").status_code == status.HTTP_401_UNAUTHORIZED

    # Platform admin & Inventory Manager -> 403
    assert (
        _auth_client(f["platform_admin"]).post(url, {}, format="json").status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        _auth_client(f["role_users"][Role.INVENTORY_MANAGER], f["tenant"])
        .post(url, {}, format="json")
        .status_code
        == status.HTTP_403_FORBIDDEN
    )

    # All 5 operational roles succeed and increment call_count + audit log
    allowed_roles = [
        Role.OWNER,
        Role.BRANCH_MANAGER,
        Role.CASHIER,
        Role.WAITER,
        Role.KITCHEN,
    ]
    for expected_calls, role in enumerate(allowed_roles, start=1):
        res = _auth_client(f["role_users"][role], f["tenant"]).post(url, {}, format="json")
        assert res.status_code == status.HTTP_200_OK, f"Failed for role {role}: {res.data}"
        assert res.data["status"] == OrderStatus.READY
        assert res.data["call_count"] == expected_calls
        assert res.data["last_called_at"] is not None

    order.refresh_from_db()
    assert order.status == OrderStatus.READY
    assert AuditLog.objects.filter(
        tenant=f["tenant"], action="order.token_called", entity_id=str(order.id)
    ).count() == len(allowed_roles)
    assert OrderEvent.unscoped.filter(
        order=order, event_type=OrderEventType.TOKEN_CALLED
    ).count() == len(allowed_roles)

    # Branch isolation: Cashier restricted to branch_a cannot call order on branch_b (404)
    order_b = create_order(
        branch=f["branch_b"],
        items_data=[{"menu_item_id": str(f["item"].id), "quantity": 1}],
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        initial_status=OrderStatus.READY,
    )
    cashier_mem = Membership.objects.get(user=f["role_users"][Role.CASHIER], tenant=f["tenant"])
    cashier_mem.branches.add(f["branch_a"])
    res_other_branch = _auth_client(f["role_users"][Role.CASHIER], f["tenant"]).post(
        f"/api/v1/orders/{order_b.id}/call/", {}, format="json"
    )
    assert res_other_branch.status_code == status.HTTP_404_NOT_FOUND

    # Foreign tenant order ID -> 404
    other_order = create_order(
        branch=f["other_branch"],
        items_data=[{"menu_item_id": str(f["other_item"].id), "quantity": 1}],
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        initial_status=OrderStatus.READY,
    )
    res_foreign = _auth_client(f["role_users"][Role.OWNER], f["tenant"]).post(
        f"/api/v1/orders/{other_order.id}/call/", {}, format="json"
    )
    assert res_foreign.status_code == status.HTTP_404_NOT_FOUND

    # Table order without token -> 400 NO_TOKEN_ASSIGNED
    table_order = create_order(
        branch=f["branch_a"],
        items_data=[{"menu_item_id": str(f["item"].id), "quantity": 1}],
        table_session=f["session_a"],
        order_workflow=OrderWorkflow.TABLE_SERVICE,
    )
    res_no_tok = _auth_client(f["role_users"][Role.OWNER], f["tenant"]).post(
        f"/api/v1/orders/{table_order.id}/call/", {}, format="json"
    )
    assert res_no_tok.status_code == status.HTTP_400_BAD_REQUEST

    # Completed / Cancelled order -> 400 INVALID_ORDER_STATE
    transition_order_status(order, OrderStatus.SERVED)
    transition_order_status(order, OrderStatus.COMPLETED)
    res_completed = _auth_client(f["role_users"][Role.OWNER], f["tenant"]).post(
        url, {}, format="json"
    )
    assert res_completed.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_public_token_tv_zero_pii_isolation_and_query_counts(
    stage2_fixture: dict[str, Any],
) -> None:
    f = stage2_fixture
    anon = APIClient()
    qr: QRCode = f["qr_a"]

    # Create preparing & ready orders with PII notes & guest label that MUST NEVER leak
    prep_order = create_order(
        branch=f["branch_a"],
        items_data=[{"menu_item_id": str(f["item"].id), "quantity": 1}],
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        initial_status=OrderStatus.PREPARING,
        notes="VIP phone 9988776655 allergen note",
        guest_label="Arjun Private",
    )
    ready_order = create_order(
        branch=f["branch_a"],
        items_data=[{"menu_item_id": str(f["item"].id), "quantity": 1}],
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        initial_status=OrderStatus.PLACED,
        notes="Secret kitchen note",
        guest_label="Priya Private",
    )
    # Branch B order & foreign restaurant order MUST NEVER show up on Branch A TV
    create_order(
        branch=f["branch_b"],
        items_data=[{"menu_item_id": str(f["item"].id), "quantity": 1}],
        token_number=999,
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        initial_status=OrderStatus.READY,
    )
    create_order(
        branch=f["other_branch"],
        items_data=[{"menu_item_id": str(f["other_item"].id), "quantity": 1}],
        token_number=888,
        order_workflow=OrderWorkflow.COUNTER_TOKEN,
        initial_status=OrderStatus.READY,
    )

    transition_order_status(ready_order, OrderStatus.PREPARING)
    transition_order_status(ready_order, OrderStatus.READY)

    tv_url = f"/api/v1/public/tv/{qr.public_token}/"
    res = anon.get(tv_url)
    assert res.status_code == status.HTTP_200_OK
    assert res.data["display_name"] == "Madras Chai Point"
    assert res.data["branch_name"] == "T. Nagar Counter"
    assert res.data["now_calling"]["token_number"] == ready_order.token_number
    assert [t["token_number"] for t in res.data["ready_tokens"]] == [ready_order.token_number]
    assert [t["token_number"] for t in res.data["preparing_tokens"]] == [prep_order.token_number]

    raw_payload = str(res.data)
    assert "9988776655" not in raw_payload
    assert "Arjun Private" not in raw_payload
    assert "Priya Private" not in raw_payload
    assert "Secret kitchen note" not in raw_payload
    assert "999" not in raw_payload
    assert "888" not in raw_payload
    assert "cgst" not in raw_payload.lower()

    # Invalid / >64 chars / deactivated QR / suspended tenant -> identical generic 404
    assert anon.get("/api/v1/public/tv/not-found-tok/").status_code == 404
    assert anon.get(f"/api/v1/public/tv/{'x' * 70}/").status_code == 404

    qr.is_active = False
    qr.save(update_fields=["is_active"])
    assert anon.get(tv_url).status_code == 404
    qr.is_active = True
    qr.save(update_fields=["is_active"])

    f["tenant"].status = Tenant.Status.SUSPENDED
    f["tenant"].save(update_fields=["status"])
    assert anon.get(tv_url).status_code == 404
    f["tenant"].status = Tenant.Status.ACTIVE
    f["tenant"].save(update_fields=["status"])

    # Query count check (O(1) regardless of token count)
    for _ in range(10):
        create_order(
            branch=f["branch_a"],
            items_data=[{"menu_item_id": str(f["item"].id), "quantity": 1}],
            order_workflow=OrderWorkflow.COUNTER_TOKEN,
            initial_status=OrderStatus.PREPARING,
        )
    with CaptureQueriesContext(connection) as ctx:
        res_many = anon.get(tv_url)
        assert res_many.status_code == 200
    assert len(ctx) <= 5
